import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, HttpError } from '../lib/http.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

// Platform-owner surface: create/manage schools and their admins.
// Guarded by SUPER_ADMIN — the only role not bound to a single school.
export const platformRouter = Router();
platformRouter.use(requireAuth, requireRole('SUPER_ADMIN'));

/** Parse a positive integer path param, 400 otherwise. */
function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid id');
  return id;
}

const adminInput = z.object({
  name: z.string().min(1),
  phone: z.string().min(6),
});

// --- Schools ---
platformRouter.get('/schools', ah(async (_req, res) => {
  const schools = await prisma.school.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { users: true, students: true, classes: true } } },
  });
  res.json(
    schools.map((s) => ({
      id: s.id,
      name: s.name,
      timezone: s.timezone,
      createdAt: s.createdAt,
      counts: { users: s._count.users, students: s._count.students, classes: s._count.classes },
    })),
  );
}));

const createSchoolSchema = z.object({
  name: z.string().min(1),
  timezone: z.string().min(1).optional(),
  // Optionally provision the school's first admin in the same request.
  admin: adminInput.optional(),
});
platformRouter.post('/schools', ah(async (req, res) => {
  const data = createSchoolSchema.parse(req.body);
  const { school, admin } = await prisma.$transaction(async (tx) => {
    const school = await tx.school.create({
      data: { name: data.name, ...(data.timezone ? { timezone: data.timezone } : {}) },
    });
    const admin = data.admin
      ? await tx.user.create({
          data: { schoolId: school.id, name: data.admin.name, phone: data.admin.phone, role: 'ADMIN' },
        })
      : null;
    return { school, admin };
  });
  res.status(201).json({
    id: school.id,
    name: school.name,
    timezone: school.timezone,
    createdAt: school.createdAt,
    admin: admin ? { id: admin.id, name: admin.name, phone: admin.phone } : null,
  });
}));

platformRouter.get('/schools/:id', ah(async (req, res) => {
  const id = parseId(req.params.id);
  const school = await prisma.school.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true, students: true, classes: true } },
      users: { where: { role: 'ADMIN' }, orderBy: { name: 'asc' }, select: { id: true, name: true, phone: true } },
    },
  });
  if (!school) throw new HttpError(404, 'School not found');
  res.json({
    id: school.id,
    name: school.name,
    timezone: school.timezone,
    createdAt: school.createdAt,
    counts: { users: school._count.users, students: school._count.students, classes: school._count.classes },
    admins: school.users,
  });
}));

const updateSchoolSchema = z
  .object({ name: z.string().min(1).optional(), timezone: z.string().min(1).optional() })
  .refine((d) => d.name !== undefined || d.timezone !== undefined, { message: 'Nothing to update' });
platformRouter.patch('/schools/:id', ah(async (req, res) => {
  const id = parseId(req.params.id);
  const data = updateSchoolSchema.parse(req.body);
  const exists = await prisma.school.findUnique({ where: { id } });
  if (!exists) throw new HttpError(404, 'School not found');
  const school = await prisma.school.update({ where: { id }, data });
  res.json({ id: school.id, name: school.name, timezone: school.timezone, createdAt: school.createdAt });
}));

platformRouter.delete('/schools/:id', ah(async (req, res) => {
  const id = parseId(req.params.id);
  const exists = await prisma.school.findUnique({ where: { id } });
  if (!exists) throw new HttpError(404, 'School not found');
  // Cascades to users, students, classes and all school-scoped rows.
  await prisma.school.delete({ where: { id } });
  res.status(204).end();
}));

// --- School admins ---
platformRouter.get('/schools/:id/admins', ah(async (req, res) => {
  const schoolId = parseId(req.params.id);
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) throw new HttpError(404, 'School not found');
  const admins = await prisma.user.findMany({
    where: { schoolId, role: 'ADMIN' },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, phone: true },
  });
  res.json(admins);
}));

platformRouter.post('/schools/:id/admins', ah(async (req, res) => {
  const schoolId = parseId(req.params.id);
  const data = adminInput.parse(req.body);
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) throw new HttpError(404, 'School not found');
  const dup = await prisma.user.findFirst({ where: { schoolId, phone: data.phone, role: 'ADMIN' } });
  if (dup) throw new HttpError(409, 'An admin with this phone already exists in this school');
  const admin = await prisma.user.create({
    data: { schoolId, name: data.name, phone: data.phone, role: 'ADMIN' },
  });
  res.status(201).json({ id: admin.id, name: admin.name, phone: admin.phone });
}));
