import axios from 'axios';
import { storage } from '../lib/storage';

// API base URL comes from env — never hardcode localhost (Capacitor-safe).
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000',
});

api.interceptors.request.use((config) => {
  const token = storage.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      storage.clear();
      if (!location.hash.startsWith('#/login')) location.hash = '#/login';
    }
    return Promise.reject(error);
  },
);

/**
 * An error the API chose to explain, rather than one that just happened.
 *
 * `code` is what the UI branches on. `IN_USE` comes back from a delete the
 * server refused because school history depends on the row; `usage` then holds
 * the counts behind that refusal, so the screen can name what it is protecting
 * instead of saying "couldn't delete".
 */
export interface ApiError {
  error: string;
  code?: string;
  action?: 'ARCHIVE' | 'NONE';
  usage?: Record<string, number>;
}

export function apiError(e: unknown, fallback: string): ApiError {
  const data = (e as { response?: { data?: unknown } })?.response?.data;
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (typeof d.error === 'string') {
      return {
        error: d.error,
        code: typeof d.code === 'string' ? d.code : undefined,
        action: d.action === 'ARCHIVE' || d.action === 'NONE' ? d.action : undefined,
        usage: d.usage && typeof d.usage === 'object' ? (d.usage as Record<string, number>) : undefined,
      };
    }
  }
  return { error: fallback };
}

/**
 * One sentence to show the user, with the counts folded in when the server
 * refused a delete because school history depends on the row.
 */
export function apiErrorText(e: unknown, fallback: string): string {
  const err = apiError(e, fallback);
  const detail = describeUsage(err.usage);
  return detail ? `${err.error} It holds ${detail}.` : err.error;
}

/** Human-readable counts: `{ exams: 4, marks: 312 }` -> "4 exams and 312 marks". */
export function describeUsage(usage: Record<string, number> | undefined): string {
  const LABEL: Record<string, [string, string]> = {
    exams: ['exam', 'exams'],
    assignments: ['teacher assignment', 'teacher assignments'],
    marks: ['mark', 'marks'],
    diary: ['diary entry', 'diary entries'],
    reportCards: ['report card', 'report cards'],
    attendance: ['attendance record', 'attendance records'],
    enrollments: ['class enrolment', 'class enrolments'],
    leaveRequests: ['leave request', 'leave requests'],
    students: ['student', 'students'],
    classesLed: ['class led', 'classes led'],
    notices: ['notice', 'notices'],
    attendanceMarked: ['attendance record', 'attendance records'],
  };
  const parts = Object.entries(usage ?? {})
    .filter(([, n]) => n > 0)
    .map(([k, n]) => {
      const [one, many] = LABEL[k] ?? [k, k];
      return `${n} ${n === 1 ? one : many}`;
    });
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
