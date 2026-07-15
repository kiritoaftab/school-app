import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  AppHeader, BottomSheet, Card, Chip, DateStrip, Glyph, InfoNote, PrimaryButton,
  OutlineButton, Shell, StatCard, cx, type TabDef,
} from './kit';
import { CalendarScreen, NotificationsScreen, PhotosScreen } from './SharedScreens';
import { AccountSheet } from './AccountSheet';
import {
  SCHOOL, GLYPH, TEACHER_CLASSES, SUBJ_META, rosterOf, CT_NAME_OF, SEEDED_ABS,
  CLASS_DIARY, TE_EXAMS, PUB_AVG_MAP, MAX_MARKS, DATE_ORDER, WD, WD_FULL, TODAY_DATE,
  initialsOf, type ClassDiary,
} from './data';

type Screen = 'home' | 'attendance' | 'diary' | 'calendar' | 'results' | 'photos' | 'notifs';
type ExamStatus = 'draft' | 'provisional' | 'final';
const TOP_LEVEL: Screen[] = ['home', 'diary', 'calendar', 'results', 'photos'];

const mkKey = (cls: string, exam: string, subj: string, sid: string) => `${cls}.${exam}.${subj}.${sid}`;

export function TeacherApp() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [screen, setScreen] = useState<Screen>('home');
  const [selClass, setSelClass] = useState('5B');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [acctOpen, setAcctOpen] = useState(false);

  const [attAbs, setAttAbs] = useState<Record<string, Record<string, boolean>>>({ '5B': {}, '5A': {}, '6A': {} });
  const [regSaved, setRegSaved] = useState(false);

  const [classDiary, setClassDiary] = useState<ClassDiary>(() => JSON.parse(JSON.stringify(CLASS_DIARY)));
  const [teDate, setTeDate] = useState(TODAY_DATE);
  const [hwNote, setHwNote] = useState('');
  const [hwSubject, setHwSubject] = useState('Mathematics');

  const [teExam, setTeExam] = useState('ut3');
  const [teSubject, setTeSubject] = useState('math');
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [examStatus, setExamStatus] = useState<Record<string, ExamStatus>>({});
  const [editingFinal, setEditingFinal] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState('');

  const curClass = TEACHER_CLASSES.find((c) => c.id === selClass) || TEACHER_CLASSES[0];
  const name = user?.name ?? 'Ms. Anjali Rao';

  function go(s: Screen) {
    setScreen(s);
    setPickerOpen(false);
  }
  function statusOf(cls: string, examId: string): ExamStatus {
    if (examId !== 'ut3') return 'final';
    return examStatus[`${cls}.ut3`] || 'draft';
  }

  // header
  let title = 'Greenwood';
  let sub: string | undefined = `${name.toUpperCase()} · TEACHER`;
  if (screen === 'diary') { title = 'Class Diary'; sub = curClass.label.toUpperCase(); }
  else if (screen === 'calendar') { title = 'Calendar'; sub = SCHOOL.toUpperCase(); }
  else if (screen === 'results') { title = 'Marks'; sub = curClass.label.toUpperCase(); }
  else if (screen === 'photos') { title = 'Moments'; sub = 'SHARED BY THE SCHOOL'; }
  else if (screen === 'attendance') { title = 'Attendance'; sub = `${curClass.label} · 25 JUN`.toUpperCase(); }
  else if (screen === 'notifs') { title = 'Notifications'; sub = SCHOOL.toUpperCase(); }

  const topLevel = TOP_LEVEL.includes(screen);
  const onBack = topLevel ? undefined : () => go('home');
  const activeKey = topLevel ? screen : 'home';
  const showClassBar = ['home', 'attendance', 'diary', 'results'].includes(screen);

  const tabs: TabDef[] = [
    { key: 'home', label: 'Home', glyph: GLYPH.home },
    { key: 'diary', label: 'Diary', glyph: GLYPH.diary },
    { key: 'calendar', label: 'Calendar', glyph: GLYPH.calendar },
    { key: 'results', label: 'Marks', glyph: GLYPH.results },
    { key: 'photos', label: 'Photos', glyph: GLYPH.photos },
  ].map((t) => ({ ...t, active: activeKey === t.key, onClick: () => go(t.key as Screen) }));

  return (
    <Shell
      header={<AppHeader title={title} sub={sub} onBack={onBack} onAccount={() => setAcctOpen(true)} onBell={() => go('notifs')} />}
      classBar={
        showClassBar ? (
          <div className="flex items-center gap-2 px-4 py-[9px] bg-[#eef3ee] border-b border-[#e0e7e0]">
            <button onClick={() => setPickerOpen(true)} className="flex items-center gap-[7px] bg-white border border-[#d3ddd4] rounded-full px-3 py-1.5">
              <span className="text-[12.5px] font-bold text-green">{curClass.label}</span>
              <span className="text-[10px] font-semibold text-muted">{curClass.roleLabel}</span>
              <span className="text-muted"><Glyph d="M6 9l6 6 6-6" size={13} stroke={2.2} /></span>
            </button>
            <span className="ml-auto text-[11px] text-muted font-semibold">{curClass.count} students</span>
          </div>
        ) : undefined
      }
      tabs={tabs}
      overlays={
        <>
          <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)}>
            <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">Your classes</div>
            {TEACHER_CLASSES.map((c) => {
              const on = c.id === selClass;
              return (
                <div key={c.id} onClick={() => { setSelClass(c.id); setPickerOpen(false); setTeSubject('math'); setTeDate('25'); setRegSaved(false); }}
                  className={cx('flex items-center gap-2.5 px-3.5 py-[13px] rounded-[15px] cursor-pointer mb-2 border-[1.5px]', on ? 'border-green bg-[#f3f8f4]' : 'border-line bg-white')}>
                  <div className="flex-1">
                    <b className={cx('text-[14px] font-bold block', on ? 'text-green' : 'text-ink')}>{c.label}</b>
                    <small className="text-[11px] text-muted">{c.roleLabel} · {c.count} students</small>
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
          name={name} curClass={curClass} statusOf={statusOf} regSaved={regSaved}
          attAbs={attAbs} classDiary={classDiary} teDate={teDate} go={go}
          openMarks={() => { setTeExam('ut3'); go('results'); }}
        />
      )}
      {screen === 'attendance' && (
        <TeacherAttendance curClass={curClass} selClass={selClass} attAbs={attAbs} setAttAbs={setAttAbs} regSaved={regSaved} setRegSaved={setRegSaved} />
      )}
      {screen === 'diary' && (
        <TeacherDiary curClass={curClass} selClass={selClass} classDiary={classDiary} setClassDiary={setClassDiary}
          teDate={teDate} setTeDate={setTeDate} hwNote={hwNote} setHwNote={setHwNote} hwSubject={hwSubject} setHwSubject={setHwSubject} />
      )}
      {screen === 'results' && (
        <TeacherMarks
          curClass={curClass} selClass={selClass} teExam={teExam} setTeExam={setTeExam} teSubject={teSubject} setTeSubject={setTeSubject}
          marks={marks} setMarks={setMarks} attAbs={attAbs} setAttAbs={setAttAbs} statusOf={statusOf}
          setExamStatus={setExamStatus} editingFinal={editingFinal} setEditingFinal={setEditingFinal} toast={toast} setToast={setToast}
        />
      )}
      {screen === 'calendar' && <CalendarScreen />}
      {screen === 'photos' && <PhotosScreen canUpload />}
      {screen === 'notifs' && <NotificationsScreen />}
    </Shell>
  );
}

// ---------- HOME ----------
function TeacherHome({
  name, curClass, statusOf, regSaved, attAbs, classDiary, teDate, go, openMarks,
}: {
  name: string;
  curClass: typeof TEACHER_CLASSES[number];
  statusOf: (cls: string, e: string) => ExamStatus;
  regSaved: boolean;
  attAbs: Record<string, Record<string, boolean>>;
  classDiary: ClassDiary;
  teDate: string;
  go: (s: Screen) => void;
  openMarks: () => void;
}) {
  const abs = attAbs[curClass.id] || {};
  const regAbsent = Object.keys(abs).length;
  const regPresent = curClass.count - regAbsent;
  const roAbs = SEEDED_ABS[curClass.id] || [];
  const classAbsent = curClass.ct ? regAbsent : roAbs.length;
  const classPresent = curClass.count - classAbsent;
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
        <div className="w-[38px] h-[38px] rounded-[13px] grid place-items-center text-green font-bold text-[14px] flex-none" style={{ background: 'linear-gradient(140deg,#d7e4da,#a7c4b4)' }}>{initialsOf(name)}</div>
        <div className="font-semibold text-[14px] leading-[1.1]">{name}<small className="block text-muted font-medium text-[11px] mt-0.5">Mathematics · 3 classes</small></div>
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
        <StatCard value={curClass.count} label="Students" />
        <StatCard value={classPresent} label="Present" />
        <StatCard value={hwCount} label="Homework" />
      </div>
    </div>
  );
}

// ---------- ATTENDANCE ----------
function TeacherAttendance({
  curClass, selClass, attAbs, setAttAbs, regSaved, setRegSaved,
}: {
  curClass: typeof TEACHER_CLASSES[number];
  selClass: string;
  attAbs: Record<string, Record<string, boolean>>;
  setAttAbs: React.Dispatch<React.SetStateAction<Record<string, Record<string, boolean>>>>;
  regSaved: boolean;
  setRegSaved: (v: boolean) => void;
}) {
  const roster = rosterOf(selClass);
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
          <StatCard value={curClass.count - classAbsent} label="Present" valueColor="text-success" />
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
  const regPresent = curClass.count - regAbsent;
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
function TeacherDiary({
  curClass, selClass, classDiary, setClassDiary, teDate, setTeDate, hwNote, setHwNote, hwSubject, setHwSubject,
}: {
  curClass: typeof TEACHER_CLASSES[number];
  selClass: string;
  classDiary: ClassDiary;
  setClassDiary: React.Dispatch<React.SetStateAction<ClassDiary>>;
  teDate: string;
  setTeDate: (d: string) => void;
  hwNote: string;
  setHwNote: (v: string) => void;
  hwSubject: string;
  setHwSubject: (v: string) => void;
}) {
  const days = classDiary[selClass] || {};
  const list = days[teDate] || [];

  function addHw() {
    if (!hwNote.trim()) return;
    setClassDiary((cd) => {
      const c = { ...(cd[selClass] || {}) };
      c[teDate] = [...(c[teDate] || []), { subj: hwSubject, note: hwNote.trim() }];
      return { ...cd, [selClass]: c };
    });
    setHwNote('');
  }
  function delHw(i: number) {
    setClassDiary((cd) => {
      const c = { ...(cd[selClass] || {}) };
      c[teDate] = (c[teDate] || []).filter((_, j) => j !== i);
      return { ...cd, [selClass]: c };
    });
  }

  return (
    <div className="px-[15px] py-4 pb-6">
      <DateStrip dates={DATE_ORDER} selDate={teDate} today={TODAY_DATE} weekdayOf={(k) => WD[k]} onPick={setTeDate} hasDot={(k) => (days[k] || []).length > 0} />
      <div className="flex items-center gap-2.5 mb-[11px]">
        <div className="font-serif text-[19px] leading-none">{WD_FULL[WD[teDate]]}, {teDate} June</div>
        {teDate === TODAY_DATE && <span className="text-[10px] font-bold text-green bg-gold-soft px-2 py-[3px] rounded-[7px]">TODAY</span>}
      </div>
      <Card className="px-3.5 py-1.5 mb-3">
        {list.length === 0 ? (
          <div className="py-4 text-center text-muted text-[12.5px]">No homework posted for {curClass.label} yet.</div>
        ) : (
          list.map((h, i) => (
            <div key={i} className="flex items-start gap-[11px] py-[11px] border-t border-[#f0f2ee] first:border-t-0">
              <span className="text-[9.5px] font-bold uppercase text-green bg-mist px-2 py-1 rounded-[7px] mt-px flex-none">{h.subj}</span>
              <div className="flex-1 text-[12.5px] leading-[1.45]">{h.note}</div>
              <button onClick={() => delHw(i)} className="w-6 h-6 rounded-lg bg-[#f6ecec] grid place-items-center flex-none text-danger" aria-label="Delete">
                <Glyph d="M6 6l12 12M18 6L6 18" size={13} stroke={2} />
              </button>
            </div>
          ))
        )}
      </Card>
      <Card className="p-[15px]">
        <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">Add homework</div>
        <div className="flex gap-1.5 flex-wrap mb-2.5">
          {curClass.subjects.map((code) => (
            <Chip key={code} active={hwSubject === SUBJ_META[code]} onClick={() => setHwSubject(SUBJ_META[code])}>{SUBJ_META[code]}</Chip>
          ))}
        </div>
        <textarea value={hwNote} onChange={(e) => setHwNote(e.target.value)} placeholder="Homework details for parents…" className="w-full box-border px-3 py-[11px] border-[1.5px] border-line rounded-xl text-[13px] bg-white resize-none h-16 mb-2.5" />
        <button onClick={addHw} className="w-full py-3 rounded-xl bg-green text-white font-semibold text-[13px]">Post to {curClass.label}</button>
      </Card>
    </div>
  );
}

// ---------- MARKS (results teacher) ----------
function TeacherMarks({
  curClass, selClass, teExam, setTeExam, teSubject, setTeSubject, marks, setMarks,
  attAbs, setAttAbs, statusOf, setExamStatus, editingFinal, setEditingFinal, toast, setToast,
}: {
  curClass: typeof TEACHER_CLASSES[number];
  selClass: string;
  teExam: string;
  setTeExam: (v: string) => void;
  teSubject: string;
  setTeSubject: (v: string) => void;
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
  const roster = rosterOf(selClass);
  const absMarks = attAbs[selClass] || {};
  const status = statusOf(selClass, teExam);
  const editKey = `${selClass}.${teExam}`;
  const isEditingFinal = status === 'final' && !!editingFinal[editKey];
  const editable = status === 'draft' || status === 'provisional' || isEditingFinal;
  const teExamName = TE_EXAMS.find((e) => e.id === teExam)?.name ?? '';

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
    setExamStatus((m) => ({ ...m, [`${selClass}.ut3`]: s }));
    setToast(t);
  }

  // averages
  let sum = 0, count = 0;
  roster.forEach((r) => {
    if (absMarks[r.id]) return;
    const v = parseInt(marks[mkKey(selClass, teExam, teSubject, r.id)]);
    if (!isNaN(v)) { sum += v; count++; }
  });
  const marksAvg = count ? `${Math.round((sum / count / MAX_MARKS) * 100)}%` : '—';
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
        {TE_EXAMS.map((e) => {
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
            <StatCard value={count} label={`of ${curClass.count} in`} />
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
              <div className="flex-1 bg-cloud rounded-[14px] p-3 text-center"><div className="font-serif text-[23px] leading-none text-green">{curClass.count}</div><small className="text-[10px] uppercase text-muted font-semibold">Cards sent</small></div>
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

function MarksToast({ tone, icon, children }: { tone: 'green' | 'amber'; icon: string; children: React.ReactNode }) {
  const cls = tone === 'amber' ? 'bg-[#fbf3e2] border-[#ecd8ab] text-[#8a6d1f]' : 'bg-[#eef5f0] border-[#cfe3d6] text-green';
  return (
    <div className={cx('rounded-[14px] border px-3.5 py-3 mb-3 text-[12px] font-semibold flex items-center gap-2', cls)}>
      <Glyph d={icon} size={15} stroke={2.4} />{children}
    </div>
  );
}
