import { api } from './client';

export interface TeacherSubject {
  id: number;
  name: string;
}

/** A class this teacher works with — either as class teacher or subject teacher. */
export interface TeacherKlass {
  id: number;
  grade: string;
  section: string;
  label: string;
  isClassTeacher: boolean;
  roleLabel: string;
  students: number;
  /** Subjects this teacher may post diary entries for in this class. */
  subjects: TeacherSubject[];
}

export interface DiaryEntry {
  id: number;
  /** YYYY-MM-DD */
  date: string;
  /** null = a general "note for the day", not tied to a subject. */
  subject: string | null;
  task: string;
  note: string | null;
  createdById: number | null;
  createdBy?: string | null;
  canDelete: boolean;
}

export interface DiaryWeek {
  klassId: number;
  isClassTeacher: boolean;
  subjects: TeacherSubject[];
  entries: DiaryEntry[];
}

export async function listMyClasses(): Promise<TeacherKlass[]> {
  const { data } = await api.get<TeacherKlass[]>('/teacher/classes');
  return data;
}

export async function listDiary(klassId: number, from: string, to: string): Promise<DiaryWeek> {
  const { data } = await api.get<DiaryWeek>('/teacher/diary', { params: { klassId, from, to } });
  return data;
}

export async function createDiaryEntry(input: {
  klassId: number;
  /** Omit for a general "note for the day". */
  subject?: string;
  date: string;
  task: string;
  note?: string;
}): Promise<DiaryEntry> {
  const { data } = await api.post<DiaryEntry>('/teacher/diary', input);
  return data;
}

export async function deleteDiaryEntry(id: number): Promise<void> {
  await api.delete(`/teacher/diary/${id}`);
}

/** An exam/test. subject null = covers all subjects; set = single-subject test. */
export interface TeacherExam {
  id: number;
  name: string;
  schoolWide: boolean;
  subject: { id: number; name: string } | null;
}

export async function listClassExams(klassId: number): Promise<TeacherExam[]> {
  const { data } = await api.get<TeacherExam[]>(`/teacher/classes/${klassId}/exams`);
  return data;
}

export async function createClassExam(
  klassId: number,
  name: string,
  subjectId: number | null,
): Promise<TeacherExam> {
  const { data } = await api.post<TeacherExam>(`/teacher/classes/${klassId}/exams`, {
    name,
    subjectId,
  });
  return data;
}

export async function deleteClassExam(id: number): Promise<void> {
  await api.delete(`/teacher/exams/${id}`);
}

/** A student's row when grading one exam + subject. score null = not entered. */
export interface ResultRow {
  studentId: number;
  name: string;
  score: number | null;
}

export interface ClassResults {
  maxScore: number;
  students: ResultRow[];
}

export async function listClassResults(
  klassId: number,
  termId: number,
  subject: string,
): Promise<ClassResults> {
  const { data } = await api.get<ClassResults>(`/teacher/classes/${klassId}/results`, {
    params: { termId, subject },
  });
  return data;
}

/** A student in a class, with guardian (parent) login details. */
export interface TeacherStudent {
  id: number;
  name: string;
  admissionNo: string | null;
  guardian: { name: string; phone: string; relation: string } | null;
}

export async function listClassStudents(klassId: number): Promise<TeacherStudent[]> {
  const { data } = await api.get<TeacherStudent[]>(`/teacher/classes/${klassId}/students`);
  return data;
}

export async function addClassStudent(
  klassId: number,
  input: { name: string; guardianName: string; guardianPhone: string; relation: string },
): Promise<void> {
  await api.post(`/teacher/classes/${klassId}/students`, input);
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'HOLIDAY';

export interface RosterStudent {
  id: number;
  name: string;
  status: AttendanceStatus | null;
}

export interface ClassRoster {
  date: string;
  isClassTeacher: boolean;
  students: RosterStudent[];
}

export async function getClassRoster(klassId: number, date?: string): Promise<ClassRoster> {
  const { data } = await api.get<ClassRoster>(`/teacher/classes/${klassId}/roster`, {
    params: date ? { date } : undefined,
  });
  return data;
}

export async function saveClassAttendance(
  klassId: number,
  date: string,
  marks: { studentId: number; status: AttendanceStatus }[],
): Promise<void> {
  await api.post(`/teacher/classes/${klassId}/attendance`, { date, marks });
}

/** A school calendar event. date is 'YYYY-MM-DD'. */
export interface TeacherEvent {
  id: number;
  title: string;
  description: string | null;
  date: string;
}

export async function listEvents(): Promise<TeacherEvent[]> {
  const { data } = await api.get<TeacherEvent[]>('/teacher/events');
  return data;
}

export async function saveClassResults(
  klassId: number,
  input: {
    termId: number;
    subject: string;
    maxScore: number;
    entries: { studentId: number; score: number | null }[];
  },
): Promise<void> {
  await api.post(`/teacher/classes/${klassId}/results`, input);
}
