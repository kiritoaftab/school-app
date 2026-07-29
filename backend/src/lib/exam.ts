/**
 * One shape for an exam (a `Term` row), shared by the admin and teacher routers
 * so the two can't drift.
 *
 * `subjectId` being null is load-bearing: it means the exam covers every
 * subject and is graded per subject. That is why `Term.subjectId` is RESTRICT
 * rather than SET NULL — if removing a subject could null it, a historic
 * single-subject test would silently start claiming it covered everything.
 * `subjectScope` states that distinction outright instead of leaving the client
 * to infer it from a null.
 */
export interface ExamSubject {
  id: number;
  name: string;
  /** True once the subject is retired: still shown, no longer offered. */
  archived: boolean;
}

export interface ShapedExam {
  id: number;
  name: string;
  schoolWide: boolean;
  subjectScope: 'ALL' | 'SINGLE';
  /** Null if and only if `subjectScope` is `'ALL'`. */
  subject: ExamSubject | null;
}

interface TermRow {
  id: number;
  name: string;
  klassId: number | null;
  subject: { id: number; name: string; archivedAt?: Date | null } | null;
}

export function shapeExam(t: TermRow): ShapedExam {
  return {
    id: t.id,
    name: t.name,
    schoolWide: t.klassId === null,
    subjectScope: t.subject ? 'SINGLE' : 'ALL',
    subject: t.subject
      ? { id: t.subject.id, name: t.subject.name, archived: t.subject.archivedAt != null }
      : null,
  };
}
