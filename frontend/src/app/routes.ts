/**
 * Every URL this app can be at, in one place.
 *
 * Each role app stays a single mounted component: the URL replaces what used
 * to be a `useState<Screen>`, nothing more. `parseX` turns the splat after
 * `/app`, `/teacher` or `/admin` into the screen plus whatever ids that screen
 * needs, and `xPath` is the inverse — the only thing anywhere that builds a
 * path string.
 *
 * Unknown paths fall back to that role's home rather than throwing, so a stale
 * bookmark or a typo lands somewhere sensible instead of on a blank frame.
 */
import type { Role } from '../auth/AuthContext';

/** Where each role starts. Used by the login page, the guards and the switcher. */
export const homeFor: Record<Role, string> = {
  PARENT: '/app',
  TEACHER: '/teacher',
  ADMIN: '/admin',
};

/** URL segments are strings; ids are positive integers or nothing. */
function num(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function seg(splat: string): string[] {
  return splat.split('/').filter(Boolean);
}

// ---------------------------------------------------------------- parent ----

export type ParentScreen =
  | 'home'
  | 'attendance'
  | 'leave'
  | 'diary'
  | 'calendar'
  | 'results'
  | 'photos'
  | 'album'
  | 'noticeBoard'
  | 'notice'
  | 'notifs';

export const PARENT_TOP_LEVEL: ParentScreen[] = [
  'home',
  'diary',
  'calendar',
  'results',
  'photos',
];

export interface ParentRoute {
  screen: ParentScreen;
  /** Parent notices carry string ids end to end, so this one stays a string. */
  noticeId: string | null;
  albumId: number | null;
}

const PARENT_HOME: ParentRoute = { screen: 'home', noticeId: null, albumId: null };

export function parseParent(splat: string): ParentRoute {
  const [a, b] = seg(splat);
  switch (a) {
    case 'diary':
      return { ...PARENT_HOME, screen: 'diary' };
    case 'calendar':
      return { ...PARENT_HOME, screen: 'calendar' };
    case 'results':
      return { ...PARENT_HOME, screen: 'results' };
    case 'attendance':
      return { ...PARENT_HOME, screen: 'attendance' };
    case 'leave':
      return { ...PARENT_HOME, screen: 'leave' };
    case 'notifications':
      return { ...PARENT_HOME, screen: 'notifs' };
    case 'photos':
      return b
        ? { ...PARENT_HOME, screen: 'album', albumId: num(b) }
        : { ...PARENT_HOME, screen: 'photos' };
    case 'notices':
      return b
        ? { ...PARENT_HOME, screen: 'notice', noticeId: b }
        : { ...PARENT_HOME, screen: 'noticeBoard' };
    default:
      return PARENT_HOME;
  }
}

export function parentPath(
  r: Partial<ParentRoute> & { screen: ParentScreen },
): string {
  switch (r.screen) {
    case 'home':
      return '/app';
    case 'diary':
      return '/app/diary';
    case 'calendar':
      return '/app/calendar';
    case 'results':
      return '/app/results';
    case 'attendance':
      return '/app/attendance';
    case 'leave':
      return '/app/leave';
    case 'notifs':
      return '/app/notifications';
    case 'photos':
      return '/app/photos';
    case 'album':
      return r.albumId == null ? '/app/photos' : `/app/photos/${r.albumId}`;
    case 'noticeBoard':
      return '/app/notices';
    case 'notice':
      return r.noticeId == null ? '/app/notices' : `/app/notices/${r.noticeId}`;
  }
}

// --------------------------------------------------------------- teacher ----

export type TeacherScreen =
  | 'home'
  | 'attendance'
  | 'leaveNotes'
  | 'diary'
  | 'myClass'
  | 'results'
  | 'photos'
  | 'album'
  | 'notifs';

/** The two halves of the My Class tab (calendar + roster live together). */
export type MyClassTab = 'calendar' | 'students';

export const TEACHER_TOP_LEVEL: TeacherScreen[] = [
  'home',
  'diary',
  'results',
  'myClass',
  'photos',
];

export interface TeacherRoute {
  screen: TeacherScreen;
  albumId: number | null;
  myClassTab: MyClassTab;
}

const TEACHER_HOME: TeacherRoute = {
  screen: 'home',
  albumId: null,
  myClassTab: 'students',
};

export function parseTeacher(splat: string): TeacherRoute {
  const [a, b] = seg(splat);
  switch (a) {
    case 'diary':
      return { ...TEACHER_HOME, screen: 'diary' };
    case 'marks':
      return { ...TEACHER_HOME, screen: 'results' };
    case 'attendance':
      return { ...TEACHER_HOME, screen: 'attendance' };
    case 'leave-notes':
      return { ...TEACHER_HOME, screen: 'leaveNotes' };
    case 'notifications':
      return { ...TEACHER_HOME, screen: 'notifs' };
    case 'my-class':
      return {
        ...TEACHER_HOME,
        screen: 'myClass',
        myClassTab: b === 'calendar' ? 'calendar' : 'students',
      };
    case 'photos':
      return b
        ? { ...TEACHER_HOME, screen: 'album', albumId: num(b) }
        : { ...TEACHER_HOME, screen: 'photos' };
    default:
      return TEACHER_HOME;
  }
}

export function teacherPath(
  r: Partial<TeacherRoute> & { screen: TeacherScreen },
): string {
  switch (r.screen) {
    case 'home':
      return '/teacher';
    case 'diary':
      return '/teacher/diary';
    case 'results':
      return '/teacher/marks';
    case 'attendance':
      return '/teacher/attendance';
    case 'leaveNotes':
      return '/teacher/leave-notes';
    case 'notifs':
      return '/teacher/notifications';
    case 'myClass':
      return `/teacher/my-class/${r.myClassTab ?? 'students'}`;
    case 'photos':
      return '/teacher/photos';
    case 'album':
      return r.albumId == null
        ? '/teacher/photos'
        : `/teacher/photos/${r.albumId}`;
  }
}

// ----------------------------------------------------------------- admin ----

export type AdminScreen =
  | 'home'
  | 'staff'
  | 'staffDetail'
  | 'staffAdd'
  | 'classes'
  | 'classDetail'
  | 'classAdd'
  | 'adminAtt'
  | 'adminAttClass'
  | 'school'
  | 'notice'
  | 'noticeCompose'
  | 'photos'
  | 'album'
  | 'notifs';

/** The four tabs of a class detail screen. */
export type ClassTab = 'students' | 'teachers' | 'subjects' | 'exams';
/** The two halves of the School tab (notices + calendar live together). */
export type SchoolTab = 'notices' | 'calendar';

const CLASS_TABS: ClassTab[] = ['students', 'teachers', 'subjects', 'exams'];

export const ADMIN_TOP_LEVEL: AdminScreen[] = [
  'home',
  'staff',
  'classes',
  'school',
  'photos',
];

export interface AdminRoute {
  screen: AdminScreen;
  teacherId: number | null;
  klassId: number | null;
  noticeId: number | null;
  albumId: number | null;
  classTab: ClassTab;
  schoolTab: SchoolTab;
}

const ADMIN_HOME: AdminRoute = {
  screen: 'home',
  teacherId: null,
  klassId: null,
  noticeId: null,
  albumId: null,
  classTab: 'students',
  schoolTab: 'notices',
};

export function parseAdmin(splat: string): AdminRoute {
  const [a, b, c] = seg(splat);
  switch (a) {
    case 'notifications':
      return { ...ADMIN_HOME, screen: 'notifs' };

    case 'staff':
      if (!b) return { ...ADMIN_HOME, screen: 'staff' };
      if (b === 'new') return { ...ADMIN_HOME, screen: 'staffAdd' };
      return { ...ADMIN_HOME, screen: 'staffDetail', teacherId: num(b) };

    case 'classes':
      if (!b) return { ...ADMIN_HOME, screen: 'classes' };
      if (b === 'new') return { ...ADMIN_HOME, screen: 'classAdd' };
      return {
        ...ADMIN_HOME,
        screen: 'classDetail',
        klassId: num(b),
        classTab: CLASS_TABS.find((t) => t === c) ?? 'students',
      };

    case 'attendance':
      return b
        ? { ...ADMIN_HOME, screen: 'adminAttClass', klassId: num(b) }
        : { ...ADMIN_HOME, screen: 'adminAtt' };

    case 'school':
      return {
        ...ADMIN_HOME,
        screen: 'school',
        schoolTab: b === 'calendar' ? 'calendar' : 'notices',
      };

    // A bare /admin/notices is the notices half of the School tab; everything
    // deeper is a single notice.
    case 'notices':
      if (!b) return { ...ADMIN_HOME, screen: 'school', schoolTab: 'notices' };
      if (b === 'new') return { ...ADMIN_HOME, screen: 'noticeCompose' };
      return {
        ...ADMIN_HOME,
        screen: c === 'edit' ? 'noticeCompose' : 'notice',
        noticeId: num(b),
      };

    case 'photos':
      return b
        ? { ...ADMIN_HOME, screen: 'album', albumId: num(b) }
        : { ...ADMIN_HOME, screen: 'photos' };

    default:
      return ADMIN_HOME;
  }
}

export function adminPath(
  r: Partial<AdminRoute> & { screen: AdminScreen },
): string {
  switch (r.screen) {
    case 'home':
      return '/admin';
    case 'notifs':
      return '/admin/notifications';
    case 'staff':
      return '/admin/staff';
    case 'staffAdd':
      return '/admin/staff/new';
    case 'staffDetail':
      return r.teacherId == null ? '/admin/staff' : `/admin/staff/${r.teacherId}`;
    case 'classes':
      return '/admin/classes';
    case 'classAdd':
      return '/admin/classes/new';
    case 'classDetail':
      return r.klassId == null
        ? '/admin/classes'
        : `/admin/classes/${r.klassId}/${r.classTab ?? 'students'}`;
    case 'adminAtt':
      return '/admin/attendance';
    case 'adminAttClass':
      return r.klassId == null
        ? '/admin/attendance'
        : `/admin/attendance/${r.klassId}`;
    case 'school':
      return r.schoolTab === 'calendar' ? '/admin/school/calendar' : '/admin/school';
    case 'notice':
      return r.noticeId == null ? '/admin/school' : `/admin/notices/${r.noticeId}`;
    case 'noticeCompose':
      return r.noticeId == null
        ? '/admin/notices/new'
        : `/admin/notices/${r.noticeId}/edit`;
    case 'photos':
      return '/admin/photos';
    case 'album':
      return r.albumId == null ? '/admin/photos' : `/admin/photos/${r.albumId}`;
  }
}
