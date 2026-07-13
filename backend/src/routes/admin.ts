import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, HttpError } from '../lib/http.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('ADMIN'));

// --- Users ---
adminRouter.get('/users', ah(async (req, res) => {
  const { schoolId } = req.auth!;
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
  const { schoolId } = req.auth!;
  const data = userSchema.parse(req.body);
  const exists = await prisma.user.findFirst({ where: { schoolId, phone: data.phone, role: data.role } });
  if (exists) throw new HttpError(409, 'User with this phone and role already exists');
  const user = await prisma.user.create({ data: { schoolId, ...data } });
  res.status(201).json({ id: user.id, name: user.name, phone: user.phone, role: user.role });
}));

// --- Students ---
adminRouter.get('/students', ah(async (req, res) => {
  const { schoolId } = req.auth!;
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
  const { schoolId } = req.auth!;
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
  const { schoolId } = req.auth!;
  const classes = await prisma.klass.findMany({
    where: { schoolId },
    orderBy: [{ grade: 'asc' }, { section: 'asc' }],
    include: { classTeacher: true, _count: { select: { enrollments: true } } },
  });
  res.json(
    classes.map((c) => ({
      id: c.id,
      label: `${c.grade}-${c.section}`,
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
  const { schoolId } = req.auth!;
  const data = classSchema.parse(req.body);
  const klass = await prisma.klass.create({
    data: { schoolId, grade: data.grade, section: data.section, classTeacherId: data.classTeacherId ?? null },
  });
  res.status(201).json(klass);
}));

// --- Parent-student links ---
const linkSchema = z.object({
  parentUserId: z.number(),
  studentId: z.number(),
  relation: z.string().default('Parent'),
});
adminRouter.post('/parent-links', ah(async (req, res) => {
  const { schoolId } = req.auth!;
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
  const { userId, schoolId } = req.auth!;
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
  const { schoolId } = req.auth!;
  const events = await prisma.event.findMany({ where: { schoolId }, orderBy: { date: 'asc' } });
  res.json(events.map((e) => ({ ...e, date: e.date.toISOString().slice(0, 10) })));
}));
adminRouter.post('/events', ah(async (req, res) => {
  const { schoolId } = req.auth!;
  const data = eventSchema.parse(req.body);
  const event = await prisma.event.create({
    data: { schoolId, title: data.title, description: data.description, date: new Date(data.date) },
  });
  res.status(201).json(event);
}));
