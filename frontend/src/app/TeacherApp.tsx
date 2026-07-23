import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  AppHeader, BottomSheet, Card, Chip, Glyph, InfoNote, PrimaryButton,
  Shell, StatCard, cx, type TabDef,
} from './kit';
import {
  listMyClasses, listDiary, createDiaryEntry, deleteDiaryEntry,
  listClassExams, createClassExam, deleteClassExam,
  listClassResults, saveClassResults, listEvents,
  listClassStudents, addClassStudent,
  type TeacherKlass, type DiaryEntry, type TeacherExam, type TeacherSubject, type ResultRow, type TeacherStudent,
} from '../api/teacher';
import { CalendarScreen, NotificationsScreen } from './SharedScreens';
import { AccountSheet } from './AccountSheet';
import {
  SCHOOL, GLYPH, TEACHER_CLASSES, ROSTERS, CT_NAME_OF, SEEDED_ABS,
  initialsOf, maskPhone,
  type RosterStudent, type CalEvent,
} from './data';

type Screen = 'home' | 'attendance' | 'diary' | 'calendar' | 'results' | 'students' | 'notifs';
type Rostered = { id: string; name: string; roll: number; guardian?: RosterStudent['guardian'] };
const TOP_LEVEL: Screen[] = ['home', 'diary', 'calendar', 'results', 'students'];

const MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
/** Map a backend event ('YYYY-MM-DD' + title/description) to the calendar's shape. */
function toCalEvent(e: { title: string; description: string | null; date: string }): CalEvent {
  const [, month, day] = e.date.split('-');
  return {
    m: MONTH_ABBR[(parseInt(month) || 1) - 1] ?? '',
    d: day ?? '',
    title: e.title,
    sub: e.description || 'School event',
    accent: '#c2a04e',
  };
}

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
  const [calEvents, setCalEvents] = useState<CalEvent[]>([]);

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

  useEffect(() => {
    let alive = true;
    listEvents()
      .then((evs) => alive && setCalEvents(evs.map(toCalEvent)))
      .catch(() => alive && setCalEvents([]));
    return () => { alive = false; };
  }, []);

  const liveClass = classes.find((c) => c.id === selClassId) ?? null;

  const [attAbs, setAttAbs] = useState<Record<string, Record<string, boolean>>>({ '5B': {}, '5A': {}, '6A': {} });
  const [regSaved, setRegSaved] = useState(false);

  const [teExam, setTeExam] = useState('');
  const [teSubject, setTeSubject] = useState('');
  const [toast, setToast] = useState('');

  // Editable rosters (class teacher can add/edit/remove students).
  const [teRosters] = useState<Record<string, RosterStudent[]>>(seedRosters);
  // Live examination catalogue for the selected class.
  const [teExams, setTeExams] = useState<TeacherExam[]>([]);

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

  // Live exams for the selected class; keep the selected exam valid as it loads.
  const reloadExams = useCallback(async () => {
    if (liveClass == null) { setTeExams([]); return; }
    const ex = await listClassExams(liveClass.id);
    setTeExams(ex);
    setTeExam((cur) => (ex.some((e) => String(e.id) === cur) ? cur : String(ex[0]?.id ?? '')));
  }, [liveClass]);
  useEffect(() => {
    let alive = true;
    if (liveClass == null) { setTeExams([]); return; }
    listClassExams(liveClass.id)
      .then((ex) => {
        if (!alive) return;
        setTeExams(ex);
        setTeExam((cur) => (ex.some((e) => String(e.id) === cur) ? cur : String(ex[0]?.id ?? '')));
      })
      .catch(() => alive && setTeExams([]));
    return () => { alive = false; };
  }, [liveClass?.id]);

  function go(s: Screen) {
    setScreen(s);
    setPickerOpen(false);
  }

  // ---- exam catalogue mutations (any teacher of the class) ----
  async function teAddExam(examName: string, subjectId: number | null) {
    const nm = examName.trim();
    if (!nm || liveClass == null) return;
    const created = await createClassExam(liveClass.id, nm, subjectId);
    await reloadExams();
    if (created) setTeExam(String(created.id));
  }
  async function teRemoveExam(id: number) {
    await deleteClassExam(id);
    await reloadExams();
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
                <div key={c.id} onClick={() => { setSelClassId(c.id); setPickerOpen(false); setRegSaved(false); }}
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
          name={name} klass={liveClass} classCount={classes.length}
          go={go} openAcct={() => setAcctOpen(true)}
        />
      )}
      {screen === 'attendance' && (
        <TeacherAttendance curClass={curClass} selClass={selClass} roster={roster} count={count} attAbs={attAbs} setAttAbs={setAttAbs} regSaved={regSaved} setRegSaved={setRegSaved} />
      )}
      {screen === 'students' && (
        <TeacherStudents
          klassId={liveClass?.id ?? null}
          label={curClass.label}
          roleLabel={curClass.roleLabel}
          isClassTeacher={liveClass?.isClassTeacher ?? false}
        />
      )}
      {screen === 'diary' && (
        <TeacherDiary klass={liveClass} loading={loadingClasses} error={classesErr} />
      )}
      {screen === 'results' && (
        <TeacherMarks
          curClass={curClass} klassId={liveClass?.id ?? null}
          classSubjects={liveClass?.subjects ?? []}
          teExam={teExam} setTeExam={setTeExam} teSubject={teSubject} setTeSubject={setTeSubject}
          teExams={teExams} onAddExam={teAddExam} onRemoveExam={teRemoveExam}
          toast={toast} setToast={setToast}
        />
      )}
      {screen === 'calendar' && <CalendarScreen events={calEvents} />}
      {screen === 'notifs' && <NotificationsScreen />}
    </Shell>
  );
}

// ---------- HOME ----------
function TeacherHome({
  name, klass, classCount, go, openAcct,
}: {
  name: string;
  klass: TeacherKlass | null;
  classCount: number;
  go: (s: Screen) => void;
  openAcct: () => void;
}) {
  const [hwCount, setHwCount] = useState(0);
  const [exams, setExams] = useState<TeacherExam[]>([]);

  useEffect(() => {
    let alive = true;
    if (klass == null) { setHwCount(0); setExams([]); return; }
    const today = new Date().toISOString().slice(0, 10);
    listDiary(klass.id, today, today)
      .then((w) => alive && setHwCount(w.entries.filter((e) => e.date === today).length))
      .catch(() => alive && setHwCount(0));
    listClassExams(klass.id)
      .then((ex) => alive && setExams(ex))
      .catch(() => alive && setExams([]));
    return () => { alive = false; };
  }, [klass?.id]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const isCT = klass?.isClassTeacher ?? false;
  const label = klass?.label ?? '—';
  const studentCount = klass?.students ?? 0;
  const latestExam = exams[0] ?? null;

  const actions: {
    title: string; sub: string; icon: string; gold?: boolean; badge?: string; onClick: () => void;
  }[] = [
    {
      title: isCT ? "Today's attendance" : 'Class attendance',
      sub: isCT ? `Open the register · ${studentCount} students` : 'View-only register',
      icon: isCT ? GLYPH.attendanceCheck : GLYPH.staff,
      badge: isCT ? '' : 'VIEW',
      onClick: () => go('attendance'),
    },
    {
      title: 'Post homework',
      sub: `${hwCount} posted for today · ${label}`,
      icon: GLYPH.diary,
      onClick: () => go('diary'),
    },
    {
      title: latestExam ? 'Enter exam marks' : 'Create an exam',
      sub: latestExam
        ? `${latestExam.name} · ${latestExam.subject ? latestExam.subject.name : 'All subjects'}`
        : 'No exams yet — add one to start grading',
      icon: GLYPH.results, gold: true,
      badge: latestExam ? 'GRADE' : 'NEW',
      onClick: () => go('results'),
    },
  ];

  return (
    <div className="px-[15px] pt-4 pb-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div onClick={openAcct} className="flex items-center gap-2.5 cursor-pointer">
          <div className="w-[38px] h-[38px] rounded-[13px] grid place-items-center text-green font-bold text-[14px] flex-none" style={{ background: 'linear-gradient(140deg,#d7e4da,#a7c4b4)' }}>{initialsOf(name)}</div>
          <div className="font-semibold text-[14px] leading-[1.1]">{name}<small className="block text-muted font-medium text-[11px] mt-0.5">{klass?.roleLabel ? `${klass.roleLabel} · ` : ''}{classCount} {classCount === 1 ? 'class' : 'classes'}</small></div>
          <span className="text-[#9aa39b] flex-none"><Glyph d={GLYPH.chevronDown} size={16} stroke={2.2} /></span>
        </div>
        <div className="ml-auto font-serif text-[16px] text-green">{greeting}</div>
      </div>
      <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">Today · {label}</div>
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
        <div onClick={() => go('students')} className="flex-1 cursor-pointer"><StatCard value={studentCount} label="Students" /></div>
        <div onClick={() => go('diary')} className="flex-1 cursor-pointer"><StatCard value={hwCount} label="Homework" /></div>
        <div onClick={() => go('results')} className="flex-1 cursor-pointer"><StatCard value={exams.length} label="Exams" /></div>
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

  const [noteText, setNoteText] = useState('');
  const [postingNote, setPostingNote] = useState(false);

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
  // Diary can only be added to / removed from for today — past & future days are read-only.
  const isToday = selDate === todayKey;
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
  async function postNote() {
    if (!klass || !noteText.trim()) return;
    setPostingNote(true);
    try {
      // No subject → a general note for the day.
      await createDiaryEntry({ klassId: klass.id, date: selDate, task: noteText.trim() });
      setNoteText('');
      await load();
    } catch {
      setLoadErr('Could not post that note.');
    } finally {
      setPostingNote(false);
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
          <div className="py-4 text-center text-muted text-[12.5px]">Nothing posted for {klass.label} yet.</div>
        ) : (
          dayEntries.map((e) => (
            <div key={e.id} className="flex items-start gap-[11px] py-[11px] border-t border-[#f0f2ee] first:border-t-0">
              {e.subject ? (
                <span className="text-[9.5px] font-bold uppercase text-green bg-mist px-2 py-1 rounded-[7px] mt-px flex-none">{e.subject}</span>
              ) : (
                <span className="text-[9.5px] font-bold uppercase text-green bg-gold-soft px-2 py-1 rounded-[7px] mt-px flex-none">Note</span>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[12.5px] leading-[1.45]">{e.task}</div>
                {!klass.isClassTeacher || !e.createdBy ? null : (
                  <small className="text-[10.5px] text-muted">{e.createdBy}</small>
                )}
              </div>
              {e.canDelete && isToday && (
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
            disabled={!task.trim() || !subject || posting || !isToday}
            className={cx('w-full py-3 rounded-xl font-semibold text-[13px]', task.trim() && subject && !posting && isToday ? 'bg-green text-white' : 'bg-[#dfe5df] text-[#9aa39b]')}
          >
            {posting ? 'Posting…' : `Post to ${klass.label}`}
          </button>
          {!isToday && (
            <div className="text-[11px] text-muted leading-[1.5] mt-2.5">You can only add homework for today. This day is read-only.</div>
          )}
        </Card>
      )}

      {/* ---- general note for the day (any teacher of the class) ---- */}
      <Card className="p-[15px] mt-3">
        <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">General note for the day</div>
        <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="e.g. Bring your record book tomorrow…" className="w-full box-border px-3 py-[11px] border-[1.5px] border-line rounded-xl text-[13px] bg-white resize-none h-16 mb-2.5" />
        <button
          onClick={postNote}
          disabled={!noteText.trim() || postingNote || !isToday}
          className={cx('w-full py-3 rounded-xl font-semibold text-[13px]', noteText.trim() && !postingNote && isToday ? 'bg-green text-white' : 'bg-[#dfe5df] text-[#9aa39b]')}
        >
          {postingNote ? 'Posting…' : 'Post note'}
        </button>
        {!isToday && (
          <div className="text-[11px] text-muted leading-[1.5] mt-2.5">You can only add a note for today. This day is read-only.</div>
        )}
      </Card>
    </div>
  );
}

// ---------- MARKS (results teacher) ----------
function TeacherMarks({
  curClass, klassId, classSubjects, teExam, setTeExam, teSubject, setTeSubject,
  teExams, onAddExam, onRemoveExam, toast, setToast,
}: {
  curClass: typeof TEACHER_CLASSES[number];
  klassId: number | null;
  classSubjects: TeacherSubject[];
  teExam: string;
  setTeExam: (v: string) => void;
  teSubject: string;
  setTeSubject: (v: string) => void;
  teExams: TeacherExam[];
  onAddExam: (name: string, subjectId: number | null) => void;
  onRemoveExam: (id: number) => void;
  toast: string;
  setToast: (v: string) => void;
}) {
  const [examMgOpen, setExamMgOpen] = useState(false);
  const [newExam, setNewExam] = useState('');
  // null = all-subjects exam; a subject id = single-subject test.
  const [newExamSubjectId, setNewExamSubjectId] = useState<number | null>(null);

  const selectedExam = teExams.find((e) => String(e.id) === teExam) ?? null;
  const termId = selectedExam ? selectedExam.id : null;

  // A single-subject exam locks grading to its subject; an all-subjects exam
  // opens every subject the teacher may grade in this class.
  const subjectChoices: TeacherSubject[] = selectedExam?.subject ? [selectedExam.subject] : classSubjects;
  const choiceKey = subjectChoices.map((s) => s.name).join('|');
  useEffect(() => {
    if (subjectChoices.length && !subjectChoices.some((s) => s.name === teSubject)) {
      setTeSubject(subjectChoices[0].name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teExam, choiceKey]);

  // Real roster + saved marks for the selected exam + subject.
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [maxScore, setMaxScore] = useState('100');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (klassId == null || termId == null || !teSubject) { setRows([]); setDraft({}); return; }
    let alive = true;
    setLoading(true);
    listClassResults(klassId, termId, teSubject)
      .then((data) => {
        if (!alive) return;
        setRows(data.students);
        setMaxScore(String(data.maxScore));
        const d: Record<number, string> = {};
        data.students.forEach((s) => { d[s.studentId] = s.score == null ? '' : String(s.score); });
        setDraft(d);
      })
      .catch(() => { if (alive) { setRows([]); setDraft({}); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [klassId, termId, teSubject]);

  const maxNum = Math.max(1, parseInt(maxScore) || 100);
  function setMark(sid: number, raw: string) {
    let v = raw.replace(/[^0-9]/g, '').slice(0, 3);
    if (v !== '' && parseInt(v) > maxNum) v = String(maxNum);
    setDraft((d) => ({ ...d, [sid]: v }));
  }

  let sum = 0, entered = 0;
  rows.forEach((r) => {
    const v = parseInt(draft[r.studentId] ?? '');
    if (!isNaN(v)) { sum += v; entered++; }
  });
  const marksAvg = entered ? `${Math.round((sum / entered / maxNum) * 100)}%` : '—';
  const allEntered = rows.length > 0 && rows.every((r) => (draft[r.studentId] ?? '') !== '');

  async function save() {
    if (klassId == null || termId == null || !teSubject) return;
    setSaving(true);
    try {
      await saveClassResults(klassId, {
        termId,
        subject: teSubject,
        maxScore: maxNum,
        entries: rows.map((r) => {
          const raw = draft[r.studentId] ?? '';
          return { studentId: r.studentId, score: raw === '' ? null : parseInt(raw) };
        }),
      });
      setToast('saved');
      setTimeout(() => setToast(''), 2500);
    } catch {
      setToast('error');
      setTimeout(() => setToast(''), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-[15px] py-4 pb-6">
      <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2">Examination</div>
      <div className="gw-scroll flex gap-2 overflow-x-auto mb-3.5 pb-0.5">
        {teExams.length === 0 && (
          <div className="text-[12.5px] text-muted py-1">No exams yet — add one below.</div>
        )}
        {teExams.map((e) => {
          const eid = String(e.id);
          const on = eid === teExam;
          return (
            <button key={e.id} onClick={() => setTeExam(eid)} className={cx('flex-none min-w-[100px] text-left px-[13px] py-2.5 rounded-[14px] border', on ? 'bg-green border-green' : 'bg-white border-line')}>
              <span className={cx('block text-[12px] font-bold', on ? 'text-white' : 'text-ink')}>{e.name}</span>
              <span className={cx('block text-[10px] font-semibold', on ? 'text-white/80' : 'text-muted')}>{e.subject ? e.subject.name : 'All subjects'}</span>
              {e.schoolWide && <span className={cx('block text-[10px] font-semibold mt-[3px]', on ? 'text-gold' : 'text-muted')}>School-wide</span>}
            </button>
          );
        })}
      </div>

      <div className="mb-3.5">
        {!examMgOpen ? (
          <button onClick={() => setExamMgOpen(true)} className="inline-flex items-center gap-1.5 text-[12px] font-bold text-green bg-mist border-[1.5px] border-[#dbe5db] rounded-[11px] px-[13px] py-2">
            <Glyph d={GLYPH.plus} size={15} stroke={2.2} />Add / remove exams
          </button>
        ) : (
          <Card className="p-3">
            <div className="flex items-center mb-2.5">
              <div className="flex-1 text-[10px] tracking-[0.13em] uppercase font-semibold text-muted">Examinations for {curClass.label}</div>
              <button onClick={() => { setExamMgOpen(false); setNewExam(''); setNewExamSubjectId(null); }} className="w-[26px] h-[26px] rounded-lg border border-line bg-white text-muted text-[15px] font-bold flex-none">×</button>
            </div>
            <div className="flex gap-2 mb-2.5">
              <input value={newExam} onChange={(e) => setNewExam(e.target.value)} placeholder="e.g. Annual Exam" className="flex-1 min-w-0 border-[1.5px] border-line rounded-[11px] px-3 py-2.5 text-[13px] bg-white" />
              <button onClick={() => { onAddExam(newExam, newExamSubjectId); setNewExam(''); setNewExamSubjectId(null); }} disabled={!newExam.trim()} className={cx('flex-none px-4 rounded-[11px] font-bold text-[13px]', newExam.trim() ? 'bg-green text-white' : 'bg-[#dfe5df] text-[#9aa39b]')}>Add</button>
            </div>
            <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-1.5">Subject</div>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              <Chip active={newExamSubjectId === null} onClick={() => setNewExamSubjectId(null)} className="py-2">All subjects</Chip>
              {classSubjects.map((s) => (
                <Chip key={s.id} active={newExamSubjectId === s.id} onClick={() => setNewExamSubjectId(s.id)} className="py-2">{s.name}</Chip>
              ))}
            </div>
            <div className="text-[11px] text-muted leading-[1.5] mb-1">
              {newExamSubjectId === null ? 'An all-subjects exam, graded per subject.' : 'A single-subject test.'}
            </div>
            {teExams.filter((e) => !e.schoolWide).map((e) => (
              <div key={e.id} className="flex items-center gap-2.5 py-2.25 px-1 border-t border-[#f0f3ef]">
                <div className="flex-1 min-w-0">
                  <b className="text-[13px] font-semibold block truncate">{e.name}</b>
                  <small className="text-[10.5px] text-muted">{e.subject ? e.subject.name : 'All subjects'}</small>
                </div>
                <button onClick={() => onRemoveExam(e.id)} className="w-[26px] h-[26px] rounded-lg bg-[#f6ecec] text-danger text-[15px] font-bold flex-none">×</button>
              </div>
            ))}
          </Card>
        )}
      </div>

      {selectedExam == null ? (
        <div className="text-center text-muted text-[12.5px] py-8">Select or add an exam to enter marks.</div>
      ) : (
        <>
          <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2">
            {selectedExam.subject ? 'Subject (single-subject test)' : 'Subject'}
          </div>
          <div className="gw-scroll flex gap-1.5 overflow-x-auto mb-3.5 pb-0.5">
            {subjectChoices.map((s) => {
              const on = teSubject === s.name;
              return (
                <button key={s.id} onClick={() => setTeSubject(s.name)} className={cx('flex-none flex items-center gap-1.5 px-3 py-2.5 rounded-xl border-[1.5px]', on ? 'border-green bg-mist' : 'border-line bg-white')}>
                  <span className={cx('text-[12px] font-bold', on ? 'text-green' : 'text-muted')}>{s.name}</span>
                  {on && allEntered && <span className="text-success"><Glyph d={GLYPH.check} size={12} stroke={3} /></span>}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2.5 mb-3">
            <StatCard value={marksAvg} label="Class avg" dark />
            <StatCard value={entered} label={`of ${rows.length} in`} />
            <div className="flex-1 bg-white border-[1.5px] border-line rounded-[16px] px-2 py-2.5 text-center">
              <input inputMode="numeric" value={maxScore} onChange={(e) => setMaxScore(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))} className="w-full text-center font-serif text-[22px] leading-none text-green bg-transparent outline-none" />
              <div className="text-[10px] uppercase text-muted font-semibold mt-1">Max</div>
            </div>
          </div>

          {rows.length === 0 ? (
            <Card className="p-6 mb-3 text-center text-muted text-[12.5px]">
              {loading ? 'Loading roster…' : 'No students enrolled in this class yet.'}
            </Card>
          ) : (
            <Card className="px-3.5 py-1.5 mb-3">
              {rows.map((r, i) => (
                <div key={r.studentId} className="flex items-center gap-2.5 py-2 border-t border-[#f0f2ee] first:border-t-0">
                  <span className="w-5 text-[11px] text-muted font-semibold flex-none">{i + 1}</span>
                  <span className="flex-1 text-[13px] font-semibold truncate">{r.name}</span>
                  <input type="number" value={draft[r.studentId] ?? ''} onChange={(e) => setMark(r.studentId, e.target.value)} placeholder="—" className="w-[50px] text-center px-1 py-2 border-[1.5px] border-line rounded-[10px] text-[13px] font-semibold bg-white box-border" />
                  <span className="text-[11px] text-[#b7bfb6] flex-none w-6">/{maxNum}</span>
                </div>
              ))}
            </Card>
          )}

          {toast === 'saved' && <MarksToast tone="green" icon={GLYPH.check}>Marks saved · parents see the updated results</MarksToast>}
          {toast === 'error' && <MarksToast tone="amber" icon={GLYPH.bell}>Couldn’t save marks — please try again</MarksToast>}

          <PrimaryButton onClick={save} disabled={saving || rows.length === 0}>
            {saving ? 'Saving…' : 'Save marks'}
          </PrimaryButton>
          <div className="text-center text-[11px] text-muted mt-2.5 leading-[1.4]">Saved marks are visible to parents in each student's report card. Leave a box blank to clear that mark.</div>
        </>
      )}
    </div>
  );
}

// ---------- STUDENTS (class roster — class teacher only) ----------
const relChips = ['Mother', 'Father', 'Guardian'];
const teInputCls = 'w-full box-border border-[1.5px] border-line rounded-[11px] px-3 py-2.5 text-[13px] bg-white';

function TeacherStudents({
  klassId, label, roleLabel, isClassTeacher,
}: {
  klassId: number | null;
  label: string;
  roleLabel: string;
  isClassTeacher: boolean;
}) {
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [gName, setGName] = useState('');
  const [gPhone, setGPhone] = useState('');
  const [gRel, setGRel] = useState('Mother');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const reload = useCallback(async () => {
    if (klassId == null) { setStudents([]); return; }
    const list = await listClassStudents(klassId);
    setStudents(list);
  }, [klassId]);

  useEffect(() => {
    let alive = true;
    if (klassId == null) { setStudents([]); return; }
    setLoading(true);
    listClassStudents(klassId)
      .then((list) => alive && setStudents(list))
      .catch(() => alive && setStudents([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [klassId]);

  const ready = name.trim().length > 0 && gPhone.replace(/\D/g, '').length === 10;

  async function submit() {
    if (!ready || klassId == null || busy) return;
    setBusy(true);
    setErr('');
    try {
      await addClassStudent(klassId, {
        name: name.trim(),
        guardianName: gName.trim() || 'Guardian',
        guardianPhone: gPhone.replace(/\D/g, ''),
        relation: gRel,
      });
      await reload();
      setName(''); setGName(''); setGPhone(''); setGRel('Mother'); setAddOpen(false);
    } catch {
      setErr("Couldn't add the student. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-[15px] py-4 pb-6">
      {!isClassTeacher ? (
        <div className="mb-3.5">
          <InfoNote tone="amber" icon="M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z">
            Only the <b>class teacher</b> can add students. You teach {roleLabel} in {label} — you can view the roster here.
          </InfoNote>
        </div>
      ) : addOpen ? (
        <Card className="p-3.5 mb-3.5">
          <div className="flex items-center mb-2.5">
            <div className="flex-1 text-[10px] tracking-[0.13em] uppercase font-semibold text-muted">Add a student to {label}</div>
            <button onClick={() => { setAddOpen(false); setErr(''); }} className="w-[26px] h-[26px] rounded-lg border border-line bg-white text-muted text-[15px] font-bold flex-none">×</button>
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
          {err && <div className="text-[11.5px] text-danger font-semibold mb-2">{err}</div>}
          <button onClick={submit} disabled={!ready || busy} className={cx('w-full py-3 rounded-xl font-bold text-[13.5px]', ready && !busy ? 'bg-green text-white' : 'bg-[#dfe5df] text-[#9aa39b]')}>{busy ? 'Adding…' : 'Add student'}</button>
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

      <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">{students.length} students</div>
      {students.length === 0 ? (
        <div className="text-center text-muted text-[12.5px] py-8">{loading ? 'Loading roster…' : 'No students in this class yet.'}</div>
      ) : (
        students.map((r, i) => {
          const g = r.guardian;
          return (
            <Card key={r.id} className="p-3 mb-2 rounded-[14px]">
              <div className="flex gap-[11px] items-center">
                <span className="w-[26px] h-[26px] rounded-lg bg-[#f1f5f1] text-muted text-[11px] font-bold grid place-items-center flex-none">{('0' + (i + 1)).slice(-2)}</span>
                <div className="flex-1 min-w-0">
                  <b className="text-[13.5px] font-semibold block">{r.name}</b>
                  {g ? <small className="text-[10.5px] text-muted">{g.relation} · {g.name} · {maskPhone(g.phone)}</small>
                    : <small className="text-[10.5px] text-[#a9761b] font-semibold">No guardian phone — can't log in yet</small>}
                </div>
              </div>
            </Card>
          );
        })
      )}
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
