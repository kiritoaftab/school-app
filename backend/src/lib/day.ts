import { HttpError } from './http.js';

/** Parse a 'YYYY-MM-DD' day key into the UTC midnight used by @db.Date columns. */
export function parseDay(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(400, 'Date must be YYYY-MM-DD');
  const d = new Date(`${value}T00:00:00.000Z`);
  // V8 rolls impossible dates forward rather than rejecting them (2026-02-31
  // becomes 2026-03-03), so compare the round-trip instead of just NaN.
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, 'Date is not a real calendar date');
  }
  return d;
}

/** Render a @db.Date column back as a plain 'YYYY-MM-DD' day key. */
export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
