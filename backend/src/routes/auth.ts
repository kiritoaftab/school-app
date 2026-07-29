import { Router } from 'express';
import type { Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { ah, HttpError } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { signToken } from '../lib/jwt.js';
import { auditAfter } from '../lib/audit.js';
import {
  compareOtp,
  generateOtp,
  hashOtp,
  otpExpiry,
  smsProvider,
} from '../lib/otp.js';
import { config } from '../config.js';

export const authRouter = Router();

/**
 * One row of the "which of my profiles am I using" list.
 *
 * A phone can hold several accounts — the unique key is [schoolId, phone, role]
 * — so the same person may be a PARENT at two schools, or a parent at one and
 * an admin at another. Every surface that offers a choice between them (the
 * login picker, the in-app switcher) speaks this shape.
 */
type ProfileUser = {
  id: number;
  name: string;
  phone: string;
  role: Role;
  schoolId: number | null;
  school: { id: number; name: string; logo: string | null } | null;
};

function toProfile(user: ProfileUser) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    schoolId: user.schoolId,
    school: user.school
      ? { id: user.school.id, name: user.school.name, logo: user.school.logo }
      : null,
  };
}

const requestSchema = z.object({
  phone: z.string().min(6),
});

authRouter.post(
  '/request-otp',
  ah(async (req, res) => {
    const { phone } = requestSchema.parse(req.body);

    // Phone-only login: role is derived from the user record at verify time.
    // We still require a matching account so we don't SMS arbitrary numbers.
    // `archivedAt: null` is what actually takes access away from someone who
    // has left — every other archived-row filter is presentational next to it.
    const user = await prisma.user.findFirst({ where: { phone, archivedAt: null } });
    if (!user) {
      throw new HttpError(404, 'No account found for this phone');
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
  otp: z.string().min(4),
});

authRouter.post(
  '/verify-otp',
  ah(async (req, res) => {
    const { phone, otp } = verifySchema.parse(req.body);

    const record = await prisma.otpCode.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record || !(await compareOtp(otp, record.codeHash))) {
      throw new HttpError(400, 'Invalid or expired code');
    }

    // A phone can map to several accounts (e.g. PARENT in one school, ADMIN in
    // another) — unique key is [schoolId, phone, role]. The OTP proves the phone,
    // so every account on it belongs to this person. We mint a token per account
    // and let the client pick which profile to enter.
    // Archived accounts are excluded here too: holding a valid OTP must not get
    // a retired teacher back into a school's data.
    const users = await prisma.user.findMany({
      where: { phone, archivedAt: null },
      include: { school: true },
      orderBy: { id: 'asc' },
    });
    if (users.length === 0) throw new HttpError(404, 'Account not found');

    await prisma.otpCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    const accounts = users.map((user) => ({
      token: signToken({ userId: user.id, role: user.role, schoolId: user.schoolId }),
      ...toProfile(user),
    }));

    // One row per account the OTP unlocked. The phone proves the person, so
    // every account on it is a sign-in, whichever profile they then enter.
    for (const user of users) {
      auditAfter(
        { userId: user.id, role: user.role, schoolId: user.schoolId, ip: req.ip, name: user.name },
        { action: 'LOGIN', entity: 'User', entityId: user.id, label: user.name },
      );
    }

    res.json({ accounts });
  }),
);

/**
 * Every profile reachable from the signed-in one, so the app can offer a
 * switcher instead of making a two-school parent sign out and back in.
 *
 * Read live rather than from the login response: a school added after the
 * current token was minted should appear without a fresh OTP, and one the
 * parent was removed from should disappear.
 */
authRouter.get(
  '/profiles',
  requireAuth,
  ah(async (req, res) => {
    const { userId } = req.auth!;
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    if (!me) throw new HttpError(404, 'User not found');

    const users = await prisma.user.findMany({
      where: { phone: me.phone, archivedAt: null },
      include: { school: true },
      orderBy: { id: 'asc' },
    });

    res.json({
      profiles: users.map((user) => ({ ...toProfile(user), current: user.id === userId })),
    });
  }),
);

const switchSchema = z.object({
  userId: z.number().int().positive(),
});

/**
 * Trade the current token for one scoped to another profile on the same phone.
 *
 * The phone is the whole authorisation: the OTP proved the number, and every
 * live account on it belongs to this person — the same rule `verify-otp` uses
 * when it hands out a token per account. So this mints no new trust, it only
 * saves the round trip through logout and a second SMS.
 */
authRouter.post(
  '/switch',
  requireAuth,
  ah(async (req, res) => {
    const { userId: targetId } = switchSchema.parse(req.body);
    const current = req.auth!;

    const me = await prisma.user.findUnique({
      where: { id: current.userId },
      select: { phone: true, name: true },
    });
    if (!me) throw new HttpError(404, 'User not found');

    const target = await prisma.user.findUnique({
      where: { id: targetId },
      include: { school: true },
    });
    // Same 404 for "no such user", "someone else's account" and "archived":
    // a caller poking at ids should not learn which of the three it hit.
    if (!target || target.phone !== me.phone || target.archivedAt) {
      throw new HttpError(404, 'Profile not available');
    }

    const token = signToken({
      userId: target.id,
      role: target.role,
      schoolId: target.schoolId,
    });

    auditAfter(
      {
        userId: target.id,
        role: target.role,
        schoolId: target.schoolId,
        ip: req.ip,
        name: target.name,
      },
      {
        action: 'LOGIN',
        entity: 'User',
        entityId: target.id,
        label: target.name,
        summary: `Switched profile from ${current.role} (school ${current.schoolId ?? '—'})`,
      },
    );

    res.json({ token, ...toProfile(target) });
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
      ...toProfile(user),
      students: user.parentLinks.map((l) => ({
        id: l.student.id,
        name: l.student.name,
        relation: l.relation,
      })),
    });
  }),
);
