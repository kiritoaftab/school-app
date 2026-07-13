import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, HttpError } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { signToken } from '../lib/jwt.js';
import {
  compareOtp,
  generateOtp,
  hashOtp,
  otpExpiry,
  smsProvider,
} from '../lib/otp.js';
import { config } from '../config.js';

export const authRouter = Router();

const requestSchema = z.object({
  phone: z.string().min(6),
  role: z.enum(['PARENT', 'TEACHER', 'ADMIN']),
});

authRouter.post(
  '/request-otp',
  ah(async (req, res) => {
    const { phone, role } = requestSchema.parse(req.body);

    // Role is authoritative from the user record. The selected role must match
    // a real user with that phone, otherwise we reject (a parent can't log in
    // as admin).
    const user = await prisma.user.findFirst({ where: { phone, role } });
    if (!user) {
      throw new HttpError(404, `No ${role.toLowerCase()} account found for this phone`);
    }

    const code = generateOtp();
    await prisma.otpCode.create({
      data: { phone, codeHash: await hashOtp(code), expiresAt: otpExpiry() },
    });
    await smsProvider.send(phone, code);

    res.json({
      ok: true,
      // Only surfaced in dev so the client can auto-fill / testers can see it.
      devCode: config.isProd ? undefined : code,
    });
  }),
);

const verifySchema = z.object({
  phone: z.string().min(6),
  role: z.enum(['PARENT', 'TEACHER', 'ADMIN']),
  otp: z.string().min(4),
});

authRouter.post(
  '/verify-otp',
  ah(async (req, res) => {
    const { phone, role, otp } = verifySchema.parse(req.body);

    const record = await prisma.otpCode.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record || !(await compareOtp(otp, record.codeHash))) {
      throw new HttpError(400, 'Invalid or expired code');
    }

    const user = await prisma.user.findFirst({ where: { phone, role } });
    if (!user) throw new HttpError(404, 'Account not found');

    await prisma.otpCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    const token = signToken({ userId: user.id, role: user.role, schoolId: user.schoolId });
    res.json({
      token,
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role, schoolId: user.schoolId },
    });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    const { userId } = req.auth!;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        school: true,
        parentLinks: { include: { student: true } },
      },
    });
    if (!user) throw new HttpError(404, 'User not found');

    res.json({
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      schoolId: user.schoolId,
      school: { id: user.school.id, name: user.school.name },
      students: user.parentLinks.map((l) => ({
        id: l.student.id,
        name: l.student.name,
        relation: l.relation,
      })),
    });
  }),
);
