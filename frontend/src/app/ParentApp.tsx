import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  Card, Chip, DateStrip, Glyph, PrimaryButton, SectionLabel, StatCard, SuccessScreen, cx,
  type TabDef, AppHeader, Shell,
} from './kit';
import {
  CalendarScreen, NoticeBoardScreen, NoticeDetailScreen, NotificationsScreen, PhotosScreen,
} from './SharedScreens';
import { AccountSheet } from './AccountSheet';
import {
  CHILD, SCHOOL, GLYPH, NOTICES, DIARY_BY_DATE, DATE_ORDER, WD, WD_FULL, TODAY_DATE,
  attCells, YEARS, overallOf, gradeFor, ordinal, type DiaryDay,
} from './data';

// ---------- DIARY ----------
function DiaryParent({
  diary, selDate, setSelDate, toggle,
}: {
  diary: Record<string, DiaryDay>;
  selDate: string;
  setSelDate: (d: string) => void;
  toggle: (dk: string, i: number) => void;
}) {
  const day = diary[selDate] || { note: null, tasks: [] };
  return (
    <div className="px-[15px] py-4 pb-6">
      <DateStrip
        dates={DATE_ORDER}
        selDate={selDate}
        today={TODAY_DATE}
        weekdayOf={(k) => WD[k]}
        onPick={setSelDate}
        hasDot={(k) => diary[k].tasks.length > 0}
      />
      <div className="flex items-center gap-2.5 mb-[11px]">
        <div className="font-serif text-[19px] leading-none">{WD_FULL[WD[selDate]]}, {selDate} June</div>
        {selDate === TODAY_DATE && <span className="text-[10px] font-bold text-green bg-gold-soft px-2 py-[3px] rounded-[7px]">TODAY</span>}
      </div>
      {day.tasks.length > 0 ? (
        <>
          <Card className="p-[15px] mb-3">
            {day.tasks.map((t, i) => (
              <div key={i} className="flex items-center gap-[11px] py-2.5 border-t border-line first:border-t-0">
                <div onClick={() => toggle(selDate, i)} className={cx('w-[21px] h-[21px] rounded-[7px] flex-none grid place-items-center cursor-pointer border-[1.8px]', t.done ? 'bg-green border-green text-white' : 'bg-white border-line')}>
                  {t.done && <Glyph d={GLYPH.check} size={12} stroke={3} />}
                </div>
                <div className="flex-1">
                  <b className={cx('text-[13px] font-semibold', t.done && 'line-through text-muted')}>{t.subj}</b>
                  <small className="block text-muted text-[11px] mt-px">{t.note}</small>
                </div>
              </div>
            ))}
          </Card>
          {day.note && (
            <Card className="p-[15px] flex gap-[9px] items-start">
              <span className="text-[10px] font-bold text-green bg-mist px-2 py-[3px] rounded-[7px] mt-px">NOTE</span>
              <p className="text-[12.5px] text-muted leading-[1.5]">{day.note}</p>
            </Card>
          )}
        </>
      ) : (
        <div className="text-center py-10 px-5 text-muted">
          <div className="w-[54px] h-[54px] rounded-full bg-[#f1f5f1] grid place-items-center mx-auto mb-3.5 text-[#9fb3a5]">
            <Glyph d={GLYPH.diary} size={24} />
          </div>
          <div className="text-[13.5px] font-semibold text-ink mb-1">No homework posted</div>
          <p className="text-[12px] leading-[1.5] max-w-[200px] mx-auto">Teachers haven't added diary entries for this day yet.</p>
        </div>
      )}
    </div>
  );
}

type Screen =
  | 'home' | 'attendance' | 'leave' | 'diary' | 'calendar' | 'results' | 'photos'
  | 'noticeBoard' | 'notice' | 'notifs';

const TOP_LEVEL: Screen[] = ['home', 'diary', 'calendar', 'results', 'photos'];

export function ParentApp() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [screen, setScreen] = useState<Screen>('home');
  const [acctOpen, setAcctOpen] = useState(false);

  const [diary, setDiary] = useState<Record<string, DiaryDay>>(() =>
    JSON.parse(JSON.stringify(DIARY_BY_DATE)),
  );
  const [selDate, setSelDate] = useState(TODAY_DATE);
  const [acked, setAcked] = useState<Record<string, boolean>>({});
  const [activeNoticeId, setActiveNoticeId] = useState('ptm');
  const [leaveSent, setLeaveSent] = useState(false);
  const [leaveType, setLeaveType] = useState<'Sick' | 'Casual' | 'Other'>('Sick');
  const [resYear, setResYear] = useState('g5');
  const [resExam, setResExam] = useState('ut2');

  function toggle(dk: string, i: number) {
    setDiary((d) => {
      const copy = { ...d, [dk]: { ...d[dk], tasks: d[dk].tasks.map((t, j) => (j === i ? { ...t, done: !t.done } : t)) } };
      return copy;
    });
  }
  function go(s: Screen) {
    setScreen(s);
  }

  const year = YEARS.find((y) => y.id === resYear) || YEARS[0];
  const exam = year.exams.find((e) => e.id === resExam) || year.exams[year.exams.length - 1];

  // header
  let title = 'Greenwood';
  let sub: string | undefined = SCHOOL.toUpperCase();
  if (screen === 'diary') { title = 'Diary'; sub = `AARAV · ${selDate} JUNE`; }
  else if (screen === 'calendar') { title = 'Calendar'; sub = SCHOOL.toUpperCase(); }
  else if (screen === 'results') { title = 'Report Card'; sub = `${year.short} · ${exam.name}`.toUpperCase(); }
  else if (screen === 'photos') { title = 'Moments'; sub = 'SHARED BY THE SCHOOL'; }
  else if (screen === 'attendance') { title = 'Attendance'; sub = 'AARAV · GRADE 5-B'; }
  else if (screen === 'leave') { title = 'Apply for Leave'; sub = 'AARAV · GRADE 5-B'; }
  else if (screen === 'noticeBoard') { title = 'Notice Board'; sub = SCHOOL.toUpperCase(); }
  else if (screen === 'notice') {
    const n = NOTICES.find((x) => x.id === activeNoticeId)!;
    title = 'Notice'; sub = n.from.toUpperCase();
  } else if (screen === 'notifs') { title = 'Notifications'; sub = SCHOOL.toUpperCase(); }

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
        />
      }
      tabs={tabs}
      overlays={
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
      }
    >
      {screen === 'home' && <HomeParent diary={diary} acked={acked} toggle={toggle} go={go} openNotice={(id) => { setActiveNoticeId(id); go('notice'); }} />}
      {screen === 'attendance' && <AttendanceParent go={go} />}
      {screen === 'leave' && (leaveSent ? (
        <SuccessScreen title="Request sent" body="Ms. Kapoor will see this right away. You'll get a notification once it's approved." buttonLabel="Back to home" onButton={() => { setLeaveSent(false); go('home'); }} />
      ) : (
        <LeaveParent type={leaveType} setType={setLeaveType} onSubmit={() => setLeaveSent(true)} />
      ))}
      {screen === 'diary' && <DiaryParent diary={diary} selDate={selDate} setSelDate={setSelDate} toggle={toggle} />}
      {screen === 'calendar' && <CalendarScreen />}
      {screen === 'results' && <ResultsParent year={year} exam={exam} resYear={resYear} setResYear={setResYear} resExam={resExam} setResExam={setResExam} />}
      {screen === 'photos' && <PhotosScreen />}
      {screen === 'noticeBoard' && <NoticeBoardScreen role="parent" notices={NOTICES} acked={acked} onOpen={(id) => { setActiveNoticeId(id); go('notice'); }} />}
      {screen === 'notice' && (
        <NoticeDetailScreen
          notice={NOTICES.find((n) => n.id === activeNoticeId)!}
          acked={!!acked[activeNoticeId]}
          showAck
          onAcknowledge={() => setAcked((a) => ({ ...a, [activeNoticeId]: true }))}
        />
      )}
      {screen === 'notifs' && <NotificationsScreen />}
    </Shell>
  );
}

// ---------- HOME ----------
function HomeParent({
  diary, acked, toggle, go, openNotice,
}: {
  diary: Record<string, DiaryDay>;
  acked: Record<string, boolean>;
  toggle: (dk: string, i: number) => void;
  go: (s: Screen) => void;
  openNotice: (id: string) => void;
}) {
  const today = diary[TODAY_DATE];
  const doneCount = today.tasks.filter((t) => t.done).length;
  const unread = NOTICES.filter((n) => !acked[n.id]);
  const homeNotices = unread.slice(0, 4);
  const upNext = { m: 'JUN', d: '28', title: 'Parent–Teacher Meeting', sub: '9:00 AM – 1:00 PM · Main block' };

  return (
    <div className="px-[15px] pt-4 pb-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-[38px] h-[38px] rounded-[13px] grid place-items-center text-green font-bold text-[15px] flex-none" style={{ background: 'linear-gradient(140deg,#d7e4da,#a7c4b4)' }}>A</div>
        <div className="font-semibold text-[14px] leading-[1.1]">
          {CHILD.name}
          <small className="block text-muted font-medium text-[11px] mt-0.5">{CHILD.klass}</small>
        </div>
        <div className="ml-auto font-serif text-[16px] text-green">Good morning</div>
      </div>

      <div onClick={() => go('attendance')} className="bg-green text-white rounded-[20px] p-[15px] mb-2.5 flex items-center gap-[13px] cursor-pointer">
        <div className="w-11 h-11 rounded-[14px] bg-white/15 grid place-items-center flex-none">
          <Glyph d={GLYPH.check} size={22} stroke={2.2} />
        </div>
        <div className="flex-1">
          <b className="font-serif text-[20px] font-normal block leading-[1.1]">Present today</b>
          <small className="text-[#cfe0d6] text-[11.5px]">Marked 8:42 AM · Ms. Rao</small>
        </div>
        <span className="text-[#9fc0ad]"><Glyph d={GLYPH.chevronRight} size={18} stroke={2} /></span>
      </div>

      <button onClick={() => go('leave')} className="w-full mb-3 py-[11px] rounded-[13px] bg-white border border-line text-green font-semibold text-[12.5px] flex items-center justify-center gap-[7px]">
        <Glyph d={GLYPH.plus} size={16} stroke={1.8} />Apply for leave
      </button>

      <Card className="p-[15px] mb-3">
        <SectionLabel right={<span onClick={() => go('noticeBoard')} className="text-green cursor-pointer">View all ({NOTICES.length}) →</span>}>
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
          Today's Homework · {doneCount} of {today.tasks.length} done
        </SectionLabel>
        {today.tasks.map((t, i) => (
          <div key={i} className="flex items-center gap-[11px] py-2.5 border-t border-line">
            <div onClick={() => toggle(TODAY_DATE, i)} className={cx('w-[21px] h-[21px] rounded-[7px] flex-none grid place-items-center cursor-pointer border-[1.8px]', t.done ? 'bg-green border-green text-white' : 'bg-white border-line')}>
              {t.done && <Glyph d={GLYPH.check} size={12} stroke={3} />}
            </div>
            <div className="flex-1">
              <b className={cx('text-[13px] font-semibold', t.done && 'line-through text-muted')}>{t.subj}</b>
              <small className="block text-muted text-[11px] mt-px">{t.note}</small>
            </div>
          </div>
        ))}
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
function AttendanceParent({ go }: { go: (s: Screen) => void }) {
  const cells = useMemo(() => attCells(), []);
  const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <div className="px-[15px] py-4 pb-6">
      <div className="flex gap-2.5 mb-3.5">
        <StatCard value="94%" label="This month" />
        <StatCard value="18" label="Present" />
        <StatCard value="1" label="Absent" />
      </div>
      <Card className="p-[15px] mb-3">
        <SectionLabel>June 2026</SectionLabel>
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {weekdays.map((w, i) => (
            <div key={i} className="text-[9px] text-muted font-bold">{w}</div>
          ))}
          {cells.map((c) => (
            <div key={c.d} className="aspect-square grid place-items-center text-[11px] font-semibold rounded-[9px] relative" style={{ color: c.txt }}>
              {c.d}
              {c.showDot && <span className="absolute bottom-[3px] w-[5px] h-[5px] rounded-full" style={{ background: c.color }} />}
            </div>
          ))}
        </div>
        <div className="flex gap-3.5 mt-3.5 text-[11px] text-muted font-semibold">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-success" />Present</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-danger" />Absent</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-line" />Holiday</span>
        </div>
      </Card>
      <PrimaryButton onClick={() => go('leave')}>Apply for leave</PrimaryButton>
    </div>
  );
}

// ---------- LEAVE ----------
function LeaveParent({
  type, setType, onSubmit,
}: {
  type: 'Sick' | 'Casual' | 'Other';
  setType: (t: 'Sick' | 'Casual' | 'Other') => void;
  onSubmit: () => void;
}) {
  return (
    <div className="px-[15px] py-4 pb-6">
      <Card className="p-[15px] mb-3.5 flex items-center gap-2.5">
        <div className="w-[38px] h-[38px] rounded-[13px] grid place-items-center text-green font-bold text-[15px] flex-none" style={{ background: 'linear-gradient(140deg,#d7e4da,#a7c4b4)' }}>A</div>
        <div className="font-semibold text-[13px]">{CHILD.name}<small className="block text-muted font-medium text-[11px] mt-0.5">{CHILD.klassShort} · Roll {CHILD.roll}</small></div>
      </Card>
      <div className="mb-3.5">
        <label className="block text-[12px] font-semibold mb-[7px]">Type of leave</label>
        <div className="flex gap-[7px]">
          {(['Sick', 'Casual', 'Other'] as const).map((t) => (
            <Chip key={t} active={type === t} onClick={() => setType(t)} className="flex-1 text-center py-2.5">{t}</Chip>
          ))}
        </div>
      </div>
      <div className="mb-3.5">
        <label className="block text-[12px] font-semibold mb-[7px]">Dates</label>
        <div className="flex gap-[9px]">
          <input defaultValue="26 Jun" readOnly className="w-full px-3 py-[11px] border-[1.5px] border-line rounded-xl text-[13px] bg-white text-center" />
          <input defaultValue="27 Jun" readOnly className="w-full px-3 py-[11px] border-[1.5px] border-line rounded-xl text-[13px] bg-white text-center" />
        </div>
      </div>
      <div className="mb-3.5">
        <label className="block text-[12px] font-semibold mb-[7px]">Reason for the class teacher</label>
        <textarea defaultValue="Mild fever, advised rest by the doctor." className="w-full px-3 py-[11px] border-[1.5px] border-line rounded-xl text-[13px] bg-white resize-none h-[74px]" />
      </div>
      <PrimaryButton onClick={onSubmit}>Send request</PrimaryButton>
    </div>
  );
}

// ---------- RESULTS ----------
function ResultsParent({
  year, exam, resYear, setResYear, resExam, setResExam,
}: {
  year: typeof YEARS[number];
  exam: typeof YEARS[number]['exams'][number];
  resYear: string;
  setResYear: (id: string) => void;
  resExam: string;
  setResExam: (id: string) => void;
}) {
  const published = exam.published !== false;
  const overall = overallOf(exam);

  function pickYear(id: string) {
    const y = YEARS.find((v) => v.id === id)!;
    const pub = y.exams.filter((e) => e.published !== false);
    const last = pub[pub.length - 1] || y.exams[0];
    setResYear(id);
    setResExam(last.id);
  }

  return (
    <div className="px-[15px] py-4 pb-6">
      <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2">Academic year</div>
      <div className="gw-scroll flex gap-2 overflow-x-auto mb-4 pb-0.5">
        {YEARS.map((y) => {
          const on = y.id === resYear;
          return (
            <button key={y.id} onClick={() => pickYear(y.id)} className={cx('flex-none min-w-[104px] text-left px-3.5 py-[11px] rounded-[15px] border', on ? 'bg-green border-green' : 'bg-white border-line')}>
              <span className={cx('block text-[13px] font-bold', on ? 'text-white' : 'text-ink')}>{y.label}</span>
              <span className={cx('block text-[10px] font-semibold mt-0.5', on ? 'text-[#9fc0ad]' : 'text-muted')}>{y.sub}</span>
            </button>
          );
        })}
      </div>

      <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2">Examinations</div>
      <div className="gw-scroll flex gap-2 overflow-x-auto mb-4 pb-0.5">
        {year.exams.map((e) => {
          const on = e.id === resExam;
          const pub = e.published !== false;
          const ov = overallOf(e);
          return (
            <button key={e.id} onClick={() => setResExam(e.id)} className={cx('flex-none min-w-[96px] text-left px-[13px] py-2.5 rounded-[14px] border', on ? 'bg-green border-green' : pub ? 'bg-white border-line' : 'bg-cloud border border-dashed border-[#cdd5cc]')}>
              <span className={cx('block text-[12px] font-bold', on ? 'text-white' : pub ? 'text-ink' : 'text-[#9aa39b]')}>{e.name}</span>
              <span className={cx('block text-[11px] font-semibold mt-[3px]', on ? 'text-gold' : pub ? 'text-muted' : 'text-[#b7bfb6]')}>{pub ? `${ov}%` : 'Soon'}</span>
            </button>
          );
        })}
      </div>

      {published && exam.subjects.length > 0 ? (
        <>
          <div className="flex gap-2.5 mb-3.5">
            <StatCard value={<>{overall}<span className="text-[14px]">%</span></>} label="Overall" />
            <StatCard value={exam.rank ? ordinal(exam.rank) : ''} label="Class rank" />
            <StatCard value={overall != null ? gradeFor(overall) : ''} label="Grade" />
          </div>
          <Card className="p-[15px] mb-3">
            {exam.subjects.map((s, i) => {
              const pct = Math.round((s.m / s.max) * 100);
              return (
                <div key={i} className="mb-[13px] last:mb-0">
                  <div className="flex justify-between text-[13px] font-semibold mb-1.5">
                    <span>{s.name}</span><span className="text-muted">{s.m} / {s.max}</span>
                  </div>
                  <div className="h-[7px] rounded-md bg-[#f1f5f1] overflow-hidden">
                    <i className="block h-full rounded-md" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#15412f,#1d5740)' }} />
                  </div>
                </div>
              );
            })}
          </Card>
          <Card className="p-[15px] flex gap-[9px] items-start">
            <span className="text-[10px] font-bold text-green bg-mist px-2 py-[3px] rounded-[7px] mt-px">TEACHER</span>
            <p className="text-[12.5px] text-muted leading-[1.5]">{exam.remark}</p>
          </Card>
        </>
      ) : (
        <div className="text-center py-10 px-5 text-muted">
          <div className="w-[54px] h-[54px] rounded-full bg-[#f1f5f1] grid place-items-center mx-auto mb-3.5 text-[#9fb3a5]">
            <Glyph d="M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18" size={24} />
          </div>
          <div className="text-[13.5px] font-semibold text-ink mb-1">{exam.name} not published yet</div>
          <p className="text-[12px] leading-[1.5] max-w-[210px] mx-auto">Results will be released after {exam.when}. You'll get a notification when they're ready.</p>
        </div>
      )}
    </div>
  );
}
