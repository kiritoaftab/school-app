import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  listClasses, listTeachers, createClass, createTeacher,
  listSubjects, createSubject, updateSubject, deleteSubject,
  type AdminKlass, type AdminTeacher, type AdminSubject,
} from '../api/admin';
import {
  AppHeader, Card, Chip, EmptyState, Glyph, PrimaryButton, Shell, Spinner, SuccessScreen, cx,
  type TabDef,
} from './kit';
import {
  CalendarScreen, NoticeBoardScreen, NoticeDetailScreen, NotificationsScreen,
} from './SharedScreens';
import { AccountSheet } from './AccountSheet';
import {
  SCHOOL, GLYPH, NOTICES, ADMIN_ACTIVITY, NOTICE_CATEGORIES,
  TEACHERS, ADMIN_CLASSES, DEFAULT_CLASS_SUBJECTS, DEFAULT_CLASS_EXAMS,
  subjectsOf, teachOf, initialsOf, maskPhone, classAttendanceOf,
  type Teacher, type AdminClass, type Notice, type ClassExam,
} from './data';

type Screen =
  | 'home' | 'staff' | 'staffDetail' | 'staffAdd' | 'classes' | 'classDetail' | 'classAdd'
  | 'adminAtt' | 'adminAttClass' | 'noticeBoard' | 'notice' | 'noticeCompose' | 'calendar' | 'notifs';

export function AdminApp() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [screen, setScreen] = useState<Screen>('home');
  const [acctOpen, setAcctOpen] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>(() => JSON.parse(JSON.stringify(TEACHERS)));
  const [classes, setClasses] = useState<AdminClass[]>(() => JSON.parse(JSON.stringify(ADMIN_CLASSES)));
  const [notices, setNotices] = useState<Notice[]>(NOTICES);
  const [activeTeacherId, setActiveTeacherId] = useState<number | null>(null);
  const [activeClassId] = useState('5-B');
  const [activeNoticeId, setActiveNoticeId] = useState('ptm');
  const [attClassId, setAttClassId] = useState('5-B');
  // Per-class subject & exam catalogues (editable in class detail).
  const [classSubjects, setClassSubjects] = useState<Record<string, string[]>>({});
  const [classExams, setClassExams] = useState<Record<string, ClassExam[]>>({});

  // Live classes & teachers from the backend.
  const [apiClasses, setApiClasses] = useState<AdminKlass[] | null>(null);
  const [apiTeachers, setApiTeachers] = useState<AdminTeacher[] | null>(null);
  const [classesLoading, setClassesLoading] = useState(false);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  // Live school-level subject catalogue.
  const [apiSubjects, setApiSubjects] = useState<AdminSubject[] | null>(null);

  const loadClasses = useCallback(async () => {
    setClassesLoading(true);
    setClassesError(null);
    try {
      setApiClasses(await listClasses());
    } catch {
      setClassesError("Couldn't load classes. Pull to retry.");
    } finally {
      setClassesLoading(false);
    }
  }, []);

  const loadTeachers = useCallback(async () => {
    setStaffLoading(true);
    setStaffError(null);
    try {
      setApiTeachers(await listTeachers());
    } catch {
      setStaffError("Couldn't load staff. Pull to retry.");
    } finally {
      setStaffLoading(false);
    }
  }, []);

  const loadSubjects = useCallback(async () => {
    try {
      setApiSubjects(await listSubjects());
    } catch {
      /* surfaced inline in the subject manager */
    }
  }, []);

  // Load live data whenever the admin lands on a screen that needs it.
  useEffect(() => {
    // Add-Teacher needs live classes + subjects to build its assignment picker.
    if ((screen === 'classes' || screen === 'classAdd' || screen === 'staffAdd') && apiClasses === null) loadClasses();
    if ((screen === 'classes' || screen === 'classAdd' || screen === 'staffAdd') && apiSubjects === null) loadSubjects();
    // Staff screens need teachers; Add-Class needs them for the class-teacher picker.
    if ((screen === 'staff' || screen === 'staffDetail' || screen === 'classAdd') && apiTeachers === null) loadTeachers();
  }, [screen, apiClasses, loadClasses, apiSubjects, loadSubjects, apiTeachers, loadTeachers]);

  const name = user?.name ?? 'Sridevi Menon';
  const teacherName = (id: string) => teachers.find((t) => t.id === id)?.name ?? '';
  const activeClass = classes.find((c) => c.id === activeClassId) || classes[0];
  const activeApiTeacher = apiTeachers?.find((t) => t.id === activeTeacherId) ?? null;

  // Attendance aggregates (simulated) for the admin overview.
  const classAtt = classes.map((c) => ({ id: c.id, label: c.label, ...classAttendanceOf(c.students) }));
  const schoolPresent = classAtt.reduce((a, c) => a + c.present, 0);
  const schoolTotal = classAtt.reduce((a, c) => a + c.total, 0);
  const schoolPct = schoolTotal ? Math.round((schoolPresent / schoolTotal) * 100) : 0;
  const attClass = classAtt.find((c) => c.id === attClassId) || classAtt[0];

  function go(s: Screen) {
    setScreen(s);
  }

  // header
  let title = user?.school?.name ?? 'Greenwood';
  let sub: string | undefined = `${name.toUpperCase()} · ADMIN`;
  const M: Record<string, [string, string]> = {
    staff: ['Staff', 'MANAGE TEACHERS'],
    staffAdd: ['Add Teacher', 'ADD TO STAFF'],
    classes: ['Classes', 'ALL CLASSES'],
    classAdd: ['Add', 'CLASS OR SUBJECT'],
    adminAtt: ['Attendance', 'TODAY · ALL CLASSES'],
    noticeBoard: ['Notice Board', SCHOOL.toUpperCase()],
    noticeCompose: ['New Notice', 'TO ALL PARENTS'],
    calendar: ['Calendar', SCHOOL.toUpperCase()],
    notifs: ['Notifications', SCHOOL.toUpperCase()],
  };
  if (M[screen]) { [title, sub] = M[screen]; }
  else if (screen === 'staffDetail') { title = activeApiTeacher?.name ?? 'Teacher'; sub = 'TEACHER'; }
  else if (screen === 'classDetail') { title = activeClass.label; sub = activeClass.ctId ? `CLASS TEACHER · ${teacherName(activeClass.ctId).toUpperCase()}` : 'NO CLASS TEACHER'; }
  else if (screen === 'adminAttClass') { title = attClass.label; sub = `${attClass.present} / ${attClass.total} PRESENT`; }
  else if (screen === 'notice') { title = 'Notice'; sub = (notices.find((n) => n.id === activeNoticeId)?.from ?? '').toUpperCase(); }

  const TOP: Screen[] = ['home', 'staff', 'classes', 'noticeBoard', 'calendar'];
  const topLevel = TOP.includes(screen);
  const backTo: Record<string, Screen> = {
    staffDetail: 'staff', staffAdd: 'staff', classDetail: 'classes', classAdd: 'classes',
    adminAtt: 'home', adminAttClass: 'adminAtt',
    noticeCompose: 'noticeBoard', notice: 'noticeBoard', notifs: 'home',
  };
  const onBack = topLevel ? undefined : () => go(backTo[screen] || 'home');

  const activeKey = ['staff', 'staffDetail', 'staffAdd'].includes(screen) ? 'staff'
    : ['classes', 'classDetail', 'classAdd'].includes(screen) ? 'classes'
      : ['noticeBoard', 'notice', 'noticeCompose'].includes(screen) ? 'notices'
        : screen === 'calendar' ? 'calendar' : 'home';

  const tabs: TabDef[] = [
    { key: 'home', label: 'Home', glyph: GLYPH.home, to: 'home' },
    { key: 'staff', label: 'Staff', glyph: GLYPH.staff, to: 'staff' },
    { key: 'classes', label: 'Classes', glyph: GLYPH.classes, to: 'classes' },
    { key: 'notices', label: 'Notices', glyph: GLYPH.notices, to: 'noticeBoard' },
    { key: 'calendar', label: 'Calendar', glyph: GLYPH.calendar, to: 'calendar' },
  ].map((t) => ({ key: t.key, label: t.label, glyph: t.glyph, active: activeKey === t.key, onClick: () => go(t.to as Screen) }));

  return (
    <Shell
      header={<AppHeader title={title} sub={sub} onBack={onBack} onAccount={() => setAcctOpen(true)} onBell={() => go('notifs')} brand={user?.school?.name} logo={user?.school?.logo} />}
      tabs={tabs}
      overlays={<AccountSheet open={acctOpen} onClose={() => setAcctOpen(false)} name={name} phone={user?.phone ?? '9800011122'} roleLabel="Admin" onSignOut={() => { logout(); navigate('/login'); }} />}
    >
      {screen === 'home' && <AdminHome name={name} teachers={teachers} classes={classes} schoolStudents={schoolTotal} schoolPct={schoolPct} go={go} openAcct={() => setAcctOpen(true)} />}
      {screen === 'staff' && <StaffList teachers={apiTeachers} loading={staffLoading} error={staffError} onRetry={loadTeachers} onAdd={() => go('staffAdd')} onOpen={(id) => { setActiveTeacherId(id); go('staffDetail'); }} />}
      {screen === 'staffDetail' && <StaffDetail teacher={activeApiTeacher} classes={apiClasses} />}
      {screen === 'staffAdd' && <StaffAdd subjects={apiSubjects} classes={apiClasses} onCreated={async () => { setApiClasses(null); await loadTeachers(); go('staff'); }} />}
      {screen === 'classes' && <ClassesList classes={apiClasses} subjects={apiSubjects} loading={classesLoading} error={classesError} onRetry={loadClasses} onAdd={() => go('classAdd')} />}
      {screen === 'classDetail' && (
        <ClassDetail
          cls={activeClass} teachers={teachers} teacherName={teacherName}
          setTeachers={setTeachers} setClasses={setClasses}
          classSubjects={classSubjects} setClassSubjects={setClassSubjects}
          classExams={classExams} setClassExams={setClassExams}
        />
      )}
      {screen === 'adminAtt' && <AdminAttendance classAtt={classAtt} schoolPct={schoolPct} schoolPresent={schoolPresent} onOpen={(id) => { setAttClassId(id); go('adminAttClass'); }} />}
      {screen === 'adminAttClass' && <AdminAttendanceClass att={attClass} />}
      {screen === 'classAdd' && (
        <ClassOrSubjectAdd
          teachers={apiTeachers ?? []}
          onClassCreated={async () => { await loadClasses(); go('classes'); }}
          subjects={apiSubjects}
          onSubjectsChanged={loadSubjects}
        />
      )}
      {screen === 'noticeBoard' && <NoticeBoardScreen role="admin" notices={notices} acked={{}} onOpen={(id) => { setActiveNoticeId(id); go('notice'); }} onCompose={() => go('noticeCompose')} />}
      {screen === 'notice' && <NoticeDetailScreen notice={notices.find((n) => n.id === activeNoticeId)!} acked={false} showAck={false} onAcknowledge={() => {}} />}
      {screen === 'noticeCompose' && <NoticeCompose onPublish={(n) => setNotices((ns) => [n, ...ns])} onDone={() => go('noticeBoard')} />}
      {screen === 'calendar' && <CalendarScreen admin />}
      {screen === 'notifs' && <NotificationsScreen />}
    </Shell>
  );
}

// ---------- HOME ----------
function AdminHome({ name, teachers, classes, schoolStudents, schoolPct, go, openAcct }: { name: string; teachers: Teacher[]; classes: AdminClass[]; schoolStudents: number; schoolPct: number; go: (s: Screen) => void; openAcct: () => void }) {
  const pending = teachers.filter((t) => t.status === 'invited').length;
  const stats: { n: string; label: string; to: Screen }[] = [
    { n: String(schoolStudents), label: 'Students', to: 'classes' },
    { n: String(teachers.length), label: 'Teachers', to: 'staff' },
    { n: String(classes.length), label: 'Classes', to: 'classes' },
    { n: `${schoolPct}%`, label: 'Present today', to: 'adminAtt' },
  ];
  return (
    <div className="px-[15px] pt-4 pb-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div onClick={openAcct} className="flex items-center gap-2.5 cursor-pointer">
          <div className="w-[38px] h-[38px] rounded-[13px] grid place-items-center text-green font-bold text-[14px] flex-none" style={{ background: 'linear-gradient(140deg,#d7e4da,#a7c4b4)' }}>{initialsOf(name)}</div>
          <div className="font-semibold text-[14px] leading-[1.1]">{name}<small className="block text-muted font-medium text-[11px] mt-0.5">Principal · Admin</small></div>
          <span className="text-[#9aa39b] flex-none"><Glyph d={GLYPH.chevronDown} size={16} stroke={2.2} /></span>
        </div>
        <div className="ml-auto font-serif text-[16px] text-green">Good morning</div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 mb-3">
        {stats.map((s) => (
          <Card key={s.label} onClick={() => go(s.to)} className="p-[15px]"><div className="font-serif text-[28px] leading-none text-green">{s.n}</div><small className="text-[11px] text-muted font-semibold block mt-1">{s.label}</small></Card>
        ))}
      </div>
      <div onClick={() => go('staff')} className="bg-green text-white rounded-[20px] p-[15px] mb-3 flex items-center gap-[13px] cursor-pointer">
        <div className="w-11 h-11 rounded-[14px] bg-white/15 grid place-items-center flex-none"><Glyph d={GLYPH.staff} size={22} stroke={1.9} /></div>
        <div className="flex-1"><b className="font-serif text-[19px] font-normal block leading-[1.1]">Manage staff</b><small className="text-[#cfe0d6] text-[11.5px]">{teachers.length} teachers · {pending} invite pending</small></div>
        <span className="text-[#9fc0ad]"><Glyph d={GLYPH.chevronRight} size={18} stroke={2} /></span>
      </div>
      <Card onClick={() => go('classes')} className="p-[15px] mb-3 flex items-center gap-[13px]">
        <div className="w-11 h-11 rounded-[14px] bg-mist grid place-items-center flex-none text-green"><Glyph d={GLYPH.classes} size={21} stroke={1.9} /></div>
        <div className="flex-1"><b className="font-serif text-[19px] font-normal block leading-[1.1]">Classes &amp; students</b><small className="text-muted text-[11.5px]">{classes.length} classes · add, view &amp; assign</small></div>
        <span className="text-[#c3ccc5]"><Glyph d={GLYPH.chevronRight} size={18} stroke={2} /></span>
      </Card>
      <Card className="p-[15px]">
        <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-1">Recent activity</div>
        {ADMIN_ACTIVITY.map((a, i) => (
          <div key={i} className="flex gap-[11px] items-center py-2.5 border-t border-line">
            <span className="w-2 h-2 rounded-full flex-none" style={{ background: a.dot }} />
            <div className="flex-1"><b className="text-[12.5px] font-semibold block">{a.title}</b><small className="text-[11px] text-muted">{a.sub}</small></div>
            <span className="text-[10px] text-muted font-semibold">{a.tm}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ---------- STAFF LIST (live) ----------
function StaffList({ teachers, loading, error, onRetry, onAdd, onOpen }: {
  teachers: AdminTeacher[] | null; loading: boolean; error: string | null;
  onRetry: () => void; onAdd: () => void; onOpen: (id: number) => void;
}) {
  return (
    <div className="px-[15px] py-4 pb-6">
      <button onClick={onAdd} className="w-full mb-3.5 py-3 rounded-[14px] bg-green text-white font-semibold text-[13px] flex items-center justify-center gap-[7px]"><Glyph d={GLYPH.plus} size={17} stroke={2} />Add a teacher</button>

      {loading && teachers === null && <div className="py-10"><Spinner /></div>}

      {error && teachers === null && !loading && (
        <Card className="p-5 text-center">
          <div className="text-[12.5px] text-danger mb-3">{error}</div>
          <button onClick={onRetry} className="px-4 py-2 rounded-[11px] bg-green text-white font-semibold text-[12.5px]">Retry</button>
        </Card>
      )}

      {teachers !== null && (
        <>
          <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">{teachers.length} {teachers.length === 1 ? 'teacher' : 'teachers'}</div>
          {teachers.length === 0 ? (
            <EmptyState icon={GLYPH.staff} title="No teachers yet">Add your first teacher — they'll sign in with their mobile and a one-time code.</EmptyState>
          ) : (
            teachers.map((t) => (
              <Card key={t.id} onClick={() => onOpen(t.id)} className="p-[13px] mb-2.25 flex gap-3 items-center">
                <div className="w-10 h-10 rounded-xl grid place-items-center text-green font-bold text-[13px] flex-none" style={{ background: 'linear-gradient(140deg,#d7e4da,#a7c4b4)' }}>{initialsOf(t.name)}</div>
                <div className="flex-1 min-w-0"><b className="text-[13.5px] font-semibold block">{t.name}</b><small className="text-[11px] text-muted">{maskPhone(t.phone)} · login mobile</small></div>
                <span className="text-[#c3ccc5] flex-none"><Glyph d={GLYPH.chevronRight} size={17} stroke={2.2} /></span>
              </Card>
            ))
          )}
        </>
      )}
    </div>
  );
}

// ---------- STAFF DETAIL (live, read-only) ----------
function StaffDetail({ teacher, classes }: { teacher: AdminTeacher | null; classes: AdminKlass[] | null }) {
  if (!teacher) return <div className="px-[15px] py-10"><Spinner /></div>;
  const ctClasses = (classes ?? []).filter((c) => c.classTeacherId === teacher.id);
  return (
    <div className="px-[15px] py-4 pb-6">
      <Card className="p-[18px] mb-3 text-center">
        <div className="w-[60px] h-[60px] rounded-[18px] grid place-items-center text-green font-bold text-[19px] mx-auto mb-3" style={{ background: 'linear-gradient(140deg,#d7e4da,#a7c4b4)' }}>{initialsOf(teacher.name)}</div>
        <h3 className="font-serif text-[23px] mb-[3px]">{teacher.name}</h3>
        <div className="text-[12px] text-muted font-semibold">Teacher</div>
        <div className="text-[11.5px] text-muted mt-1.5">{maskPhone(teacher.phone)} · login mobile</div>
      </Card>
      <Card className="p-[15px]">
        <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.75">Class teacher of</div>
        {ctClasses.length > 0 ? (
          <div className="flex gap-1.5 flex-wrap">
            {ctClasses.map((c) => (
              <span key={c.id} className="text-[12px] font-semibold text-green bg-mist rounded-[10px] px-3 py-1.5 flex items-center gap-1.5"><Glyph d={GLYPH.classes} size={14} stroke={1.9} />{c.label}</span>
            ))}
          </div>
        ) : (
          <div className="text-[12.5px] text-muted">Not a class teacher yet. Assign this teacher when creating a class.</div>
        )}
      </Card>
      <div className="text-center text-[11px] text-muted leading-[1.5] mt-3">They sign in with their mobile and a one-time code — no password to set up.</div>
    </div>
  );
}

// ---------- STAFF ADD (live) ----------
function StaffAdd({ subjects, classes, onCreated }: {
  subjects: AdminSubject[] | null; classes: AdminKlass[] | null; onCreated: () => void | Promise<void>;
}) {
  const [sent, setSent] = useState(false);
  const [addedName, setAddedName] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  // Subjects the teacher teaches (subject ids), then which of those in which class.
  const [selSubjects, setSelSubjects] = useState<number[]>([]);
  const [teach, setTeach] = useState<Record<number, number[]>>({});
  const [ctId, setCtId] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneDigits = phone.replace(/\D/g, '');
  const ready = name.trim().length > 0 && phoneDigits.length === 10 && !submitting;
  const subjName = (id: number) => subjects?.find((s) => s.id === id)?.name ?? '';
  const teachKlassIds = Object.keys(teach).map(Number);

  function toggleSubject(id: number) {
    const removing = selSubjects.includes(id);
    setSelSubjects((v) => (removing ? v.filter((x) => x !== id) : [...v, id]));
    if (removing) {
      // Drop the de-selected subject from every per-class selection too.
      setTeach((t) => {
        const n: Record<number, number[]> = {};
        for (const k of Object.keys(t).map(Number)) n[k] = (t[k] || []).filter((s) => s !== id);
        return n;
      });
    }
  }
  function toggleClassTeach(klassId: number) {
    setTeach((t) => {
      if (klassId in t) { const n = { ...t }; delete n[klassId]; if (ctId === klassId) setCtId(''); return n; }
      return { ...t, [klassId]: [...selSubjects] };
    });
  }
  function toggleClassSubj(klassId: number, subjectId: number) {
    setTeach((t) => {
      const cur = (t[klassId] || []).slice();
      const i = cur.indexOf(subjectId);
      if (i >= 0) cur.splice(i, 1); else cur.push(subjectId);
      return { ...t, [klassId]: cur };
    });
  }

  async function send() {
    if (!ready) return;
    setSubmitting(true);
    setError(null);
    const assignments = teachKlassIds
      .map((klassId) => ({ klassId, subjectIds: (teach[klassId] || []).filter((s) => selSubjects.includes(s)) }))
      .filter((a) => a.subjectIds.length > 0);
    const classTeacherOf = ctId !== '' && ctId in teach ? ctId : null;
    try {
      await createTeacher({ name: name.trim(), phone: phoneDigits, assignments, classTeacherOf });
      setAddedName(name.trim());
      setSent(true);
    } catch (e) {
      setError((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? "Couldn't add the teacher. Please try again.");
      setSubmitting(false);
    }
  }

  if (sent) return <SuccessScreen title="Teacher added" body={`${addedName} can now sign in with their mobile and a one-time code. Their classes and subjects are saved to their profile.`} buttonLabel="Back to staff" onButton={onCreated} />;

  return (
    <div className="px-[15px] py-4 pb-6">
      <Field label="Full name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya Sharma" className={inputCls} /></Field>
      <Field label="Mobile number · their login">
        <div className="flex items-center bg-white border-[1.5px] border-line rounded-xl overflow-hidden">
          <span className="px-3 text-[13px] font-semibold border-r border-line h-11 flex items-center">+91</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" placeholder="Teacher's mobile" className="flex-1 min-w-0 border-none px-3 h-11 text-[13px] bg-transparent" />
        </div>
      </Field>

      <Field label="Subjects · pick all they teach">
        {subjects === null ? (
          <div className="py-3"><Spinner /></div>
        ) : subjects.length === 0 ? (
          <div className="text-[12px] text-[#8a6d1f] bg-[#fbf3e2] border border-[#ecd8ab] rounded-[11px] px-3 py-2.5">No subjects yet — add your school's subjects from Classes → Add first.</div>
        ) : (
          <div className="flex gap-1.5 flex-wrap">
            {subjects.map((s) => <Chip key={s.id} active={selSubjects.includes(s.id)} onClick={() => toggleSubject(s.id)}>{s.name}</Chip>)}
          </div>
        )}
      </Field>

      <Field label="Classes & subjects · which subjects in which class">
        {classes === null ? (
          <div className="py-3"><Spinner /></div>
        ) : selSubjects.length === 0 ? (
          <div className="text-[12px] text-[#8a6d1f] bg-[#fbf3e2] border border-[#ecd8ab] rounded-[11px] px-3 py-2.5">Pick the subjects above first, then choose which classes they teach them in.</div>
        ) : classes.length === 0 ? (
          <div className="text-[12px] text-[#8a6d1f] bg-[#fbf3e2] border border-[#ecd8ab] rounded-[11px] px-3 py-2.5">No classes yet — create a class from Classes → Add first.</div>
        ) : (
          classes.map((c) => {
            const sel = c.id in teach;
            return (
              <div key={c.id} className={cx('border-[1.5px] rounded-[13px] p-3 mb-2', sel ? 'border-green bg-[#f3f8f4]' : 'border-line bg-white')}>
                <div onClick={() => toggleClassTeach(c.id)} className="flex items-center gap-2.5 cursor-pointer">
                  <span className={cx('w-5 h-5 rounded-md flex-none grid place-items-center border-[1.5px]', sel ? 'border-green bg-green text-white' : 'border-[#cdd5cc] bg-white')}>{sel && <Glyph d={GLYPH.check} size={13} stroke={3} />}</span>
                  <b className="text-[13px] font-bold flex-1">{c.label}</b>
                </div>
                {sel && (
                  <div className="flex gap-1.5 flex-wrap mt-2.5 pl-7">
                    {selSubjects.map((su) => {
                      const on = (teach[c.id] || []).includes(su);
                      return <button key={su} onClick={() => toggleClassSubj(c.id, su)} className={cx('px-2.5 py-1 rounded-lg text-[11px] font-semibold border', on ? 'border-green bg-green text-white' : 'border-[#dbe5db] bg-white text-green')}>{subjName(su)}</button>;
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </Field>

      {teachKlassIds.length > 0 && (
        <Field label="Class teacher of">
          <div className="flex gap-1.5 flex-wrap">
            <Chip active={ctId === ''} onClick={() => setCtId('')}>Not a class teacher</Chip>
            {teachKlassIds.map((id) => <Chip key={id} active={ctId === id} onClick={() => setCtId(id)}>{classes?.find((c) => c.id === id)?.label ?? id}</Chip>)}
          </div>
          <div className="text-[11px] text-muted leading-[1.5] mt-2">A teacher can lead one class as its class teacher — or none, and still teach several classes.</div>
        </Field>
      )}

      {error && <div className="text-[12px] text-danger bg-[#f6ecec] border border-[#eccfcf] rounded-[11px] px-3 py-2.5 mb-3">{error}</div>}
      <PrimaryButton disabled={!ready} onClick={send}>{submitting ? 'Adding…' : 'Add teacher'}</PrimaryButton>
      <div className="flex gap-2 items-start mt-2.75">
        <span className="flex-none mt-px text-muted"><Glyph d={GLYPH.info} size={14} stroke={1.9} /></span>
        <div className="text-[11px] text-muted leading-[1.5]">They sign in with this mobile and a one-time code — no password, nothing to set up.</div>
      </div>
    </div>
  );
}

// ---------- CLASSES LIST (live) ----------
function ClassesList({ classes, subjects, loading, error, onRetry, onAdd }: { classes: AdminKlass[] | null; subjects: AdminSubject[] | null; loading: boolean; error: string | null; onRetry: () => void; onAdd: () => void }) {
  return (
    <div className="px-[15px] py-4 pb-6">
      <button onClick={onAdd} className="w-full mb-3.5 py-3 rounded-[14px] bg-green text-white font-semibold text-[13px] flex items-center justify-center gap-[7px]"><Glyph d={GLYPH.plus} size={17} stroke={2} />Add class or subject</button>

      {loading && classes === null && <div className="py-10"><Spinner /></div>}

      {error && classes === null && !loading && (
        <Card className="p-5 text-center">
          <div className="text-[12.5px] text-danger mb-3">{error}</div>
          <button onClick={onRetry} className="px-4 py-2 rounded-[11px] bg-green text-white font-semibold text-[12.5px]">Retry</button>
        </Card>
      )}

      {classes !== null && (
        <>
          <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">{classes.length} {classes.length === 1 ? 'class' : 'classes'}</div>
          {classes.length === 0 ? (
            <EmptyState icon={GLYPH.classes} title="No classes yet">Add your first class with a grade and section.</EmptyState>
          ) : (
            classes.map((c) => (
              <Card key={c.id} className="p-[13px] mb-2.25 flex gap-3 items-center">
                <div className="w-[42px] h-[42px] rounded-[13px] bg-mist grid place-items-center flex-none text-green"><Glyph d={GLYPH.classes} size={20} stroke={1.9} /></div>
                <div className="flex-1 min-w-0"><b className="text-[14px] font-bold block">{c.label}</b><small className="text-[11px] text-muted">{c.teacher ? 'Class teacher · ' + c.teacher : 'No class teacher yet'}</small></div>
                <span className="text-[12px] font-bold text-green bg-[#f1f5f1] rounded-[9px] px-2.5 py-1.5 flex-none">{c.students}</span>
              </Card>
            ))
          )}

          <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5 mt-5">
            {subjects === null ? 'Subjects' : `${subjects.length} ${subjects.length === 1 ? 'subject' : 'subjects'}`}
          </div>
          {subjects === null ? (
            <div className="py-4"><Spinner /></div>
          ) : subjects.length === 0 ? (
            <EmptyState icon={GLYPH.results} title="No subjects yet">Add your school's subjects from the Add screen — they'll apply across every class.</EmptyState>
          ) : (
            <div className="flex gap-1.5 flex-wrap">
              {subjects.map((s) => (
                <span key={s.id} className="text-[12px] font-semibold text-green bg-mist rounded-[10px] px-3 py-1.5 flex items-center gap-1.5">
                  <Glyph d={GLYPH.results} size={14} stroke={1.9} />{s.name}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------- CLASS DETAIL (tabbed) ----------
type ClassTab = 'students' | 'teachers' | 'subjects' | 'exams';

function ClassDetail({
  cls, teachers, teacherName, setTeachers, setClasses, classSubjects, setClassSubjects, classExams, setClassExams,
}: {
  cls: AdminClass; teachers: Teacher[]; teacherName: (id: string) => string;
  setTeachers: React.Dispatch<React.SetStateAction<Teacher[]>>;
  setClasses: React.Dispatch<React.SetStateAction<AdminClass[]>>;
  classSubjects: Record<string, string[]>;
  setClassSubjects: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  classExams: Record<string, ClassExam[]>;
  setClassExams: React.Dispatch<React.SetStateAction<Record<string, ClassExam[]>>>;
}) {
  const [tab, setTab] = useState<ClassTab>('students');
  // students
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [studEditIdx, setStudEditIdx] = useState<number | null>(null);
  const [newStudent, setNewStudent] = useState('');
  const [gName, setGName] = useState('');
  const [gPhone, setGPhone] = useState('');
  const [gRel, setGRel] = useState('Mother');
  // teachers / subjects / exams
  const [clsTAddOpen, setClsTAddOpen] = useState(false);
  const [subjAddOpen, setSubjAddOpen] = useState(false);
  const [newSubj, setNewSubj] = useState('');
  const [examAddOpen, setExamAddOpen] = useState(false);
  const [newExam, setNewExam] = useState('');

  const subjects = classSubjects[cls.id] || DEFAULT_CLASS_SUBJECTS;
  const exams = classExams[cls.id] || DEFAULT_CLASS_EXAMS;
  const teachersInClass = teachers.filter((t) => t.classes.includes(cls.id));
  const availableTeachers = teachers.filter((t) => !t.classes.includes(cls.id));
  const ready = newStudent.trim().length > 0 && gPhone.replace(/\D/g, '').length === 10;

  function switchTab(t: ClassTab) {
    setTab(t); setAddStudentOpen(false); setStudEditIdx(null); setClsTAddOpen(false); setSubjAddOpen(false); setExamAddOpen(false);
  }

  // ---- students ----
  function addStudent() {
    if (!ready) return;
    setClasses((cs) => cs.map((c) => (c.id === cls.id ? { ...c, students: [...c.students, { name: newStudent.trim(), guardian: { name: gName.trim() || 'Guardian', phone: gPhone.replace(/\D/g, ''), relation: gRel } }] } : c)));
    setNewStudent(''); setGName(''); setGPhone(''); setGRel('Mother'); setAddStudentOpen(false);
  }
  function removeStudent(idx: number) {
    setClasses((cs) => cs.map((c) => (c.id === cls.id ? { ...c, students: c.students.filter((_, i) => i !== idx) } : c)));
    setStudEditIdx(null);
  }
  function setStudentField(idx: number, field: 'name' | 'gname' | 'gphone' | 'grel', val: string) {
    setClasses((cs) => cs.map((c) => {
      if (c.id !== cls.id) return c;
      const arr = c.students.slice();
      const e = { ...arr[idx] };
      if (field === 'name') e.name = val;
      else {
        const g = { name: '', phone: '', relation: 'Mother', ...(e.guardian || {}) };
        if (field === 'gname') g.name = val;
        if (field === 'gphone') g.phone = val.replace(/\D/g, '').slice(0, 10);
        if (field === 'grel') g.relation = val;
        e.guardian = g;
      }
      arr[idx] = e;
      return { ...c, students: arr };
    }));
  }

  // ---- teachers ----
  function addTeacherToClass(tid: string) {
    setTeachers((ts) => ts.map((t) => {
      if (t.id !== tid || t.classes.includes(cls.id)) return t;
      const teach = { ...teachOf(t) }; teach[cls.id] = subjects.slice(0, 1);
      return { ...t, classes: [...t.classes, cls.id], teach };
    }));
    setClsTAddOpen(false);
  }
  function removeTeacherFromClass(tid: string) {
    setTeachers((ts) => ts.map((t) => { if (t.id !== tid) return t; const teach = { ...teachOf(t) }; delete teach[cls.id]; return { ...t, classes: t.classes.filter((c) => c !== cls.id), ct: t.ct === cls.id ? '' : t.ct, teach }; }));
    setClasses((cs) => cs.map((c) => (c.id === cls.id && c.ctId === tid ? { ...c, ctId: '' } : c)));
  }
  function setClassCt(tid: string) {
    const cur = teachers.find((t) => t.id === tid);
    const isCt = cur?.ct === cls.id;
    setTeachers((ts) => ts.map((t) => {
      if (t.id === tid) return { ...t, classes: t.classes.includes(cls.id) ? t.classes : [...t.classes, cls.id], ct: isCt ? '' : cls.id };
      return !isCt && t.ct === cls.id ? { ...t, ct: '' } : t;
    }));
    setClasses((cs) => cs.map((c) => (c.id === cls.id ? { ...c, ctId: isCt ? '' : tid } : c)));
  }
  function toggleTeachSubject(tid: string, su: string) {
    setTeachers((ts) => ts.map((t) => { if (t.id !== tid) return t; const teach = { ...teachOf(t) }; const arr = (teach[cls.id] || []).slice(); const i = arr.indexOf(su); if (i >= 0) arr.splice(i, 1); else arr.push(su); teach[cls.id] = arr; return { ...t, teach }; }));
  }

  // ---- subjects ----
  function addSubject() {
    const nm = newSubj.trim();
    if (!nm || subjects.some((s) => s.toLowerCase() === nm.toLowerCase())) { setNewSubj(''); setSubjAddOpen(false); return; }
    setClassSubjects((m) => ({ ...m, [cls.id]: [...subjects, nm] }));
    setNewSubj(''); setSubjAddOpen(false);
  }
  function removeSubject(nm: string) {
    setClassSubjects((m) => ({ ...m, [cls.id]: subjects.filter((s) => s !== nm) }));
    setTeachers((ts) => ts.map((t) => { const teach = teachOf(t); if (!(cls.id in teach)) return t; return { ...t, teach: { ...teach, [cls.id]: (teach[cls.id] || []).filter((s) => s !== nm) } }; }));
  }

  // ---- exams ----
  function addExam() {
    const nm = newExam.trim();
    if (!nm) return;
    setClassExams((m) => ({ ...m, [cls.id]: [...exams, { id: 'ex' + Date.now(), name: nm }] }));
    setNewExam(''); setExamAddOpen(false);
  }
  function removeExam(id: string) {
    setClassExams((m) => ({ ...m, [cls.id]: exams.filter((e) => e.id !== id) }));
  }

  const tabs: { key: ClassTab; label: string }[] = [
    { key: 'students', label: 'Students' }, { key: 'teachers', label: 'Teachers' },
    { key: 'subjects', label: 'Subjects' }, { key: 'exams', label: 'Exams' },
  ];

  return (
    <div className="px-[15px] py-4 pb-6">
      <Card className="p-3.5 mb-3 flex items-center gap-[11px]">
        <div className="w-[38px] h-[38px] rounded-[11px] bg-mist grid place-items-center flex-none text-green"><Glyph d={GLYPH.staff} size={19} stroke={1.9} /></div>
        <div className="flex-1"><small className="text-[9.5px] tracking-[0.1em] uppercase text-muted font-semibold block">Class teacher</small>
          {cls.ctId ? <b className="text-[13.5px] font-bold">{teacherName(cls.ctId)}</b> : <span className="text-[12px] text-[#8a6d1f] font-semibold">Not set — pick one in Teachers</span>}
        </div>
      </Card>

      <div className="flex gap-[3px] bg-[#eef1ec] rounded-[13px] p-1 mb-3.5">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => switchTab(t.key)} className={cx('flex-1 py-2.25 rounded-[10px] text-[12px] font-bold', tab === t.key ? 'bg-green text-white' : 'text-muted')}>{t.label}</button>
        ))}
      </div>

      {tab === 'students' && (
        <>
          {addStudentOpen ? (
            <Card className="p-3.5 mb-3.5">
              <div className="flex items-center mb-2.5">
                <div className="flex-1 text-[10px] tracking-[0.13em] uppercase font-semibold text-muted">Add a student</div>
                <button onClick={() => setAddStudentOpen(false)} className="w-[26px] h-[26px] rounded-lg border border-line bg-white text-muted text-[15px] font-bold flex-none">×</button>
              </div>
              <input value={newStudent} onChange={(e) => setNewStudent(e.target.value)} placeholder="Student's full name" className={cx(inputCls, 'mb-2.25')} />
              <input value={gName} onChange={(e) => setGName(e.target.value)} placeholder="Guardian's name" className={cx(inputCls, 'mb-2.25')} />
              <div className="flex items-center bg-white border-[1.5px] border-line rounded-[11px] overflow-hidden mb-2.25">
                <span className="px-[11px] text-[13px] font-semibold border-r border-line h-[42px] flex items-center">+91</span>
                <input value={gPhone} onChange={(e) => setGPhone(e.target.value)} inputMode="numeric" placeholder="Guardian mobile (for login)" className="flex-1 min-w-0 border-none px-3 h-[42px] text-[13px] bg-transparent" />
              </div>
              <div className="flex gap-1.5 mb-3">
                {['Mother', 'Father', 'Guardian'].map((r) => <Chip key={r} active={gRel === r} onClick={() => setGRel(r)} className="flex-1 text-center py-2">{r}</Chip>)}
              </div>
              <button onClick={addStudent} disabled={!ready} className={cx('w-full py-3 rounded-xl font-bold text-[13.5px]', ready ? 'bg-green text-white' : 'bg-[#dfe5df] text-[#9aa39b]')}>Add student</button>
            </Card>
          ) : (
            <button onClick={() => setAddStudentOpen(true)} className="w-full mb-3.5 py-3.5 rounded-[14px] bg-green text-white font-bold text-[14px] flex items-center justify-center gap-2"><Glyph d={GLYPH.plus} size={18} stroke={2.2} />Add student</button>
          )}
          <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">{cls.students.length} students</div>
          {cls.students.map((s, i) => {
            const g = s.guardian;
            const editing = studEditIdx === i;
            return (
              <Card key={i} className="p-3 mb-2 rounded-[14px]">
                {editing ? (
                  <div>
                    <div className="text-[9.5px] tracking-[0.1em] uppercase font-semibold text-[#9aa39b] mb-1.5">Editing #{('0' + (i + 1)).slice(-2)}</div>
                    <input value={s.name} onChange={(e) => setStudentField(i, 'name', e.target.value)} placeholder="Student's full name" className={cx(inputCls, 'mb-2', 'rounded-[10px]')} />
                    <input value={g?.name || ''} onChange={(e) => setStudentField(i, 'gname', e.target.value)} placeholder="Guardian's name" className={cx(inputCls, 'mb-2', 'rounded-[10px]')} />
                    <div className="flex items-center bg-white border-[1.5px] border-line rounded-[10px] overflow-hidden mb-2">
                      <span className="px-2.5 text-[12.5px] font-semibold border-r border-line h-10 flex items-center">+91</span>
                      <input value={g?.phone || ''} onChange={(e) => setStudentField(i, 'gphone', e.target.value)} inputMode="numeric" placeholder="Guardian mobile (login)" className="flex-1 min-w-0 border-none px-2.5 h-10 text-[13px] bg-transparent" />
                    </div>
                    <div className="flex gap-1.5 mb-2.5">
                      {['Mother', 'Father', 'Guardian'].map((rel) => <Chip key={rel} active={(g?.relation || 'Mother') === rel} onClick={() => setStudentField(i, 'grel', rel)} className="flex-1 text-center py-1.5">{rel}</Chip>)}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setStudEditIdx(null)} className="flex-1 py-2.75 rounded-[11px] bg-green text-white font-bold text-[13px]">Done</button>
                      <button onClick={() => removeStudent(i)} className="px-4 rounded-[11px] bg-[#f6ecec] text-danger font-bold text-[13px]">Remove</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-[11px] items-center">
                    <span className="w-[26px] h-[26px] rounded-lg bg-[#f1f5f1] text-muted text-[11px] font-bold grid place-items-center flex-none">{('0' + (i + 1)).slice(-2)}</span>
                    <div className="flex-1 min-w-0"><b className="text-[13.5px] font-semibold block">{s.name}</b>
                      {g ? <small className="text-[10.5px] text-muted">{g.relation} · {g.name} · {maskPhone(g.phone)}</small> : <small className="text-[10.5px] text-[#a9761b] font-semibold">No guardian phone — can't log in yet</small>}
                    </div>
                    <button onClick={() => setStudEditIdx(i)} className="w-7 h-7 rounded-[9px] border border-[#dbe5db] bg-white text-green grid place-items-center flex-none" aria-label="Edit"><Glyph d={GLYPH.edit} size={14} stroke={2} /></button>
                    <button onClick={() => removeStudent(i)} className="w-7 h-7 rounded-[9px] bg-[#f6ecec] text-danger text-[16px] font-bold flex-none">×</button>
                  </div>
                )}
              </Card>
            );
          })}
          {cls.students.length === 0 && <div className="text-center text-muted text-[12.5px] py-5">No students yet. Add the first one above.</div>}
        </>
      )}

      {tab === 'teachers' && (
        <>
          {clsTAddOpen ? (
            <Card className="p-3 mb-3.5">
              <div className="flex items-center mb-2.5">
                <div className="flex-1 text-[10px] tracking-[0.13em] uppercase font-semibold text-muted">Pick a teacher</div>
                <button onClick={() => setClsTAddOpen(false)} className="w-[26px] h-[26px] rounded-lg border border-line bg-white text-muted text-[15px] font-bold flex-none">×</button>
              </div>
              {availableTeachers.length === 0 ? <div className="text-[12.5px] text-muted px-0.5 py-1">Every teacher is already in this class.</div> : availableTeachers.map((t) => (
                <button key={t.id} onClick={() => addTeacherToClass(t.id)} className="w-full text-left flex items-center gap-2 px-[11px] py-2.5 border-[1.5px] border-line rounded-[11px] bg-white mb-1.75 text-[12.5px] font-semibold text-ink">
                  <Glyph d={GLYPH.plus} size={15} stroke={2} />{t.name} · {subjectsOf(t).join(', ')}
                </button>
              ))}
            </Card>
          ) : (
            <button onClick={() => setClsTAddOpen(true)} className="w-full mb-3.5 py-3.5 rounded-[14px] bg-green text-white font-bold text-[14px] flex items-center justify-center gap-2"><Glyph d={GLYPH.plus} size={18} stroke={2.2} />Add teacher to class</button>
          )}
          {teachersInClass.length === 0 && <div className="text-center text-muted text-[12.5px] py-4">No teachers in this class yet.</div>}
          {teachersInClass.map((t) => {
            const subs = teachOf(t)[cls.id] || [];
            const isCt = cls.ctId === t.id;
            return (
              <Card key={t.id} className="p-3 mb-2.25">
                <div className="flex items-center gap-2.5 mb-2.25">
                  <b className="flex-1 min-w-0 text-[13.5px] font-bold">{t.name}</b>
                  <button onClick={() => setClassCt(t.id)} className={cx('px-2.5 py-1.5 rounded-[9px] text-[10.5px] font-bold border-[1.5px] flex-none', isCt ? 'border-green bg-green text-white' : 'border-[#dbe5db] bg-white text-green')}>{isCt ? 'Class teacher ✓' : 'Make CT'}</button>
                  <button onClick={() => removeTeacherFromClass(t.id)} className="w-7 h-7 rounded-[9px] bg-[#f6ecec] text-danger text-[16px] font-bold flex-none">×</button>
                </div>
                <div className="text-[9.5px] tracking-[0.1em] uppercase font-semibold text-[#9aa39b] mb-1.5">Subjects taught here</div>
                <div className="flex gap-1.5 flex-wrap">
                  {subjects.map((su) => {
                    const on = subs.includes(su);
                    return <button key={su} onClick={() => toggleTeachSubject(t.id, su)} className={cx('px-2.5 py-1 rounded-lg text-[10.5px] font-semibold border', on ? 'border-green bg-green text-white' : 'border-[#dbe5db] bg-white text-green')}>{su}</button>;
                  })}
                </div>
                {subs.length === 0 && <div className="text-[10.5px] text-[#a9761b] font-semibold mt-1.5">No subject set for this teacher.</div>}
              </Card>
            );
          })}
        </>
      )}

      {tab === 'subjects' && (
        <>
          {subjAddOpen ? (
            <Card className="p-3 mb-3.5">
              <div className="flex items-center mb-2.5">
                <div className="flex-1 text-[10px] tracking-[0.13em] uppercase font-semibold text-muted">New subject</div>
                <button onClick={() => { setSubjAddOpen(false); setNewSubj(''); }} className="w-[26px] h-[26px] rounded-lg border border-line bg-white text-muted text-[15px] font-bold flex-none">×</button>
              </div>
              <div className="flex gap-2">
                <input value={newSubj} onChange={(e) => setNewSubj(e.target.value)} placeholder="e.g. French" className="flex-1 min-w-0 border-[1.5px] border-line rounded-[11px] px-3 py-2.5 text-[13px] bg-white" />
                <button onClick={addSubject} disabled={!newSubj.trim()} className={cx('flex-none px-4 rounded-[11px] font-bold text-[13px]', newSubj.trim() ? 'bg-green text-white' : 'bg-[#dfe5df] text-[#9aa39b]')}>Add</button>
              </div>
            </Card>
          ) : (
            <button onClick={() => setSubjAddOpen(true)} className="w-full mb-3.5 py-3.5 rounded-[14px] bg-green text-white font-bold text-[14px] flex items-center justify-center gap-2"><Glyph d={GLYPH.plus} size={18} stroke={2.2} />Add subject</button>
          )}
          <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">{subjects.length} subjects in {cls.label}</div>
          {subjects.map((nm) => (
            <Card key={nm} className="p-3 mb-2 rounded-[13px] flex gap-[11px] items-center">
              <div className="w-8 h-8 rounded-[9px] bg-mist grid place-items-center flex-none text-green"><Glyph d={GLYPH.diary} size={16} stroke={1.9} /></div>
              <b className="flex-1 min-w-0 text-[13.5px] font-semibold">{nm}</b>
              <button onClick={() => removeSubject(nm)} className="w-7 h-7 rounded-[9px] bg-[#f6ecec] text-danger text-[16px] font-bold flex-none">×</button>
            </Card>
          ))}
        </>
      )}

      {tab === 'exams' && (
        <>
          {examAddOpen ? (
            <Card className="p-3 mb-3.5">
              <div className="flex items-center mb-2.5">
                <div className="flex-1 text-[10px] tracking-[0.13em] uppercase font-semibold text-muted">New examination</div>
                <button onClick={() => { setExamAddOpen(false); setNewExam(''); }} className="w-[26px] h-[26px] rounded-lg border border-line bg-white text-muted text-[15px] font-bold flex-none">×</button>
              </div>
              <div className="flex gap-2">
                <input value={newExam} onChange={(e) => setNewExam(e.target.value)} placeholder="e.g. Annual Exam" className="flex-1 min-w-0 border-[1.5px] border-line rounded-[11px] px-3 py-2.5 text-[13px] bg-white" />
                <button onClick={addExam} disabled={!newExam.trim()} className={cx('flex-none px-4 rounded-[11px] font-bold text-[13px]', newExam.trim() ? 'bg-green text-white' : 'bg-[#dfe5df] text-[#9aa39b]')}>Add</button>
              </div>
            </Card>
          ) : (
            <button onClick={() => setExamAddOpen(true)} className="w-full mb-3.5 py-3.5 rounded-[14px] bg-green text-white font-bold text-[14px] flex items-center justify-center gap-2"><Glyph d={GLYPH.plus} size={18} stroke={2.2} />Add examination</button>
          )}
          <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">{exams.length} examinations in {cls.label}</div>
          {exams.map((e) => (
            <Card key={e.id} className="p-3 mb-2 rounded-[13px] flex gap-[11px] items-center">
              <div className="w-8 h-8 rounded-[9px] bg-mist grid place-items-center flex-none text-green"><Glyph d={GLYPH.results} size={16} stroke={1.9} /></div>
              <b className="flex-1 min-w-0 text-[13.5px] font-semibold">{e.name}</b>
              <button onClick={() => removeExam(e.id)} className="w-7 h-7 rounded-[9px] bg-[#f6ecec] text-danger text-[16px] font-bold flex-none">×</button>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

// ---------- ADMIN ATTENDANCE (all classes) ----------
type ClassAtt = { id: string; label: string; roster: { name: string; roll: string; present: boolean }[]; present: number; absent: number; total: number; pct: number };

function AdminAttendance({ classAtt, schoolPct, schoolPresent, onOpen }: { classAtt: ClassAtt[]; schoolPct: number; schoolPresent: number; onOpen: (id: string) => void }) {
  const barColor = (p: number) => (p >= 90 ? '#1f8a5b' : p >= 80 ? '#c2882a' : '#c0392b');
  return (
    <div className="px-[15px] py-4 pb-6">
      <div className="bg-green text-white rounded-[20px] p-4 mb-3.5 flex items-center gap-3.5">
        <div className="font-serif text-[36px] leading-none">{schoolPct}<span className="text-[16px]">%</span></div>
        <div className="flex-1"><b className="text-[14px] font-bold block">Present today</b><small className="text-[#cfe0d6] text-[11.5px]">{schoolPresent} students across the school · 25 Jun</small></div>
      </div>
      <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">By class</div>
      {classAtt.map((c) => (
        <Card key={c.id} onClick={() => onOpen(c.id)} className="p-[13px] mb-2.25 rounded-[16px]">
          <div className="flex items-center gap-2.5 mb-2.25">
            <b className="flex-1 min-w-0 text-[13.5px] font-bold">{c.label}</b>
            <small className="text-[11px] text-muted">{c.present} / {c.total} present</small>
            <span className="text-[13px] font-bold flex-none" style={{ color: barColor(c.pct) }}>{c.pct}%</span>
            <span className="text-[#c3ccc5] flex-none"><Glyph d={GLYPH.chevronRight} size={16} stroke={2.2} /></span>
          </div>
          <div className="h-1.5 rounded-[3px] bg-[#eef1ec]"><div className="h-1.5 rounded-[3px]" style={{ width: `${c.pct}%`, background: barColor(c.pct) }} /></div>
        </Card>
      ))}
    </div>
  );
}

// ---------- ADMIN ATTENDANCE (one class) ----------
function AdminAttendanceClass({ att }: { att: ClassAtt }) {
  return (
    <div className="px-[15px] py-4 pb-6">
      <div className="flex gap-2.5 mb-3.5">
        <div className="flex-1 bg-[#eaf4ee] border border-[#cfe3d6] rounded-2xl p-[13px] text-center"><div className="font-serif text-[26px] leading-none text-success">{att.present}</div><small className="text-[10px] uppercase text-muted font-semibold">Present</small></div>
        <div className="flex-1 bg-[#f6ecec] border border-[#eccfcf] rounded-2xl p-[13px] text-center"><div className="font-serif text-[26px] leading-none text-danger">{att.absent}</div><small className="text-[10px] uppercase text-muted font-semibold">Absent</small></div>
        <div className="flex-1 bg-cloud border border-line rounded-2xl p-[13px] text-center"><div className="font-serif text-[26px] leading-none text-green">{att.pct}%</div><small className="text-[10px] uppercase text-muted font-semibold">Rate</small></div>
      </div>
      <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">{att.total} students</div>
      {att.roster.map((r, i) => (
        <Card key={i} className="p-3 mb-2 rounded-[13px] flex gap-[11px] items-center">
          <span className="w-[26px] h-[26px] rounded-lg bg-[#f1f5f1] text-muted text-[11px] font-bold grid place-items-center flex-none">{r.roll}</span>
          <b className="flex-1 min-w-0 text-[13.5px] font-semibold">{r.name}</b>
          <span className={cx('text-[10.5px] font-bold px-2.5 py-1 rounded-lg flex-none', r.present ? 'bg-[#eaf4ee] text-success' : 'bg-[#f6ecec] text-danger')}>{r.present ? 'Present' : 'Absent'}</span>
        </Card>
      ))}
    </div>
  );
}

// ---------- CLASS ADD (live) ----------
function ClassAdd({ teachers, onCreated }: { teachers: AdminTeacher[]; onCreated: () => void | Promise<void> }) {
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  // '' = "Assign later" (the default). Otherwise the selected teacher's id.
  const [ct, setCt] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = grade.trim().length > 0 && section.trim().length > 0 && !submitting;

  async function create() {
    if (!ready) return;
    setSubmitting(true);
    setError(null);
    try {
      await createClass({
        grade: grade.trim(),
        section: section.trim().toUpperCase(),
        classTeacherId: ct === '' ? null : ct,
      });
      await onCreated();
    } catch (e) {
      const status = (e as { response?: { status?: number; data?: { error?: string } } }).response;
      setError(status?.data?.error ?? "Couldn't create the class. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex gap-2.5 mb-3.5">
        <Field label="Grade" className="flex-1"><input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. 5" className={inputCls} /></Field>
        <Field label="Section" className="flex-1"><input value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. C" className={inputCls} /></Field>
      </div>
      <Field label="Class teacher · optional">
        <div className="flex gap-1.5 flex-wrap">
          <Chip active={ct === ''} onClick={() => setCt('')}>Assign later</Chip>
          {teachers.map((t) => <Chip key={t.id} active={ct === t.id} onClick={() => setCt(t.id)}>{t.name}</Chip>)}
        </div>
        {teachers.length === 0 && <div className="text-[11.5px] text-muted mt-2">No teachers yet — you can add them later and assign a class teacher then.</div>}
      </Field>
      {error && <div className="text-[12px] text-danger bg-[#f6ecec] border border-[#eccfcf] rounded-[11px] px-3 py-2.5 mb-3">{error}</div>}
      <PrimaryButton disabled={!ready} onClick={create}>{submitting ? 'Creating…' : 'Create class'}</PrimaryButton>
      <div className="text-center text-[11px] text-muted leading-[1.5] mt-3">The class teacher can also be set or changed later from any teacher's profile.</div>
    </>
  );
}

// ---------- CLASS / SUBJECT ADD (chip-switched) ----------
function ClassOrSubjectAdd({
  teachers, onClassCreated, subjects, onSubjectsChanged,
}: {
  teachers: AdminTeacher[];
  onClassCreated: () => void | Promise<void>;
  subjects: AdminSubject[] | null;
  onSubjectsChanged: () => void | Promise<void>;
}) {
  const [mode, setMode] = useState<'class' | 'subject'>('class');
  return (
    <div className="px-[15px] py-4 pb-6">
      <div className="flex gap-1.5 mb-4">
        <Chip active={mode === 'class'} onClick={() => setMode('class')}>Class</Chip>
        <Chip active={mode === 'subject'} onClick={() => setMode('subject')}>Subject</Chip>
      </div>
      {mode === 'class'
        ? <ClassAdd teachers={teachers} onCreated={onClassCreated} />
        : <SubjectManager subjects={subjects} onChanged={onSubjectsChanged} />}
    </div>
  );
}

// ---------- SUBJECT MANAGER (school-level CRUD) ----------
function SubjectManager({ subjects, onChanged }: { subjects: AdminSubject[] | null; onChanged: () => void | Promise<void> }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  function readErr(e: unknown, fallback: string) {
    return (e as { response?: { data?: { error?: string } } }).response?.data?.error ?? fallback;
  }

  async function add() {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true); setError(null);
    try {
      await createSubject(n);
      setName('');
      await onChanged();
    } catch (e) { setError(readErr(e, "Couldn't add the subject. Please try again.")); }
    finally { setBusy(false); }
  }

  async function saveEdit(id: number) {
    const n = editName.trim();
    if (!n || busy) return;
    setBusy(true); setError(null);
    try {
      await updateSubject(id, n);
      setEditId(null);
      await onChanged();
    } catch (e) { setError(readErr(e, "Couldn't rename the subject. Please try again.")); }
    finally { setBusy(false); }
  }

  async function remove(id: number) {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await deleteSubject(id);
      await onChanged();
    } catch (e) { setError(readErr(e, "Couldn't delete the subject. Please try again.")); }
    finally { setBusy(false); }
  }

  return (
    <>
      <Field label="Subject name">
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} placeholder="e.g. Mathematics" className={inputCls} />
          <button onClick={add} disabled={!name.trim() || busy} className="px-4 rounded-xl bg-green text-white font-semibold text-[13px] flex items-center gap-1.5 disabled:opacity-50 flex-none"><Glyph d={GLYPH.plus} size={16} stroke={2} />Add</button>
        </div>
      </Field>
      {error && <div className="text-[12px] text-danger bg-[#f6ecec] border border-[#eccfcf] rounded-[11px] px-3 py-2.5 mb-3">{error}</div>}

      {subjects === null ? (
        <div className="py-8"><Spinner /></div>
      ) : (
        <>
          <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">{subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'}</div>
          {subjects.length === 0 ? (
            <EmptyState icon={GLYPH.results} title="No subjects yet">Add your school's subjects here — they'll be available across every class.</EmptyState>
          ) : (
            subjects.map((s) => (
              <Card key={s.id} className="p-[13px] mb-2.25 flex gap-3 items-center">
                <div className="w-[42px] h-[42px] rounded-[13px] bg-mist grid place-items-center flex-none text-green"><Glyph d={GLYPH.results} size={20} stroke={1.9} /></div>
                {editId === s.id ? (
                  <>
                    <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(s.id); if (e.key === 'Escape') setEditId(null); }} className={cx(inputCls, 'flex-1 min-w-0')} />
                    <button onClick={() => saveEdit(s.id)} disabled={busy} className="text-green flex-none" aria-label="Save"><Glyph d={GLYPH.check} size={20} stroke={2} /></button>
                    <button onClick={() => setEditId(null)} className="text-muted flex-none text-[12px] font-semibold">Cancel</button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0"><b className="text-[14px] font-bold block truncate">{s.name}</b></div>
                    <button onClick={() => { setEditId(s.id); setEditName(s.name); }} className="text-muted flex-none" aria-label="Rename"><Glyph d={GLYPH.edit} size={18} stroke={1.9} /></button>
                    <button onClick={() => remove(s.id)} disabled={busy} className="text-danger flex-none" aria-label="Delete"><Glyph d={GLYPH.trash} size={18} stroke={1.9} /></button>
                  </>
                )}
              </Card>
            ))
          )}
        </>
      )}
    </>
  );
}

// ---------- NOTICE COMPOSE ----------
function NoticeCompose({ onPublish, onDone }: { onPublish: (n: Notice) => void; onDone: () => void }) {
  const [sent, setSent] = useState(false);
  const [cat, setCat] = useState('Admin');
  const [ncTitle, setNcTitle] = useState('');
  const [ncBody, setNcBody] = useState('');
  function publish() {
    const title = ncTitle.trim() || 'School notice';
    const body = ncBody.trim() || 'Details to follow.';
    onPublish({ id: 'nc' + Date.now(), category: cat, from: 'School Office', pinned: false, date: '25 Jun', icon: 'M4 8h16M7 3v3M17 3v3M5 6h14v14H5z', title, preview: body.slice(0, 90), body, ackStat: '0 of 180 parents have acknowledged' });
    setSent(true);
  }
  if (sent) return <SuccessScreen title="Notice published" body="It's now on every parent's notice board and a push notification has been sent." buttonLabel="View notice board" onButton={onDone} />;
  return (
    <div className="px-[15px] py-4 pb-6">
      <Field label="Category">
        <div className="flex gap-1.5 flex-wrap">{NOTICE_CATEGORIES.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}</div>
      </Field>
      <Field label="Title"><input value={ncTitle} onChange={(e) => setNcTitle(e.target.value)} placeholder="e.g. Sports Day rescheduled" className={inputCls} /></Field>
      <Field label="Message to parents"><textarea value={ncBody} onChange={(e) => setNcBody(e.target.value)} placeholder="Write the notice…" className={cx(inputCls, 'resize-none h-[120px]')} /></Field>
      <PrimaryButton onClick={publish}>Publish to all parents</PrimaryButton>
    </div>
  );
}

// ---------- small form helpers ----------
const inputCls = 'w-full box-border px-3 py-[11px] border-[1.5px] border-line rounded-xl text-[13px] bg-white';
function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  const [main, hint] = label.split(' · ');
  return (
    <div className={cx('mb-3.5', className)}>
      <label className="block text-[12px] font-semibold mb-[7px]">{main}{hint && <span className="text-muted font-medium"> · {hint}</span>}</label>
      {children}
    </div>
  );
}
