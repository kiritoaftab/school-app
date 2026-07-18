import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  AppHeader, BottomSheet, Card, Chip, Glyph, InfoNote, PrimaryButton,
  OutlineButton, Shell, StatCard, cx, type TabDef,
} from './kit';
import {
  listMyClasses, listDiary, createDiaryEntry, deleteDiaryEntry,
  type TeacherKlass, type DiaryEntry,
} from '../api/teacher';
import { CalendarScreen, NotificationsScreen } from './SharedScreens';
import { AccountSheet } from './AccountSheet';
import {
  SCHOOL, GLYPH, TEACHER_CLASSES, SUBJ_META, ROSTERS, CT_NAME_OF, SEEDED_ABS,
  CLASS_DIARY, PUB_AVG_MAP, MAX_MARKS, TODAY_DATE,
  DEFAULT_CLASS_EXAMS, initialsOf, maskPhone,
  type ClassDiary, type RosterStudent, type ClassExam,
} from './data';

type Screen = 'home' | 'attendance' | 'diary' | 'calendar' | 'results' | 'students' | 'notifs';
type ExamStatus = 'draft' | 'provisional' | 'final';
type Rostered = { id: string; name: string; roll: number; guardian?: RosterStudent['guardian'] };
const TOP_LEVEL: Screen[] = ['home', 'diary', 'calendar', 'results', 'students'];
const PUBLISHED_EXAMS = ['ut1', 'hy', 'ut2'];

const mkKey = (cls: string, exam: string, subj: string, sid: string) => `${cls}.${exam}.${subj}.${sid}`;
const seedRosters = (): Record<string, RosterStudent[]> => {
  const out: Record<string, RosterStudent[]> = {};
  Object.keys(ROSTERS).forEach((k) => { out[k] = ROSTERS[k].map((name) => ({ name })); });
  return out;
};

export function TeacherApp() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [screen, setScreen] = useState<Screen>('home');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);

  // Live classes drive the switcher; the diary reads from them directly.
  const [classes, setClasses] = useState<TeacherKlass[]>([]);
  const [classesErr, setClassesErr] = useState('');
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [selClassId, setSelClassId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    listMyClasses()
      .then((cs) => {
        if (!alive) return;
        setClasses(cs);
        setSelClassId((cur) => (cur != null && cs.some((c) => c.id === cur) ? cur : cs[0]?.id ?? null));
      })
      .catch(() => alive && setClassesErr('Could not load your classes.'))
      .finally(() => alive && setLoadingClasses(false));
    return () => { alive = false; };
  }, []);

  const liveClass = classes.find((c) => c.id === selClassId) ?? null;

  const [attAbs, setAttAbs] = useState<Record<string, Record<string, boolean>>>({ '5B': {}, '5A': {}, '6A': {} });
  const [regSaved, setRegSaved] = useState(false);

  // Read-only now that the diary screen is live — TeacherHome still reads it for its mock counts.
  const [classDiary] = useState<ClassDiary>(() => JSON.parse(JSON.stringify(CLASS_DIARY)));
  const [teDate, setTeDate] = useState(TODAY_DATE);

  const [teExam, setTeExam] = useState('ut3');
  const [teSubject, setTeSubject] = useState('math');
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [examStatus, setExamStatus] = useState<Record<string, ExamStatus>>({});
  const [editingFinal, setEditingFinal] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState('');

  // Editable rosters (class teacher can add/edit/remove students).
  const [teRosters, setTeRosters] = useState<Record<string, RosterStudent[]>>(seedRosters);
  // Per-class examination catalogue (class teacher can add/remove).
  const [teExamsByClass, setTeExamsByClass] = useState<Record<string, ClassExam[]>>({});

  // Bridge to the screens that are still on mock data: they look classes up by
  // the "5B" style key, so derive it from the real grade/section.
  const selClass = liveClass ? `${liveClass.grade.replace(/\D/g, '')}${liveClass.section.toUpperCase()}` : '5B';
  const mockClass = TEACHER_CLASSES.find((c) => c.id === selClass) ?? TEACHER_CLASSES[0];
  const curClass = liveClass
    ? {
        ...mockClass,
        id: selClass,
        label: liveClass.label,
        roleLabel: liveClass.roleLabel,
        count: liveClass.students,
        ct: liveClass.isClassTeacher,
      }
    : mockClass;
  const name = user?.name ?? 'Ms. Anjali Rao';

  const roster: Rostered[] = (teRosters[selClass] || []).map((s, i) => ({
    id: `${selClass}-${i}`, name: s.name, roll: i + 1, guardian: s.guardian,
  }));
  const count = roster.length;
  const teExams = teExamsByClass[selClass] || DEFAULT_CLASS_EXAMS;

  function go(s: Screen) {
    setScreen(s);
    setPickerOpen(false);
  }
  function statusOf(cls: string, examId: string): ExamStatus {
    if (PUBLISHED_EXAMS.includes(examId)) return 'final';
    return examStatus[`${cls}.${examId}`] || 'draft';
  }

  // ---- roster mutations (class teacher) ----
  function teAddStudent(student: RosterStudent) {
    setTeRosters((r) => ({ ...r, [selClass]: [...(r[selClass] || []), student] }));
  }
  function teRemoveStudent(idx: number) {
    setTeRosters((r) => ({ ...r, [selClass]: (r[selClass] || []).filter((_, i) => i !== idx) }));
  }
  function teSetStudentField(idx: number, field: 'name' | 'gname' | 'gphone' | 'grel', val: string) {
    setTeRosters((r) => {
      const arr = (r[selClass] || []).slice();
      const e: RosterStudent = { ...arr[idx] };
      if (field === 'name') e.name = val;
      else {
        const g = { name: '', phone: '', relation: 'Mother', ...(e.guardian || {}) };
        if (field === 'gname') g.name = val;
        if (field === 'gphone') g.phone = val.replace(/\D/g, '').slice(0, 10);
        if (field === 'grel') g.relation = val;
        e.guardian = g;
      }
      arr[idx] = e;
      return { ...r, [selClass]: arr };
    });
  }

  // ---- exam catalogue mutations (class teacher) ----
  function teAddExam(examName: string) {
    const nm = examName.trim();
    if (!nm) return;
    setTeExamsByClass((m) => ({ ...m, [selClass]: [...(m[selClass] || DEFAULT_CLASS_EXAMS), { id: 'ex' + Date.now(), name: nm }] }));
  }
  function teRemoveExam(id: string) {
    setTeExamsByClass((m) => {
      const arr = (m[selClass] || DEFAULT_CLASS_EXAMS).filter((e) => e.id !== id);
      if (id === teExam) setTeExam(arr[0]?.id ?? '');
      return { ...m, [selClass]: arr };
    });
  }

  // header
  let title = user?.school?.name ?? 'Greenwood';
  let sub: string | undefined = `${name.toUpperCase()} · TEACHER`;
  if (screen === 'diary') { title = 'Class Diary'; sub = curClass.label.toUpperCase(); }
  else if (screen === 'calendar') { title = 'Calendar'; sub = SCHOOL.toUpperCase(); }
  else if (screen === 'results') { title = 'Marks'; sub = curClass.label.toUpperCase(); }
  else if (screen === 'students') { title = 'Students'; sub = `${curClass.label} · CLASS ROSTER`.toUpperCase(); }
  else if (screen === 'attendance') { title = 'Attendance'; sub = `${curClass.label} · 25 JUN`.toUpperCase(); }
  else if (screen === 'notifs') { title = 'Notifications'; sub = SCHOOL.toUpperCase(); }

  const topLevel = TOP_LEVEL.includes(screen);
  const onBack = topLevel ? undefined : () => go('home');
  const activeKey = topLevel ? screen : 'home';
  const showClassBar = ['home', 'attendance', 'diary', 'results', 'students'].includes(screen);

  const tabs: TabDef[] = [
    { key: 'home', label: 'Home', glyph: GLYPH.home },
    { key: 'diary', label: 'Diary', glyph: GLYPH.diary },
    { key: 'calendar', label: 'Calendar', glyph: GLYPH.calendar },
    { key: 'results', label: 'Marks', glyph: GLYPH.results },
    { key: 'students', label: 'Students', glyph: GLYPH.students },
  ].map((t) => ({ ...t, active: activeKey === t.key, onClick: () => go(t.key as Screen) }));

  return (
    <Shell
      header={<AppHeader title={title} sub={sub} onBack={onBack} onAccount={() => setAcctOpen(true)} onBell={() => go('notifs')} brand={user?.school?.name} logo={user?.school?.logo} />}
      classBar={
        showClassBar ? (
          <div className="flex items-center gap-2 px-4 py-[9px] bg-[#eef3ee] border-b border-[#e0e7e0]">
            <button onClick={() => setPickerOpen(true)} className="flex items-center gap-[7px] bg-white border border-[#d3ddd4] rounded-full px-3 py-1.5">
              <span className="text-[12.5px] font-bold text-green">{curClass.label}</span>
              <span className="text-[10px] font-semibold text-muted">{curClass.roleLabel}</span>
              <span className="text-muted"><Glyph d="M6 9l6 6 6-6" size={13} stroke={2.2} /></span>
            </button>
            <span className="ml-auto text-[11px] text-muted font-semibold">{liveClass?.students ?? count} students</span>
          </div>
        ) : undefined
      }
      tabs={tabs}
      overlays={
        <>
          <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)}>
            <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">Your classes</div>
            {classes.length === 0 && (
              <div className="py-4 text-center text-muted text-[12.5px]">
                {loadingClasses ? 'Loading your classes…' : classesErr || 'No classes assigned to you yet.'}
              </div>
            )}
            {classes.map((c) => {
              const on = c.id === selClassId;
              return (
                <div key={c.id} onClick={() => { setSelClassId(c.id); setPickerOpen(false); setTeSubject('math'); setTeDate(TODAY_DATE); setRegSaved(false); }}
                  className={cx('flex items-center gap-2.5 px-3.5 py-[13px] rounded-[15px] cursor-pointer mb-2 border-[1.5px]', on ? 'border-green bg-[#f3f8f4]' : 'border-line bg-white')}>
                  <div className="flex-1">
                    <b className={cx('text-[14px] font-bold block', on ? 'text-green' : 'text-ink')}>{c.label}</b>
                    <small className="text-[11px] text-muted">{c.roleLabel} · {c.students} students</small>
                  </div>
                  {on && <span className="text-green"><Glyph d={GLYPH.check} size={18} stroke={2.4} /></span>}
                </div>
              );
            })}
          </BottomSheet>
          <AccountSheet open={acctOpen} onClose={() => setAcctOpen(false)} name={name} phone={user?.phone ?? '9811122233'} roleLabel="Teacher" onSignOut={() => { logout(); navigate('/login'); }} />
        </>
      }
    >
      {screen === 'home' && (
        <TeacherHome
          name={name} curClass={curClass} count={count} statusOf={statusOf} regSaved={regSaved}
          attAbs={attAbs} classDiary={classDiary} teDate={teDate} go={go} openAcct={() => setAcctOpen(true)}
          openMarks={() => { setTeExam('ut3'); go('results'); }}
        />
      )}
      {screen === 'attendance' && (
        <TeacherAttendance curClass={curClass} selClass={selClass} roster={roster} count={count} attAbs={attAbs} setAttAbs={setAttAbs} regSaved={regSaved} setRegSaved={setRegSaved} />
      )}
      {screen === 'students' && (
        <TeacherStudents
          curClass={curClass} roster={roster}
          onAdd={teAddStudent} onRemove={teRemoveStudent} onSetField={teSetStudentField}
        />
      )}
      {screen === 'diary' && (
        <TeacherDiary klass={liveClass} loading={loadingClasses} error={classesErr} />
      )}
      {screen === 'results' && (
        <TeacherMarks
          curClass={curClass} selClass={selClass} roster={roster} count={count}
          teExam={teExam} setTeExam={setTeExam} teSubject={teSubject} setTeSubject={setTeSubject}
          teExams={teExams} onAddExam={teAddExam} onRemoveExam={teRemoveExam}
          marks={marks} setMarks={setMarks} attAbs={attAbs} setAttAbs={setAttAbs} statusOf={statusOf}
          setExamStatus={setExamStatus} editingFinal={editingFinal} setEditingFinal={setEditingFinal} toast={toast} setToast={setToast}
        />
      )}
      {screen === 'calendar' && <CalendarScreen />}
      {screen === 'notifs' && <NotificationsScreen />}
    </Shell>
  );
}

// ---------- HOME ----------
function TeacherHome({
  name, curClass, count, statusOf, regSaved, attAbs, classDiary, teDate, go, openAcct, openMarks,
}: {
  name: string;
  curClass: typeof TEACHER_CLASSES[number];
  count: number;
  statusOf: (cls: string, e: string) => ExamStatus;
  regSaved: boolean;
  attAbs: Record<string, Record<string, boolean>>;
  classDiary: ClassDiary;
  teDate: string;
  go: (s: Screen) => void;
  openAcct: () => void;
  openMarks: () => void;
}) {
  const abs = attAbs[curClass.id] || {};
  const regAbsent = Object.keys(abs).length;
  const regPresent = count - regAbsent;
  const roAbs = SEEDED_ABS[curClass.id] || [];
  const classAbsent = curClass.ct ? regAbsent : roAbs.length;
  const classPresent = count - classAbsent;
  const hwCount = (classDiary[curClass.id]?.[teDate] || []).length;
  const ut3 = statusOf(curClass.id, 'ut3');

  const actions: {
    title: string; sub: string; icon: string; gold?: boolean; badge?: string; onClick: () => void;
  }[] = [];
  if (curClass.ct) {
    actions.push({
      title: "Mark today's attendance",
      sub: regSaved ? `Saved · ${regPresent} present` : regAbsent > 0 ? `${regAbsent} marked absent · not saved` : 'Register not taken yet',
      icon: GLYPH.attendanceCheck, badge: regSaved ? '' : 'DUE', onClick: () => go('attendance'),
    });
  } else {
    actions.push({
      title: 'Class attendance', sub: `${classPresent} present · ${classAbsent} absent · by ${CT_NAME_OF[curClass.id]}`,
      icon: GLYPH.staff, badge: 'VIEW', onClick: () => go('attendance'),
    });
  }
  actions.push({ title: 'Post homework', sub: `${hwCount} posted for today · ${curClass.label}`, icon: GLYPH.diary, onClick: () => go('diary') });
  actions.push({
    title: 'Enter Unit Test 3 marks',
    sub: ut3 === 'final' ? 'Finalized & published' : ut3 === 'provisional' ? 'Provisional · under review' : 'Due 12 July · not published',
    icon: GLYPH.results, gold: true, badge: ut3 === 'draft' ? 'TO DO' : ut3 === 'provisional' ? 'PROVISIONAL' : '', onClick: openMarks,
  });

  return (
    <div className="px-[15px] pt-4 pb-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div onClick={openAcct} className="flex items-center gap-2.5 cursor-pointer">
          <div className="w-[38px] h-[38px] rounded-[13px] grid place-items-center text-green font-bold text-[14px] flex-none" style={{ background: 'linear-gradient(140deg,#d7e4da,#a7c4b4)' }}>{initialsOf(name)}</div>
          <div className="font-semibold text-[14px] leading-[1.1]">{name}<small className="block text-muted font-medium text-[11px] mt-0.5">Mathematics · 3 classes</small></div>
          <span className="text-[#9aa39b] flex-none"><Glyph d={GLYPH.chevronDown} size={16} stroke={2.2} /></span>
        </div>
        <div className="ml-auto font-serif text-[16px] text-green">Good morning</div>
      </div>
      <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">Today · {curClass.label}</div>
      {actions.map((a, i) => (
        <Card key={i} onClick={a.onClick} className="p-3.5 mb-2.5 flex gap-3 items-center">
          <div className={cx('w-10 h-10 rounded-xl grid place-items-center flex-none', a.gold ? 'bg-gold-soft text-[#8a6d1f]' : 'bg-mist text-green')}>
            <Glyph d={a.icon} size={20} stroke={1.9} />
          </div>
          <div className="flex-1 min-w-0"><b className="text-[13.5px] font-semibold block">{a.title}</b><small className="text-[11.5px] text-muted">{a.sub}</small></div>
          {a.badge && <span className="text-[10px] font-bold text-[#8a6d1f] bg-gold-soft px-2 py-[3px] rounded-[7px] flex-none">{a.badge}</span>}
          <span className="text-[#c3ccc5] flex-none"><Glyph d={GLYPH.chevronRight} size={17} stroke={2.2} /></span>
        </Card>
      ))}
      <div className="flex gap-2.5 mt-1.5">
        <div onClick={() => go('students')} className="flex-1 cursor-pointer"><StatCard value={count} label="Students" /></div>
        <div onClick={() => go('attendance')} className="flex-1 cursor-pointer"><StatCard value={classPresent} label="Present" /></div>
        <div onClick={() => go('diary')} className="flex-1 cursor-pointer"><StatCard value={hwCount} label="Homework" /></div>
      </div>
    </div>
  );
}

// ---------- ATTENDANCE ----------
function TeacherAttendance({
  curClass, selClass, roster, count, attAbs, setAttAbs, regSaved, setRegSaved,
}: {
  curClass: typeof TEACHER_CLASSES[number];
  selClass: string;
  roster: Rostered[];
  count: number;
  attAbs: Record<string, Record<string, boolean>>;
  setAttAbs: React.Dispatch<React.SetStateAction<Record<string, Record<string, boolean>>>>;
  regSaved: boolean;
  setRegSaved: (v: boolean) => void;
}) {
  const abs = attAbs[selClass] || {};

  function toggle(sid: string, present: boolean) {
    setAttAbs((a) => {
      const c = { ...(a[selClass] || {}) };
      if (present) delete c[sid];
      else c[sid] = true;
      return { ...a, [selClass]: c };
    });
    setRegSaved(false);
  }

  if (!curClass.ct) {
    const roAbs = SEEDED_ABS[selClass] || [];
    const classAbsent = roAbs.length;
    return (
      <div className="px-[15px] py-4 pb-6">
        <div className="mb-3">
          <InfoNote>
            Marked by <b>{CT_NAME_OF[selClass]}</b> (class teacher) at 8:40 AM. You teach {curClass.roleLabel} here, so the register is view-only.
          </InfoNote>
        </div>
        <div className="flex gap-2.5 mb-3">
          <StatCard value={count - classAbsent} label="Present" valueColor="text-success" />
          <StatCard value={classAbsent} label="Absent" valueColor="text-danger" />
        </div>
        <Card className="px-3.5 py-1.5">
          {roster.map((r) => {
            const isAbs = roAbs.includes(r.id);
            return (
              <div key={r.id} className="flex items-center gap-[11px] py-2.5 border-t border-[#f0f2ee] first:border-t-0">
                <span className="w-[22px] text-[11px] text-muted font-semibold flex-none">{r.roll}</span>
                <span className="flex-1 text-[13px] font-semibold truncate">{r.name}</span>
                <span className={cx('text-[11px] font-bold px-2.5 py-1 rounded-lg flex-none', isAbs ? 'bg-[#f6ecec] text-danger' : 'bg-mist text-success')}>{isAbs ? 'Absent' : 'Present'}</span>
              </div>
            );
          })}
        </Card>
      </div>
    );
  }

  const regAbsent = Object.keys(abs).length;
  const regPresent = count - regAbsent;
  return (
    <div className="px-[15px] py-4 pb-6">
      <div className="flex items-center gap-2.5 mb-3">
        <StatCard value={regPresent} label="Present" valueColor="text-success" />
        <StatCard value={regAbsent} label="Absent" valueColor="text-danger" />
        <button onClick={() => { setAttAbs((a) => ({ ...a, [selClass]: {} })); setRegSaved(false); }} className="flex-1 bg-mist rounded-2xl px-2 py-3 text-green font-semibold text-[11.5px] leading-tight">Mark all present</button>
      </div>
      <Card className="px-3.5 py-1.5 mb-3">
        {roster.map((r) => {
          const isAbs = !!abs[r.id];
          return (
            <div key={r.id} className="flex items-center gap-[11px] py-2.5 border-t border-[#f0f2ee] first:border-t-0">
              <span className="w-[22px] text-[11px] text-muted font-semibold flex-none">{r.roll}</span>
              <span className="flex-1 text-[13px] font-semibold truncate">{r.name}</span>
              <div className="flex gap-1 bg-[#f1f5f1] rounded-[10px] p-[3px]">
                <button onClick={() => toggle(r.id, true)} className={cx('w-[30px] h-[26px] rounded-lg text-[12px] font-bold', !isAbs ? 'bg-success text-white' : 'text-[#9aa39b]')}>P</button>
                <button onClick={() => toggle(r.id, false)} className={cx('w-[30px] h-[26px] rounded-lg text-[12px] font-bold', isAbs ? 'bg-danger text-white' : 'text-[#9aa39b]')}>A</button>
              </div>
            </div>
          );
        })}
      </Card>
      <PrimaryButton onClick={() => setRegSaved(true)}>{regSaved ? '✓ Register saved' : 'Save register'}</PrimaryButton>
    </div>
  );
}

// ---------- DIARY (post homework) ----------
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Local-time YYYY-MM-DD — never use toISOString here, it shifts across timezones. */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
/** Monday of the week containing `d`. */
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return addDays(x, -((x.getDay() + 6) % 7));
}

function TeacherDiary({ klass, loading, error }: { klass: TeacherKlass | null; loading: boolean; error: string }) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const todayKey = ymd(today);

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selDate, setSelDate] = useState(todayKey);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState('');

  const [task, setTask] = useState('');
  const [subject, setSubject] = useState('');
  const [posting, setPosting] = useState(false);

  // Mon–Sat; schools here don't run a Sunday diary.
  const week = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const from = ymd(week[0]);
  const to = ymd(week[week.length - 1]);

  const subjects = klass?.subjects ?? [];
  // Keep the chosen subject valid when the class (and so the allowed list) changes.
  useEffect(() => {
    setSubject((s) => (subjects.some((x) => x.name === s) ? s : subjects[0]?.name ?? ''));
  }, [klass?.id, subjects]);

  const load = useCallback(async () => {
    if (!klass) return;
    setBusy(true);
    setLoadErr('');
    try {
      const data = await listDiary(klass.id, from, to);
      setEntries(data.entries);
    } catch {
      setLoadErr('Could not load the diary for this week.');
      setEntries([]);
    } finally {
      setBusy(false);
    }
  }, [klass?.id, from, to]);

  useEffect(() => { void load(); }, [load]);

  const dayEntries = entries.filter((e) => e.date === selDate);
  const countFor = (key: string) => entries.filter((e) => e.date === key).length;

  const selDay = useMemo(() => new Date(`${selDate}T00:00:00`), [selDate]);
  const inThisWeek = selDate >= from && selDate <= to;
  const onCurrentWeek = ymd(startOfWeek(today)) === from;

  function shiftWeek(delta: number) {
    const next = addDays(weekStart, delta * 7);
    setWeekStart(next);
    // Follow the user into the new week rather than leaving a stale selection.
    setSelDate(ymd(next));
  }
  function goToday() {
    setWeekStart(startOfWeek(today));
    setSelDate(todayKey);
  }

  async function post() {
    if (!klass || !task.trim() || !subject) return;
    setPosting(true);
    try {
      await createDiaryEntry({ klassId: klass.id, subject, date: selDate, task: task.trim() });
      setTask('');
      await load();
    } catch {
      setLoadErr('Could not post that entry.');
    } finally {
      setPosting(false);
    }
  }
  async function remove(id: number) {
    try {
      await deleteDiaryEntry(id);
      setEntries((es) => es.filter((e) => e.id !== id));
    } catch {
      setLoadErr('Could not remove that entry.');
    }
  }

  if (loading) return <div className="px-[15px] py-8 text-center text-muted text-[12.5px]">Loading…</div>;
  if (!klass) {
    return (
      <div className="px-[15px] py-4">
        <InfoNote tone="amber" icon="M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z">
          {error || 'You have no classes assigned yet. Ask your school admin to make you a class teacher or assign you a subject.'}
        </InfoNote>
      </div>
    );
  }

  return (
    <div className="px-[15px] py-4 pb-6">
      {/* ---- week calendar ---- */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="flex-1 font-serif text-[16px] leading-none text-green">
          {MONTHS[week[0].getMonth()]}
          {week[5].getMonth() !== week[0].getMonth() && ` – ${MONTHS[week[5].getMonth()]}`}
          <span className="text-muted text-[13px] font-sans font-semibold ml-1.5">{week[0].getFullYear()}</span>
        </div>
        {!onCurrentWeek && (
          <button onClick={goToday} className="text-[11px] font-bold text-green bg-mist px-2.5 py-1.5 rounded-[9px]">Today</button>
        )}
        <button onClick={() => shiftWeek(-1)} aria-label="Previous week" className="w-7 h-7 rounded-[9px] border border-line bg-white text-muted grid place-items-center">
          <Glyph d="M15 18l-6-6 6-6" size={15} stroke={2.2} />
        </button>
        <button onClick={() => shiftWeek(1)} aria-label="Next week" className="w-7 h-7 rounded-[9px] border border-line bg-white text-muted grid place-items-center">
          <Glyph d="M9 18l6-6-6-6" size={15} stroke={2.2} />
        </button>
      </div>
      <div className="flex gap-1.5 mb-3.5">
        {week.map((d) => {
          const key = ymd(d);
          const active = key === selDate;
          const isToday = key === todayKey;
          const n = countFor(key);
          return (
            <button
              key={key}
              onClick={() => setSelDate(key)}
              className={cx(
                'flex-1 text-center pt-2 pb-[13px] rounded-[13px] text-[11px] font-semibold relative border',
                active ? 'bg-green border-green text-[#bcd2c5]'
                  : isToday ? 'bg-white border-[1.5px] border-green text-muted'
                    : 'bg-white border-line text-muted',
              )}
            >
              {DAY_SHORT[d.getDay()]}
              <b className={cx('block text-[15px] mt-0.5', active ? 'text-white' : 'text-ink')}>{d.getDate()}</b>
              {n > 0 && !active && <span className="absolute bottom-[5px] left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-gold" />}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2.5 mb-[11px]">
        <div className="font-serif text-[19px] leading-none">
          {DAY_FULL[selDay.getDay()]}, {selDay.getDate()} {MONTHS[selDay.getMonth()]}
        </div>
        {selDate === todayKey && <span className="text-[10px] font-bold text-green bg-gold-soft px-2 py-[3px] rounded-[7px]">TODAY</span>}
        {selDate > todayKey && <span className="text-[10px] font-bold text-muted bg-cloud px-2 py-[3px] rounded-[7px]">UPCOMING</span>}
      </div>

      {loadErr && <div className="mb-3"><InfoNote tone="amber">{loadErr}</InfoNote></div>}

      <Card className="px-3.5 py-1.5 mb-3">
        {busy && dayEntries.length === 0 ? (
          <div className="py-4 text-center text-muted text-[12.5px]">Loading diary…</div>
        ) : dayEntries.length === 0 ? (
          <div className="py-4 text-center text-muted text-[12.5px]">No homework posted for {klass.label} yet.</div>
        ) : (
          dayEntries.map((e) => (
            <div key={e.id} className="flex items-start gap-[11px] py-[11px] border-t border-[#f0f2ee] first:border-t-0">
              <span className="text-[9.5px] font-bold uppercase text-green bg-mist px-2 py-1 rounded-[7px] mt-px flex-none">{e.subject}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] leading-[1.45]">{e.task}</div>
                {!klass.isClassTeacher || !e.createdBy ? null : (
                  <small className="text-[10.5px] text-muted">{e.createdBy}</small>
                )}
              </div>
              {e.canDelete && (
                <button onClick={() => remove(e.id)} className="w-6 h-6 rounded-lg bg-[#f6ecec] grid place-items-center flex-none text-danger" aria-label="Delete">
                  <Glyph d="M6 6l12 12M18 6L6 18" size={13} stroke={2} />
                </button>
              )}
            </div>
          ))
        )}
      </Card>

      {subjects.length === 0 ? (
        <InfoNote tone="amber" icon="M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z">
          You have no subjects assigned in {klass.label}, so you can't post homework here. Ask your admin to assign you a subject.
        </InfoNote>
      ) : (
        <Card className="p-[15px]">
          <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">Add homework</div>
          {!klass.isClassTeacher && (
            <div className="text-[11px] text-muted leading-[1.5] mb-2.5">
              You teach {subjects.map((s) => s.name).join(', ')} in {klass.label}, so you can post for {subjects.length === 1 ? 'that subject' : 'those subjects'} only.
            </div>
          )}
          <div className="flex gap-1.5 flex-wrap mb-2.5">
            {subjects.map((s) => (
              <Chip key={s.id} active={subject === s.name} onClick={() => setSubject(s.name)}>{s.name}</Chip>
            ))}
          </div>
          <textarea value={task} onChange={(e) => setTask(e.target.value)} placeholder="Homework details for parents…" className="w-full box-border px-3 py-[11px] border-[1.5px] border-line rounded-xl text-[13px] bg-white resize-none h-16 mb-2.5" />
          <button
            onClick={post}
            disabled={!task.trim() || !subject || posting || !inThisWeek}
            className={cx('w-full py-3 rounded-xl font-semibold text-[13px]', task.trim() && subject && !posting ? 'bg-green text-white' : 'bg-[#dfe5df] text-[#9aa39b]')}
          >
            {posting ? 'Posting…' : `Post to ${klass.label}`}
          </button>
        </Card>
      )}
    </div>
  );
}

// ---------- MARKS (results teacher) ----------
function TeacherMarks({
  curClass, selClass, roster, count, teExam, setTeExam, teSubject, setTeSubject,
  teExams, onAddExam, onRemoveExam, marks, setMarks,
  attAbs, setAttAbs, statusOf, setExamStatus, editingFinal, setEditingFinal, toast, setToast,
}: {
  curClass: typeof TEACHER_CLASSES[number];
  selClass: string;
  roster: Rostered[];
  count: number;
  teExam: string;
  setTeExam: (v: string) => void;
  teSubject: string;
  setTeSubject: (v: string) => void;
  teExams: ClassExam[];
  onAddExam: (name: string) => void;
  onRemoveExam: (id: string) => void;
  marks: Record<string, string>;
  setMarks: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  attAbs: Record<string, Record<string, boolean>>;
  setAttAbs: React.Dispatch<React.SetStateAction<Record<string, Record<string, boolean>>>>;
  statusOf: (cls: string, e: string) => ExamStatus;
  setExamStatus: React.Dispatch<React.SetStateAction<Record<string, ExamStatus>>>;
  editingFinal: Record<string, boolean>;
  setEditingFinal: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  toast: string;
  setToast: (v: string) => void;
}) {
  const [examMgOpen, setExamMgOpen] = useState(false);
  const [newExam, setNewExam] = useState('');
  const absMarks = attAbs[selClass] || {};
  const status = statusOf(selClass, teExam);
  const editKey = `${selClass}.${teExam}`;
  const isEditingFinal = status === 'final' && !!editingFinal[editKey];
  const editable = status === 'draft' || status === 'provisional' || isEditingFinal;
  const teExamName = teExams.find((e) => e.id === teExam)?.name ?? '';

  const statusTag: Record<ExamStatus, string> = { draft: 'To enter', provisional: 'Provisional', final: 'Published' };

  function setMark(sid: string, raw: string) {
    let v = raw.replace(/[^0-9]/g, '').slice(0, 3);
    if (v !== '' && parseInt(v) > MAX_MARKS) v = String(MAX_MARKS);
    setMarks((m) => ({ ...m, [mkKey(selClass, teExam, teSubject, sid)]: v }));
  }
  function toggleAbsent(sid: string) {
    setAttAbs((a) => {
      const c = { ...(a[selClass] || {}) };
      if (c[sid]) delete c[sid];
      else c[sid] = true;
      return { ...a, [selClass]: c };
    });
  }
  function setStatus(s: ExamStatus, t: string) {
    setExamStatus((m) => ({ ...m, [`${selClass}.${teExam}`]: s }));
    setToast(t);
  }

  // averages
  let sum = 0, entered = 0;
  roster.forEach((r) => {
    if (absMarks[r.id]) return;
    const v = parseInt(marks[mkKey(selClass, teExam, teSubject, r.id)]);
    if (!isNaN(v)) { sum += v; entered++; }
  });
  const marksAvg = entered ? `${Math.round((sum / entered / MAX_MARKS) * 100)}%` : '—';
  let pubAvg = PUB_AVG_MAP[teExam] || 85;
  if (teExam === 'ut3') {
    let a = 0, c = 0;
    curClass.subjects.forEach((code) => roster.forEach((r) => {
      if (absMarks[r.id]) return;
      const v = parseInt(marks[mkKey(selClass, 'ut3', code, r.id)]);
      if (!isNaN(v)) { a += v; c++; }
    }));
    pubAvg = c ? Math.round((a / c / MAX_MARKS) * 100) : 86;
  }
  const subjectDone = (code: string) => roster.every((r) => (marks[mkKey(selClass, teExam, code, r.id)] || '') !== '');

  return (
    <div className="px-[15px] py-4 pb-6">
      <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2">Examination</div>
      <div className="gw-scroll flex gap-2 overflow-x-auto mb-3.5 pb-0.5">
        {teExams.map((e) => {
          const on = e.id === teExam;
          const st = statusOf(selClass, e.id);
          const tagCol = st === 'final' ? 'text-success' : st === 'provisional' ? 'text-[#c2882a]' : 'text-[#8a6d1f]';
          return (
            <button key={e.id} onClick={() => { setTeExam(e.id); setTeSubject('math'); }} className={cx('flex-none min-w-[100px] text-left px-[13px] py-2.5 rounded-[14px] border', on ? 'bg-green border-green' : 'bg-white border-line')}>
              <span className={cx('block text-[12px] font-bold', on ? 'text-white' : 'text-ink')}>{e.name}</span>
              <span className={cx('block text-[10px] font-semibold mt-[3px]', on ? 'text-gold' : tagCol)}>{statusTag[st]}</span>
            </button>
          );
        })}
      </div>

      {curClass.ct && (
        <div className="mb-3.5">
          {!examMgOpen ? (
            <button onClick={() => setExamMgOpen(true)} className="inline-flex items-center gap-1.5 text-[12px] font-bold text-green bg-mist border-[1.5px] border-[#dbe5db] rounded-[11px] px-[13px] py-2">
              <Glyph d={GLYPH.plus} size={15} stroke={2.2} />Add / remove exams
            </button>
          ) : (
            <Card className="p-3">
              <div className="flex items-center mb-2.5">
                <div className="flex-1 text-[10px] tracking-[0.13em] uppercase font-semibold text-muted">Examinations for {curClass.label}</div>
                <button onClick={() => { setExamMgOpen(false); setNewExam(''); }} className="w-[26px] h-[26px] rounded-lg border border-line bg-white text-muted text-[15px] font-bold flex-none">×</button>
              </div>
              <div className="flex gap-2 mb-2.5">
                <input value={newExam} onChange={(e) => setNewExam(e.target.value)} placeholder="e.g. Annual Exam" className="flex-1 min-w-0 border-[1.5px] border-line rounded-[11px] px-3 py-2.5 text-[13px] bg-white" />
                <button onClick={() => { onAddExam(newExam); setNewExam(''); }} disabled={!newExam.trim()} className={cx('flex-none px-4 rounded-[11px] font-bold text-[13px]', newExam.trim() ? 'bg-green text-white' : 'bg-[#dfe5df] text-[#9aa39b]')}>Add</button>
              </div>
              {teExams.map((e) => (
                <div key={e.id} className="flex items-center gap-2.5 py-2.25 px-1 border-t border-[#f0f3ef]">
                  <b className="flex-1 min-w-0 text-[13px] font-semibold">{e.name}</b>
                  <button onClick={() => onRemoveExam(e.id)} className="w-[26px] h-[26px] rounded-lg bg-[#f6ecec] text-danger text-[15px] font-bold flex-none">×</button>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {editable ? (
        <>
          {isEditingFinal && <div className="mb-3.5"><InfoNote><b>Editing finalized results.</b> Marks stay locked for parents until you re-publish. Every change is recorded in the edit history.</InfoNote></div>}
          {status === 'provisional' && <div className="mb-3.5"><InfoNote tone="amber"><b>Provisional</b> — parents can see these marks, tagged as under review. You can still edit them, then finalize once discussed.</InfoNote></div>}

          <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2">Subject</div>
          <div className="gw-scroll flex gap-1.5 overflow-x-auto mb-3.5 pb-0.5">
            {curClass.subjects.map((code) => {
              const on = teSubject === code;
              return (
                <button key={code} onClick={() => setTeSubject(code)} className={cx('flex-none flex items-center gap-1.5 px-3 py-2.5 rounded-xl border-[1.5px]', on ? 'border-green bg-mist' : 'border-line bg-white')}>
                  <span className={cx('text-[12px] font-bold', on ? 'text-green' : 'text-muted')}>{SUBJ_META[code]}</span>
                  {subjectDone(code) && <span className="text-success"><Glyph d={GLYPH.check} size={12} stroke={3} /></span>}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2.5 mb-3">
            <StatCard value={marksAvg} label="Class avg" dark />
            <StatCard value={entered} label={`of ${count} in`} />
            <StatCard value={MAX_MARKS} label="Max" />
          </div>

          <Card className="px-3.5 py-1.5 mb-3">
            {roster.map((r) => {
              const isAbs = !!absMarks[r.id];
              return (
                <div key={r.id} className="flex items-center gap-2.5 py-2 border-t border-[#f0f2ee] first:border-t-0">
                  <span className="w-5 text-[11px] text-muted font-semibold flex-none">{r.roll}</span>
                  <span className="flex-1 text-[13px] font-semibold truncate">{r.name}</span>
                  {isAbs ? (
                    <span className="text-[11px] font-bold text-danger w-[78px] text-center">ABSENT</span>
                  ) : (
                    <>
                      <input type="number" value={marks[mkKey(selClass, teExam, teSubject, r.id)] || ''} onChange={(e) => setMark(r.id, e.target.value)} placeholder="—" className="w-[50px] text-center px-1 py-2 border-[1.5px] border-line rounded-[10px] text-[13px] font-semibold bg-white box-border" />
                      <span className="text-[11px] text-[#b7bfb6] flex-none w-6">/{MAX_MARKS}</span>
                    </>
                  )}
                  <button onClick={() => toggleAbsent(r.id)} className={cx('w-7 h-7 rounded-[9px] text-[12px] font-bold flex-none', isAbs ? 'bg-danger text-white' : 'bg-[#f1f5f1] text-[#9aa39b]')}>A</button>
                </div>
              );
            })}
          </Card>

          {toast === 'saved' && <MarksToast tone="green" icon={GLYPH.check}>Changes saved · parents see the updated marks</MarksToast>}
          {toast === 'provisional' && <MarksToast tone="amber" icon={GLYPH.bell}>Provisional results sent to {curClass.label} parents</MarksToast>}

          {isEditingFinal ? (
            <>
              <div className="flex gap-[9px]">
                <OutlineButton onClick={() => { setEditingFinal((e) => { const n = { ...e }; delete n[editKey]; return n; }); setToast(''); }}>Cancel</OutlineButton>
                <PrimaryButton onClick={() => { setEditingFinal((e) => { const n = { ...e }; delete n[editKey]; return n; }); setToast('updated'); }}>Save &amp; re-publish</PrimaryButton>
              </div>
              <div className="text-center text-[11px] text-muted mt-2.5 leading-[1.4]">Re-publishing pushes the corrected report cards to parents and notes the update.</div>
            </>
          ) : status === 'draft' ? (
            <>
              <PrimaryButton onClick={() => setStatus('provisional', 'provisional')}>Publish as provisional</PrimaryButton>
              <div className="text-center text-[11px] text-muted mt-2.5 leading-[1.4]">Provisional results reach parents tagged “under review”. You finalize them after discussion.</div>
            </>
          ) : (
            <>
              <div className="flex gap-[9px]">
                <button onClick={() => setToast('saved')} className="flex-1 py-3.5 rounded-[14px] bg-white text-green font-semibold text-[13.5px] border-[1.5px] border-green">Save changes</button>
                <PrimaryButton onClick={() => setStatus('final', 'final')}>Finalize results</PrimaryButton>
              </div>
              <div className="text-center text-[11px] text-muted mt-2.5 leading-[1.4]">Finalizing locks the marks and removes the “provisional” tag for parents.</div>
            </>
          )}
        </>
      ) : (
        <>
          <Card className="p-[18px] mb-3">
            <div className="flex items-center gap-2.5 mb-3.5">
              <div className="w-10 h-10 rounded-xl bg-mist grid place-items-center flex-none text-success"><Glyph d={GLYPH.check} size={21} stroke={2.4} /></div>
              <div><b className="text-[14px] font-bold block">Results finalized</b><small className="text-[11.5px] text-muted">{teExamName} · {curClass.label} · locked</small></div>
            </div>
            <div className="flex gap-2.5">
              <div className="flex-1 bg-cloud rounded-[14px] p-3 text-center"><div className="font-serif text-[23px] leading-none text-green">{pubAvg}<span className="text-[12px]">%</span></div><small className="text-[10px] uppercase text-muted font-semibold">Class avg</small></div>
              <div className="flex-1 bg-cloud rounded-[14px] p-3 text-center"><div className="font-serif text-[23px] leading-none text-green">{count}</div><small className="text-[10px] uppercase text-muted font-semibold">Cards sent</small></div>
            </div>
            <button onClick={() => { setEditingFinal((e) => ({ ...e, [editKey]: true })); setToast(''); }} className="w-full mt-3.5 py-3 rounded-[14px] bg-white text-green font-semibold text-[13.5px] border-[1.5px] border-green flex items-center justify-center gap-2">
              <Glyph d={GLYPH.edit} size={16} stroke={2} />Edit marks
            </button>
            <div className="text-center text-[11px] text-muted mt-2.5 leading-[1.4]">Marks stay editable after finalizing. Corrections re-send updated report cards to parents.</div>
          </Card>
          {toast === 'final' && <MarksToast tone="green" icon={GLYPH.bell}>Final report cards sent to all parents in {curClass.label}.</MarksToast>}
          {toast === 'updated' && <MarksToast tone="green" icon={GLYPH.bell}>Updated {teExamName} report cards re-sent to {curClass.label} parents. The edit is logged.</MarksToast>}
        </>
      )}
    </div>
  );
}

// ---------- STUDENTS (class roster — class teacher only) ----------
const relChips = ['Mother', 'Father', 'Guardian'];
const teInputCls = 'w-full box-border border-[1.5px] border-line rounded-[11px] px-3 py-2.5 text-[13px] bg-white';

function TeacherStudents({
  curClass, roster, onAdd, onRemove, onSetField,
}: {
  curClass: typeof TEACHER_CLASSES[number];
  roster: Rostered[];
  onAdd: (s: RosterStudent) => void;
  onRemove: (idx: number) => void;
  onSetField: (idx: number, field: 'name' | 'gname' | 'gphone' | 'grel', val: string) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [gName, setGName] = useState('');
  const [gPhone, setGPhone] = useState('');
  const [gRel, setGRel] = useState('Mother');
  const [editIdx, setEditIdx] = useState<number | null>(null);

  const ready = name.trim().length > 0 && gPhone.replace(/\D/g, '').length === 10;

  function submit() {
    if (!ready) return;
    onAdd({ name: name.trim(), guardian: { name: gName.trim() || 'Guardian', phone: gPhone.replace(/\D/g, ''), relation: gRel } });
    setName(''); setGName(''); setGPhone(''); setGRel('Mother'); setAddOpen(false);
  }

  if (!curClass.ct) {
    return (
      <div className="px-[15px] py-4 pb-6">
        <InfoNote tone="amber" icon="M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z">
          Only the <b>class teacher</b> can add or remove students. You teach {curClass.roleLabel} in {curClass.label} — switch to a class you lead to manage its roster.
        </InfoNote>
      </div>
    );
  }

  return (
    <div className="px-[15px] py-4 pb-6">
      {addOpen ? (
        <Card className="p-3.5 mb-3.5">
          <div className="flex items-center mb-2.5">
            <div className="flex-1 text-[10px] tracking-[0.13em] uppercase font-semibold text-muted">Add a student to {curClass.label}</div>
            <button onClick={() => setAddOpen(false)} className="w-[26px] h-[26px] rounded-lg border border-line bg-white text-muted text-[15px] font-bold flex-none">×</button>
          </div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Student's full name" className={cx(teInputCls, 'mb-2.25')} />
          <input value={gName} onChange={(e) => setGName(e.target.value)} placeholder="Guardian's name" className={cx(teInputCls, 'mb-2.25')} />
          <div className="flex items-center bg-white border-[1.5px] border-line rounded-[11px] overflow-hidden mb-2.25">
            <span className="px-[11px] text-[13px] font-semibold border-r border-line h-[42px] flex items-center">+91</span>
            <input value={gPhone} onChange={(e) => setGPhone(e.target.value)} inputMode="numeric" placeholder="Guardian mobile (for login)" className="flex-1 min-w-0 border-none px-3 h-[42px] text-[13px] bg-transparent" />
          </div>
          <div className="flex gap-1.5 mb-3">
            {relChips.map((r) => <Chip key={r} active={gRel === r} onClick={() => setGRel(r)} className="flex-1 text-center py-2">{r}</Chip>)}
          </div>
          <button onClick={submit} disabled={!ready} className={cx('w-full py-3 rounded-xl font-bold text-[13.5px]', ready ? 'bg-green text-white' : 'bg-[#dfe5df] text-[#9aa39b]')}>Add student</button>
          <div className="flex gap-2 items-start mt-2.75">
            <span className="flex-none mt-px text-muted"><Glyph d={GLYPH.info} size={14} stroke={1.9} /></span>
            <div className="text-[11px] text-muted leading-[1.5]">The guardian's mobile is their login — they sign in with it and a one-time code. No separate sign-up.</div>
          </div>
        </Card>
      ) : (
        <button onClick={() => setAddOpen(true)} className="w-full mb-3.5 py-3.5 rounded-[14px] bg-green text-white font-bold text-[14px] flex items-center justify-center gap-2">
          <Glyph d={GLYPH.plus} size={18} stroke={2.2} />Add student
        </button>
      )}
      <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">{roster.length} students</div>
      {roster.map((r, i) => {
        const g = r.guardian;
        const editing = editIdx === i;
        return (
          <Card key={r.id} className="p-3 mb-2 rounded-[14px]">
            {editing ? (
              <div>
                <div className="text-[9.5px] tracking-[0.1em] uppercase font-semibold text-[#9aa39b] mb-1.5">Editing #{('0' + (i + 1)).slice(-2)}</div>
                <input value={r.name} onChange={(e) => onSetField(i, 'name', e.target.value)} placeholder="Student's full name" className={cx(teInputCls, 'mb-2')} />
                <input value={g?.name || ''} onChange={(e) => onSetField(i, 'gname', e.target.value)} placeholder="Guardian's name" className={cx(teInputCls, 'mb-2')} />
                <div className="flex items-center bg-white border-[1.5px] border-line rounded-[10px] overflow-hidden mb-2">
                  <span className="px-2.5 text-[12.5px] font-semibold border-r border-line h-10 flex items-center">+91</span>
                  <input value={g?.phone || ''} onChange={(e) => onSetField(i, 'gphone', e.target.value)} inputMode="numeric" placeholder="Guardian mobile (login)" className="flex-1 min-w-0 border-none px-2.5 h-10 text-[13px] bg-transparent" />
                </div>
                <div className="flex gap-1.5 mb-2.5">
                  {relChips.map((rel) => <Chip key={rel} active={(g?.relation || 'Mother') === rel} onClick={() => onSetField(i, 'grel', rel)} className="flex-1 text-center py-1.5">{rel}</Chip>)}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditIdx(null)} className="flex-1 py-2.75 rounded-[11px] bg-green text-white font-bold text-[13px]">Done</button>
                  <button onClick={() => { onRemove(i); setEditIdx(null); }} className="px-4 rounded-[11px] bg-[#f6ecec] text-danger font-bold text-[13px]">Remove</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-[11px] items-center">
                <span className="w-[26px] h-[26px] rounded-lg bg-[#f1f5f1] text-muted text-[11px] font-bold grid place-items-center flex-none">{('0' + (i + 1)).slice(-2)}</span>
                <div className="flex-1 min-w-0">
                  <b className="text-[13.5px] font-semibold block">{r.name}</b>
                  {g ? <small className="text-[10.5px] text-muted">{g.relation} · {g.name} · {maskPhone(g.phone)}</small>
                    : <small className="text-[10.5px] text-[#a9761b] font-semibold">No guardian phone — can't log in yet</small>}
                </div>
                <button onClick={() => setEditIdx(i)} className="w-7 h-7 rounded-[9px] border border-[#dbe5db] bg-white text-green grid place-items-center flex-none" aria-label="Edit"><Glyph d={GLYPH.edit} size={14} stroke={2} /></button>
                <button onClick={() => onRemove(i)} className="w-7 h-7 rounded-[9px] bg-[#f6ecec] text-danger text-[16px] font-bold flex-none">×</button>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function MarksToast({ tone, icon, children }: { tone: 'green' | 'amber'; icon: string; children: React.ReactNode }) {
  const cls = tone === 'amber' ? 'bg-[#fbf3e2] border-[#ecd8ab] text-[#8a6d1f]' : 'bg-[#eef5f0] border-[#cfe3d6] text-green';
  return (
    <div className={cx('rounded-[14px] border px-3.5 py-3 mb-3 text-[12px] font-semibold flex items-center gap-2', cls)}>
      <Glyph d={icon} size={15} stroke={2.4} />{children}
    </div>
  );
}
