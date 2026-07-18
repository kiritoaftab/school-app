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

export async function listClasses(): Promise<AdminKlass[]> {
  const { data } = await api.get<AdminKlass[]>('/admin/classes');
  return data;
}

export async function listTeachers(): Promise<AdminTeacher[]> {
  const { data } = await api.get<AdminTeacher[]>('/admin/users', { params: { role: 'TEACHER' } });
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
