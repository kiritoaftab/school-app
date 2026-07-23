import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  Card, Chip, Glyph, PrimaryButton, SectionLabel, StatCard, SuccessScreen, cx,
  type TabDef, AppHeader, BottomSheet, Shell,
} from './kit';
import {
  CalendarScreen, NoticeBoardScreen, NoticeDetailScreen, NotificationsScreen, PhotosScreen,
} from './SharedScreens';
import { AccountSheet } from './AccountSheet';
import { GLYPH, SCHOOL, gradeFor, ordinal, type CalEvent, type Notice } from './data';
import {
  listMyStudents, listStudentDiary, getStudentAttendance, listStudentTerms, getStudentResults,
  listEvents, listNotices, ackNotice, submitLeave,
  type ParentStudent, type ParentDiaryEntry, type AttendanceStatus, type StudentResults,
  type ParentNotice, type LeaveType,
} from '../api/parent';
import {
  MONTHS, MONTH_ABBR, DAY_SHORT, DAY_FULL, ymd, ym, addDays, startOfWeek,
} from '../lib/date';
import { getDone, setDone } from '../lib/diaryDone';

type Screen =
  | 'home' | 'attendance' | 'leave' | 'diary' | 'calendar' | 'results' | 'photos'
  | 'noticeBoard' | 'notice' | 'notifs';

const TOP_LEVEL: Screen[] = ['home', 'diary', 'calendar', 'results', 'photos'];

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

// Category → board icon; falls back to the generic bell/notice glyph.
const NOTICE_ICON: Record<string, string> = {
  Principal: GLYPH.notices,
  Admin: 'M4 8h16M7 3v3M17 3v3M5 6h14v14H5z',
  Accounts: 'M3 7h18v10H3zM3 11h18',
  Sports: 'M6 4h12v3a6 6 0 01-12 0zM10 13h4v3h-4z',
  Library: GLYPH.diary,
};

/** "24 Jun" from an ISO timestamp. */
function shortDate(iso: string): string {
  const d = new Date(iso);
  const a = MONTH_ABBR[d.getMonth()] ?? '';
  return `${d.getDate()} ${a ? a[0] + a.slice(1).toLowerCase() : ''}`;
}

/** Adapt a live notice to the shared `Notice` shape the board/detail screens expect. */
function toNotice(n: ParentNotice, schoolName: string): Notice {
  // The detail screen adds +1 to the leading count when this parent has acked,
  // so pass a base that excludes them.
  const base = Math.max(0, n.ackCount - (n.acked ? 1 : 0));
  return {
    id: String(n.id),
    category: n.category,
    from: `${n.category} · ${schoolName}`,
    pinned: n.pinned,
    date: shortDate(n.createdAt),
    icon: NOTICE_ICON[n.category] ?? GLYPH.notices,
    title: n.title,
    preview: n.preview,
    body: n.body,
    ackStat: `${base} of ${n.totalParents} parents have acknowledged`,
  };
}

export function ParentApp() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [screen, setScreen] = useState<Screen>('home');
  const [acctOpen, setAcctOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // ---- children (switcher) ----
  const [students, setStudents] = useState<ParentStudent[]>([]);
  const [studentsErr, setStudentsErr] = useState('');
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [selStudentId, setSelStudentId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    listMyStudents()
      .then((list) => {
        if (!alive) return;
        setStudents(list);
        setSelStudentId((cur) => (cur != null && list.some((s) => s.id === cur) ? cur : list[0]?.id ?? null));
      })
      .catch(() => alive && setStudentsErr('Could not load your children.'))
      .finally(() => alive && setLoadingStudents(false));
    return () => { alive = false; };
  }, []);

  const selStudent = students.find((s) => s.id === selStudentId) ?? null;

  // ---- diary (shared by Home "today" + Diary screen) ----
  const [diary, setDiary] = useState<ParentDiaryEntry[]>([]);
  const [diaryLoading, setDiaryLoading] = useState(false);
  const [doneSet, setDoneSet] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (selStudentId == null) { setDiary([]); setDoneSet(new Set()); return; }
    let alive = true;
    setDiaryLoading(true);
    setDoneSet(getDone(selStudentId));
    listStudentDiary(selStudentId)
      .then((d) => alive && setDiary(d))
      .catch(() => alive && setDiary([]))
      .finally(() => alive && setDiaryLoading(false));
    return () => { alive = false; };
  }, [selStudentId]);

  const toggleDone = useCallback((entryId: number) => {
    if (selStudentId == null) return;
    setDoneSet((cur) => setDone(selStudentId, entryId, !cur.has(entryId)));
  }, [selStudentId]);

  // ---- calendar events ----
  const [calEvents, setCalEvents] = useState<CalEvent[]>([]);
  useEffect(() => {
    let alive = true;
    listEvents()
      .then((evs) => alive && setCalEvents(evs.map(toCalEvent)))
      .catch(() => alive && setCalEvents([]));
    return () => { alive = false; };
  }, []);

  // ---- notices (live) ----
  const schoolName = user?.school?.name ?? SCHOOL;
  const [notices, setNotices] = useState<Notice[]>([]);
  const [acked, setAcked] = useState<Record<string, boolean>>({});
  const [activeNoticeId, setActiveNoticeId] = useState('');

  useEffect(() => {
    let alive = true;
    listNotices()
      .then((list) => {
        if (!alive) return;
        setNotices(list.map((n) => toNotice(n, schoolName)));
        setAcked(Object.fromEntries(list.map((n) => [String(n.id), n.acked])));
      })
      .catch(() => { if (alive) { setNotices([]); setAcked({}); } });
    return () => { alive = false; };
  }, [schoolName]);

  function acknowledge(id: string) {
    setAcked((a) => ({ ...a, [id]: true }));
    ackNotice(Number(id)).catch(() => {/* optimistic; leave the tick on */});
  }

  const activeNotice = notices.find((n) => n.id === activeNoticeId) ?? null;

  // ---- leave ----
  const [leaveSent, setLeaveSent] = useState(false);

  function go(s: Screen) {
    setScreen(s);
    setPickerOpen(false);
  }

  const childName = selStudent?.name ?? 'your child';
  const childKlass = selStudent?.klass ?? '';

  // header
  let title = user?.school?.name ?? 'Greenwood';
  let sub: string | undefined = (user?.school?.name ?? SCHOOL).toUpperCase();
  if (screen === 'diary') { title = 'Diary'; sub = childName.toUpperCase(); }
  else if (screen === 'calendar') { title = 'Calendar'; sub = (user?.school?.name ?? SCHOOL).toUpperCase(); }
  else if (screen === 'results') { title = 'Report Card'; sub = `${childName}${childKlass ? ` · ${childKlass}` : ''}`.toUpperCase(); }
  else if (screen === 'photos') { title = 'Moments'; sub = 'SHARED BY THE SCHOOL'; }
  else if (screen === 'attendance') { title = 'Attendance'; sub = `${childName}${childKlass ? ` · ${childKlass}` : ''}`.toUpperCase(); }
  else if (screen === 'leave') { title = 'Apply for Leave'; sub = `${childName}${childKlass ? ` · ${childKlass}` : ''}`.toUpperCase(); }
  else if (screen === 'noticeBoard') { title = 'Notice Board'; sub = schoolName.toUpperCase(); }
  else if (screen === 'notice') { title = 'Notice'; sub = (activeNotice?.from ?? schoolName).toUpperCase(); }
  else if (screen === 'notifs') { title = 'Notifications'; sub = schoolName.toUpperCase(); }

  const topLevel = TOP_LEVEL.includes(screen);
  const onBack = topLevel ? undefined : () => go(screen === 'notice' ? 'noticeBoard' : 'home');
  const activeKey = TOP_LEVEL.includes(screen) ? screen : 'home';

  const tabs: TabDef[] = [
    { key: 'home', label: 'Home', glyph: GLYPH.home },
    { key: 'diary', label: 'Diary', glyph: GLYPH.diary },
    { key: 'calendar', label: 'Calendar', glyph: GLYPH.calendar },
    { key: 'results', label: 'Results', glyph: GLYPH.results },
    { key: 'photos', label: 'Photos', glyph: GLYPH.photos },
  ].map((t) => ({
    ...t,
    active: activeKey === t.key,
    onClick: () => go(t.key as Screen),
  }));

  return (
    <Shell
      header={
        <AppHeader
          title={title}
          sub={sub}
          onBack={onBack}
          onAccount={() => setAcctOpen(true)}
          onBell={() => go('notifs')}
          brand={user?.school?.name}
          logo={user?.school?.logo}
        />
      }
      tabs={tabs}
      overlays={
        <>
          <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)}>
            <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">Your children</div>
            {students.length === 0 && (
              <div className="py-4 text-center text-muted text-[12.5px]">
                {loadingStudents ? 'Loading…' : studentsErr || 'No children linked to your account yet.'}
              </div>
            )}
            {students.map((s) => {
              const on = s.id === selStudentId;
              return (
                <div key={s.id} onClick={() => { setSelStudentId(s.id); setPickerOpen(false); }}
                  className={cx('flex items-center gap-2.5 px-3.5 py-[13px] rounded-[15px] cursor-pointer mb-2 border-[1.5px]', on ? 'border-green bg-[#f3f8f4]' : 'border-line bg-white')}>
                  <div className="w-[38px] h-[38px] rounded-[13px] grid place-items-center text-green font-bold text-[15px] flex-none" style={{ background: 'linear-gradient(140deg,#d7e4da,#a7c4b4)' }}>{s.name[0]?.toUpperCase()}</div>
                  <div className="flex-1">
                    <b className={cx('text-[14px] font-bold block', on ? 'text-green' : 'text-ink')}>{s.name}</b>
                    <small className="text-[11px] text-muted">{s.relation}{s.klass ? ` · ${s.klass}` : ''}</small>
                  </div>
                  {on && <span className="text-green"><Glyph d={GLYPH.check} size={18} stroke={2.4} /></span>}
                </div>
              );
            })}
          </BottomSheet>
          <AccountSheet
            open={acctOpen}
            onClose={() => setAcctOpen(false)}
            name={user?.name ?? 'Anita Sharma'}
            phone={user?.phone ?? '9876543210'}
            roleLabel="Parent"
            onSignOut={() => {
              logout();
              navigate('/login');
            }}
          />
        </>
      }
    >
      {screen === 'home' && (
        <HomeParent
          student={selStudent} childCount={students.length}
          diary={diary} doneSet={doneSet} toggleDone={toggleDone}
          notices={notices} acked={acked} go={go}
          openSwitcher={() => setPickerOpen(true)}
          openNotice={(id) => { setActiveNoticeId(id); go('notice'); }}
        />
      )}
      {screen === 'attendance' && <AttendanceParent studentId={selStudentId} go={go} />}
      {screen === 'leave' && (leaveSent ? (
        <SuccessScreen title="Request sent" body="The class teacher will see this right away. You'll get a notification once it's approved." buttonLabel="Back to home" onButton={() => { setLeaveSent(false); go('home'); }} />
      ) : (
        <LeaveParent student={selStudent} onSuccess={() => setLeaveSent(true)} />
      ))}
      {screen === 'diary' && (
        <DiaryParent
          childName={childName} klassLabel={childKlass}
          diary={diary} loading={diaryLoading}
          doneSet={doneSet} toggleDone={toggleDone}
        />
      )}
      {screen === 'calendar' && <CalendarScreen events={calEvents} />}
      {screen === 'results' && <ResultsParent studentId={selStudentId} />}
      {screen === 'photos' && <PhotosScreen />}
      {screen === 'noticeBoard' && <NoticeBoardScreen role="parent" notices={notices} acked={acked} onOpen={(id) => { setActiveNoticeId(id); go('notice'); }} />}
      {screen === 'notice' && activeNotice && (
        <NoticeDetailScreen
          notice={activeNotice}
          acked={!!acked[activeNoticeId]}
          showAck
          onAcknowledge={() => acknowledge(activeNoticeId)}
        />
      )}
      {screen === 'notifs' && <NotificationsScreen />}
    </Shell>
  );
}

// ---------- shared homework row ----------
function HomeworkRow({ entry, done, onToggle }: { entry: ParentDiaryEntry; done: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-[11px] py-2.5 border-t border-line first:border-t-0">
      <div onClick={onToggle} className={cx('w-[21px] h-[21px] rounded-[7px] flex-none grid place-items-center cursor-pointer border-[1.8px]', done ? 'bg-green border-green text-white' : 'bg-white border-line')}>
        {done && <Glyph d={GLYPH.check} size={12} stroke={3} />}
      </div>
      <div className="flex-1">
        <b className={cx('text-[13px] font-semibold', done && 'line-through text-muted')}>{entry.subject}</b>
        <small className="block text-muted text-[11px] mt-px">{entry.task}</small>
      </div>
    </div>
  );
}

// ---------- DIARY (view only, week calendar) ----------
function DiaryParent({
  childName, klassLabel, diary, loading, doneSet, toggleDone,
}: {
  childName: string;
  klassLabel: string;
  diary: ParentDiaryEntry[];
  loading: boolean;
  doneSet: Set<number>;
  toggleDone: (entryId: number) => void;
}) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const todayKey = ymd(today);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selDate, setSelDate] = useState(todayKey);

  // Mon–Sat; schools here don't run a Sunday diary.
  const week = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const countFor = (key: string) => diary.filter((e) => e.date === key).length;
  const onCurrentWeek = ymd(startOfWeek(today)) === ymd(week[0]);

  const dayEntries = diary.filter((e) => e.date === selDate);
  const tasks = dayEntries.filter((e) => e.subject != null);
  const notes = dayEntries.filter((e) => e.subject == null);
  const selDay = useMemo(() => new Date(`${selDate}T00:00:00`), [selDate]);

  function shiftWeek(delta: number) {
    const next = addDays(weekStart, delta * 7);
    setWeekStart(next);
    setSelDate(ymd(next));
  }
  function goToday() {
    setWeekStart(startOfWeek(today));
    setSelDate(todayKey);
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
      </div>

      {loading && dayEntries.length === 0 ? (
        <div className="py-8 text-center text-muted text-[12.5px]">Loading diary…</div>
      ) : dayEntries.length === 0 ? (
        <div className="text-center py-10 px-5 text-muted">
          <div className="w-[54px] h-[54px] rounded-full bg-[#f1f5f1] grid place-items-center mx-auto mb-3.5 text-[#9fb3a5]">
            <Glyph d={GLYPH.diary} size={24} />
          </div>
          <div className="text-[13.5px] font-semibold text-ink mb-1">No homework posted</div>
          <p className="text-[12px] leading-[1.5] max-w-[210px] mx-auto">Teachers haven't added diary entries for {childName}{klassLabel ? ` (${klassLabel})` : ''} on this day yet.</p>
        </div>
      ) : (
        <>
          {tasks.length > 0 && (
            <Card className="p-[15px] mb-3">
              {tasks.map((e) => (
                <HomeworkRow key={e.id} entry={e} done={doneSet.has(e.id)} onToggle={() => toggleDone(e.id)} />
              ))}
            </Card>
          )}
          {notes.map((e) => (
            <Card key={e.id} className="p-[15px] mb-3 flex gap-[9px] items-start">
              <span className="text-[10px] font-bold text-green bg-mist px-2 py-[3px] rounded-[7px] mt-px flex-none">NOTE</span>
              <p className="text-[12.5px] text-muted leading-[1.5]">{e.task}</p>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

// ---------- HOME ----------
function HomeParent({
  student, childCount, diary, doneSet, toggleDone, notices, acked, go, openSwitcher, openNotice,
}: {
  student: ParentStudent | null;
  childCount: number;
  diary: ParentDiaryEntry[];
  doneSet: Set<number>;
  toggleDone: (entryId: number) => void;
  notices: Notice[];
  acked: Record<string, boolean>;
  go: (s: Screen) => void;
  openSwitcher: () => void;
  openNotice: (id: string) => void;
}) {
  const todayKey = ymd(new Date());
  const todayTasks = diary.filter((e) => e.date === todayKey && e.subject != null);
  const doneCount = todayTasks.filter((t) => doneSet.has(t.id)).length;
  const unread = notices.filter((n) => !acked[n.id]);
  const homeNotices = unread.slice(0, 4);
  const upNext = { m: 'JUN', d: '28', title: 'Parent–Teacher Meeting', sub: '9:00 AM – 1:00 PM · Main block' };
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = student?.name ?? 'Your child';

  return (
    <div className="px-[15px] pt-4 pb-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div onClick={childCount > 1 ? openSwitcher : undefined} className={cx('flex items-center gap-2.5', childCount > 1 && 'cursor-pointer')}>
          <div className="w-[38px] h-[38px] rounded-[13px] grid place-items-center text-green font-bold text-[15px] flex-none" style={{ background: 'linear-gradient(140deg,#d7e4da,#a7c4b4)' }}>{name[0]?.toUpperCase()}</div>
          <div className="font-semibold text-[14px] leading-[1.1]">
            {name}
            <small className="block text-muted font-medium text-[11px] mt-0.5">{student?.klass ?? '—'}</small>
          </div>
          {childCount > 1 && <span className="text-[#9aa39b] flex-none"><Glyph d={GLYPH.chevronDown} size={16} stroke={2.2} /></span>}
        </div>
        <div className="ml-auto font-serif text-[16px] text-green">{greeting}</div>
      </div>

      <div onClick={() => go('attendance')} className="bg-green text-white rounded-[20px] p-[15px] mb-2.5 flex items-center gap-[13px] cursor-pointer">
        <div className="w-11 h-11 rounded-[14px] bg-white/15 grid place-items-center flex-none">
          <Glyph d={GLYPH.check} size={22} stroke={2.2} />
        </div>
        <div className="flex-1">
          <b className="font-serif text-[20px] font-normal block leading-[1.1]">Attendance</b>
          <small className="text-[#cfe0d6] text-[11.5px]">View this month's register</small>
        </div>
        <span className="text-[#9fc0ad]"><Glyph d={GLYPH.chevronRight} size={18} stroke={2} /></span>
      </div>

      <button onClick={() => go('leave')} className="w-full mb-3 py-[11px] rounded-[13px] bg-white border border-line text-green font-semibold text-[12.5px] flex items-center justify-center gap-[7px]">
        <Glyph d={GLYPH.plus} size={16} stroke={1.8} />Apply for leave
      </button>

      <Card className="p-[15px] mb-3">
        <SectionLabel right={<span onClick={() => go('noticeBoard')} className="text-green cursor-pointer">View all ({notices.length}) →</span>}>
          Notices · {unread.length > 0 ? `${unread.length} new` : 'all read'}
        </SectionLabel>
        {unread.length > 0 ? (
          homeNotices.map((n) => (
            <div key={n.id} onClick={() => openNotice(n.id)} className="flex items-center gap-2.5 py-2.5 border-t border-line cursor-pointer">
              <span className="w-[30px] h-[30px] rounded-[9px] bg-gold-soft grid place-items-center flex-none text-[#8a6d1f]">
                <Glyph d={n.icon} size={15} stroke={1.8} />
              </span>
              <div className="flex-1 min-w-0">
                <b className="text-[12.5px] font-semibold block leading-[1.25] truncate">{n.title}</b>
                <small className="text-[10.5px] text-muted">{n.category} · {n.date}</small>
              </div>
              <span className="w-2 h-2 rounded-full bg-gold flex-none" />
            </div>
          ))
        ) : (
          <div className="flex items-center gap-2.5 pt-[11px] pb-1 border-t border-line text-success text-[12.5px] font-semibold">
            <Glyph d={GLYPH.check} size={16} stroke={2.4} />You're all caught up on notices
          </div>
        )}
      </Card>

      <Card className="p-[15px] mb-3">
        <SectionLabel right={<span onClick={() => go('diary')} className="text-green cursor-pointer">Open diary →</span>}>
          Today's Homework · {doneCount} of {todayTasks.length} done
        </SectionLabel>
        {todayTasks.length > 0 ? (
          todayTasks.map((t) => (
            <HomeworkRow key={t.id} entry={t} done={doneSet.has(t.id)} onToggle={() => toggleDone(t.id)} />
          ))
        ) : (
          <div className="flex items-center gap-2.5 pt-[11px] pb-1 border-t border-line text-muted text-[12.5px]">
            No homework posted for today yet.
          </div>
        )}
      </Card>

      <Card onClick={() => go('calendar')} className="p-[15px] mb-3">
        <SectionLabel right={<span className="text-green">Calendar →</span>}>Up Next</SectionLabel>
        <div className="flex gap-3 items-center">
          <div className="w-[50px] flex-none rounded-[14px] bg-[#f1f5f1] text-center py-2">
            <span className="text-[10px] font-bold text-gold tracking-[0.06em] block">{upNext.m}</span>
            <span className="font-serif text-[22px] leading-none">{upNext.d}</span>
          </div>
          <div className="flex-1">
            <b className="text-[14px] font-semibold block">{upNext.title}</b>
            <small className="text-[11.5px] text-muted">{upNext.sub}</small>
          </div>
        </div>
      </Card>

      <Card onClick={() => go('photos')} className="p-[15px] pb-[13px] mb-3">
        <SectionLabel>New · School Moments</SectionLabel>
        <div className="rounded-[14px] aspect-[2.1] relative overflow-hidden" style={{ background: 'linear-gradient(150deg,#3d6b4e,#7fae8c)' }}>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,transparent 55%,rgba(0,0,0,.3))' }} />
          <div className="absolute left-[11px] bottom-[9px] text-white text-[11px] font-semibold z-[2]">Annual Sports Day · 142 photos</div>
        </div>
      </Card>
    </div>
  );
}

// ---------- ATTENDANCE ----------
const attColor: Record<AttendanceStatus, string> = {
  PRESENT: '#1f8a5b',
  ABSENT: '#c0392b',
  LATE: '#c2a04e',
  HOLIDAY: '#e6e9e3',
};

function AttendanceParent({ studentId, go }: { studentId: number | null; go: (s: Screen) => void }) {
  const [monthDate, setMonthDate] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [statusByDay, setStatusByDay] = useState<Record<number, AttendanceStatus>>({});
  const [stats, setStats] = useState({ present: 0, absent: 0, percent: 0 });
  const [loading, setLoading] = useState(false);

  const monthKey = ym(monthDate);
  useEffect(() => {
    if (studentId == null) { setStatusByDay({}); setStats({ present: 0, absent: 0, percent: 0 }); return; }
    let alive = true;
    setLoading(true);
    getStudentAttendance(studentId, monthKey)
      .then((a) => {
        if (!alive) return;
        const map: Record<number, AttendanceStatus> = {};
        a.days.forEach((d) => { map[new Date(`${d.date}T00:00:00`).getDate()] = d.status; });
        setStatusByDay(map);
        setStats({ present: a.present, absent: a.absent, percent: a.percent });
      })
      .catch(() => { if (alive) { setStatusByDay({}); setStats({ present: 0, absent: 0, percent: 0 }); } })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [studentId, monthKey]);

  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-first
  const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function shiftMonth(delta: number) {
    setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }

  return (
    <div className="px-[15px] py-4 pb-6">
      <div className="flex gap-2.5 mb-3.5">
        <StatCard value={`${stats.percent}%`} label="This month" />
        <StatCard value={stats.present} label="Present" valueColor="text-success" />
        <StatCard value={stats.absent} label="Absent" valueColor="text-danger" />
      </div>
      <Card className="p-[15px] mb-3">
        <div className="flex items-center gap-2 mb-2.5">
          <SectionLabel>{MONTHS[month]} {year}</SectionLabel>
          <div className="ml-auto flex gap-1.5">
            <button onClick={() => shiftMonth(-1)} aria-label="Previous month" className="w-7 h-7 rounded-[9px] border border-line bg-white text-muted grid place-items-center">
              <Glyph d="M15 18l-6-6 6-6" size={15} stroke={2.2} />
            </button>
            <button onClick={() => shiftMonth(1)} aria-label="Next month" className="w-7 h-7 rounded-[9px] border border-line bg-white text-muted grid place-items-center">
              <Glyph d="M9 18l6-6-6-6" size={15} stroke={2.2} />
            </button>
          </div>
        </div>
        {loading ? (
          <div className="py-6 text-center text-muted text-[12.5px]">Loading…</div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {weekdays.map((w, i) => (
              <div key={i} className="text-[9px] text-muted font-bold">{w}</div>
            ))}
            {cells.map((d, i) => {
              if (d == null) return <div key={`b${i}`} />;
              const st = statusByDay[d];
              const txt = st === 'HOLIDAY' ? '#6c766f' : '#15211b';
              return (
                <div key={d} className="aspect-square grid place-items-center text-[11px] font-semibold rounded-[9px] relative" style={{ color: txt }}>
                  {d}
                  {st && <span className="absolute bottom-[3px] w-[5px] h-[5px] rounded-full" style={{ background: attColor[st] }} />}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex gap-3.5 mt-3.5 text-[11px] text-muted font-semibold">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-success" />Present</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-danger" />Absent</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: attColor.LATE }} />Late</span>
        </div>
      </Card>
      <PrimaryButton onClick={() => go('leave')}>Apply for leave</PrimaryButton>
    </div>
  );
}

// ---------- LEAVE ----------
const LEAVE_TYPES: { label: string; value: LeaveType }[] = [
  { label: 'Sick', value: 'SICK' },
  { label: 'Casual', value: 'CASUAL' },
  { label: 'Other', value: 'OTHER' },
];

function LeaveParent({ student, onSuccess }: { student: ParentStudent | null; onSuccess: () => void }) {
  const name = student?.name ?? 'Your child';
  const todayKey = ymd(new Date());
  const [type, setType] = useState<LeaveType>('SICK');
  const [fromDate, setFromDate] = useState(todayKey);
  const [toDate, setToDate] = useState(todayKey);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const ready = student != null && reason.trim().length > 0 && fromDate !== '' && toDate !== '' && toDate >= fromDate;

  async function submit() {
    if (!ready || student == null || busy) return;
    setBusy(true);
    setErr('');
    try {
      await submitLeave({ studentId: student.id, type, fromDate, toDate, reason: reason.trim() });
      onSuccess();
    } catch {
      setErr("Couldn't send the request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-[15px] py-4 pb-6">
      <Card className="p-[15px] mb-3.5 flex items-center gap-2.5">
        <div className="w-[38px] h-[38px] rounded-[13px] grid place-items-center text-green font-bold text-[15px] flex-none" style={{ background: 'linear-gradient(140deg,#d7e4da,#a7c4b4)' }}>{name[0]?.toUpperCase()}</div>
        <div className="font-semibold text-[13px]">{name}<small className="block text-muted font-medium text-[11px] mt-0.5">{student?.klass ?? ''}</small></div>
      </Card>
      <div className="mb-3.5">
        <label className="block text-[12px] font-semibold mb-[7px]">Type of leave</label>
        <div className="flex gap-[7px]">
          {LEAVE_TYPES.map((t) => (
            <Chip key={t.value} active={type === t.value} onClick={() => setType(t.value)} className="flex-1 text-center py-2.5">{t.label}</Chip>
          ))}
        </div>
      </div>
      <div className="mb-3.5">
        <label className="block text-[12px] font-semibold mb-[7px]">Dates</label>
        <div className="flex gap-[9px]">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full px-3 py-[11px] border-[1.5px] border-line rounded-xl text-[13px] bg-white text-center" />
          <input type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} className="w-full px-3 py-[11px] border-[1.5px] border-line rounded-xl text-[13px] bg-white text-center" />
        </div>
      </div>
      <div className="mb-3.5">
        <label className="block text-[12px] font-semibold mb-[7px]">Reason for the class teacher</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Mild fever, advised rest by the doctor." className="w-full box-border px-3 py-[11px] border-[1.5px] border-line rounded-xl text-[13px] bg-white resize-none h-[74px]" />
      </div>
      {err && <div className="text-[11.5px] text-danger font-semibold mb-2">{err}</div>}
      <PrimaryButton onClick={submit} disabled={!ready || busy}>{busy ? 'Sending…' : 'Send request'}</PrimaryButton>
    </div>
  );
}

// ---------- RESULTS (report card) ----------
function ResultsParent({ studentId }: { studentId: number | null }) {
  const [terms, setTerms] = useState<{ id: number; name: string }[]>([]);
  const [selTermId, setSelTermId] = useState<number | null>(null);
  const [termsLoading, setTermsLoading] = useState(false);

  const [results, setResults] = useState<StudentResults | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  useEffect(() => {
    if (studentId == null) { setTerms([]); setSelTermId(null); return; }
    let alive = true;
    setTermsLoading(true);
    listStudentTerms(studentId)
      .then((t) => {
        if (!alive) return;
        setTerms(t);
        setSelTermId((cur) => (cur != null && t.some((x) => x.id === cur) ? cur : t[0]?.id ?? null));
      })
      .catch(() => alive && setTerms([]))
      .finally(() => alive && setTermsLoading(false));
    return () => { alive = false; };
  }, [studentId]);

  useEffect(() => {
    if (studentId == null || selTermId == null) { setResults(null); return; }
    let alive = true;
    setResultsLoading(true);
    getStudentResults(studentId, selTermId)
      .then((r) => alive && setResults(r))
      .catch(() => alive && setResults(null))
      .finally(() => alive && setResultsLoading(false));
    return () => { alive = false; };
  }, [studentId, selTermId]);

  if (termsLoading) {
    return <div className="px-[15px] py-10 text-center text-muted text-[12.5px]">Loading results…</div>;
  }
  if (terms.length === 0) {
    return (
      <div className="text-center py-12 px-5 text-muted">
        <div className="w-[54px] h-[54px] rounded-full bg-[#f1f5f1] grid place-items-center mx-auto mb-3.5 text-[#9fb3a5]">
          <Glyph d="M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18" size={24} />
        </div>
        <div className="text-[13.5px] font-semibold text-ink mb-1">No results published yet</div>
        <p className="text-[12px] leading-[1.5] max-w-[210px] mx-auto">You'll get a notification when the school publishes your child's report card.</p>
      </div>
    );
  }

  const overall = results?.overallPct ?? null;

  return (
    <div className="px-[15px] py-4 pb-6">
      <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2">Examinations</div>
      <div className="gw-scroll flex gap-2 overflow-x-auto mb-4 pb-0.5">
        {terms.map((t) => {
          const on = t.id === selTermId;
          return (
            <button key={t.id} onClick={() => setSelTermId(t.id)} className={cx('flex-none min-w-[110px] text-left px-[13px] py-2.5 rounded-[14px] border', on ? 'bg-green border-green' : 'bg-white border-line')}>
              <span className={cx('block text-[12px] font-bold', on ? 'text-white' : 'text-ink')}>{t.name}</span>
            </button>
          );
        })}
      </div>

      {resultsLoading ? (
        <div className="py-8 text-center text-muted text-[12.5px]">Loading…</div>
      ) : results && results.subjects.length > 0 ? (
        <>
          <div className="flex gap-2.5 mb-3.5">
            <StatCard value={overall != null ? <>{overall}<span className="text-[14px]">%</span></> : '—'} label="Overall" />
            <StatCard value={results.rank != null ? ordinal(results.rank) : '—'} label="Class rank" />
            <StatCard value={overall != null ? gradeFor(overall) : '—'} label="Grade" />
          </div>
          <Card className="p-[15px] mb-3">
            {results.subjects.map((s, i) => {
              const pct = Math.round((s.score / s.maxScore) * 100);
              return (
                <div key={i} className="mb-[13px] last:mb-0">
                  <div className="flex justify-between text-[13px] font-semibold mb-1.5">
                    <span>{s.subject}</span><span className="text-muted">{s.score} / {s.maxScore}</span>
                  </div>
                  <div className="h-[7px] rounded-md bg-[#f1f5f1] overflow-hidden">
                    <i className="block h-full rounded-md" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#15412f,#1d5740)' }} />
                  </div>
                </div>
              );
            })}
          </Card>
          {results.teacherComment && (
            <Card className="p-[15px] flex gap-[9px] items-start">
              <span className="text-[10px] font-bold text-green bg-mist px-2 py-[3px] rounded-[7px] mt-px flex-none">TEACHER</span>
              <p className="text-[12.5px] text-muted leading-[1.5]">{results.teacherComment}</p>
            </Card>
          )}
        </>
      ) : (
        <div className="text-center py-10 px-5 text-muted text-[12.5px]">No subject marks recorded for this exam yet.</div>
      )}
    </div>
  );
}
