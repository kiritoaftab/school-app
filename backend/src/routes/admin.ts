import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, HttpError } from '../lib/http.js';
import { requireAuth, requireRole, requireSchoolId } from '../middleware/auth.js';
import { examUsage, klassUsage, plural, studentUsage, subjectUsage, teacherUsage, throwIfInUse } from '../lib/usage.js';
import { shapeExam } from '../lib/exam.js';
import { audit, auditAfter, actorFrom } from '../lib/audit.js';
import { LIVE, archiveData, archiveStudentData, restoreData, restoreStudentData } from '../lib/archive.js';
import { mountGalleryRoutes } from './gallery.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('ADMIN'));

/**
 * Lists hide archived rows unless `?includeArchived=1` asks for them, so the
 * admin can still open a retired teacher or subject to read its history.
 */
function wantsArchived(req: { query: Record<string, unknown> }): boolean {
  const v = req.query.includeArchived;
  return v === '1' || v === 'true';
}
const liveUnless = (include: boolean) => (include ? {} : LIVE);

// --- Users ---
adminRouter.get('/users', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const role = req.query.role as string | undefined;
  const users = await prisma.user.findMany({
    where: { schoolId, ...(role ? { role: role as any } : {}), ...liveUnless(wantsArchived(req)) },
    orderBy: { name: 'asc' },
  });
  res.json(users.map((u) => ({
    id: u.id,
    name: u.name,
    phone: u.phone,
    role: u.role,
    archivedAt: u.archivedAt,
  })));
}));

const userSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(6),
  role: z.enum(['PARENT', 'TEACHER', 'ADMIN']),
});
adminRouter.post('/users', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const data = userSchema.parse(req.body);
  const exists = await prisma.user.findFirst({ where: { schoolId, phone: data.phone, role: data.role } });
  if (exists) throw new HttpError(409, 'User with this phone and role already exists');
  const user = await prisma.user.create({ data: { schoolId, ...data } });
  res.status(201).json({ id: user.id, name: user.name, phone: user.phone, role: user.role });
}));

/**
 * A subject in a class has exactly one teacher.
 *
 * The unique index on (klassId, subjectId) is the real guarantee; this runs
 * first so the admin is told *who* holds the slot instead of being shown a
 * database error. `exceptTeacherId` skips the teacher being edited — rewriting
 * their own chips must not collide with the rows about to be replaced.
 */
type SubjectClash = {
  klassId: number;
  klassLabel: string;
  subjectId: number;
  subjectName: string;
  teacherId: number;
  teacherName: string;
};
async function assertSubjectsFree(
  schoolId: number,
  pairs: { klassId: number; subjectId: number }[],
  exceptTeacherId?: number,
): Promise<void> {
  if (!pairs.length) return;
  const taken = await prisma.teachingAssignment.findMany({
    where: {
      schoolId,
      ...(exceptTeacherId != null ? { teacherId: { not: exceptTeacherId } } : {}),
      OR: pairs.map((p) => ({ klassId: p.klassId, subjectId: p.subjectId })),
    },
    include: {
      teacher: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      klass: { select: { grade: true, section: true } },
    },
  });
  if (!taken.length) return;

  const conflicts: SubjectClash[] = taken.map((a) => ({
    klassId: a.klassId,
    klassLabel: `${a.klass.grade}-${a.klass.section}`,
    subjectId: a.subjectId,
    subjectName: a.subject.name,
    teacherId: a.teacher.id,
    teacherName: a.teacher.name,
  }));
  const [first] = conflicts;
  throw new HttpError(
    409,
    conflicts.length === 1
      ? `${first.teacherName} already teaches ${first.subjectName} in ${first.klassLabel}.`
      : `${conflicts.length} of those subjects are already taught by someone else.`,
    { code: 'SUBJECT_TAKEN', conflicts },
  );
}

// --- Teachers (user + class/subject assignments + class-teacher, in one shot) ---
const teacherCreateSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(6),
  assignments: z
    .array(z.object({ klassId: z.number(), subjectIds: z.array(z.number()) }))
    .default([]),
  classTeacherOf: z.number().nullable().optional(),
});
adminRouter.post('/teachers', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const data = teacherCreateSchema.parse(req.body);
  const phone = data.phone.trim();

  const exists = await prisma.user.findFirst({ where: { schoolId, phone, role: 'TEACHER', ...LIVE } });
  if (exists) throw new HttpError(409, 'A teacher with this phone already exists');

  // Every referenced class & subject must belong to this school.
  const klassIds = [...new Set([
    ...data.assignments.map((a) => a.klassId),
    ...(data.classTeacherOf != null ? [data.classTeacherOf] : []),
  ])];
  const subjectIds = [...new Set(data.assignments.flatMap((a) => a.subjectIds))];
  const [klasses, subjects] = await Promise.all([
    klassIds.length ? prisma.klass.findMany({ where: { id: { in: klassIds }, schoolId, ...LIVE }, select: { id: true } }) : Promise.resolve([]),
    subjectIds.length ? prisma.subject.findMany({ where: { id: { in: subjectIds }, schoolId, ...LIVE }, select: { id: true } }) : Promise.resolve([]),
  ]);
  const validKlass = new Set(klasses.map((k) => k.id));
  const validSubject = new Set(subjects.map((s) => s.id));
  if (klassIds.some((id) => !validKlass.has(id))) throw new HttpError(404, 'A selected class was not found in this school');
  if (subjectIds.some((id) => !validSubject.has(id))) throw new HttpError(404, 'A selected subject was not found in this school');

  // Flatten to unique (klassId, subjectId) rows.
  const seen = new Set<string>();
  const rows: { klassId: number; subjectId: number }[] = [];
  for (const a of data.assignments) {
    for (const subjectId of a.subjectIds) {
      const key = `${a.klassId}:${subjectId}`;
      if (!seen.has(key)) { seen.add(key); rows.push({ klassId: a.klassId, subjectId }); }
    }
  }
  await assertSubjectsFree(schoolId, rows);

  const teacher = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { schoolId, name: data.name.trim(), phone, role: 'TEACHER' } });
    if (rows.length) {
      await tx.teachingAssignment.createMany({
        data: rows.map((r) => ({ schoolId, teacherId: user.id, klassId: r.klassId, subjectId: r.subjectId })),
      });
    }
    if (data.classTeacherOf != null) {
      await tx.klass.update({ where: { id: data.classTeacherOf }, data: { classTeacherId: user.id } });
    }
    return user;
  });

  auditAfter(actorFrom(req), {
    action: 'CREATE',
    entity: 'User',
    entityId: teacher.id,
    label: teacher.name,
    after: { phone, role: 'TEACHER', assignments: rows.length, classTeacherOf: data.classTeacherOf ?? null },
  });
  res.status(201).json({ id: teacher.id, name: teacher.name, phone: teacher.phone, role: teacher.role });
}));

// One teacher with their class × subject assignments, grouped by class.
adminRouter.get('/teachers/:id', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const id = Number(req.params.id);
  const teacher = await prisma.user.findFirst({
    where: { id, schoolId, role: 'TEACHER' },
    include: {
      classesTaught: { select: { id: true, grade: true, section: true } },
      teachingAssignments: {
        include: {
          klass: { select: { id: true, grade: true, section: true } },
          subject: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!teacher) throw new HttpError(404, 'Teacher not found');

  const byKlass = new Map<number, { klassId: number; label: string; subjects: { id: number; name: string }[] }>();
  for (const a of teacher.teachingAssignments) {
    let entry = byKlass.get(a.klassId);
    if (!entry) {
      entry = { klassId: a.klassId, label: `${a.klass.grade}-${a.klass.section}`, subjects: [] };
      byKlass.set(a.klassId, entry);
    }
    entry.subjects.push({ id: a.subject.id, name: a.subject.name });
  }
  const assignments = [...byKlass.values()].sort((a, b) => a.label.localeCompare(b.label));
  for (const a of assignments) a.subjects.sort((x, y) => x.name.localeCompare(y.name));

  res.json({
    id: teacher.id,
    name: teacher.name,
    phone: teacher.phone,
    role: teacher.role,
    classTeacherOf: teacher.classesTaught.map((k) => ({ id: k.id, label: `${k.grade}-${k.section}` })),
    assignments,
  });
}));

// Set exactly which subjects a teacher covers in one class.
// An empty list drops the class from their load entirely.
const classSubjectsSchema = z.object({ subjectIds: z.array(z.number()) });
adminRouter.put('/teachers/:id/assignments/:klassId', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const teacherId = Number(req.params.id);
  const klassId = Number(req.params.klassId);
  const { subjectIds } = classSubjectsSchema.parse(req.body);
  const wanted = [...new Set(subjectIds)];

  const [teacher, klass, subjects] = await Promise.all([
    prisma.user.findFirst({ where: { id: teacherId, schoolId, role: 'TEACHER' } }),
    prisma.klass.findFirst({ where: { id: klassId, schoolId } }),
    wanted.length
      ? prisma.subject.findMany({ where: { id: { in: wanted }, schoolId, ...LIVE }, select: { id: true } })
      : Promise.resolve([]),
  ]);
  if (!teacher) throw new HttpError(404, 'Teacher not found');
  if (!klass) throw new HttpError(404, 'Class not found in this school');
  if (subjects.length !== wanted.length) {
    throw new HttpError(404, 'A selected subject was not found in this school');
  }

  await assertSubjectsFree(schoolId, subjects.map((s) => ({ klassId, subjectId: s.id })), teacherId);

  const before = await prisma.teachingAssignment.findMany({
    where: { schoolId, teacherId, klassId },
    select: { subjectId: true },
  });

  // Replace the whole set for this class so the write matches the chips exactly.
  await prisma.$transaction([
    prisma.teachingAssignment.deleteMany({ where: { schoolId, teacherId, klassId } }),
    ...(subjects.length
      ? [
          prisma.teachingAssignment.createMany({
            data: subjects.map((s) => ({ schoolId, teacherId, klassId, subjectId: s.id })),
          }),
        ]
      : []),
  ]);
  auditAfter(actorFrom(req), {
    action: 'UPDATE',
    entity: 'TeachingAssignment',
    entityId: teacherId,
    label: `${teacher.name} · ${klass.grade}${klass.section}`,
    before: { subjectIds: before.map((a) => a.subjectId) },
    after: { subjectIds: subjects.map((s) => s.id) },
  });
  res.json({ ok: true });
}));

// Remove a whole class from a teacher (every subject they teach in it).
adminRouter.delete('/teachers/:id/assignments/:klassId', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const teacherId = Number(req.params.id);
  const klassId = Number(req.params.klassId);
  const [teacher, klass] = await Promise.all([
    prisma.user.findFirst({ where: { id: teacherId, schoolId, role: 'TEACHER' } }),
    prisma.klass.findFirst({ where: { id: klassId, schoolId } }),
  ]);
  if (!teacher) throw new HttpError(404, 'Teacher not found');
  // Without this a wrong or out-of-school klassId deleted nothing and still
  // answered 204, so the caller was told a change had happened that hadn't.
  if (!klass) throw new HttpError(404, 'Class not found in this school');

  const removed = await prisma.teachingAssignment.deleteMany({ where: { schoolId, teacherId, klassId } });
  // Leading a class you no longer teach in is allowed, so classTeacherId is left alone.
  auditAfter(actorFrom(req), {
    action: 'DELETE',
    entity: 'TeachingAssignment',
    entityId: teacherId,
    label: `${teacher.name} · ${klass.grade}${klass.section}`,
    summary: `${plural(removed.count, 'subject link')} removed.`,
  });
  res.status(204).end();
}));

/**
 * Retire a teacher who has left.
 *
 * There is no delete-teacher endpoint and there should not be: their name is on
 * diary entries, notices and attendance registers, and a delete would null all
 * of that out silently. Archiving keeps every trace and takes away the login.
 */
adminRouter.post('/teachers/:id/archive', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const { userId } = req.auth!;
  const id = Number(req.params.id);
  const teacher = await prisma.user.findFirst({ where: { id, schoolId, role: 'TEACHER' } });
  if (!teacher) throw new HttpError(404, 'Teacher not found');
  if (teacher.archivedAt) throw new HttpError(409, 'That teacher is already archived', { code: 'ALREADY_ARCHIVED' });

  // Leading a class is a live responsibility, not a historical fact. Rather
  // than nulling it out behind the admin's back, make them hand it over first.
  const leads = await prisma.klass.findMany({
    where: { schoolId, classTeacherId: id, archivedAt: null },
    select: { id: true, grade: true, section: true },
  });
  if (leads.length) {
    throw new HttpError(409, 'Hand over their class first — they are still the class teacher.', {
      code: 'IS_CLASS_TEACHER',
      classes: leads.map((k) => ({ id: k.id, label: `${k.grade}-${k.section}` })),
    });
  }

  const usage = await teacherUsage(schoolId, id);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: archiveData(id, userId) });
    // The timetable is current state; the diary entries and registers they
    // wrote are history and keep pointing at them.
    const unlinked = await tx.teachingAssignment.deleteMany({ where: { schoolId, teacherId: id } });
    await audit(tx, actorFrom(req), {
      action: 'ARCHIVE',
      entity: 'User',
      entityId: id,
      label: teacher.name,
      summary:
        `Sign-in revoked. ${plural(usage.counts.diary, 'diary entry', 'diary entries')}, ` +
        `${plural(usage.counts.notices, 'notice')} and ${plural(usage.counts.attendanceMarked, 'attendance record')} ` +
        `keep their name; ${plural(unlinked.count, 'class assignment')} removed.`,
    });
  });
  res.json({ ok: true });
}));

adminRouter.post('/teachers/:id/restore', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const id = Number(req.params.id);
  const teacher = await prisma.user.findFirst({ where: { id, schoolId, role: 'TEACHER' } });
  if (!teacher) throw new HttpError(404, 'Teacher not found');
  // Their mobile is freed on archive, so someone else may hold it now.
  const clash = await prisma.user.findFirst({
    where: { schoolId, phone: teacher.phone, role: 'TEACHER', archivedAt: null, id: { not: id } },
  });
  if (clash) {
    throw new HttpError(409, 'Another active teacher now uses that mobile number.', { code: 'PHONE_TAKEN' });
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: restoreData() });
    await audit(tx, actorFrom(req), {
      action: 'RESTORE',
      entity: 'User',
      entityId: id,
      label: teacher.name,
      summary: 'Class assignments are not restored — reassign them.',
    });
  });
  res.json({ ok: true });
}));

// Make this teacher the class teacher of a class, or step them down from it.
const ctSchema = z.object({ klassId: z.number(), isClassTeacher: z.boolean() });
adminRouter.put('/teachers/:id/class-teacher', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const teacherId = Number(req.params.id);
  const { klassId, isClassTeacher } = ctSchema.parse(req.body);

  const [teacher, klass] = await Promise.all([
    prisma.user.findFirst({ where: { id: teacherId, schoolId, role: 'TEACHER' } }),
    prisma.klass.findFirst({ where: { id: klassId, schoolId } }),
  ]);
  if (!teacher) throw new HttpError(404, 'Teacher not found');
  if (!klass) throw new HttpError(404, 'Class not found in this school');

  const next = isClassTeacher ? teacherId : klass.classTeacherId === teacherId ? null : klass.classTeacherId;
  if (next !== klass.classTeacherId) {
    await prisma.klass.update({ where: { id: klassId }, data: { classTeacherId: next } });
    // Who leads a class decides who can see its whole diary and marks, so the
    // handover is worth a line of its own.
    auditAfter(actorFrom(req), {
      action: 'UPDATE',
      entity: 'Klass',
      entityId: klassId,
      label: `${klass.grade}${klass.section}`,
      summary: next == null ? `${teacher.name} stepped down as class teacher.` : `${teacher.name} became class teacher.`,
      before: { classTeacherId: klass.classTeacherId },
      after: { classTeacherId: next },
    });
  }
  res.json({ ok: true });
}));

// --- Students ---
adminRouter.get('/students', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const students = await prisma.student.findMany({
    where: { schoolId, ...liveUnless(wantsArchived(req)) },
    orderBy: { name: 'asc' },
    include: { enrollments: { include: { klass: true } }, parentLinks: { include: { parent: true } } },
  });
  res.json(
    students.map((s) => ({
      id: s.id,
      name: s.name,
      admissionNo: s.admissionNo,
      klass: s.enrollments.at(-1)
        ? `${s.enrollments.at(-1)!.klass.grade}-${s.enrollments.at(-1)!.klass.section}`
        : null,
      parents: s.parentLinks.map((l) => ({ id: l.parent.id, name: l.parent.name })),
    })),
  );
}));

const studentSchema = z.object({
  name: z.string().min(1),
  admissionNo: z.string().min(1),
  klassId: z.number().optional(),
  academicYear: z.string().default(String(new Date().getFullYear())),
});
adminRouter.post('/students', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const data = studentSchema.parse(req.body);
  const student = await prisma.student.create({
    data: { schoolId, name: data.name, admissionNo: data.admissionNo },
  });
  if (data.klassId) {
    await prisma.enrollment.create({
      data: { studentId: student.id, klassId: data.klassId, academicYear: data.academicYear },
    });
  }
  res.status(201).json(student);
}));

// --- Classes ---
adminRouter.get('/classes', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const classes = await prisma.klass.findMany({
    where: { schoolId, ...liveUnless(wantsArchived(req)) },
    orderBy: [{ grade: 'asc' }, { section: 'asc' }],
    include: {
      classTeacher: true,
      // A departed pupil shouldn't still be counted in the class size.
      _count: { select: { enrollments: { where: { student: { ...LIVE } } } } },
    },
  });
  res.json(
    classes.map((c) => ({
      id: c.id,
      label: `${c.grade}-${c.section}`,
      grade: c.grade,
      section: c.section,
      classTeacherId: c.classTeacherId,
      teacher: c.classTeacher?.name ?? null,
      students: c._count.enrollments,
      archivedAt: c.archivedAt,
    })),
  );
}));

const classSchema = z.object({
  grade: z.string().min(1),
  section: z.string().min(1),
  classTeacherId: z.number().nullable().optional(),
});
adminRouter.post('/classes', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const data = classSchema.parse(req.body);
  const grade = data.grade.trim();
  const section = data.section.trim().toUpperCase();

  const exists = await prisma.klass.findFirst({ where: { schoolId, grade, section, ...LIVE } });
  if (exists) throw new HttpError(409, `Class ${grade}-${section} already exists`);

  if (data.classTeacherId != null) {
    const teacher = await prisma.user.findFirst({
      where: { id: data.classTeacherId, schoolId, role: 'TEACHER' },
    });
    if (!teacher) throw new HttpError(404, 'Selected teacher not found in this school');
  }

  const klass = await prisma.klass.create({
    data: { schoolId, grade, section, classTeacherId: data.classTeacherId ?? null },
  });
  auditAfter(actorFrom(req), {
    action: 'CREATE',
    entity: 'Klass',
    entityId: klass.id,
    label: `${grade}-${section}`,
    after: { grade, section, classTeacherId: klass.classTeacherId },
  });
  res.status(201).json({
    id: klass.id,
    label: `${klass.grade}-${klass.section}`,
    grade: klass.grade,
    section: klass.section,
    classTeacherId: klass.classTeacherId,
  });
}));

/**
 * Retire a class once its year is over.
 *
 * Its enrolments, exams, marks and diary stay put — the class is how they are
 * grouped. Move the children on first: a class still holding pupils is a live
 * class, and archiving it would strand them with nowhere to appear.
 */
adminRouter.post('/classes/:id/archive', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const { userId } = req.auth!;
  const id = Number(req.params.id);
  const klass = await prisma.klass.findFirst({ where: { id, schoolId } });
  if (!klass) throw new HttpError(404, 'Class not found');
  if (klass.archivedAt) throw new HttpError(409, 'That class is already archived', { code: 'ALREADY_ARCHIVED' });

  const students = await prisma.enrollment.count({
    where: { klassId: id, student: { archivedAt: null } },
  });
  if (students > 0) {
    throw new HttpError(409, 'Move its students to another class first.', {
      code: 'HAS_STUDENTS',
      usage: { students },
    });
  }

  const usage = await klassUsage(schoolId, id);
  await prisma.$transaction(async (tx) => {
    await tx.klass.update({
      where: { id },
      data: { ...archiveData(id, userId), classTeacherId: null },
    });
    const unlinked = await tx.teachingAssignment.deleteMany({ where: { schoolId, klassId: id } });
    await audit(tx, actorFrom(req), {
      action: 'ARCHIVE',
      entity: 'Klass',
      entityId: id,
      label: `${klass.grade}-${klass.section}`,
      summary:
        `${plural(usage.counts.exams, 'exam')} and ${plural(usage.counts.diary, 'diary entry', 'diary entries')} retained; ` +
        `${plural(unlinked.count, 'teacher assignment')} removed.`,
    });
  });
  res.json({ ok: true });
}));

adminRouter.post('/classes/:id/restore', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const id = Number(req.params.id);
  const klass = await prisma.klass.findFirst({ where: { id, schoolId } });
  if (!klass) throw new HttpError(404, 'Class not found');
  const clash = await prisma.klass.findFirst({
    where: { schoolId, grade: klass.grade, section: klass.section, archivedAt: null, id: { not: id } },
  });
  if (clash) {
    throw new HttpError(409, `Class ${klass.grade}-${klass.section} already exists.`, { code: 'NAME_TAKEN' });
  }

  await prisma.$transaction(async (tx) => {
    await tx.klass.update({ where: { id }, data: restoreData() });
    await audit(tx, actorFrom(req), {
      action: 'RESTORE',
      entity: 'Klass',
      entityId: id,
      label: `${klass.grade}-${klass.section}`,
      summary: 'No class teacher and no subject assignments — set them up again.',
    });
  });
  res.json({ ok: true });
}));

// --- Class detail tabs: students, teachers, exams ---

// Shared guard: the class must exist in the caller's school.
async function requireKlass(schoolId: number, klassId: number) {
  const klass = await prisma.klass.findFirst({ where: { id: klassId, schoolId } });
  if (!klass) throw new HttpError(404, 'Class not found in this school');
  return klass;
}

// Admission numbers are generated, not typed — "2026-0007" style, per school.
export async function nextAdmissionNo(schoolId: number) {
  const year = new Date().getFullYear();
  const count = await prisma.student.count({ where: { schoolId } });
  return `${year}-${String(count + 1).padStart(4, '0')}`;
}

adminRouter.get('/classes/:id/students', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const klassId = Number(req.params.id);
  await requireKlass(schoolId, klassId);

  const enrollments = await prisma.enrollment.findMany({
    where: { klassId, student: { ...LIVE } },
    include: { student: { include: { parentLinks: { include: { parent: true } } } } },
    orderBy: { student: { name: 'asc' } },
  });
  res.json(
    enrollments.map((e) => {
      const link = e.student.parentLinks[0];
      return {
        id: e.student.id,
        name: e.student.name,
        admissionNo: e.student.admissionNo,
        guardian: link
          ? { id: link.parent.id, name: link.parent.name, phone: link.parent.phone, relation: link.relation }
          : null,
      };
    }),
  );
}));

// Guardian is mandatory: their mobile is the parent login.
const classStudentSchema = z.object({
  name: z.string().min(1),
  guardianName: z.string().min(1),
  guardianPhone: z.string().min(10),
  relation: z.enum(['Mother', 'Father', 'Guardian']),
  academicYear: z.string().default(String(new Date().getFullYear())),
});

adminRouter.post('/classes/:id/students', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const klassId = Number(req.params.id);
  await requireKlass(schoolId, klassId);
  const data = classStudentSchema.parse(req.body);
  const phone = data.guardianPhone.replace(/\D/g, '');
  if (phone.length !== 10) throw new HttpError(400, 'Guardian mobile must be 10 digits');

  const admissionNo = await nextAdmissionNo(schoolId);
  const student = await prisma.$transaction(async (tx) => {
    const s = await tx.student.create({ data: { schoolId, name: data.name.trim(), admissionNo } });
    await tx.enrollment.create({ data: { studentId: s.id, klassId, academicYear: data.academicYear } });
    // One parent account per mobile — a second child reuses the same login.
    const parent =
      (await tx.user.findFirst({ where: { schoolId, phone, role: 'PARENT' } })) ??
      (await tx.user.create({
        data: { schoolId, phone, name: data.guardianName.trim(), role: 'PARENT' },
      }));
    await tx.parentStudentLink.create({
      data: { parentUserId: parent.id, studentId: s.id, relation: data.relation },
    });
    return s;
  });
  auditAfter(actorFrom(req), {
    action: 'CREATE',
    entity: 'Student',
    entityId: student.id,
    label: student.name,
    after: { admissionNo, klassId, academicYear: data.academicYear, guardianPhone: phone },
  });
  res.status(201).json({ id: student.id, name: student.name, admissionNo: student.admissionNo });
}));

const studentEditSchema = classStudentSchema.partial().omit({ academicYear: true });
adminRouter.put('/students/:id', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const id = Number(req.params.id);
  const data = studentEditSchema.parse(req.body);
  const student = await prisma.student.findFirst({
    where: { id, schoolId },
    include: { parentLinks: true },
  });
  if (!student) throw new HttpError(404, 'Student not found');

  await prisma.$transaction(async (tx) => {
    if (data.name) await tx.student.update({ where: { id }, data: { name: data.name.trim() } });

    const link = student.parentLinks[0];
    if (!link) return;
    if (data.relation) {
      await tx.parentStudentLink.update({ where: { id: link.id }, data: { relation: data.relation } });
    }
    const guardianData: { name?: string; phone?: string } = {};
    if (data.guardianName) guardianData.name = data.guardianName.trim();
    if (data.guardianPhone) {
      const phone = data.guardianPhone.replace(/\D/g, '');
      if (phone.length !== 10) throw new HttpError(400, 'Guardian mobile must be 10 digits');
      const clash = await tx.user.findFirst({
        where: { schoolId, phone, role: 'PARENT', id: { not: link.parentUserId } },
      });
      if (clash) throw new HttpError(409, 'Another guardian already uses this mobile');
      guardianData.phone = phone;
    }
    if (Object.keys(guardianData).length) {
      await tx.user.update({ where: { id: link.parentUserId }, data: guardianData });
      // Changing a guardian's mobile moves which phone can log in and read this
      // child's record, so it is logged inside the transaction, not after it.
      await audit(tx, actorFrom(req), {
        action: 'UPDATE',
        entity: 'User',
        entityId: link.parentUserId,
        label: guardianData.name ?? data.guardianName ?? 'Guardian',
        summary: guardianData.phone ? `Sign-in mobile changed for ${student.name}'s guardian.` : undefined,
        after: guardianData,
      });
    }
  });
  res.json({ ok: true });
}));

/** Retire a pupil who has left. Their whole record stays exactly as it was. */
adminRouter.post('/students/:id/archive', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const { userId } = req.auth!;
  const id = Number(req.params.id);
  const student = await prisma.student.findFirst({ where: { id, schoolId } });
  if (!student) throw new HttpError(404, 'Student not found');
  if (student.archivedAt) throw new HttpError(409, 'That student is already archived', { code: 'ALREADY_ARCHIVED' });

  const usage = await studentUsage(id);
  await prisma.$transaction(async (tx) => {
    await tx.student.update({ where: { id }, data: archiveStudentData(userId) });
    await audit(tx, actorFrom(req), {
      action: 'ARCHIVE',
      entity: 'Student',
      entityId: id,
      label: student.name,
      summary:
        `${plural(usage.counts.marks, 'mark')}, ${plural(usage.counts.attendance, 'attendance record')} and ` +
        `${plural(usage.counts.leaveRequests, 'leave request')} retained.`,
    });
  });
  res.json({ ok: true });
}));

adminRouter.post('/students/:id/restore', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const id = Number(req.params.id);
  const student = await prisma.student.findFirst({ where: { id, schoolId } });
  if (!student) throw new HttpError(404, 'Student not found');
  await prisma.$transaction(async (tx) => {
    await tx.student.update({ where: { id }, data: restoreStudentData() });
    await audit(tx, actorFrom(req), {
      action: 'RESTORE', entity: 'Student', entityId: id, label: student.name,
    });
  });
  res.json({ ok: true });
}));

adminRouter.delete('/students/:id', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const id = Number(req.params.id);
  const student = await prisma.student.findFirst({ where: { id, schoolId } });
  if (!student) throw new HttpError(404, 'Student not found');
  // A child with marks, a register or a leave history is not deletable — that
  // record is the point of the platform. Only a row added by mistake, before
  // anything was written against it, can still be removed outright; anything
  // else must be archived instead.
  throwIfInUse(await studentUsage(id), 'student', 'ARCHIVE');
  await prisma.$transaction(async (tx) => {
    await tx.parentStudentLink.deleteMany({ where: { studentId: id } });
    await tx.student.delete({ where: { id } });
    await audit(tx, actorFrom(req), {
      action: 'DELETE',
      entity: 'Student',
      entityId: id,
      label: student.name,
      summary: 'Deleted while no marks, register or leave history existed.',
      before: { name: student.name, admissionNo: student.admissionNo },
    });
  });
  res.status(204).end();
}));

// Teachers working in this class, with the subjects each covers here.
adminRouter.get('/classes/:id/teachers', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const klassId = Number(req.params.id);
  const klass = await requireKlass(schoolId, klassId);

  const rows = await prisma.teachingAssignment.findMany({
    where: { schoolId, klassId },
    include: {
      teacher: { select: { id: true, name: true, phone: true } },
      subject: { select: { id: true, name: true } },
    },
  });
  const byTeacher = new Map<number, { id: number; name: string; phone: string; isClassTeacher: boolean; subjects: { id: number; name: string }[] }>();
  for (const r of rows) {
    let t = byTeacher.get(r.teacherId);
    if (!t) {
      t = { ...r.teacher, isClassTeacher: klass.classTeacherId === r.teacherId, subjects: [] };
      byTeacher.set(r.teacherId, t);
    }
    t.subjects.push({ id: r.subject.id, name: r.subject.name });
  }
  const teachers = [...byTeacher.values()].sort((a, b) => a.name.localeCompare(b.name));
  for (const t of teachers) t.subjects.sort((a, b) => a.name.localeCompare(b.name));
  res.json(teachers);
}));

// Exams for this class. Legacy school-wide terms (klassId null) show everywhere.
adminRouter.get('/classes/:id/exams', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const klassId = Number(req.params.id);
  await requireKlass(schoolId, klassId);
  const terms = await prisma.term.findMany({
    where: { schoolId, OR: [{ klassId }, { klassId: null }] },
    include: { subject: true },
    orderBy: { id: 'asc' },
  });
  res.json(terms.map(shapeExam));
}));

const examSchema = z.object({
  name: z.string().min(1),
  allSchool: z.boolean().default(false),
  // Null/absent = exam covers all subjects; set = single-subject test.
  subjectId: z.number().int().positive().nullable().optional(),
});
adminRouter.post('/classes/:id/exams', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const klassId = Number(req.params.id);
  await requireKlass(schoolId, klassId);
  const { name: rawName, allSchool, subjectId } = examSchema.parse(req.body);
  const name = rawName.trim();

  if (subjectId != null) {
    const subject = await prisma.subject.findFirst({ where: { id: subjectId, schoolId } });
    if (!subject) throw new HttpError(404, 'Subject not found');
  }

  // "All school" fans out to one row per class, so each class owns its copy
  // and can delete or grade it independently.
  const targets = allSchool
    ? (await prisma.klass.findMany({ where: { schoolId, ...LIVE }, select: { id: true } })).map((k) => k.id)
    : [klassId];

  // klassKey/subjectKey mirror the nullable columns so the unique index
  // actually fires — without them `skipDuplicates` silently does nothing.
  await prisma.term.createMany({
    data: targets.map((kId) => ({
      schoolId,
      klassId: kId,
      klassKey: kId,
      name,
      subjectId: subjectId ?? null,
      subjectKey: subjectId ?? 0,
    })),
    skipDuplicates: true,
  });
  const created = await prisma.term.findFirst({
    where: { schoolId, klassId, name, subjectId: subjectId ?? null, archivedAt: null },
    include: { subject: true },
  });
  // `count` is how many classes the exam was fanned out to; the rest is the
  // copy belonging to the class the admin was looking at.
  res.status(201).json({
    ...(created ? shapeExam(created) : { id: null, name, schoolWide: false, subjectScope: 'ALL', subject: null }),
    count: targets.length,
  });
}));

// Retire a graded exam. The marks and report cards behind it stay untouched —
// this only stops it appearing in the exam list and the grading picker.
adminRouter.post('/exams/:id/archive', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const { userId } = req.auth!;
  const id = Number(req.params.id);
  const term = await prisma.term.findFirst({ where: { id, schoolId } });
  if (!term) throw new HttpError(404, 'Exam not found');
  if (term.archivedAt) throw new HttpError(409, 'That exam is already archived', { code: 'ALREADY_ARCHIVED' });

  const usage = await examUsage(id);
  await prisma.$transaction(async (tx) => {
    await tx.term.update({ where: { id }, data: archiveData(id, userId) });
    await audit(tx, actorFrom(req), {
      action: 'ARCHIVE',
      entity: 'Term',
      entityId: id,
      label: term.name,
      summary: `${plural(usage.counts.marks, 'mark')} and ${plural(usage.counts.reportCards, 'report card')} retained.`,
    });
  });
  res.json({ ok: true });
}));

adminRouter.post('/exams/:id/restore', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const id = Number(req.params.id);
  const term = await prisma.term.findFirst({ where: { id, schoolId } });
  if (!term) throw new HttpError(404, 'Exam not found');

  await prisma.$transaction(async (tx) => {
    await tx.term.update({ where: { id }, data: restoreData() });
    await audit(tx, actorFrom(req), {
      action: 'RESTORE', entity: 'Term', entityId: id, label: term.name,
    });
  });
  res.json({ ok: true });
}));

adminRouter.delete('/exams/:id', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const id = Number(req.params.id);
  const term = await prisma.term.findFirst({ where: { id, schoolId } });
  if (!term) throw new HttpError(404, 'Exam not found');
  // Deleting a graded exam used to take every mark and report card with it.
  throwIfInUse(await examUsage(id), 'exam', 'ARCHIVE');
  await prisma.$transaction(async (tx) => {
    await tx.term.delete({ where: { id } });
    await audit(tx, actorFrom(req), {
      action: 'DELETE',
      entity: 'Term',
      entityId: id,
      label: term.name,
      summary: 'Deleted while ungraded — no marks existed.',
      before: { name: term.name, klassId: term.klassId, subjectId: term.subjectId },
    });
  });
  res.status(204).end();
}));

// --- Subjects (school-level catalogue) ---
adminRouter.get('/subjects', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const subjects = await prisma.subject.findMany({
    where: { schoolId, ...liveUnless(wantsArchived(req)) },
    orderBy: { name: 'asc' },
  });
  res.json(subjects.map((s) => ({ id: s.id, name: s.name, archivedAt: s.archivedAt })));
}));

const subjectSchema = z.object({ name: z.string().min(1) });
adminRouter.post('/subjects', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const { name: rawName } = subjectSchema.parse(req.body);
  const name = rawName.trim();
  const exists = await prisma.subject.findFirst({ where: { schoolId, name } });
  if (exists) throw new HttpError(409, `Subject "${name}" already exists`);
  const subject = await prisma.subject.create({ data: { schoolId, name } });
  res.status(201).json({ id: subject.id, name: subject.name });
}));

adminRouter.put('/subjects/:id', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const id = Number(req.params.id);
  const { name: rawName } = subjectSchema.parse(req.body);
  const name = rawName.trim();
  const subject = await prisma.subject.findFirst({ where: { id, schoolId } });
  if (!subject) throw new HttpError(404, 'Subject not found');
  const clash = await prisma.subject.findFirst({ where: { schoolId, name, id: { not: id } } });
  if (clash) throw new HttpError(409, `Subject "${name}" already exists`);

  // Marks and diary entries store the subject's *name*, not its id, so a rename
  // that only touched the Subject row would strand every historical mark under
  // the old name — and the grading screen keys on the name, so those marks would
  // become unreachable. Carry the rename through in the same transaction.
  // Result is unique on [studentId, termId, subject], so if a student already
  // has a mark filed under the new name — possible for a subject deleted before
  // these guards existed — the rename would collide. Say so instead of 500ing.
  if (subject.name !== name) {
    const collision = await prisma.result.findFirst({
      where: { subject: name, term: { schoolId } },
      select: { id: true },
    });
    if (collision) {
      throw new HttpError(409, `Some marks are already recorded under "${name}". Rename it to something else.`, {
        code: 'NAME_HAS_HISTORY',
      });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.subject.update({ where: { id }, data: { name } });
    if (subject.name !== name) {
      const marks = await tx.result.updateMany({
        where: { subject: subject.name, term: { schoolId } },
        data: { subject: name },
      });
      const diary = await tx.diaryEntry.updateMany({
        where: { schoolId, subject: subject.name },
        data: { subject: name },
      });
      await audit(tx, actorFrom(req), {
        action: 'UPDATE',
        entity: 'Subject',
        entityId: id,
        label: name,
        summary: `Renamed; carried through ${plural(marks.count, 'mark')} and ${plural(diary.count, 'diary entry', 'diary entries')}.`,
        before: { name: subject.name },
        after: { name },
      });
    }
    return row;
  });
  res.json({ id: updated.id, name: updated.name });
}));

// Retire a subject the school no longer teaches. Old marks, exams and diary
// entries keep naming it; it just stops being offered for new work.
adminRouter.post('/subjects/:id/archive', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const { userId } = req.auth!;
  const id = Number(req.params.id);
  const subject = await prisma.subject.findFirst({ where: { id, schoolId } });
  if (!subject) throw new HttpError(404, 'Subject not found');
  if (subject.archivedAt) throw new HttpError(409, 'That subject is already archived', { code: 'ALREADY_ARCHIVED' });

  const usage = await subjectUsage(schoolId, id, subject.name);
  await prisma.$transaction(async (tx) => {
    await tx.subject.update({ where: { id }, data: archiveData(id, userId) });
    // Teaching assignments describe the current timetable, not history, so they
    // go with the subject. Everything historical keeps pointing at the row.
    const unlinked = await tx.teachingAssignment.deleteMany({ where: { schoolId, subjectId: id } });
    await audit(tx, actorFrom(req), {
      action: 'ARCHIVE',
      entity: 'Subject',
      entityId: id,
      label: subject.name,
      summary:
        `${plural(usage.counts.marks, 'mark')} and ${plural(usage.counts.exams, 'exam')} retained; ` +
        `${plural(unlinked.count, 'teacher assignment')} removed.`,
    });
  });
  res.json({ ok: true });
}));

adminRouter.post('/subjects/:id/restore', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const id = Number(req.params.id);
  const subject = await prisma.subject.findFirst({ where: { id, schoolId } });
  if (!subject) throw new HttpError(404, 'Subject not found');
  // A live subject may have taken the name in the meantime.
  const clash = await prisma.subject.findFirst({
    where: { schoolId, name: subject.name, archivedAt: null, id: { not: id } },
  });
  if (clash) {
    throw new HttpError(409, `A live subject is already called "${subject.name}". Rename it first.`, {
      code: 'NAME_TAKEN',
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.subject.update({ where: { id }, data: restoreData() });
    await audit(tx, actorFrom(req), {
      action: 'RESTORE',
      entity: 'Subject',
      entityId: id,
      label: subject.name,
      summary: 'Teacher assignments are not restored — reassign it to classes.',
    });
  });
  res.json({ ok: true });
}));

adminRouter.delete('/subjects/:id', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const id = Number(req.params.id);
  const subject = await prisma.subject.findFirst({ where: { id, schoolId } });
  if (!subject) throw new HttpError(404, 'Subject not found');
  // The worst path in the app before this check existed: deleting a subject
  // cascaded to its single-subject exams and from there to every mark under
  // them, school-wide and across every year, with no confirmation.
  throwIfInUse(await subjectUsage(schoolId, id, subject.name), 'subject', 'ARCHIVE');
  await prisma.$transaction(async (tx) => {
    await tx.subject.delete({ where: { id } });
    await audit(tx, actorFrom(req), {
      action: 'DELETE',
      entity: 'Subject',
      entityId: id,
      label: subject.name,
      summary: 'Deleted while unused — nothing referenced it.',
      before: { name: subject.name },
    });
  });
  res.status(204).end();
}));

// --- Parent-student links ---
const linkSchema = z.object({
  parentUserId: z.number(),
  studentId: z.number(),
  relation: z.string().default('Parent'),
});
adminRouter.post('/parent-links', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const data = linkSchema.parse(req.body);
  const [parent, student] = await Promise.all([
    prisma.user.findFirst({ where: { id: data.parentUserId, schoolId, role: 'PARENT' } }),
    prisma.student.findFirst({ where: { id: data.studentId, schoolId } }),
  ]);
  if (!parent || !student) throw new HttpError(404, 'Parent or student not found in school');
  const link = await prisma.parentStudentLink.upsert({
    where: { parentUserId_studentId: { parentUserId: data.parentUserId, studentId: data.studentId } },
    create: data,
    update: { relation: data.relation },
  });
  res.status(201).json(link);
}));

// --- Notices ---
const noticeSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  category: z.string().default('General'),
  pinned: z.boolean().default(false),
  // null / omitted = every parent in the school; a class id targets one class.
  audienceClassId: z.number().nullable().optional(),
});

// Acknowledgement is per parent, so the denominator is how many parents the
// notice actually reaches — the whole school, or just that class's guardians.
async function parentReach(schoolId: number, audienceClassId: number | null) {
  if (audienceClassId === null) {
    return prisma.user.count({ where: { schoolId, role: 'PARENT' } });
  }
  const links = await prisma.parentStudentLink.findMany({
    where: { student: { schoolId, enrollments: { some: { klassId: audienceClassId } } } },
    select: { parentUserId: true },
  });
  return new Set(links.map((l) => l.parentUserId)).size;
}

function noticeView(n: {
  id: number;
  title: string;
  body: string;
  category: string;
  pinned: boolean;
  createdAt: Date;
  audienceClassId: number | null;
  createdBy: { name: string } | null;
  audienceClass: { grade: string; section: string } | null;
  _count: { acks: number };
}) {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    category: n.category,
    pinned: n.pinned,
    createdAt: n.createdAt,
    from: n.createdBy?.name ?? 'School Office',
    audienceClassId: n.audienceClassId,
    audienceLabel: n.audienceClass
      ? `${n.audienceClass.grade}-${n.audienceClass.section}`
      : null,
    ackCount: n._count.acks,
  };
}

const noticeInclude = {
  createdBy: { select: { name: true } },
  audienceClass: { select: { grade: true, section: true } },
  _count: { select: { acks: true } },
} as const;

adminRouter.get('/notices', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const [notices, schoolParents] = await Promise.all([
    prisma.notice.findMany({
      where: { schoolId },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      include: noticeInclude,
    }),
    prisma.user.count({ where: { schoolId, role: 'PARENT' } }),
  ]);

  // Class-targeted notices reach only that class's guardians, so their
  // denominator differs from the school-wide one. Resolve each distinct
  // audience class once rather than per notice.
  const classIds = [
    ...new Set(notices.map((n) => n.audienceClassId).filter((id): id is number => id !== null)),
  ];
  const reachByClass = new Map<number, number>();
  await Promise.all(
    classIds.map(async (id) => reachByClass.set(id, await parentReach(schoolId, id))),
  );

  res.json(
    notices.map((n) => ({
      ...noticeView(n),
      totalParents:
        n.audienceClassId === null
          ? schoolParents
          : (reachByClass.get(n.audienceClassId) ?? 0),
    })),
  );
}));

adminRouter.get('/notices/:id', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const notice = await prisma.notice.findFirst({
    where: { id: Number(req.params.id), schoolId },
    include: noticeInclude,
  });
  if (!notice) throw new HttpError(404, 'Notice not found');
  const totalParents = await parentReach(schoolId, notice.audienceClassId);
  res.json({ ...noticeView(notice), totalParents });
}));

adminRouter.post('/notices', ah(async (req, res) => {
  const { userId } = req.auth!;
  const schoolId = requireSchoolId(req);
  const { audienceClassId = null, ...data } = noticeSchema.parse(req.body);
  if (audienceClassId !== null) await requireKlass(schoolId, audienceClassId);

  const notice = await prisma.notice.create({
    data: {
      schoolId,
      ...data,
      audienceType: audienceClassId === null ? 'SCHOOL' : 'CLASS',
      audienceClassId,
      createdById: userId,
    },
    include: noticeInclude,
  });
  res.status(201).json(noticeView(notice));
}));

adminRouter.put('/notices/:id', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const id = Number(req.params.id);
  const data = noticeSchema.partial().parse(req.body);
  const existing = await prisma.notice.findFirst({ where: { id, schoolId } });
  if (!existing) throw new HttpError(404, 'Notice not found');
  if (data.audienceClassId != null) await requireKlass(schoolId, data.audienceClassId);

  const notice = await prisma.notice.update({
    where: { id },
    data: {
      ...data,
      // Only touch audience when the caller actually sent the field.
      ...('audienceClassId' in data
        ? {
            audienceClassId: data.audienceClassId ?? null,
            audienceType: data.audienceClassId == null ? 'SCHOOL' : 'CLASS',
          }
        : {}),
    },
    include: noticeInclude,
  });
  res.json(noticeView(notice));
}));

adminRouter.delete('/notices/:id', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const id = Number(req.params.id);
  const notice = await prisma.notice.findFirst({ where: { id, schoolId } });
  if (!notice) throw new HttpError(404, 'Notice not found');
  // Read receipts go with it, so record how many were on the row.
  const acks = await prisma.noticeAck.count({ where: { noticeId: id } });
  await prisma.$transaction(async (tx) => {
    await tx.notice.delete({ where: { id } });
    await audit(tx, actorFrom(req), {
      action: 'DELETE',
      entity: 'Notice',
      entityId: id,
      label: notice.title,
      summary: `${plural(acks, 'read receipt')} removed with it.`,
      before: { title: notice.title, body: notice.body },
    });
  });
  res.status(204).end();
}));

// --- Dashboard (admin home: stat cards + infographics) ---

// Attendance dates are stored as @db.Date, i.e. UTC midnight — the same
// normalisation the teacher marking route uses, so keys line up across routes.
function utcDay(d: Date) {
  return new Date(d.toISOString().slice(0, 10));
}

// A day counts as "attending" for both PRESENT and LATE — a late child was
// still in school. HOLIDAY rows are excluded from the denominator entirely.
function rateOf(present: number, late: number, absent: number) {
  const marked = present + late + absent;
  return marked ? Math.round(((present + late) / marked) * 100) : 0;
}

const TREND_DAYS = 14;

const blankTally = () => ({ present: 0, late: 0, absent: 0, holiday: 0 });
type Tally = ReturnType<typeof blankTally>;

/**
 * One day's attendance for the whole school, split per class. Shared by the
 * home dashboard and the attendance screens so both count the same way.
 */
async function attendanceForDay(schoolId: number, day: Date) {
  const [classes, marks] = await Promise.all([
    prisma.klass.findMany({
      where: { schoolId },
      orderBy: [{ grade: 'asc' }, { section: 'asc' }],
      include: { _count: { select: { enrollments: true } } },
    }),
    prisma.attendance.findMany({
      where: { schoolId, date: day },
      select: {
        status: true,
        student: { select: { enrollments: { select: { klassId: true } } } },
      },
    }),
  ]);

  const school = blankTally();
  const byKlass = new Map<number, Tally>();
  for (const m of marks) {
    const key = m.status.toLowerCase() as keyof Tally;
    school[key] += 1;
    // A student's current class is their latest enrollment, matching /students.
    const klassId = m.student.enrollments.at(-1)?.klassId;
    if (klassId === undefined) continue;
    let k = byKlass.get(klassId);
    if (!k) { k = blankTally(); byKlass.set(klassId, k); }
    k[key] += 1;
  }

  const byClass = classes.map((c) => {
    const a = byKlass.get(c.id) ?? blankTally();
    return {
      id: c.id,
      label: `${c.grade}-${c.section}`,
      students: c._count.enrollments,
      present: a.present,
      late: a.late,
      absent: a.absent,
      marked: a.present + a.late + a.absent,
      pct: rateOf(a.present, a.late, a.absent),
    };
  });

  return {
    date: day.toISOString().slice(0, 10),
    present: school.present,
    late: school.late,
    absent: school.absent,
    marked: school.present + school.late + school.absent,
    pct: rateOf(school.present, school.late, school.absent),
    // Classes with a roster but nothing marked — the admin's nudge list.
    classesPending: byClass.filter((c) => c.students > 0 && c.marked === 0).length,
    byClass,
  };
}

// The date the screens work off: ?date=YYYY-MM-DD, defaulting to today.
function dayParam(req: { query: Record<string, unknown> }) {
  const raw = req.query.date;
  return typeof raw === 'string' && raw ? parseDay(raw) : utcDay(new Date());
}

// Attendance overview for one day, school-wide and by class.
adminRouter.get('/attendance', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  res.json(await attendanceForDay(schoolId, dayParam(req)));
}));

// One class's roster for a day, each student with their mark (null = unmarked).
adminRouter.get('/classes/:id/attendance', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const klassId = Number(req.params.id);
  const klass = await requireKlass(schoolId, klassId);
  const day = dayParam(req);

  const enrollments = await prisma.enrollment.findMany({
    where: { klassId, student: { ...LIVE } },
    include: { student: { select: { id: true, name: true, admissionNo: true } } },
    orderBy: { student: { name: 'asc' } },
  });
  const studentIds = enrollments.map((e) => e.studentId);
  const marks = studentIds.length
    ? await prisma.attendance.findMany({
        where: { date: day, studentId: { in: studentIds } },
        select: { studentId: true, status: true },
      })
    : [];
  const statusOf = new Map(marks.map((m) => [m.studentId, m.status]));

  const tally = blankTally();
  const roster = enrollments.map((e, i) => {
    const status = statusOf.get(e.studentId) ?? null;
    if (status) tally[status.toLowerCase() as keyof Tally] += 1;
    return {
      id: e.student.id,
      // Roll numbers are positional within the sorted roster, as elsewhere.
      roll: String(i + 1).padStart(2, '0'),
      name: e.student.name,
      admissionNo: e.student.admissionNo,
      status,
    };
  });

  res.json({
    date: day.toISOString().slice(0, 10),
    klass: { id: klass.id, label: `${klass.grade}-${klass.section}` },
    students: roster.length,
    present: tally.present,
    late: tally.late,
    absent: tally.absent,
    marked: tally.present + tally.late + tally.absent,
    pct: rateOf(tally.present, tally.late, tally.absent),
    roster,
  });
}));

adminRouter.get('/dashboard', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const today = utcDay(new Date());
  const windowStart = new Date(today);
  windowStart.setUTCDate(windowStart.getUTCDate() - (TREND_DAYS - 1));

  const [
    students,
    teachers,
    parents,
    subjects,
    attendance,
    pendingLeaves,
    trendGroups,
    upcomingEvents,
    recentNotices,
    schoolParents,
  ] = await Promise.all([
    prisma.student.count({ where: { schoolId } }),
    prisma.user.count({ where: { schoolId, role: 'TEACHER' } }),
    prisma.user.count({ where: { schoolId, role: 'PARENT' } }),
    prisma.subject.count({ where: { schoolId } }),
    attendanceForDay(schoolId, today),
    prisma.leaveRequest.count({ where: { schoolId, status: 'SUBMITTED' } }),
    prisma.attendance.groupBy({
      by: ['date', 'status'],
      where: { schoolId, date: { gte: windowStart, lte: today } },
      _count: { _all: true },
    }),
    prisma.event.findMany({
      where: { schoolId, date: { gte: today } },
      orderBy: { date: 'asc' },
      take: 3,
    }),
    prisma.notice.findMany({
      where: { schoolId },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: 3,
      include: noticeInclude,
    }),
    prisma.user.count({ where: { schoolId, role: 'PARENT' } }),
  ]);

  // --- 14-day trend, school days only (a day with no marks isn't plotted) ---
  const byDate = new Map<string, Tally>();
  for (const g of trendGroups) {
    const key = g.date.toISOString().slice(0, 10);
    let d = byDate.get(key);
    if (!d) { d = blankTally(); byDate.set(key, d); }
    d[g.status.toLowerCase() as keyof Tally] += g._count._all;
  }
  const trend = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, a]) => ({
      date,
      present: a.present,
      late: a.late,
      absent: a.absent,
      pct: rateOf(a.present, a.late, a.absent),
    }))
    // Holiday-only days carry no signal, so they'd flatline the chart at 0.
    .filter((d) => d.present + d.late + d.absent > 0);

  res.json({
    counts: {
      students,
      teachers,
      parents,
      classes: attendance.byClass.length,
      subjects,
    },
    attendance: { ...attendance, trend },
    pendingLeaves,
    upcomingEvents: upcomingEvents.map(eventView),
    recentNotices: recentNotices.map((n) => ({
      ...noticeView(n),
      totalParents: schoolParents,
    })),
  });
}));

// --- Events ---
const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  date: z.string(),
});

function eventView(e: { id: number; title: string; description: string | null; date: Date }) {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    date: e.date.toISOString().slice(0, 10),
  };
}

// Dates arrive as plain YYYY-MM-DD; parse as UTC midnight so the stored @db.Date
// can't drift a day either side of the school's timezone.
function parseDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(400, 'Date must be YYYY-MM-DD');
  const d = new Date(`${value}T00:00:00.000Z`);
  // V8 rolls impossible dates forward rather than rejecting them (2026-02-31
  // becomes 2026-03-03), so compare the round-trip instead of just NaN.
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, 'Date is not a real calendar date');
  }
  return d;
}

adminRouter.get('/events', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const events = await prisma.event.findMany({ where: { schoolId }, orderBy: { date: 'asc' } });
  res.json(events.map(eventView));
}));

adminRouter.post('/events', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const data = eventSchema.parse(req.body);
  const event = await prisma.event.create({
    data: {
      schoolId,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      date: parseDay(data.date),
    },
  });
  res.status(201).json(eventView(event));
}));

adminRouter.put('/events/:id', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const id = Number(req.params.id);
  const data = eventSchema.partial().parse(req.body);
  const existing = await prisma.event.findFirst({ where: { id, schoolId } });
  if (!existing) throw new HttpError(404, 'Event not found');

  const event = await prisma.event.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.description !== undefined
        ? { description: data.description.trim() || null }
        : {}),
      ...(data.date !== undefined ? { date: parseDay(data.date) } : {}),
    },
  });
  res.json(eventView(event));
}));

adminRouter.delete('/events/:id', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const id = Number(req.params.id);
  const event = await prisma.event.findFirst({ where: { id, schoolId } });
  if (!event) throw new HttpError(404, 'Event not found');
  await prisma.$transaction(async (tx) => {
    await tx.event.delete({ where: { id } });
    await audit(tx, actorFrom(req), {
      action: 'DELETE',
      entity: 'Event',
      entityId: id,
      label: event.title,
      before: { title: event.title, date: event.date },
    });
  });
  res.status(204).end();
}));

// --- Photo albums (shared with the teacher app) ---
mountGalleryRoutes(adminRouter);
