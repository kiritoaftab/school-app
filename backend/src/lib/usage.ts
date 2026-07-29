import { prisma } from '../db.js';
import { HttpError } from './http.js';

/**
 * How much school history depends on a catalogue row.
 *
 * The foreign keys on Term, Result, Attendance and friends are RESTRICT, so the
 * database already refuses to let a Subject or Student be deleted out from under
 * its history. These helpers ask the same question up front, so the client gets
 * a 409 that says *what* is in the way instead of a bare constraint violation.
 */
export interface Usage {
  /** Per-kind counts, e.g. `{ exams: 4, marks: 312 }`. Rendered to the user. */
  counts: Record<string, number>;
  total: number;
}

function usage(counts: Record<string, number>): Usage {
  return { counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
}

/**
 * Marks and diary entries store the subject's *name*, not its id, so both are
 * counted by name — see the propagating rename in `PUT /admin/subjects/:id`,
 * which is what keeps those strings in step with the catalogue.
 */
export async function subjectUsage(schoolId: number, subjectId: number, name: string): Promise<Usage> {
  const [exams, assignments, marks, diary] = await Promise.all([
    prisma.term.count({ where: { schoolId, subjectId } }),
    prisma.teachingAssignment.count({ where: { schoolId, subjectId } }),
    prisma.result.count({ where: { subject: name, term: { schoolId } } }),
    prisma.diaryEntry.count({ where: { schoolId, subject: name } }),
  ]);
  return usage({ exams, assignments, marks, diary });
}

export async function examUsage(termId: number): Promise<Usage> {
  const [marks, reportCards] = await Promise.all([
    prisma.result.count({ where: { termId } }),
    prisma.resultMeta.count({ where: { termId } }),
  ]);
  return usage({ marks, reportCards });
}

export async function studentUsage(studentId: number): Promise<Usage> {
  const [marks, reportCards, attendance, enrollments, leaveRequests] = await Promise.all([
    prisma.result.count({ where: { studentId } }),
    prisma.resultMeta.count({ where: { studentId } }),
    prisma.attendance.count({ where: { studentId } }),
    prisma.enrollment.count({ where: { studentId } }),
    prisma.leaveRequest.count({ where: { studentId } }),
  ]);
  return usage({ marks, reportCards, attendance, enrollments, leaveRequests });
}

export async function klassUsage(schoolId: number, klassId: number): Promise<Usage> {
  const [students, exams, diary, assignments] = await Promise.all([
    prisma.enrollment.count({ where: { klassId } }),
    prisma.term.count({ where: { schoolId, klassId } }),
    prisma.diaryEntry.count({ where: { schoolId, klassId } }),
    prisma.teachingAssignment.count({ where: { schoolId, klassId } }),
  ]);
  return usage({ students, exams, diary, assignments });
}

export async function teacherUsage(schoolId: number, teacherId: number): Promise<Usage> {
  const [assignments, classesLed, diary, notices, attendanceMarked] = await Promise.all([
    prisma.teachingAssignment.count({ where: { schoolId, teacherId } }),
    prisma.klass.count({ where: { schoolId, classTeacherId: teacherId } }),
    prisma.diaryEntry.count({ where: { schoolId, createdById: teacherId } }),
    prisma.notice.count({ where: { schoolId, createdById: teacherId } }),
    prisma.attendance.count({ where: { schoolId, markedById: teacherId } }),
  ]);
  return usage({ assignments, classesLed, diary, notices, attendanceMarked });
}

/**
 * Refuse a delete that would take history with it.
 *
 * `action` tells the client what to offer instead: `'ARCHIVE'` when retiring the
 * row is a sensible next step (a subject no longer taught), `'NONE'` when it is
 * not the caller's to retire (a teacher deleting someone else's graded exam).
 */
/** "1 exam" / "4 exams" — audit summaries are read by people. */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function throwIfInUse(u: Usage, noun: string, action: 'ARCHIVE' | 'NONE'): void {
  if (u.total === 0) return;
  throw new HttpError(409, `This ${noun} is used by school records and cannot be deleted.`, {
    code: 'IN_USE',
    action,
    // Drop the zeroes so the UI can render the counts verbatim.
    usage: Object.fromEntries(Object.entries(u.counts).filter(([, n]) => n > 0)),
  });
}
