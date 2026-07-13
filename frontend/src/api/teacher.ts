import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

const get = <T>(url: string) => api.get<T>(url).then((r) => r.data);

export interface TClass { id: number; label: string }
export interface Roster {
  date: string;
  students: { id: number; name: string; status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HOLIDAY' | null }[];
}
export interface TLeave {
  id: number;
  studentName: string;
  type: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: 'SUBMITTED' | 'APPROVED' | 'DECLINED';
}

export const useTClasses = () => useQuery({ queryKey: ['t-classes'], queryFn: () => get<TClass[]>('/teacher/classes') });
export const useTTerms = () => useQuery({ queryKey: ['t-terms'], queryFn: () => get<{ id: number; name: string }[]>('/teacher/terms') });
export const useRoster = (classId?: number, date?: string) =>
  useQuery({
    queryKey: ['roster', classId, date],
    queryFn: () => get<Roster>(`/teacher/classes/${classId}/roster?date=${date ?? ''}`),
    enabled: !!classId,
  });
export const useTLeaves = () => useQuery({ queryKey: ['t-leaves'], queryFn: () => get<TLeave[]>('/teacher/leave') });

export function useMarkAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { date: string; marks: { studentId: number; status: string }[] }) =>
      api.post('/teacher/attendance', v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roster'] }),
  });
}
export const usePostNotice = () =>
  useMutation({ mutationFn: (v: Record<string, unknown>) => api.post('/teacher/notices', v) });
export const usePostHomework = () =>
  useMutation({ mutationFn: (v: Record<string, unknown>) => api.post('/teacher/diary', v) });
export const usePostResults = () =>
  useMutation({ mutationFn: (v: Record<string, unknown>) => api.post('/teacher/results', v) });

export function useReviewLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: number; status: 'APPROVED' | 'DECLINED' }) =>
      api.patch(`/teacher/leave/${v.id}`, { status: v.status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['t-leaves'] }),
  });
}
