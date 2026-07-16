import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { verifyToken, type AuthPayload } from '../lib/jwt.js';
import { HttpError } from '../lib/http.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }
  try {
    req.auth = verifyToken(header.slice(7));
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
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
