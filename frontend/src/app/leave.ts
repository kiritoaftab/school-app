// Shared bits for the two leave surfaces: the parent's "past leaves" list and
// the class teacher's leave notes. Kept JSX-free so both apps can import it.
import { MONTH_ABBR, ymd } from '../lib/date';

export type LeaveKind = 'SICK' | 'CASUAL' | 'OTHER';
/** DECLINED only exists in older rows — the teacher flow is acknowledge-only. */
export type LeaveState = 'SUBMITTED' | 'APPROVED' | 'DECLINED';

/** Parse a 'YYYY-MM-DD' key in local time — `new Date(key)` would read it as UTC. */
function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function midnight(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** Whole days between today and `iso` (0 = today, 1 = yesterday). */
function daysAgo(iso: string): number {
  return Math.round((midnight(new Date()) - midnight(new Date(iso))) / 86400000);
}

/** "26 Jun" */
export function dayMonth(key: string): string {
  const d = parseKey(key);
  const a = MONTH_ABBR[d.getMonth()] ?? '';
  return `${d.getDate()} ${a[0]}${a.slice(1).toLowerCase()}`;
}

/** "26 Jun" for a single day, "29 Jun – 1 Jul" for a span. */
export function leaveRange(from: string, to: string): string {
  return from === to ? dayMonth(from) : `${dayMonth(from)} – ${dayMonth(to)}`;
}

/** Inclusive day count across the leave. */
export function leaveDays(from: string, to: string): number {
  const ms = parseKey(to).getTime() - parseKey(from).getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

export function daysLabel(n: number): string {
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

/** Badge colours per leave type, matching the notice/attendance badges. */
export const LEAVE_BADGE: Record<LeaveKind, string> = {
  SICK: 'bg-[#f6ecec] text-danger',
  CASUAL: 'bg-gold-soft text-[#8a6d1f]',
  OTHER: 'bg-mist text-green',
};

/** When the note arrived: "Today, 8:05 AM" · "26 Jun, 4:10 PM". */
export function sentLabel(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const n = daysAgo(iso);
  const day = n <= 0 ? 'Today' : n === 1 ? 'Yesterday' : dayMonth(ymd(d));
  return `${day}, ${time}`;
}

/**
 * "Seen just now" / "Seen yesterday" / "Seen 17 Jun". Falls back to a bare
 * "Seen" for rows the backend has no acknowledgement timestamp for.
 */
export function seenLabel(iso?: string | null): string {
  if (!iso) return 'Seen';
  const mins = (Date.now() - new Date(iso).getTime()) / 60000;
  if (mins < 60) return 'Seen just now';
  const n = daysAgo(iso);
  if (n <= 0) return 'Seen today';
  if (n === 1) return 'Seen yesterday';
  return `Seen ${dayMonth(ymd(new Date(iso)))}`;
}
