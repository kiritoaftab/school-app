/**
 * Retiring a catalogue row instead of deleting it.
 *
 * History foreign keys are RESTRICT, so anything that has ever been examined,
 * taught or registered simply cannot be deleted. Archiving is the way to stop
 * offering it: the row stays forever so old report cards still read correctly,
 * and it drops out of every picker and roster.
 */

/** Fields to write when archiving. `archiveKey` frees the row from its unique. */
export function archiveData(id: number, actorId: number) {
  return { archivedAt: new Date(), archivedById: actorId, archiveKey: id };
}

/** The inverse. `archiveKey` goes back to 0 so live rows collide again. */
export function restoreData() {
  return { archivedAt: null, archivedById: null, archiveKey: 0 };
}

/** Student has no unique constraint, so it carries no `archiveKey`. */
export function archiveStudentData(actorId: number) {
  return { archivedAt: new Date(), archivedById: actorId };
}

export function restoreStudentData() {
  return { archivedAt: null, archivedById: null };
}

/**
 * Only live rows, for every list and picker.
 *
 * Annotated rather than `as const`: the readonly type that `as const` produces
 * is rejected where this is used as a nested relation filter (`{ klass: LIVE }`).
 */
export const LIVE: { archivedAt: null } = { archivedAt: null };
