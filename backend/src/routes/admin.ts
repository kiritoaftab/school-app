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
