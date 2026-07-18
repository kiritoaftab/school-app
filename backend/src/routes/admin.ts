import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, HttpError } from '../lib/http.js';
import { requireAuth, requireRole, requireSchoolId } from '../middleware/auth.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('ADMIN'));

// --- Users ---
adminRouter.get('/users', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const role = req.query.role as string | undefined;
  const users = await prisma.user.findMany({
    where: { schoolId, ...(role ? { role: role as any } : {}) },
    orderBy: { name: 'asc' },
  });
  res.json(users.map((u) => ({ id: u.id, name: u.name, phone: u.phone, role: u.role })));
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

  const exists = await prisma.user.findFirst({ where: { schoolId, phone, role: 'TEACHER' } });
  if (exists) throw new HttpError(409, 'A teacher with this phone already exists');

  // Every referenced class & subject must belong to this school.
  const klassIds = [...new Set([
    ...data.assignments.map((a) => a.klassId),
    ...(data.classTeacherOf != null ? [data.classTeacherOf] : []),
  ])];
  const subjectIds = [...new Set(data.assignments.flatMap((a) => a.subjectIds))];
  const [klasses, subjects] = await Promise.all([
    klassIds.length ? prisma.klass.findMany({ where: { id: { in: klassIds }, schoolId }, select: { id: true } }) : Promise.resolve([]),
    subjectIds.length ? prisma.subject.findMany({ where: { id: { in: subjectIds }, schoolId }, select: { id: true } }) : Promise.resolve([]),
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
      ? prisma.subject.findMany({ where: { id: { in: wanted }, schoolId }, select: { id: true } })
      : Promise.resolve([]),
  ]);
  if (!teacher) throw new HttpError(404, 'Teacher not found');
  if (!klass) throw new HttpError(404, 'Class not found in this school');
  if (subjects.length !== wanted.length) {
    throw new HttpError(404, 'A selected subject was not found in this school');
  }

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
  res.json({ ok: true });
}));

// Remove a whole class from a teacher (every subject they teach in it).
adminRouter.delete('/teachers/:id/assignments/:klassId', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const teacherId = Number(req.params.id);
  const klassId = Number(req.params.klassId);
  const teacher = await prisma.user.findFirst({ where: { id: teacherId, schoolId, role: 'TEACHER' } });
  if (!teacher) throw new HttpError(404, 'Teacher not found');

  await prisma.teachingAssignment.deleteMany({ where: { schoolId, teacherId, klassId } });
  // Leading a class you no longer teach in is allowed, so classTeacherId is left alone.
  res.status(204).end();
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

  if (isClassTeacher) {
    await prisma.klass.update({ where: { id: klassId }, data: { classTeacherId: teacherId } });
  } else if (klass.classTeacherId === teacherId) {
    await prisma.klass.update({ where: { id: klassId }, data: { classTeacherId: null } });
  }
  res.json({ ok: true });
}));

// --- Students ---
adminRouter.get('/students', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const students = await prisma.student.findMany({
    where: { schoolId },
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
    where: { schoolId },
    orderBy: [{ grade: 'asc' }, { section: 'asc' }],
    include: { classTeacher: true, _count: { select: { enrollments: true } } },
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

  const exists = await prisma.klass.findFirst({ where: { schoolId, grade, section } });
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
  res.status(201).json({
    id: klass.id,
    label: `${klass.grade}-${klass.section}`,
    grade: klass.grade,
    section: klass.section,
    classTeacherId: klass.classTeacherId,
  });
}));

// --- Class detail tabs: students, teachers, exams ---

// Shared guard: the class must exist in the caller's school.
async function requireKlass(schoolId: number, klassId: number) {
  const klass = await prisma.klass.findFirst({ where: { id: klassId, schoolId } });
  if (!klass) throw new HttpError(404, 'Class not found in this school');
  return klass;
}

// Admission numbers are generated, not typed — "2026-0007" style, per school.
async function nextAdmissionNo(schoolId: number) {
  const year = new Date().getFullYear();
  const count = await prisma.student.count({ where: { schoolId } });
  return `${year}-${String(count + 1).padStart(4, '0')}`;
}

adminRouter.get('/classes/:id/students', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const klassId = Number(req.params.id);
  await requireKlass(schoolId, klassId);

  const enrollments = await prisma.enrollment.findMany({
    where: { klassId },
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
    }
  });
  res.json({ ok: true });
}));

adminRouter.delete('/students/:id', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const id = Number(req.params.id);
  const student = await prisma.student.findFirst({ where: { id, schoolId } });
  if (!student) throw new HttpError(404, 'Student not found');
  // Enrollments, links, attendance and results cascade from Student.
  await prisma.student.delete({ where: { id } });
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
    orderBy: { id: 'asc' },
  });
  res.json(terms.map((t) => ({ id: t.id, name: t.name, schoolWide: t.klassId === null })));
}));

const examSchema = z.object({ name: z.string().min(1), allSchool: z.boolean().default(false) });
adminRouter.post('/classes/:id/exams', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const klassId = Number(req.params.id);
  await requireKlass(schoolId, klassId);
  const { name: rawName, allSchool } = examSchema.parse(req.body);
  const name = rawName.trim();

  // "All school" fans out to one row per class, so each class owns its copy
  // and can delete or grade it independently.
  const targets = allSchool
    ? (await prisma.klass.findMany({ where: { schoolId }, select: { id: true } })).map((k) => k.id)
    : [klassId];

  await prisma.term.createMany({
    data: targets.map((kId) => ({ schoolId, klassId: kId, name })),
    skipDuplicates: true,
  });
  const created = await prisma.term.findFirst({ where: { schoolId, klassId, name } });
  res.status(201).json({ id: created?.id ?? null, name, count: targets.length });
}));

adminRouter.delete('/exams/:id', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const id = Number(req.params.id);
  const term = await prisma.term.findFirst({ where: { id, schoolId } });
  if (!term) throw new HttpError(404, 'Exam not found');
  await prisma.term.delete({ where: { id } });
  res.status(204).end();
}));

// --- Subjects (school-level catalogue) ---
adminRouter.get('/subjects', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const subjects = await prisma.subject.findMany({
    where: { schoolId },
    orderBy: { name: 'asc' },
  });
  res.json(subjects.map((s) => ({ id: s.id, name: s.name })));
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
  const updated = await prisma.subject.update({ where: { id }, data: { name } });
  res.json({ id: updated.id, name: updated.name });
}));

adminRouter.delete('/subjects/:id', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const id = Number(req.params.id);
  const subject = await prisma.subject.findFirst({ where: { id, schoolId } });
  if (!subject) throw new HttpError(404, 'Subject not found');
  await prisma.subject.delete({ where: { id } });
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

// --- School-wide notices & events ---
const noticeSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  category: z.string().default('General'),
  pinned: z.boolean().default(false),
});
adminRouter.post('/notices', ah(async (req, res) => {
  const { userId } = req.auth!;
  const schoolId = requireSchoolId(req);
  const data = noticeSchema.parse(req.body);
  const notice = await prisma.notice.create({
    data: { schoolId, ...data, audienceType: 'SCHOOL', createdById: userId },
  });
  res.status(201).json(notice);
}));

const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  date: z.string(),
});
adminRouter.get('/events', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const events = await prisma.event.findMany({ where: { schoolId }, orderBy: { date: 'asc' } });
  res.json(events.map((e) => ({ ...e, date: e.date.toISOString().slice(0, 10) })));
}));
adminRouter.post('/events', ah(async (req, res) => {
  const schoolId = requireSchoolId(req);
  const data = eventSchema.parse(req.body);
  const event = await prisma.event.create({
    data: { schoolId, title: data.title, description: data.description, date: new Date(data.date) },
  });
  res.status(201).json(event);
}));
