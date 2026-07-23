import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, HttpError } from '../lib/http.js';
import { requireAuth, requireRole, requireSchoolId } from '../middleware/auth.js';

export const teacherRouter = Router();
teacherRouter.use(requireAuth, requireRole('TEACHER'));

/** Terms in the school (for results entry). */
teacherRouter.get('/terms', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  res.json(await prisma.term.findMany({ where: { schoolId }, orderBy: { id: 'asc' } }));
}));

/** Shape a Term row for the exam list. */
function shapeExam(t: { id: number; name: string; klassId: number | null; subject: { id: number; name: string } | null }) {
  return {
    id: t.id,
    name: t.name,
    schoolWide: t.klassId === null,
    subject: t.subject ? { id: t.subject.id, name: t.subject.name } : null,
  };
}

/** Exams a teacher can grade in a class (its own + legacy school-wide terms). */
teacherRouter.get('/classes/:id/exams', ah(async (req, res) => {
  const { userId } = req.auth!;
  const schoolId = requireSchoolId(req);
  const klassId = Number(req.params.id);

  const access = await allowedSubjects(userId, schoolId, klassId);
  if (!access) throw new HttpError(403, 'You do not teach this class');

  const terms = await prisma.term.findMany({
    where: { schoolId, OR: [{ klassId }, { klassId: null }] },
    include: { subject: true },
    orderBy: { id: 'asc' },
  });
  res.json(terms.map(shapeExam));
}));

// subjectId null/absent = all-subjects exam; set = single-subject test.
const teacherExamSchema = z.object({
  name: z.string().min(1),
  subjectId: z.number().int().positive().nullable().optional(),
});
/** A teacher creates an exam for their own class only (no all-school fan-out). */
teacherRouter.post('/classes/:id/exams', ah(async (req, res) => {
  const { userId } = req.auth!;
  const schoolId = requireSchoolId(req);
  const klassId = Number(req.params.id);
  const { name: rawName, subjectId } = teacherExamSchema.parse(req.body);
  const name = rawName.trim();

  const access = await allowedSubjects(userId, schoolId, klassId);
  if (!access) throw new HttpError(403, 'You do not teach this class');
  // A single-subject test must name a subject the teacher may act on here.
  if (subjectId != null && !access.subjects.some((s) => s.id === subjectId)) {
    throw new HttpError(403, 'You do not teach that subject in this class');
  }

  await prisma.term.createMany({
    data: [{ schoolId, klassId, name, subjectId: subjectId ?? null }],
    skipDuplicates: true,
  });
  const created = await prisma.term.findFirst({
    where: { schoolId, klassId, name, subjectId: subjectId ?? null },
    include: { subject: true },
  });
  res.status(201).json(created ? shapeExam(created) : null);
}));

/** Remove an exam the teacher has access to (backs the Marks screen's × button). */
teacherRouter.delete('/exams/:id', ah(async (req, res) => {
  const { userId } = req.auth!;
  const schoolId = requireSchoolId(req);
  const id = Number(req.params.id);

  const term = await prisma.term.findFirst({ where: { id, schoolId } });
  if (!term) throw new HttpError(404, 'Exam not found');
  // Legacy school-wide terms (no class) are admin-owned; teachers can't delete them.
  if (term.klassId === null) throw new HttpError(403, 'You cannot delete a school-wide exam');
  const access = await allowedSubjects(userId, schoolId, term.klassId);
  if (!access) throw new HttpError(403, 'You do not teach this class');

  await prisma.term.delete({ where: { id } });
  res.status(204).end();
}));

/** Parse a 'YYYY-MM-DD' string into the UTC midnight used by @db.Date columns. */
function dateOnly(s: string): Date {
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new HttpError(400, `Invalid date: ${s}`);
  return d;
}

/**
 * Which subjects this teacher may write diary entries for in a class.
 *
 * A class teacher owns the whole class diary, so they get every subject the
 * school offers. Everyone else only gets the subjects they actually teach
 * there. Returns null when the teacher has no business with the class at all.
 */
async function allowedSubjects(
  userId: number,
  schoolId: number,
  klassId: number,
): Promise<{ klass: { id: number; grade: string; section: string; classTeacherId: number | null }; isClassTeacher: boolean; subjects: { id: number; name: string }[] } | null> {
  const klass = await prisma.klass.findFirst({ where: { id: klassId, schoolId } });
  if (!klass) return null;

  if (klass.classTeacherId === userId) {
    const subjects = await prisma.subject.findMany({ where: { schoolId }, orderBy: { name: 'asc' } });
    return { klass, isClassTeacher: true, subjects: subjects.map((s) => ({ id: s.id, name: s.name })) };
  }

  const assignments = await prisma.teachingAssignment.findMany({
    where: { schoolId, teacherId: userId, klassId },
    include: { subject: true },
    orderBy: { subject: { name: 'asc' } },
  });
  if (assignments.length === 0) return null;
  return {
    klass,
    isClassTeacher: false,
    subjects: assignments.map((a) => ({ id: a.subject.id, name: a.subject.name })),
  };
}

/**
 * Every class this teacher works with: the ones they are class teacher of,
 * plus the ones they teach a subject in, each with the subjects they may post
 * diary entries for.
 */
teacherRouter.get('/classes', ah(async (req, res) => {
  const { userId } = req.auth!;
  const schoolId = requireSchoolId(req);

  const [owned, assignments] = await Promise.all([
    prisma.klass.findMany({ where: { schoolId, classTeacherId: userId } }),
    prisma.teachingAssignment.findMany({
      where: { schoolId, teacherId: userId },
      include: { klass: true, subject: true },
    }),
  ]);

  const klassIds = [...new Set([...owned.map((k) => k.id), ...assignments.map((a) => a.klassId)])];
  if (klassIds.length === 0) return res.json([]);

  const [classes, counts, allSubjects] = await Promise.all([
    prisma.klass.findMany({
      where: { id: { in: klassIds } },
      orderBy: [{ grade: 'asc' }, { section: 'asc' }],
    }),
    prisma.enrollment.groupBy({ by: ['klassId'], where: { klassId: { in: klassIds } }, _count: true }),
    prisma.subject.findMany({ where: { schoolId }, orderBy: { name: 'asc' } }),
  ]);
  const countOf = new Map(counts.map((c) => [c.klassId, c._count]));

  res.json(
    classes.map((c) => {
      const isClassTeacher = c.classTeacherId === userId;
      const taught = assignments
        .filter((a) => a.klassId === c.id)
        .map((a) => ({ id: a.subject.id, name: a.subject.name }));
      const subjects = isClassTeacher ? allSubjects.map((s) => ({ id: s.id, name: s.name })) : taught;
      return {
        id: c.id,
        grade: c.grade,
        section: c.section,
        label: `${c.grade}-${c.section}`,
        isClassTeacher,
        // What the switcher shows under the class name.
        roleLabel: isClassTeacher
          ? 'Class teacher'
          : taught.map((s) => s.name).join(', ') || 'Subject teacher',
        students: countOf.get(c.id) ?? 0,
        subjects,
      };
    }),
  );
}));

/** Roster for a class, with today's attendance status prefilled. */
teacherRouter.get('/classes/:id/roster', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
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
  const { userId } = req.auth!;
  const schoolId = requireSchoolId(req);
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
  const { userId } = req.auth!;
  const schoolId = requireSchoolId(req);
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

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

const diaryQuerySchema = z.object({ klassId: z.coerce.number(), from: ymd, to: ymd });

/**
 * Diary entries for a class over a date range — the range covers the week the
 * calendar is showing, so the strip can dot the days that have homework.
 */
teacherRouter.get('/diary', ah(async (req, res) => {
  const { userId } = req.auth!;
  const schoolId = requireSchoolId(req);
  const { klassId, from, to } = diaryQuerySchema.parse(req.query);

  const access = await allowedSubjects(userId, schoolId, klassId);
  if (!access) throw new HttpError(403, 'You do not teach this class');

  const entries = await prisma.diaryEntry.findMany({
    where: { schoolId, klassId, date: { gte: dateOnly(from), lte: dateOnly(to) } },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
  });

  res.json({
    klassId,
    isClassTeacher: access.isClassTeacher,
    subjects: access.subjects,
    entries: entries.map((e) => ({
      id: e.id,
      date: e.date.toISOString().slice(0, 10),
      subject: e.subject,
      task: e.task,
      note: e.note,
      createdById: e.createdById,
      createdBy: e.createdBy?.name ?? null,
      // A subject teacher may only remove what they posted themselves.
      canDelete: access.isClassTeacher || e.createdById === userId,
    })),
  });
}));

// An entry with a subject is homework; one without is a general "note for the day".
const diarySchema = z.object({
  klassId: z.number(),
  subject: z.string().min(1).optional(),
  date: ymd,
  task: z.string().min(1),
  note: z.string().optional(),
});
teacherRouter.post('/diary', ah(async (req, res) => {
  const { userId } = req.auth!;
  const schoolId = requireSchoolId(req);
  const data = diarySchema.parse(req.body);

  const access = await allowedSubjects(userId, schoolId, data.klassId);
  if (!access) throw new HttpError(403, 'You do not teach this class');
  // Homework must name a subject the teacher may post; a general note may be
  // posted by any teacher of the class, so it skips that check.
  if (data.subject && !access.subjects.some((s) => s.name === data.subject)) {
    throw new HttpError(403, `You do not teach ${data.subject} in this class`);
  }

  const entry = await prisma.diaryEntry.create({
    data: {
      schoolId,
      klassId: data.klassId,
      subject: data.subject ?? null,
      date: dateOnly(data.date),
      task: data.task,
      note: data.note,
      createdById: userId,
    },
  });
  res.status(201).json({
    id: entry.id,
    date: entry.date.toISOString().slice(0, 10),
    subject: entry.subject,
    task: entry.task,
    note: entry.note,
    createdById: entry.createdById,
    canDelete: true,
  });
}));

/** Remove a diary entry — the class teacher, or whoever posted it. */
teacherRouter.delete('/diary/:id', ah(async (req, res) => {
  const { userId } = req.auth!;
  const schoolId = requireSchoolId(req);
  const entry = await prisma.diaryEntry.findFirst({
    where: { id: Number(req.params.id), schoolId },
  });
  if (!entry) throw new HttpError(404, 'Diary entry not found');

  const access = await allowedSubjects(userId, schoolId, entry.klassId);
  if (!access) throw new HttpError(403, 'You do not teach this class');
  if (!access.isClassTeacher && entry.createdById !== userId) {
    throw new HttpError(403, 'You can only remove entries you posted');
  }

  await prisma.diaryEntry.delete({ where: { id: entry.id } });
  res.json({ ok: true });
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
  const { userId } = req.auth!;
  const schoolId = requireSchoolId(req);
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
