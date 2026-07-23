import { api } from './client';

/** A child linked to the signed-in parent. `klass` is the "5-B" label (may be null). */
export interface ParentStudent {
  id: number;
  name: string;
  admissionNo: string | null;
  relation: string;
  klass: string | null;
}

export async function listMyStudents(): Promise<ParentStudent[]> {
  const { data } = await api.get<ParentStudent[]>('/parent/me/students');
  return data;
}

/** A diary entry for the child's class. subject null = a general note for the day. */
export interface ParentDiaryEntry {
  id: number;
  /** YYYY-MM-DD */
  date: string;
  subject: string | null;
  task: string;
  note: string | null;
  /** Server-tracked done flag — ignored by the UI, which ticks client-side. */
  done: boolean;
}

export async function listStudentDiary(studentId: number): Promise<ParentDiaryEntry[]> {
  const { data } = await api.get<ParentDiaryEntry[]>(`/parent/students/${studentId}/diary`);
  return data;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'HOLIDAY';

export interface StudentAttendance {
  /** YYYY-MM */
  month: string;
  present: number;
  absent: number;
  late: number;
  percent: number;
  days: { date: string; status: AttendanceStatus }[];
}

export async function getStudentAttendance(
  studentId: number,
  month: string,
): Promise<StudentAttendance> {
  const { data } = await api.get<StudentAttendance>(`/parent/students/${studentId}/attendance`, {
    params: { month },
  });
  return data;
}

/** An exam this child has published results for. */
export interface ParentTerm {
  id: number;
  name: string;
  overallPct: number;
  rank: number | null;
}

export async function listStudentTerms(studentId: number): Promise<ParentTerm[]> {
  const { data } = await api.get<ParentTerm[]>(`/parent/students/${studentId}/terms`);
  return data;
}

/** A school calendar event. date is 'YYYY-MM-DD'. */
export interface ParentEvent {
  id: number;
  title: string;
  description: string | null;
  date: string;
}

export async function listEvents(): Promise<ParentEvent[]> {
  const { data } = await api.get<ParentEvent[]>('/parent/events');
  return data;
}

export interface StudentResults {
  term: { id: number; name: string } | null;
  overallPct: number | null;
  rank: number | null;
  teacherComment: string | null;
  subjects: { subject: string; score: number; maxScore: number; grade: string }[];
}

export async function getStudentResults(
  studentId: number,
  termId?: number,
): Promise<StudentResults | null> {
  const { data } = await api.get<StudentResults | null>(`/parent/students/${studentId}/results`, {
    params: termId ? { termId } : undefined,
  });
  return data;
}
