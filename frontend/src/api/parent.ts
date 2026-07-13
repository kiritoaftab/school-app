import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export interface Student {
  id: number;
  name: string;
  admissionNo: string;
  relation: string;
  klass: string | null;
}
export interface TodayStatus {
  studentId: number;
  name: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HOLIDAY' | null;
}
export interface AttendanceMonth {
  month: string;
  present: number;
  absent: number;
  late: number;
  percent: number;
  days: { date: string; status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HOLIDAY' }[];
}
export interface NoticeListItem {
  id: number;
  title: string;
  category: string;
  pinned: boolean;
  createdAt: string;
  acked: boolean;
  ackCount: number;
  totalParents: number;
}
export interface NoticeDetail extends NoticeListItem {
  body: string;
}
export interface DiaryItem {
  id: number;
  subject: string;
  date: string;
  task: string;
  note: string | null;
  done: boolean;
}
export interface ResultData {
  term: { id: number; name: string } | null;
  overallPct: number | null;
  rank: number | null;
  teacherComment: string | null;
  subjects: { subject: string; score: number; maxScore: number; grade: string }[];
}
export interface EventItem {
  id: number;
  title: string;
  description: string | null;
  date: string;
}
export interface AlbumItem {
  id: number;
  title: string;
  coverUrl: string | null;
  count: number;
  createdAt: string;
}
export interface Leave {
  id: number;
  studentId: number;
  studentName: string;
  type: 'SICK' | 'CASUAL' | 'OTHER';
  fromDate: string;
  toDate: string;
  reason: string;
  status: 'SUBMITTED' | 'APPROVED' | 'DECLINED';
  createdAt: string;
}
export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  deeplink: string | null;
  readAt: string | null;
  createdAt: string;
}

const get = <T>(url: string) => api.get<T>(url).then((r) => r.data);

export const useStudents = () => useQuery({ queryKey: ['students'], queryFn: () => get<Student[]>('/parent/me/students') });
export const useToday = () => useQuery({ queryKey: ['today'], queryFn: () => get<TodayStatus[]>('/parent/me/today') });
export const useAttendance = (studentId?: number, month?: string) =>
  useQuery({
    queryKey: ['attendance', studentId, month],
    queryFn: () => get<AttendanceMonth>(`/parent/students/${studentId}/attendance?month=${month ?? ''}`),
    enabled: !!studentId,
  });
export const useNotices = () => useQuery({ queryKey: ['notices'], queryFn: () => get<NoticeListItem[]>('/parent/notices') });
export const useNotice = (id: number) =>
  useQuery({ queryKey: ['notice', id], queryFn: () => get<NoticeDetail>(`/parent/notices/${id}`) });
export const useDiary = (studentId?: number) =>
  useQuery({
    queryKey: ['diary', studentId],
    queryFn: () => get<DiaryItem[]>(`/parent/students/${studentId}/diary`),
    enabled: !!studentId,
  });
export const useResults = (studentId?: number, termId?: number) =>
  useQuery({
    queryKey: ['results', studentId, termId],
    queryFn: () => get<ResultData>(`/parent/students/${studentId}/results?termId=${termId ?? ''}`),
    enabled: !!studentId,
  });
export const useTerms = () => useQuery({ queryKey: ['terms'], queryFn: () => get<{ id: number; name: string }[]>('/parent/terms') });
export const useEvents = () => useQuery({ queryKey: ['events'], queryFn: () => get<EventItem[]>('/parent/events') });
export const useAlbums = () => useQuery({ queryKey: ['albums'], queryFn: () => get<AlbumItem[]>('/parent/albums') });
export const useAlbum = (id: number) =>
  useQuery({ queryKey: ['album', id], queryFn: () => get<{ id: number; title: string; photos: { id: number; url: string; caption: string | null }[] }>(`/parent/albums/${id}`) });
export const useLeaves = () => useQuery({ queryKey: ['leaves'], queryFn: () => get<Leave[]>('/parent/leave') });
export const useNotifications = () => useQuery({ queryKey: ['notifications'], queryFn: () => get<Notification[]>('/parent/notifications') });

export function useAckNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post(`/parent/notices/${id}/ack`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['notice', id] });
      qc.invalidateQueries({ queryKey: ['notices'] });
    },
  });
}

export function useToggleDiary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { entryId: number; studentId: number; done: boolean }) =>
      api.post(`/parent/diary/${v.entryId}/done`, { studentId: v.studentId, done: v.done }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['diary', v.studentId] }),
  });
}

export function useSubmitLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { studentId: number; type: string; fromDate: string; toDate: string; reason: string }) =>
      api.post('/parent/leave', v),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leaves'] }),
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post(`/parent/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
