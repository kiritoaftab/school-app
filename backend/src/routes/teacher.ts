import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, HttpError } from '../lib/http.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const teacherRouter = Router();
teacherRouter.use(requireAuth, requireRole('TEACHER'));

/** Terms in the school (for results entry). */
teacherRouter.get('/terms', ah(async (req, res) => {
  const { schoolId } = req.auth!;
  res.json(await prisma.term.findMany({ where: { schoolId }, orderBy: { id: 'asc' } }));
}));

/** Classes this teacher is class-teacher of. */
teacherRouter.get('/classes', ah(async (req, res) => {
  const { userId, schoolId } = req.auth!;
  const classes = await prisma.klass.findMany({
    where: { schoolId, classTeacherId: userId },
    orderBy: [{ grade: 'asc' }, { section: 'asc' }],
  });
  res.json(classes.map((c) => ({ id: c.id, label: `${c.grade}-${c.section}` })));
}));

/** Roster for a class, with today's attendance status prefilled. */
teacherRouter.get('/classes/:id/roster', ah(async (req, res) => {
  const { schoolId } = req.auth!;
  const klassId = Number(req.params.id);
  const klass = await prisma.klass.findFirst({ where: { id: klassId, schoolId } });
  if (!klass) throw new HttpError(404, 'Class not found');

  const date = String(req.query.date ?? new Date().toISOString().slice(0, 10));
  const day = new Date(date);
  const enrollments = await prisma.enrollment.findMany({
    where: { klassId },
    include: { student: true },
    orderBy: { student: { name: 'asc' } },
  });
  const attendance = await prisma.attendance.findMany({
    where: { date: day, studentId: { in: enrollments.map((e) => e.studentId) } },
  });
  const byStudent = new Map(attendance.map((a) => [a.studentId, a.status]));
  res.json({
    date,
    students: enrollments.map((e) => ({
      id: e.student.id,
      name: e.student.name,
      status: byStudent.get(e.student.id) ?? null,
    })),
  });
}));

const markSchema = z.object({
  date: z.string(),
  marks: z.array(
    z.object({
      studentId: z.number(),
      status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'HOLIDAY']),
    }),
  ),
});
teacherRouter.post('/attendance', ah(async (req, res) => {
  const { userId, schoolId } = req.auth!;
  const { date, marks } = markSchema.parse(req.body);
  const day = new Date(date);
  await prisma.$transaction(
    marks.map((m) =>
      prisma.attendance.upsert({
        where: { studentId_date: { studentId: m.studentId, date: day } },
        create: { schoolId, studentId: m.studentId, date: day, status: m.status, markedById: userId },
        update: { status: m.status, markedById: userId },
      }),
    ),
  );
  res.json({ ok: true, count: marks.length });
}));

const noticeSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  category: z.string().default('General'),
  pinned: z.boolean().default(false),
  audienceClassId: z.number().nullable().optional(),
});
teacherRouter.post('/notices', ah(async (req, res) => {
  const { userId, schoolId } = req.auth!;
  const data = noticeSchema.parse(req.body);
  const notice = await prisma.notice.create({
    data: {
      schoolId,
      title: data.title,
      body: data.body,
      category: data.category,
      pinned: data.pinned,
      audienceType: data.audienceClassId ? 'CLASS' : 'SCHOOL',
      audienceClassId: data.audienceClassId ?? null,
      createdById: userId,
    },
  });
  res.status(201).json(notice);
}));

const diarySchema = z.object({
  klassId: z.number(),
  subject: z.string().min(1),
  date: z.string(),
  task: z.string().min(1),
  note: z.string().optional(),
});
teacherRouter.post('/diary', ah(async (req, res) => {
  const { userId, schoolId } = req.auth!;
  const data = diarySchema.parse(req.body);
  const entry = await prisma.diaryEntry.create({
    data: {
      schoolId,
      klassId: data.klassId,
      subject: data.subject,
      date: new Date(data.date),
      task: data.task,
      note: data.note,
      createdById: userId,
    },
  });
  res.status(201).json(entry);
}));

const resultSchema = z.object({
  studentId: z.number(),
  termId: z.number(),
  subjects: z.array(
    z.object({ subject: z.string(), score: z.number(), maxScore: z.number().default(100), grade: z.string() }),
  ),
  overallPct: z.number(),
  rank: z.number().optional(),
  teacherComment: z.string().optional(),
});
teacherRouter.post('/results', ah(async (req, res) => {
  const data = resultSchema.parse(req.body);
  await prisma.$transaction([
    ...data.subjects.map((s) =>
      prisma.result.upsert({
        where: {
          studentId_termId_subject: { studentId: data.studentId, termId: data.termId, subject: s.subject },
        },
        create: { studentId: data.studentId, termId: data.termId, ...s },
        update: { score: s.score, maxScore: s.maxScore, grade: s.grade },
      }),
    ),
    prisma.resultMeta.upsert({
      where: { studentId_termId: { studentId: data.studentId, termId: data.termId } },
      create: {
        studentId: data.studentId,
        termId: data.termId,
        overallPct: data.overallPct,
        rank: data.rank,
        teacherComment: data.teacherComment,
      },
      update: { overallPct: data.overallPct, rank: data.rank, teacherComment: data.teacherComment },
    }),
  ]);
  res.json({ ok: true });
}));

/** Leave requests for students in this teacher's classes. */
teacherRouter.get('/leave', ah(async (req, res) => {
  const { userId, schoolId } = req.auth!;
  const classes = await prisma.klass.findMany({ where: { schoolId, classTeacherId: userId } });
  const enrollments = await prisma.enrollment.findMany({
    where: { klassId: { in: classes.map((c) => c.id) } },
  });
  const leaves = await prisma.leaveRequest.findMany({
    where: { studentId: { in: enrollments.map((e) => e.studentId) } },
    orderBy: { createdAt: 'desc' },
    include: { student: true },
  });
  res.json(
    leaves.map((l) => ({
      id: l.id,
      studentName: l.student.name,
      type: l.type,
      fromDate: l.fromDate.toISOString().slice(0, 10),
      toDate: l.toDate.toISOString().slice(0, 10),
      reason: l.reason,
      status: l.status,
    })),
  );
}));

const reviewSchema = z.object({ status: z.enum(['APPROVED', 'DECLINED']) });
teacherRouter.patch('/leave/:id', ah(async (req, res) => {
  const { userId } = req.auth!;
  const { status } = reviewSchema.parse(req.body);
  const leave = await prisma.leaveRequest.update({
    where: { id: Number(req.params.id) },
    data: { status, reviewedById: userId },
  });
  // notify the parent
  await prisma.notification.create({
    data: {
      userId: leave.createdByParentId,
      type: 'LEAVE',
      title: `Leave ${status.toLowerCase()}`,
      body: `Your leave request has been ${status.toLowerCase()}.`,
      deeplink: '/app/leave',
    },
  });
  res.json({ ok: true });
}));
