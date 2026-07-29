import type { Request } from 'express';
import type { AuditAction, Prisma, Role } from '@prisma/client';
import { prisma } from '../db.js';

/**
 * Write an audit row.
 *
 * Pass the transaction client whenever the change itself is transactional, so
 * the log commits or rolls back with it — a log that survives a rolled-back
 * delete is worse than no log. Structural changes that aren't transactional can
 * use the root client via {@link auditAfter}, which never throws into the
 * response path.
 */
type Db = Prisma.TransactionClient | typeof prisma;

export interface Actor {
  userId: number;
  role: Role;
  schoolId: number | null;
  ip?: string;
  /** Snapshotted onto the row; looked up from the user if omitted. */
  name?: string;
}

export function actorFrom(req: Request): Actor {
  const a = req.auth;
  if (!a) throw new Error('actorFrom() called without requireAuth');
  return { userId: a.userId, role: a.role, schoolId: a.schoolId ?? null, ip: req.ip };
}

export interface AuditEntry {
  action: AuditAction;
  entity: string;
  entityId: number;
  /** The target's human name at the time — "Mathematics", "Ravi Kumar". */
  label: string;
  summary?: string;
  before?: unknown;
  after?: unknown;
}

/** JSON columns reject `undefined`; Prisma wants an explicit null instead. */
function json(v: unknown): Prisma.InputJsonValue | undefined {
  return v === undefined ? undefined : (v as Prisma.InputJsonValue);
}

export async function audit(db: Db, actor: Actor, entry: AuditEntry): Promise<void> {
  // The JWT carries only userId/role/schoolId, so the name costs one read on
  // write paths. Callers that already hold the user can pass `actor.name`.
  const name =
    actor.name ??
    (await db.user.findUnique({ where: { id: actor.userId }, select: { name: true } }))?.name ??
    'Unknown';

  await db.auditLog.create({
    data: {
      schoolId: actor.schoolId,
      actorId: actor.userId,
      actorName: name,
      actorRole: actor.role,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      label: entry.label,
      summary: entry.summary,
      before: json(entry.before),
      after: json(entry.after),
      ip: actor.ip ?? null,
    },
  });
}

/**
 * Best-effort logging for changes that already succeeded.
 *
 * Used for structural edits (a class created, an assignment moved) where losing
 * the log is regrettable but failing the user's request over it would be worse.
 * Destructive actions should use {@link audit} inside their transaction instead.
 */
export function auditAfter(actor: Actor, entry: AuditEntry): void {
  void audit(prisma, actor, entry).catch((err) => {
    console.error('audit write failed', { entity: entry.entity, id: entry.entityId, err });
  });
}
