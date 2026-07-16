import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import type { Role } from '@prisma/client';

export interface AuthPayload {
  userId: number;
  role: Role;
  /** Null for SUPER_ADMIN (platform owner); a real id for every school-bound role. */
  schoolId: number | null;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, config.jwtSecret) as AuthPayload;
}
