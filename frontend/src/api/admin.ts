import { api } from './client';

export interface AdminKlass {
  id: number;
  label: string;
  grade: string;
  section: string;
  classTeacherId: number | null;
  teacher: string | null;
  students: number;
}

export interface AdminTeacher {
  id: number;
  name: string;
  phone: string;
  role: 'PARENT' | 'TEACHER' | 'ADMIN';
}

// A teacher's class × subject assignments, grouped by class.
export interface AdminTeacherAssignment {
  klassId: number;
  label: string;
  subjects: { id: number; name: string }[];
}

export interface AdminTeacherDetail extends AdminTeacher {
  classTeacherOf: { id: number; label: string }[];
  assignments: AdminTeacherAssignment[];
}

export async function listClasses(): Promise<AdminKlass[]> {
  const { data } = await api.get<AdminKlass[]>('/admin/classes');
  return data;
}

export async function listTeachers(): Promise<AdminTeacher[]> {
  const { data } = await api.get<AdminTeacher[]>('/admin/users', { params: { role: 'TEACHER' } });
  return data;
}

export async function getTeacher(id: number): Promise<AdminTeacherDetail> {
  const { data } = await api.get<AdminTeacherDetail>(`/admin/teachers/${id}`);
  return data;
}

// Sets the exact subject set for one class; an empty list unassigns the class.
export async function setClassSubjects(
  teacherId: number,
  klassId: number,
  subjectIds: number[],
): Promise<void> {
  await api.put(`/admin/teachers/${teacherId}/assignments/${klassId}`, { subjectIds });
}

export async function unassignClass(teacherId: number, klassId: number): Promise<void> {
  await api.delete(`/admin/teachers/${teacherId}/assignments/${klassId}`);
}

export async function setClassTeacher(
  teacherId: number,
  klassId: number,
  isClassTeacher: boolean,
): Promise<void> {
  await api.put(`/admin/teachers/${teacherId}/class-teacher`, { klassId, isClassTeacher });
}

export interface CreateTeacherInput {
  name: string;
  phone: string;
  // Which subjects the teacher teaches in which class.
  assignments: { klassId: number; subjectIds: number[] }[];
  // Class the teacher is class teacher of, if any.
  classTeacherOf?: number | null;
}

export async function createTeacher(input: CreateTeacherInput): Promise<AdminTeacher> {
  const { data } = await api.post<AdminTeacher>('/admin/teachers', input);
  return data;
}

export interface CreateClassInput {
  grade: string;
  section: string;
  classTeacherId?: number | null;
}

export async function createClass(input: CreateClassInput): Promise<AdminKlass> {
  const { data } = await api.post<AdminKlass>('/admin/classes', input);
  return data;
}

// --- Class detail tabs ---
export type GuardianRelation = 'Mother' | 'Father' | 'Guardian';

export interface ClassStudent {
  id: number;
  name: string;
  admissionNo: string;
  guardian: { id: number; name: string; phone: string; relation: string } | null;
}

export interface ClassTeacher {
  id: number;
  name: string;
  phone: string;
  isClassTeacher: boolean;
  subjects: { id: number; name: string }[];
}

export interface ClassExam {
  id: number;
  name: string;
  schoolWide: boolean;
}

export interface StudentInput {
  name: string;
  guardianName: string;
  guardianPhone: string;
  relation: GuardianRelation;
}

export async function listClassStudents(klassId: number): Promise<ClassStudent[]> {
  const { data } = await api.get<ClassStudent[]>(`/admin/classes/${klassId}/students`);
  return data;
}

export async function addClassStudent(klassId: number, input: StudentInput): Promise<void> {
  await api.post(`/admin/classes/${klassId}/students`, input);
}

export async function updateStudent(
  studentId: number,
  input: Partial<StudentInput>,
): Promise<void> {
  await api.put(`/admin/students/${studentId}`, input);
}

export async function deleteStudent(studentId: number): Promise<void> {
  await api.delete(`/admin/students/${studentId}`);
}

export async function listClassTeachers(klassId: number): Promise<ClassTeacher[]> {
  const { data } = await api.get<ClassTeacher[]>(`/admin/classes/${klassId}/teachers`);
  return data;
}

export async function listClassExams(klassId: number): Promise<ClassExam[]> {
  const { data } = await api.get<ClassExam[]>(`/admin/classes/${klassId}/exams`);
  return data;
}

export async function addClassExam(
  klassId: number,
  name: string,
  allSchool: boolean,
): Promise<void> {
  await api.post(`/admin/classes/${klassId}/exams`, { name, allSchool });
}

export async function deleteExam(examId: number): Promise<void> {
  await api.delete(`/admin/exams/${examId}`);
}

// --- Notices ---
export interface AdminNotice {
  id: number;
  title: string;
  body: string;
  category: string;
  pinned: boolean;
  createdAt: string;
  from: string;
  audienceClassId: number | null;
  audienceLabel: string | null;
  ackCount: number;
  totalParents: number;
}

export interface NoticeInput {
  title: string;
  body: string;
  category: string;
  pinned: boolean;
  audienceClassId: number | null;
}

export async function listNotices(): Promise<AdminNotice[]> {
  const { data } = await api.get<AdminNotice[]>('/admin/notices');
  return data;
}

export async function getNotice(id: number): Promise<AdminNotice> {
  const { data } = await api.get<AdminNotice>(`/admin/notices/${id}`);
  return data;
}

export async function createNotice(input: NoticeInput): Promise<AdminNotice> {
  const { data } = await api.post<AdminNotice>('/admin/notices', input);
  return data;
}

export async function updateNotice(
  id: number,
  input: Partial<NoticeInput>,
): Promise<AdminNotice> {
  const { data } = await api.put<AdminNotice>(`/admin/notices/${id}`, input);
  return data;
}

export async function deleteNotice(id: number): Promise<void> {
  await api.delete(`/admin/notices/${id}`);
}

// --- Events ---
export interface AdminEvent {
  id: number;
  title: string;
  description: string | null;
  date: string; // YYYY-MM-DD
}

export interface EventInput {
  title: string;
  description?: string;
  date: string;
}

export async function listEvents(): Promise<AdminEvent[]> {
  const { data } = await api.get<AdminEvent[]>('/admin/events');
  return data;
}

export async function createEvent(input: EventInput): Promise<AdminEvent> {
  const { data } = await api.post<AdminEvent>('/admin/events', input);
  return data;
}

export async function updateEvent(
  id: number,
  input: Partial<EventInput>,
): Promise<AdminEvent> {
  const { data } = await api.put<AdminEvent>(`/admin/events/${id}`, input);
  return data;
}

export async function deleteEvent(id: number): Promise<void> {
  await api.delete(`/admin/events/${id}`);
}

// --- Subjects (school-level catalogue) ---
export interface AdminSubject {
  id: number;
  name: string;
}

export async function listSubjects(): Promise<AdminSubject[]> {
  const { data } = await api.get<AdminSubject[]>('/admin/subjects');
  return data;
}

export async function createSubject(name: string): Promise<AdminSubject> {
  const { data } = await api.post<AdminSubject>('/admin/subjects', { name });
  return data;
}

export async function updateSubject(id: number, name: string): Promise<AdminSubject> {
  const { data } = await api.put<AdminSubject>(`/admin/subjects/${id}`, { name });
  return data;
}

export async function deleteSubject(id: number): Promise<void> {
  await api.delete(`/admin/subjects/${id}`);
}
