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
