// Static dummy data for the Greenwood app experience.
// Extracted from the "Greenwood Parent App" prototype (latest-mock).
// None of this is wired to the backend — only the login flow talks to the API.

export const GLYPH = {
  home: 'M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z',
  diary: 'M4 5h11a3 3 0 013 3v11M4 5v14h14',
  calendar: 'M4 6h16v14H4zM4 10h16M9 4v4M15 4v4',
  results: 'M7 3h8l4 4v14H7zM10 12h6M10 16h6',
  photos: 'M4 6h16v13H4zM12 15a3 3 0 100-6 3 3 0 000 6',
  staff: 'M12 12a4 4 0 100-8 4 4 0 000 8M5 20a7 7 0 0114 0',
  notices: 'M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8M10 21a2 2 0 004 0',
  check: 'M5 12l5 5L20 6',
  classes: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  plus: 'M12 5v14M5 12h14',
  chevronRight: 'M9 6l6 6-6 6',
  chevronLeft: 'M15 18l-6-6 6-6',
  bell: 'M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8M10 21a2 2 0 004 0',
  info: 'M12 8h.01M11 12h1v4h1',
  upload: 'M12 16V4M6 10l6-6 6 6M4 20h16',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z',
  trash: 'M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13',
  attendanceCheck: 'M9 11l3 3L20 5M4 12h4',
  students: 'M9 7a3 3 0 106 0 3 3 0 00-6 0M4 20a5 5 0 0110 0M15 12a3 3 0 100-6M17 20a5 5 0 00-3-4.6',
  chevronDown: 'M6 9l6 6 6-6',
} as const;

// ---- helpers ----
export function fmtPhone(d: string) {
  d = (d || '').replace(/\D/g, '');
  return d.length <= 5 ? d : d.slice(0, 5) + ' ' + d.slice(5);
}
export function maskPhone(d: string) {
  d = (d || '').replace(/\D/g, '');
  return d.length < 10 ? '+91 ' + fmtPhone(d) : '+91 ' + d.slice(0, 2) + '••• •' + d.slice(-4);
}
export function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
export function gradeFor(p: number) {
  return p >= 90 ? 'A+' : p >= 80 ? 'A' : p >= 70 ? 'B+' : p >= 60 ? 'B' : 'C';
}
export function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ---- child / school ----
export const CHILD = { name: 'Aarav Mehta', klass: 'Grade 5 · Section B', klassShort: 'Grade 5-B', roll: 14 };
export const SCHOOL = 'Greenwood International';

// ---- notices ----
export interface Notice {
  id: string;
  category: string;
  from: string;
  pinned: boolean;
  date: string;
  icon: string;
  title: string;
  preview: string;
  body: string;
  ackStat: string;
}

export const NOTICES: Notice[] = [
  {
    id: 'ptm', category: 'Principal', from: 'Ms. Sridevi Menon · Principal', pinned: true, date: '24 Jun',
    icon: GLYPH.notices, title: 'Parent–Teacher Meeting',
    preview: 'Slots open for Saturday, 28 June. Reserve your 15-minute window.',
    body: "Dear Parents,\n\nOur term PTM is on Saturday, 28 June, from 9:00 AM to 1:00 PM. Please reserve a 15-minute slot with your child's class teacher through the app. Report cards will be discussed in person.\n\nWarm regards,\nMs. Sridevi Menon, Principal",
    ackStat: '142 of 180 parents have acknowledged',
  },
  {
    id: 'halfday', category: 'Admin', from: 'School Office', pinned: false, date: '25 Jun',
    icon: 'M4 8h16M7 3v3M17 3v3M5 6h14v14H5z', title: 'Half-day this Friday, 27 June',
    preview: 'School closes at 12:00 noon for a staff development session.',
    body: 'Dear Parents,\n\nThis Friday, 27 June, will be a half-day. School will close at 12:00 noon for a staff development session. Buses will run on the revised half-day schedule. Please arrange your child’s pick-up accordingly.\n\nThank you,\nSchool Office',
    ackStat: '54 of 180 parents have acknowledged',
  },
  {
    id: 'fee', category: 'Accounts', from: 'Accounts Office', pinned: false, date: '22 Jun',
    icon: 'M3 7h18v10H3zM3 11h18', title: 'Term 2 fee — due 5 July',
    preview: 'Term 2 fees are now payable. Pay online to avoid a late charge.',
    body: 'Dear Parents,\n\nThe Term 2 fee is now due and payable by 5 July 2026. You can pay securely through the Fees section of the app or at the school accounts office. A late fee applies after the due date.\n\nThank you,\nAccounts Office',
    ackStat: '120 of 180 parents have acknowledged',
  },
  {
    id: 'sports', category: 'Sports', from: 'Sports Department', pinned: false, date: '20 Jun',
    icon: 'M6 4h12v3a6 6 0 01-12 0zM10 13h4v3h-4z', title: 'Annual Sports Day — kit list',
    preview: 'House T-shirts and white shorts required. Full kit list inside.',
    body: 'Dear Parents,\n\nAnnual Sports Day is on 2 July. Children must come in their House T-shirt, white shorts and non-marking sports shoes, and carry a labelled water bottle and cap. Events begin at 8:00 AM sharp.\n\nSports Department',
    ackStat: '98 of 180 parents have acknowledged',
  },
  {
    id: 'bus', category: 'Admin', from: 'Transport Office', pinned: false, date: '18 Jun',
    icon: 'M4 16V7a2 2 0 012-2h12a2 2 0 012 2v9M4 16h16M7 16v2M17 16v2M6 11h12', title: 'Revised bus timings from 1 July',
    preview: 'Morning pick-up moves 10 minutes earlier on all routes.',
    body: 'Dear Parents,\n\nFrom 1 July, morning pick-up on all routes will be 10 minutes earlier to ease traffic delays. Updated route timings are in the Transport section. Please ensure children are ready at the stop accordingly.\n\nTransport Office',
    ackStat: '110 of 180 parents have acknowledged',
  },
  {
    id: 'reading', category: 'Library', from: 'School Library', pinned: false, date: '15 Jun',
    icon: GLYPH.diary, title: 'Summer reading challenge',
    preview: 'Read 5 books over the break and earn a reading badge.',
    body: 'Dear Parents,\n\nOur summer reading challenge invites every child to read five books over the break. Log titles in the reading diary; children who complete the challenge receive a reading badge in assembly.\n\nSchool Library',
    ackStat: '76 of 180 parents have acknowledged',
  },
];

// ---- calendar events ----
export interface CalEvent {
  m: string;
  d: string;
  title: string;
  sub: string;
  accent: string;
}
export const CAL_EVENTS: CalEvent[] = [
  { m: 'JUN', d: '28', title: 'Parent–Teacher Meeting', sub: '9:00 AM – 1:00 PM · Main block', accent: '#c2a04e' },
  { m: 'JUL', d: '02', title: 'Annual Sports Day', sub: 'Full day · Sports ground', accent: '#15412f' },
  { m: 'JUL', d: '09', title: 'Unit Test 3 begins', sub: 'Maths, Science, English', accent: '#c0392b' },
  { m: 'JUL', d: '15', title: 'Independence Day rehearsal', sub: '2:00 PM · Assembly hall', accent: '#15412f' },
  { m: 'AUG', d: '15', title: 'Independence Day · Holiday', sub: 'School closed', accent: '#15412f' },
];
export const MONTH_ORDER: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};
export const MONTHS = Object.keys(MONTH_ORDER);

// ---- notifications ----
export const NOTIFS = [
  { path: GLYPH.check, title: 'Aarav was marked Present', sub: 'Marked 8:42 AM by Ms. Rao', tm: 'now' },
  { path: 'M3 6h18v14H3zM3 13l5-4 4 3 5-5 4 4', title: 'New album: Annual Sports Day', sub: '142 photos from this morning', tm: '1h' },
  { path: GLYPH.diary, title: 'Homework posted for Wed', sub: '3 subjects · Maths, Science, English', tm: '3h' },
  { path: GLYPH.notices, title: 'Notice: Parent–Teacher Meeting', sub: 'From the Principal · please acknowledge', tm: '1d' },
  { path: 'M6 3h9l4 4v14H6z', title: 'Unit Test 2 results published', sub: 'Aarav scored 88% · class rank 3', tm: '2d' },
];

// ---- parent diary (homework by date) ----
export interface DiaryTask {
  subj: string;
  note: string;
  done: boolean;
}
export interface DiaryDay {
  note: string | null;
  tasks: DiaryTask[];
}
export const DATE_ORDER = ['16', '17', '18', '19', '20', '23', '24', '25', '26', '27'];
export const WD: Record<string, string> = {
  '16': 'Mon', '17': 'Tue', '18': 'Wed', '19': 'Thu', '20': 'Fri',
  '23': 'Mon', '24': 'Tue', '25': 'Wed', '26': 'Thu', '27': 'Fri',
};
export const WD_FULL: Record<string, string> = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday',
};
export const TODAY_DATE = '25';

export const DIARY_BY_DATE: Record<string, DiaryDay> = {
  '16': { note: null, tasks: [
    { subj: 'Mathematics', note: 'Ms. Rao · Worksheet 9, place value', done: true },
    { subj: 'English', note: 'Ms. Kapoor · spellings list 6', done: true } ] },
  '17': { note: null, tasks: [
    { subj: 'Science', note: 'Mr. Nair · label the parts of a plant', done: true },
    { subj: 'Hindi', note: 'Mrs. Iyer · सुलेख अभ्यास पृष्ठ 4', done: true } ] },
  '18': { note: null, tasks: [
    { subj: 'Mathematics', note: 'Ms. Rao · Worksheet 10', done: true },
    { subj: 'Computer', note: 'Mr. Das · draw a simple flowchart', done: true } ] },
  '19': { note: null, tasks: [
    { subj: 'English', note: 'Ms. Kapoor · read chapter 5 aloud', done: true },
    { subj: 'EVS', note: 'Ms. Rao · collect 3 kinds of leaves', done: true } ] },
  '20': { note: 'Bring your art file on Monday. — Ms. Bose', tasks: [
    { subj: 'Mathematics', note: 'Ms. Rao · revision sheet', done: true },
    { subj: 'Art', note: 'Ms. Bose · finish the landscape sketch', done: true } ] },
  '23': { note: null, tasks: [
    { subj: 'Mathematics', note: 'Ms. Rao · Worksheet 11, fractions', done: true },
    { subj: 'Hindi', note: 'Mrs. Iyer · कविता याद करना', done: true } ] },
  '24': { note: 'PT kit needed tomorrow. — Coach Singh', tasks: [
    { subj: 'Mathematics', note: 'Ms. Rao · Worksheet 11 (part B)', done: true },
    { subj: 'Science', note: 'Mr. Nair · read pp. 36–39', done: true },
    { subj: 'EVS', note: 'Ms. Rao · water cycle diagram', done: true } ] },
  '25': { note: "Please send a fresh leaf for tomorrow's Science lab. — Mr. Nair", tasks: [
    { subj: 'Mathematics', note: 'Ms. Rao · Worksheet 12, fractions', done: true },
    { subj: 'Science', note: 'Mr. Nair · read pp. 40–44, leaf diagram', done: false },
    { subj: 'English', note: 'Ms. Kapoor · paragraph on "My favourite season"', done: false } ] },
  '26': { note: null, tasks: [] },
  '27': { note: null, tasks: [] },
};

// ---- attendance calendar (parent) ----
export function attCells() {
  const sun = [7, 14, 21, 28], sat = [6, 13, 20, 27], absent = [11], holiday = [19];
  const out: { d: number; color: string; showDot: boolean; txt: string }[] = [];
  for (let d = 1; d <= 30; d++) {
    let color = '#1f8a5b', future = false;
    if (sun.includes(d) || sat.includes(d) || holiday.includes(d)) color = '#e6e9e3';
    if (absent.includes(d)) color = '#c0392b';
    if (d > 25 && !sun.includes(d) && !sat.includes(d)) { color = '#f1f5f1'; future = true; }
    out.push({ d, color, showDot: !future, txt: color === '#e6e9e3' ? '#6c766f' : '#15211b' });
  }
  return out;
}

// ---- results (parent report cards) ----
export interface ExamSubject { name: string; m: number; max: number }
export interface Exam {
  id: string;
  name: string;
  published?: boolean;
  provisional?: boolean;
  when?: string;
  rank?: number;
  remark?: string;
  subjects: ExamSubject[];
}
export interface Year { id: string; label: string; sub: string; short: string; exams: Exam[] }

export const YEARS: Year[] = [
  { id: 'g5', label: 'Grade 5', sub: '2026–27 · now', short: 'Grade 5', exams: [
    { id: 'ut1', name: 'Unit Test 1', rank: 5, remark: 'A steady start to the year. A little more care with presentation in Maths. — Ms. Kapoor',
      subjects: [{ name: 'Mathematics', m: 42, max: 50 }, { name: 'Science', m: 41, max: 50 }, { name: 'English', m: 43, max: 50 }, { name: 'Social Studies', m: 42, max: 50 }] },
    { id: 'hy', name: 'Half-Yearly', rank: 4, remark: 'Good all-round performance. Reading comprehension has clearly improved. — Ms. Kapoor',
      subjects: [{ name: 'Mathematics', m: 71, max: 80 }, { name: 'Science', m: 68, max: 80 }, { name: 'English', m: 70, max: 80 }, { name: 'Social Studies', m: 69, max: 80 }] },
    { id: 'ut2', name: 'Unit Test 2', rank: 3, remark: 'Excellent improvement in Maths this term. Keep encouraging daily reading at home. — Ms. Kapoor',
      subjects: [{ name: 'Mathematics', m: 46, max: 50 }, { name: 'Science', m: 44, max: 50 }, { name: 'English', m: 43, max: 50 }, { name: 'Social Studies', m: 43, max: 50 }] },
    { id: 'ut3', name: 'Unit Test 3', published: false, when: '12 July', subjects: [] },
  ] },
  { id: 'g4', label: 'Grade 4', sub: '2025–26', short: 'Grade 4', exams: [
    { id: 'ut1', name: 'Unit Test 1', rank: 6, remark: 'Settling in well. More practice needed with multiplication tables. — Mr. Verma',
      subjects: [{ name: 'Mathematics', m: 40, max: 50 }, { name: 'Science', m: 41, max: 50 }, { name: 'English', m: 42, max: 50 }, { name: 'Social Studies', m: 40, max: 50 }] },
    { id: 'hy', name: 'Half-Yearly', rank: 4, remark: 'Consistent effort across all subjects. — Mr. Verma',
      subjects: [{ name: 'Mathematics', m: 69, max: 80 }, { name: 'Science', m: 66, max: 80 }, { name: 'English', m: 70, max: 80 }, { name: 'Social Studies', m: 67, max: 80 }] },
    { id: 'ut2', name: 'Unit Test 2', rank: 3, remark: 'A strong showing in English and Maths. — Mr. Verma',
      subjects: [{ name: 'Mathematics', m: 44, max: 50 }, { name: 'Science', m: 42, max: 50 }, { name: 'English', m: 44, max: 50 }, { name: 'Social Studies', m: 43, max: 50 }] },
    { id: 'ann', name: 'Annual Exam', rank: 2, remark: 'An excellent year. Promoted to Grade 5 with distinction. — Mr. Verma',
      subjects: [{ name: 'Mathematics', m: 92, max: 100 }, { name: 'Science', m: 88, max: 100 }, { name: 'English', m: 90, max: 100 }, { name: 'Social Studies', m: 86, max: 100 }] },
  ] },
  { id: 'g3', label: 'Grade 3', sub: '2024–25', short: 'Grade 3', exams: [
    { id: 'hy', name: 'Half-Yearly', rank: 3, remark: 'Curious and participative in class. — Mrs. Fernandes',
      subjects: [{ name: 'Mathematics', m: 71, max: 80 }, { name: 'EVS', m: 70, max: 80 }, { name: 'English', m: 68, max: 80 }, { name: 'Hindi', m: 70, max: 80 }] },
    { id: 'ann', name: 'Annual Exam', rank: 2, remark: 'A wonderful year of growth. Promoted to Grade 4. — Mrs. Fernandes',
      subjects: [{ name: 'Mathematics', m: 92, max: 100 }, { name: 'EVS', m: 90, max: 100 }, { name: 'English', m: 88, max: 100 }, { name: 'Hindi', m: 90, max: 100 }] },
  ] },
];

export function overallOf(ex: Exam) {
  if (!ex.subjects || !ex.subjects.length) return null;
  let sm = 0, mx = 0;
  ex.subjects.forEach((s) => { sm += s.m; mx += s.max; });
  return Math.round((sm / mx) * 100);
}

// ---- teacher: classes, rosters, subjects ----
export interface TeacherClass {
  id: string;
  label: string;
  roleLabel: string;
  count: number;
  subjects: string[]; // subject codes
  ct: boolean;
}
export const TEACHER_CLASSES: TeacherClass[] = [
  { id: '5B', label: 'Grade 5-B', roleLabel: 'Class teacher', count: 32, subjects: ['math', 'sci', 'eng', 'soc'], ct: true },
  { id: '5A', label: 'Grade 5-A', roleLabel: 'Mathematics', count: 30, subjects: ['math'], ct: false },
  { id: '6A', label: 'Grade 6-A', roleLabel: 'Mathematics', count: 34, subjects: ['math'], ct: false },
];
export const SUBJ_META: Record<string, string> = { math: 'Mathematics', sci: 'Science', eng: 'English', soc: 'Social Studies' };

export const ROSTERS: Record<string, string[]> = {
  '5B': ['Aarav Mehta', 'Diya Sharma', 'Kabir Nair', 'Ananya Iyer', 'Vivaan Reddy', 'Ishika Rao', 'Rohan Gupta', 'Meera Krishnan', 'Arjun Menon', 'Saanvi Desai', 'Aditya Bose', 'Anika Kapoor', 'Dhruv Malhotra', 'Riya Chopra', 'Kian Fernandes', 'Tara Sinha'],
  '5A': ['Kavya Pillai', 'Aryan Verma', 'Neel Saxena', 'Myra Jain', 'Reyansh Shah', 'Sara Dsouza', 'Yash Agarwal', 'Advika Rao', 'Zara Khan', 'Ved Kulkarni', 'Naina Bhat', 'Ishaan Roy', 'Pari Nanda', 'Kabir Sethi'],
  '6A': ['Nikhil Rao', 'Aisha Sheikh', 'Prisha Nanda', 'Om Prakash', 'Laksh Bhatia', 'Ira Menon', 'Shaurya Singh', 'Anvi Patel', 'Rudra Das', 'Mishka Roy', 'Aarohi Jain', 'Dev Malhotra', 'Sia Kapoor', 'Rehan Ali'],
};
export function rosterOf(cls: string) {
  return (ROSTERS[cls] || []).map((name, i) => ({ id: cls + '-' + i, name, roll: i + 1 }));
}

// A roster entry that may carry guardian details (teacher & admin roster editing).
export interface RosterStudent {
  name: string;
  guardian?: Guardian;
}

// Attendance is simulated deterministically for the admin overview: every 4th
// student (roll index 3, 10, 17…) is treated as absent for the day.
export function classAttendanceOf(students: (string | RosterStudent)[]) {
  const roster = students.map((s, i) => ({
    name: typeof s === 'string' ? s : s.name,
    roll: ('0' + (i + 1)).slice(-2),
    present: i % 7 !== 3,
  }));
  const total = roster.length;
  const absent = roster.filter((r) => !r.present).length;
  const present = total - absent;
  return { roster, present, absent, total, pct: total ? Math.round((present / total) * 100) : 0 };
}
export const CT_NAME_OF: Record<string, string> = { '5B': 'Ms. Rao', '5A': 'Ms. Iyer', '6A': 'Mr. Verma' };
export const SEEDED_ABS: Record<string, string[]> = { '5A': ['5A-3', '5A-7'], '6A': ['6A-5'] };

export const TE_EXAMS = [
  { id: 'ut1', name: 'Unit Test 1' },
  { id: 'hy', name: 'Half-Yearly' },
  { id: 'ut2', name: 'Unit Test 2' },
  { id: 'ut3', name: 'Unit Test 3' },
];
export const PUB_AVG_MAP: Record<string, number> = { ut1: 82, hy: 85, ut2: 86 };
export const MAX_MARKS = 50;

// ---- teacher class diary (post homework) ----
export type ClassDiary = Record<string, Record<string, { subj: string; note: string }[]>>;
export const CLASS_DIARY: ClassDiary = {
  '5B': {
    '24': [{ subj: 'Mathematics', note: 'Worksheet 11 (part B)' }, { subj: 'Science', note: 'Read pp. 36–39' }, { subj: 'EVS', note: 'Water cycle diagram' }],
    '25': [{ subj: 'Mathematics', note: 'Worksheet 12, fractions' }, { subj: 'Science', note: 'Read pp. 40–44, leaf diagram' }, { subj: 'English', note: 'Paragraph on "My favourite season"' }],
  },
  '5A': { '25': [{ subj: 'Mathematics', note: 'Exercise 6.2 — all sums' }] },
  '6A': { '25': [{ subj: 'Algebra', note: 'Algebra worksheet 3' }] },
};

// ---- admin: teachers ----
export interface Teacher {
  id: string;
  name: string;
  initials: string;
  subject: string;
  subjects: string[];
  phone: string;
  classes: string[];
  teach?: Record<string, string[]>;
  ct: string;
  status: 'active' | 'invited' | 'inactive';
}
export const TEACHERS: Teacher[] = [
  { id: 'rao', name: 'Anjali Rao', initials: 'AR', subject: 'Mathematics', subjects: ['Mathematics'], phone: '9811122233', classes: ['5-B', '5-A', '6-A'], ct: '5-B', status: 'active' },
  { id: 'kapoor', name: 'Neha Kapoor', initials: 'NK', subject: 'English', subjects: ['English'], phone: '9811133344', classes: ['5-B', '5-A'], ct: '', status: 'active' },
  { id: 'nair', name: 'Rajesh Nair', initials: 'RN', subject: 'Science', subjects: ['Science', 'Computer'], phone: '9811144455', classes: ['5-B', '6-A'], ct: '', status: 'active' },
  { id: 'iyer', name: 'Lakshmi Iyer', initials: 'LI', subject: 'Hindi', subjects: ['Hindi'], phone: '9877700011', classes: ['5-A', '5-B'], ct: '5-A', status: 'active' },
  { id: 'verma', name: 'Suresh Verma', initials: 'SV', subject: 'Social Studies', subjects: ['Social Studies'], phone: '9811166677', classes: ['6-A', '6-B'], ct: '6-A', status: 'active' },
  { id: 'das', name: 'Partho Das', initials: 'PD', subject: 'Computer', subjects: ['Computer'], phone: '9811177788', classes: ['5-A', '5-B', '6-A'], ct: '', status: 'active' },
  { id: 'bose', name: 'Ritika Bose', initials: 'RB', subject: 'Art', subjects: ['Art'], phone: '9811188899', classes: ['5-A', '5-B', '6-A', '6-B'], ct: '', status: 'active' },
  { id: 'singh', name: 'Harpreet Singh', initials: 'HS', subject: 'Phys. Education', subjects: ['Phys. Education'], phone: '9811199900', classes: ['5-A', '5-B', '6-A', '6-B'], ct: '', status: 'invited' },
];

export interface Guardian { name: string; phone: string; relation: string }
export interface AdminStudent { name: string; guardian?: Guardian }
export interface AdminClass { id: string; label: string; ctId: string; students: AdminStudent[] }

export const ADMIN_CLASSES: AdminClass[] = [
  { id: '5-A', label: 'Grade 5-A', ctId: 'iyer', students: ['Kavya Pillai', 'Aryan Verma', 'Neel Saxena', 'Myra Jain', 'Reyansh Shah', 'Sara Dsouza', 'Yash Agarwal', 'Advika Rao', 'Zara Khan', 'Ved Kulkarni', 'Naina Bhat', 'Ishaan Roy', 'Pari Nanda', 'Kabir Sethi'].map((name) => ({ name })) },
  { id: '5-B', label: 'Grade 5-B', ctId: 'rao', students: ['Aarav Mehta', 'Diya Sharma', 'Kabir Nair', 'Ananya Iyer', 'Vivaan Reddy', 'Ishika Rao', 'Rohan Gupta', 'Meera Krishnan', 'Arjun Menon', 'Saanvi Desai', 'Aditya Bose', 'Anika Kapoor', 'Dhruv Malhotra', 'Riya Chopra', 'Kian Fernandes', 'Tara Sinha'].map((name) => ({ name })) },
  { id: '6-A', label: 'Grade 6-A', ctId: 'verma', students: ['Nikhil Rao', 'Aisha Sheikh', 'Prisha Nanda', 'Om Prakash', 'Laksh Bhatia', 'Ira Menon', 'Shaurya Singh', 'Anvi Patel', 'Rudra Das', 'Mishka Roy', 'Aarohi Jain', 'Dev Malhotra', 'Sia Kapoor', 'Rehan Ali'].map((name) => ({ name })) },
  { id: '6-B', label: 'Grade 6-B', ctId: '', students: [] },
];

export const ALL_SUBJECTS = ['Mathematics', 'Science', 'English', 'Social Studies', 'Hindi', 'Computer', 'Art', 'Phys. Education'];
export const NOTICE_CATEGORIES = ['Admin', 'Principal', 'Sports', 'Library'];

// Per-class subject & exam catalogues (editable by admin & class teacher).
export const DEFAULT_CLASS_SUBJECTS = ['Mathematics', 'Science', 'English', 'Social Studies', 'Hindi'];
export interface ClassExam { id: string; name: string }
export const DEFAULT_CLASS_EXAMS: ClassExam[] = [
  { id: 'ut1', name: 'Unit Test 1' },
  { id: 'hy', name: 'Half-Yearly' },
  { id: 'ut2', name: 'Unit Test 2' },
  { id: 'ut3', name: 'Unit Test 3' },
];

export const ADMIN_ACTIVITY = [
  { dot: '#1f8a5b', title: 'Ms. Rao marked 5-B register', sub: '30 present · 2 absent', tm: '9:12' },
  { dot: '#c2a04e', title: 'Unit Test 2 results published', sub: 'Grade 5-B · Ms. Kapoor', tm: '1d' },
  { dot: '#15412f', title: 'New notice posted', sub: 'Half-day this Friday', tm: '1d' },
];

export function subjectsOf(t: Teacher) {
  return t.subjects && t.subjects.length ? t.subjects : t.subject ? [t.subject] : [];
}
export function teachOf(t: Teacher): Record<string, string[]> {
  return t.teach || Object.fromEntries((t.classes || []).map((c) => [c, subjectsOf(t)]));
}
