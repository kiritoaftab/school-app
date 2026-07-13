import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

const get = <T>(url: string) => api.get<T>(url).then((r) => r.data);

export interface AUser { id: number; name: string; phone: string; role: string }
export interface AStudent {
  id: number;
  name: string;
  admissionNo: string;
  klass: string | null;
  parents: { id: number; name: string }[];
}
export interface AClass { id: number; label: string; teacher: string | null; students: number }

export const useAUsers = (role?: string) =>
  useQuery({ queryKey: ['a-users', role], queryFn: () => get<AUser[]>(`/admin/users${role ? `?role=${role}` : ''}`) });
export const useAStudents = () => useQuery({ queryKey: ['a-students'], queryFn: () => get<AStudent[]>('/admin/students') });
export const useAClasses = () => useQuery({ queryKey: ['a-classes'], queryFn: () => get<AClass[]>('/admin/classes') });
export const useAEvents = () =>
  useQuery({ queryKey: ['a-events'], queryFn: () => get<{ id: number; title: string; date: string; description: string | null }[]>('/admin/events') });

function usePost<T>(url: string, keys: string[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: T) => api.post(url, v),
    onSuccess: () => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
  });
}

export const useCreateUser = () => usePost<{ name: string; phone: string; role: string }>('/admin/users', ['a-users']);
export const useCreateStudent = () =>
  usePost<{ name: string; admissionNo: string; klassId?: number }>('/admin/students', ['a-students']);
export const useCreateClass = () =>
  usePost<{ grade: string; section: string; classTeacherId?: number | null }>('/admin/classes', ['a-classes']);
export const useLinkParent = () =>
  usePost<{ parentUserId: number; studentId: number; relation: string }>('/admin/parent-links', ['a-students']);
export const useCreateNotice = () =>
  usePost<{ title: string; body: string; category: string; pinned: boolean }>('/admin/notices', []);
export const useCreateEvent = () =>
  usePost<{ title: string; description?: string; date: string }>('/admin/events', ['a-events']);
