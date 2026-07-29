import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { verifyToken, type AuthPayload } from '../lib/jwt.js';
import { HttpError } from '../lib/http.js';
import { prisma } from '../db.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

/**
 * Express 4 does not catch rejections from async middleware, so the DB lookup
 * below is wrapped — otherwise a database blip would hang the request instead
 * of returning a 500.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  authenticate(req, res, next).catch(next);
}

async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }
  let payload;
  try {
    payload = verifyToken(header.slice(7));
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Tokens last 7 days, so filtering the login endpoints is not enough on its
  // own — without this check a teacher archived today would keep full access to
  // children's data for the rest of the week. One primary-key lookup per
  // request is a cheap price for the archive actually meaning something.
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { archivedAt: true },
  });
  if (!user) return res.status(401).json({ error: 'Account no longer exists' });
  if (user.archivedAt) return res.status(401).json({ error: 'This account is no longer active' });

  req.auth = payload;
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ error: 'Forbidden for this role' });
    }
    next();
  };
}

/** Convenience: guaranteed-present auth after requireAuth. */
export function auth(req: Request): AuthPayload {
  if (!req.auth) throw new Error('auth() called without requireAuth');
  return req.auth;
}

/**
 * Return the caller's schoolId, or 403 if they have none (e.g. a SUPER_ADMIN
 * hitting a school-scoped route). Use in every school-bound handler.
 */
export function requireSchoolId(req: Request): number {
  const schoolId = req.auth?.schoolId;
  if (schoolId == null) throw new HttpError(403, 'This action requires a school-scoped account');
  return schoolId;
}
