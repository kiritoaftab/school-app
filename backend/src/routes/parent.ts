import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, HttpError } from '../lib/http.js';
import { requireAuth, requireRole, requireSchoolId } from '../middleware/auth.js';
import { assertParentOwnsStudent, studentClassId } from '../lib/access.js';

export const parentRouter = Router();
parentRouter.use(requireAuth, requireRole('PARENT'));

// --- Students (children) ---
parentRouter.get(
  '/me/students',
  ah(async (req, res) => {
    const { userId } = req.auth!;
    const links = await prisma.parentStudentLink.findMany({
      where: { parentUserId: userId },
      include: { student: { include: { enrollments: { include: { klass: true } } } } },
    });
    res.json(
      links.map((l) => {
        const enr = l.student.enrollments.at(-1);
        return {
          id: l.student.id,
          name: l.student.name,
          admissionNo: l.student.admissionNo,
          relation: l.relation,
          klass: enr ? `${enr.klass.grade}-${enr.klass.section}` : null,
        };
      }),
    );
  }),
);

// --- Attendance (monthly) ---
parentRouter.get(
  '/students/:id/attendance',
  ah(async (req, res) => {
    const { userId } = req.auth!;
    const schoolId = requireSchoolId(req);
    const studentId = Number(req.params.id);
    await assertParentOwnsStudent(userId, schoolId, studentId);

    const month = String(req.query.month ?? ''); // YYYY-MM
    const base = /^\d{4}-\d{2}$/.test(month) ? new Date(`${month}-01`) : new Date();
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 1);

    const records = await prisma.attendance.findMany({
      where: { studentId, date: { gte: start, lt: end } },
      orderBy: { date: 'asc' },
    });

    const present = records.filter((r) => r.status === 'PRESENT').length;
    const absent = records.filter((r) => r.status === 'ABSENT').length;
    const late = records.filter((r) => r.status === 'LATE').length;
    const counted = present + absent + late;

    res.json({
      month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      present,
      absent,
      late,
      percent: counted ? Math.round((present / counted) * 100) : 0,
      days: records.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        status: r.status,
      })),
    });
  }),
);

// today's status across all children (home dashboard)
parentRouter.get(
  '/me/today',
  ah(async (req, res) => {
    const { userId } = req.auth!;
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const links = await prisma.parentStudentLink.findMany({
      where: { parentUserId: userId },
      include: { student: true },
    });
    const result = await Promise.all(
      links.map(async (l) => {
        const rec = await prisma.attendance.findFirst({
          where: { studentId: l.studentId, date: { gte: start, lt: end } },
        });
        return { studentId: l.studentId, name: l.student.name, status: rec?.status ?? null };
      }),
    );
    res.json(result);
  }),
);

// --- Notices ---
parentRouter.get(
  '/notices',
  ah(async (req, res) => {
    const { userId } = req.auth!;
    const schoolId = requireSchoolId(req);
    const notices = await prisma.notice.findMany({
      where: { schoolId },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      include: { _count: { select: { acks: true } }, acks: { where: { parentUserId: userId } } },
    });
    const totalParents = await prisma.user.count({ where: { schoolId, role: 'PARENT' } });
    res.json(
      notices.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        preview: n.body.replace(/\s+/g, ' ').trim().slice(0, 140),
        category: n.category,
        pinned: n.pinned,
        createdAt: n.createdAt,
        acked: n.acks.length > 0,
        ackCount: n._count.acks,
        totalParents,
      })),
    );
  }),
);

parentRouter.get(
  '/notices/:id',
  ah(async (req, res) => {
    const { userId } = req.auth!;
    const schoolId = requireSchoolId(req);
    const notice = await prisma.notice.findFirst({
      where: { id: Number(req.params.id), schoolId },
      include: { _count: { select: { acks: true } }, acks: { where: { parentUserId: userId } } },
    });
    if (!notice) throw new HttpError(404, 'Notice not found');
    const totalParents = await prisma.user.count({ where: { schoolId, role: 'PARENT' } });
    res.json({
      id: notice.id,
      title: notice.title,
      body: notice.body,
      category: notice.category,
      pinned: notice.pinned,
      createdAt: notice.createdAt,
      acked: notice.acks.length > 0,
      ackCount: notice._count.acks,
      totalParents,
    });
  }),
);

parentRouter.post(
  '/notices/:id/ack',
  ah(async (req, res) => {
    const { userId } = req.auth!;
    const schoolId = requireSchoolId(req);
    const noticeId = Number(req.params.id);
    const notice = await prisma.notice.findFirst({ where: { id: noticeId, schoolId } });
    if (!notice) throw new HttpError(404, 'Notice not found');
    await prisma.noticeAck.upsert({
      where: { noticeId_parentUserId: { noticeId, parentUserId: userId } },
      create: { noticeId, parentUserId: userId },
      update: {},
    });
    res.json({ ok: true });
  }),
);

// --- Diary / homework ---
parentRouter.get(
  '/students/:id/diary',
  ah(async (req, res) => {
    const { userId } = req.auth!;
    const schoolId = requireSchoolId(req);
    const studentId = Number(req.params.id);
    await assertParentOwnsStudent(userId, schoolId, studentId);
    const klassId = await studentClassId(studentId);
    if (!klassId) return res.json([]);

    const entries = await prisma.diaryEntry.findMany({
      where: { klassId },
      orderBy: { date: 'desc' },
      take: 60,
      include: { done: { where: { studentId } } },
    });
    res.json(
      entries.map((e) => ({
        id: e.id,
        subject: e.subject,
        date: e.date.toISOString().slice(0, 10),
        task: e.task,
        note: e.note,
        done: e.done.length > 0,
      })),
    );
  }),
);

const diaryDoneSchema = z.object({ studentId: z.number(), done: z.boolean() });
parentRouter.post(
  '/diary/:entryId/done',
  ah(async (req, res) => {
    const { userId } = req.auth!;
    const schoolId = requireSchoolId(req);
    const { studentId, done } = diaryDoneSchema.parse(req.body);
    await assertParentOwnsStudent(userId, schoolId, studentId);
    const entryId = Number(req.params.entryId);

    if (done) {
      await prisma.diaryDone.upsert({
        where: { diaryEntryId_studentId: { diaryEntryId: entryId, studentId } },
        create: { diaryEntryId: entryId, studentId, parentUserId: userId },
        update: {},
      });
    } else {
      await prisma.diaryDone.deleteMany({ where: { diaryEntryId: entryId, studentId } });
    }
    res.json({ ok: true });
  }),
);

// --- Results ---
parentRouter.get('/terms', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  res.json(await prisma.term.findMany({ where: { schoolId }, orderBy: { id: 'asc' } }));
}));

// Exams a child actually has published results for (a ResultMeta row exists).
parentRouter.get(
  '/students/:id/terms',
  ah(async (req, res) => {
    const { userId } = req.auth!;
    const schoolId = requireSchoolId(req);
    const studentId = Number(req.params.id);
    await assertParentOwnsStudent(userId, schoolId, studentId);

    const metas = await prisma.resultMeta.findMany({
      where: { studentId },
      orderBy: { termId: 'desc' },
      include: { term: true },
    });
    res.json(
      metas.map((m) => ({
        id: m.termId,
        name: m.term.name,
        overallPct: Math.round(m.overallPct),
        rank: m.rank,
      })),
    );
  }),
);

parentRouter.get(
  '/students/:id/results',
  ah(async (req, res) => {
    const { userId } = req.auth!;
    const schoolId = requireSchoolId(req);
    const studentId = Number(req.params.id);
    await assertParentOwnsStudent(userId, schoolId, studentId);

    let termId = Number(req.query.termId);
    if (!termId) {
      const meta = await prisma.resultMeta.findFirst({
        where: { studentId },
        orderBy: { termId: 'desc' },
      });
      termId = meta?.termId ?? 0;
    }
    if (!termId) return res.json(null);

    const [meta, results, term] = await Promise.all([
      prisma.resultMeta.findUnique({ where: { studentId_termId: { studentId, termId } } }),
      prisma.result.findMany({ where: { studentId, termId }, orderBy: { subject: 'asc' } }),
      prisma.term.findUnique({ where: { id: termId } }),
    ]);
    res.json({
      term: term ? { id: term.id, name: term.name } : null,
      overallPct: meta?.overallPct ?? null,
      rank: meta?.rank ?? null,
      teacherComment: meta?.teacherComment ?? null,
      subjects: results.map((r) => ({
        subject: r.subject,
        score: r.score,
        maxScore: r.maxScore,
        grade: r.grade,
      })),
    });
  }),
);

// --- Calendar events ---
parentRouter.get('/events', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const events = await prisma.event.findMany({
    where: { schoolId, date: { gte: new Date(new Date().toDateString()) } },
    orderBy: { date: 'asc' },
  });
  res.json(events.map((e) => ({ ...e, date: e.date.toISOString().slice(0, 10) })));
}));

// --- Photo albums ---
parentRouter.get('/albums', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const albums = await prisma.photoAlbum.findMany({
    where: { schoolId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { photos: true } } },
  });
  res.json(
    albums.map((a) => ({
      id: a.id,
      title: a.title,
      coverUrl: a.coverUrl,
      count: a._count.photos,
      createdAt: a.createdAt,
    })),
  );
}));

parentRouter.get('/albums/:id', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const album = await prisma.photoAlbum.findFirst({
    where: { id: Number(req.params.id), schoolId },
    include: { photos: true },
  });
  if (!album) throw new HttpError(404, 'Album not found');
  res.json(album);
}));

// --- Leave ---
parentRouter.get('/leave', ah(async (req, res) => {
  const { userId } = req.auth!;
  const leaves = await prisma.leaveRequest.findMany({
    where: { createdByParentId: userId },
    orderBy: { createdAt: 'desc' },
    include: { student: true },
  });
  res.json(
    leaves.map((l) => ({
      id: l.id,
      studentId: l.studentId,
      studentName: l.student.name,
      type: l.type,
      fromDate: l.fromDate.toISOString().slice(0, 10),
      toDate: l.toDate.toISOString().slice(0, 10),
      reason: l.reason,
      status: l.status,
      createdAt: l.createdAt,
    })),
  );
}));

const leaveSchema = z.object({
  studentId: z.number(),
  type: z.enum(['SICK', 'CASUAL', 'OTHER']),
  fromDate: z.string(),
  toDate: z.string(),
  reason: z.string().min(1),
});
parentRouter.post('/leave', ah(async (req, res) => {
  const { userId } = req.auth!;
  const schoolId = requireSchoolId(req);
  const data = leaveSchema.parse(req.body);
  await assertParentOwnsStudent(userId, schoolId, data.studentId);
  const leave = await prisma.leaveRequest.create({
    data: {
      schoolId,
      studentId: data.studentId,
      type: data.type,
      fromDate: new Date(data.fromDate),
      toDate: new Date(data.toDate),
      reason: data.reason,
      createdByParentId: userId,
    },
  });
  res.status(201).json(leave);
}));

// --- Notifications ---
parentRouter.get('/notifications', ah(async (req, res) => {
  const { userId } = req.auth!;
  const items = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(items);
}));

parentRouter.post('/notifications/:id/read', ah(async (req, res) => {
  const { userId } = req.auth!;
  await prisma.notification.updateMany({
    where: { id: Number(req.params.id), userId },
    data: { readAt: new Date() },
  });
  res.json({ ok: true });
}));
