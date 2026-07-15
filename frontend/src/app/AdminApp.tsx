import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  AppHeader, Card, Chip, Glyph, PrimaryButton, Shell, SuccessScreen, cx, type TabDef,
} from './kit';
import {
  CalendarScreen, NoticeBoardScreen, NoticeDetailScreen, NotificationsScreen,
} from './SharedScreens';
import { AccountSheet } from './AccountSheet';
import {
  SCHOOL, GLYPH, NOTICES, ADMIN_ACTIVITY, ALL_SUBJECTS, NOTICE_CATEGORIES,
  TEACHERS, ADMIN_CLASSES, subjectsOf, teachOf, initialsOf, maskPhone,
  type Teacher, type AdminClass, type Notice,
} from './data';

type Screen =
  | 'home' | 'staff' | 'staffDetail' | 'staffAdd' | 'classes' | 'classDetail' | 'classAdd'
  | 'noticeBoard' | 'notice' | 'noticeCompose' | 'calendar' | 'notifs';

export function AdminApp() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [screen, setScreen] = useState<Screen>('home');
  const [acctOpen, setAcctOpen] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>(() => JSON.parse(JSON.stringify(TEACHERS)));
  const [classes, setClasses] = useState<AdminClass[]>(() => JSON.parse(JSON.stringify(ADMIN_CLASSES)));
  const [notices, setNotices] = useState<Notice[]>(NOTICES);
  const [activeTeacherId, setActiveTeacherId] = useState('rao');
  const [activeClassId, setActiveClassId] = useState('5-B');
  const [activeNoticeId, setActiveNoticeId] = useState('ptm');

  const name = user?.name ?? 'Sridevi Menon';
  const teacherName = (id: string) => teachers.find((t) => t.id === id)?.name ?? '';
  const activeClass = classes.find((c) => c.id === activeClassId) || classes[0];
  const activeTeacher = teachers.find((t) => t.id === activeTeacherId) || teachers[0];

  function go(s: Screen) {
    setScreen(s);
  }

  // header
  let title = 'Greenwood';
  let sub: string | undefined = `${name.toUpperCase()} · ADMIN`;
  const M: Record<string, [string, string]> = {
    staff: ['Staff', 'MANAGE TEACHERS'],
    staffAdd: ['Add Teacher', 'SEND AN INVITE'],
    classes: ['Classes', 'ALL CLASSES'],
    classAdd: ['New Class', 'ADD A CLASS'],
    noticeBoard: ['Notice Board', SCHOOL.toUpperCase()],
    noticeCompose: ['New Notice', 'TO ALL PARENTS'],
    calendar: ['Calendar', SCHOOL.toUpperCase()],
    notifs: ['Notifications', SCHOOL.toUpperCase()],
  };
  if (M[screen]) { [title, sub] = M[screen]; }
  else if (screen === 'staffDetail') { title = 'Teacher'; sub = (subjectsOf(activeTeacher)[0] || 'STAFF').toUpperCase(); }
  else if (screen === 'classDetail') { title = activeClass.label; sub = activeClass.ctId ? `CLASS TEACHER · ${teacherName(activeClass.ctId).toUpperCase()}` : 'NO CLASS TEACHER'; }
  else if (screen === 'notice') { title = 'Notice'; sub = (notices.find((n) => n.id === activeNoticeId)?.from ?? '').toUpperCase(); }

  const TOP: Screen[] = ['home', 'staff', 'classes', 'noticeBoard', 'calendar'];
  const topLevel = TOP.includes(screen);
  const backTo: Record<string, Screen> = {
    staffDetail: 'staff', staffAdd: 'staff', classDetail: 'classes', classAdd: 'classes',
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

  // ---- teacher/class mutations ----
  function makeCt(cid: string) {
    const tid = activeTeacherId;
    const isCt = activeTeacher.ct === cid;
    setTeachers((ts) => ts.map((t) => {
      if (t.id === tid) return { ...t, classes: t.classes.includes(cid) ? t.classes : [...t.classes, cid], ct: isCt ? '' : cid };
      return !isCt && t.ct === cid ? { ...t, ct: '' } : t;
    }));
    setClasses((cs) => cs.map((c) => (c.id === cid ? { ...c, ctId: isCt ? '' : tid } : c)));
  }
  function unassign(cid: string) {
    const tid = activeTeacherId;
    setTeachers((ts) => ts.map((t) => (t.id === tid ? { ...t, classes: t.classes.filter((c) => c !== cid), ct: t.ct === cid ? '' : t.ct } : t)));
    setClasses((cs) => cs.map((c) => (c.id === cid && c.ctId === tid ? { ...c, ctId: '' } : c)));
  }
  function assign(cid: string) {
    const tid = activeTeacherId;
    setTeachers((ts) => ts.map((t) => (t.id === tid && !t.classes.includes(cid) ? { ...t, classes: [...t.classes, cid] } : t)));
  }
  function toggleStatus() {
    setTeachers((ts) => ts.map((t) => (t.id === activeTeacherId ? { ...t, status: t.status === 'active' ? 'inactive' : 'active' } : t)));
  }

  return (
    <Shell
      header={<AppHeader title={title} sub={sub} onBack={onBack} onAccount={() => setAcctOpen(true)} onBell={() => go('notifs')} />}
      tabs={tabs}
      overlays={<AccountSheet open={acctOpen} onClose={() => setAcctOpen(false)} name={name} phone={user?.phone ?? '9800011122'} roleLabel="Admin" onSignOut={() => { logout(); navigate('/login'); }} />}
    >
      {screen === 'home' && <AdminHome name={name} teachers={teachers} classes={classes} go={go} />}
      {screen === 'staff' && <StaffList teachers={teachers} onAdd={() => go('staffAdd')} onOpen={(id) => { setActiveTeacherId(id); go('staffDetail'); }} />}
      {screen === 'staffDetail' && <StaffDetail teacher={activeTeacher} classes={classes} teacherName={teacherName} onMakeCt={makeCt} onUnassign={unassign} onAssign={assign} onToggleStatus={toggleStatus} />}
      {screen === 'staffAdd' && <StaffAdd classes={classes} onSent={(t) => { setTeachers((ts) => [...ts, t]); }} onDone={() => go('staff')} />}
      {screen === 'classes' && <ClassesList classes={classes} teacherName={teacherName} onAdd={() => go('classAdd')} onOpen={(id) => { setActiveClassId(id); go('classDetail'); }} />}
      {screen === 'classDetail' && <ClassDetail cls={activeClass} teachers={teachers} teacherName={teacherName} setClasses={setClasses} />}
      {screen === 'classAdd' && <ClassAdd teachers={teachers} onCreate={(c, ctId) => { setClasses((cs) => cs.some((x) => x.id === c.id) ? cs : [...cs, c]); if (ctId) setTeachers((ts) => ts.map((t) => (t.id === ctId ? { ...t, classes: t.classes.includes(c.id) ? t.classes : [...t.classes, c.id], ct: c.id } : t.ct === c.id ? { ...t, ct: '' } : t))); go('classes'); }} />}
      {screen === 'noticeBoard' && <NoticeBoardScreen role="admin" notices={notices} acked={{}} onOpen={(id) => { setActiveNoticeId(id); go('notice'); }} onCompose={() => go('noticeCompose')} />}
      {screen === 'notice' && <NoticeDetailScreen notice={notices.find((n) => n.id === activeNoticeId)!} acked={false} showAck={false} onAcknowledge={() => {}} />}
      {screen === 'noticeCompose' && <NoticeCompose onPublish={(n) => setNotices((ns) => [n, ...ns])} onDone={() => go('noticeBoard')} />}
      {screen === 'calendar' && <CalendarScreen admin />}
      {screen === 'notifs' && <NotificationsScreen />}
    </Shell>
  );
}

// ---------- HOME ----------
function AdminHome({ name, teachers, classes, go }: { name: string; teachers: Teacher[]; classes: AdminClass[]; go: (s: Screen) => void }) {
  const pending = teachers.filter((t) => t.status === 'invited').length;
  const stats = [
    { n: '480', label: 'Students' },
    { n: String(teachers.length), label: 'Teachers' },
    { n: '18', label: 'Classes' },
    { n: '96%', label: 'Present today' },
  ];
  return (
    <div className="px-[15px] pt-4 pb-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-[38px] h-[38px] rounded-[13px] grid place-items-center text-green font-bold text-[14px] flex-none" style={{ background: 'linear-gradient(140deg,#d7e4da,#a7c4b4)' }}>{initialsOf(name)}</div>
        <div className="font-semibold text-[14px] leading-[1.1]">{name}<small className="block text-muted font-medium text-[11px] mt-0.5">Principal · Admin</small></div>
        <div className="ml-auto font-serif text-[16px] text-green">Good morning</div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 mb-3">
        {stats.map((s) => (
          <Card key={s.label} className="p-[15px]"><div className="font-serif text-[28px] leading-none text-green">{s.n}</div><small className="text-[11px] text-muted font-semibold block mt-1">{s.label}</small></Card>
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

// ---------- STAFF LIST ----------
function StaffList({ teachers, onAdd, onOpen }: { teachers: Teacher[]; onAdd: () => void; onOpen: (id: string) => void }) {
  return (
    <div className="px-[15px] py-4 pb-6">
      <button onClick={onAdd} className="w-full mb-3.5 py-3 rounded-[14px] bg-green text-white font-semibold text-[13px] flex items-center justify-center gap-[7px]"><Glyph d={GLYPH.plus} size={17} stroke={2} />Add a teacher</button>
      <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">{teachers.length} teachers</div>
      {teachers.map((t) => {
        const line = `${subjectsOf(t).join(', ')} · ${t.classes.length ? t.classes.length + (t.classes.length > 1 ? ' classes' : ' class') : 'No class yet'}${t.ct ? ' · CT ' + t.ct : ''}`;
        return (
          <Card key={t.id} onClick={() => onOpen(t.id)} className="p-[13px] mb-2.25 flex gap-3 items-center">
            <div className="w-10 h-10 rounded-xl grid place-items-center text-green font-bold text-[13px] flex-none" style={{ background: 'linear-gradient(140deg,#d7e4da,#a7c4b4)' }}>{t.initials}</div>
            <div className="flex-1 min-w-0"><b className="text-[13.5px] font-semibold block">{t.name}</b><small className="text-[11px] text-muted">{line}</small></div>
            {t.status === 'invited' && <span className="text-[9.5px] font-bold text-[#8a6d1f] bg-gold-soft px-2 py-1 rounded-[7px] flex-none">INVITED</span>}
            <span className="text-[#c3ccc5] flex-none"><Glyph d={GLYPH.chevronRight} size={17} stroke={2.2} /></span>
          </Card>
        );
      })}
    </div>
  );
}

// ---------- STAFF DETAIL ----------
function StaffDetail({
  teacher, classes, teacherName, onMakeCt, onUnassign, onAssign, onToggleStatus,
}: {
  teacher: Teacher; classes: AdminClass[]; teacherName: (id: string) => string;
  onMakeCt: (cid: string) => void; onUnassign: (cid: string) => void; onAssign: (cid: string) => void; onToggleStatus: () => void;
}) {
  void teacherName;
  const statusLabel = teacher.status === 'active' ? 'Active' : teacher.status === 'invited' ? 'Invite pending' : 'Inactive';
  const available = classes.filter((c) => !teacher.classes.includes(c.id));
  const teach = teachOf(teacher);
  return (
    <div className="px-[15px] py-4 pb-6">
      <Card className="p-[18px] mb-3 text-center">
        <div className="w-[60px] h-[60px] rounded-[18px] grid place-items-center text-green font-bold text-[19px] mx-auto mb-3" style={{ background: 'linear-gradient(140deg,#d7e4da,#a7c4b4)' }}>{teacher.initials}</div>
        <h3 className="font-serif text-[23px] mb-[3px]">{teacher.name}</h3>
        <div className="text-[12px] text-muted font-semibold">{subjectsOf(teacher).join(', ')} · {statusLabel}</div>
        {teacher.phone && <div className="text-[11.5px] text-muted mt-1.5">{maskPhone(teacher.phone)} · login mobile</div>}
      </Card>
      <Card className="p-[15px] mb-3">
        <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.75">Assigned classes</div>
        {teacher.classes.length > 0 ? (
          <div className="flex flex-col gap-2 mb-3">
            {teacher.classes.map((cid) => {
              const ac = classes.find((c) => c.id === cid);
              const isCt = teacher.ct === cid;
              const subs = teach[cid] || [];
              return (
                <div key={cid} className="flex items-center gap-2.5 px-3 py-2.25 border-[1.5px] border-line rounded-[13px]">
                  <div className="flex-1 min-w-0"><b className="text-[13px] font-bold block">{ac?.label ?? cid}</b><small className="text-[10.5px] text-muted">{subs.length ? subs.join(', ') : 'No subject set'}</small></div>
                  <button onClick={() => onMakeCt(cid)} className={cx('px-2.5 py-1.5 rounded-[9px] text-[10.5px] font-bold border-[1.5px] flex-none', isCt ? 'border-green bg-green text-white' : 'border-[#dbe5db] bg-white text-green')}>{isCt ? 'Class teacher ✓' : 'Make CT'}</button>
                  <button onClick={() => onUnassign(cid)} className="w-7 h-7 rounded-[9px] bg-[#f6ecec] text-danger text-[16px] font-bold flex-none">×</button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-[12.5px] text-muted pt-0.5 pb-3">No classes assigned yet.</div>
        )}
        <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2">Assign a class</div>
        {available.length > 0 ? (
          <div className="flex gap-1.5 flex-wrap">
            {available.map((c) => (
              <button key={c.id} onClick={() => onAssign(c.id)} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-green bg-mist border-[1.5px] border-[#dbe5db] px-3 py-2 rounded-[11px]">+ {c.label}</button>
            ))}
          </div>
        ) : (
          <div className="text-[12.5px] text-muted">This teacher is in every class.</div>
        )}
      </Card>
      <button onClick={onToggleStatus} className={cx('w-full py-3 rounded-[14px] font-semibold text-[13.5px] mb-2.25', teacher.status === 'active' ? 'bg-[#f6ecec] text-danger' : 'bg-green text-white')}>{teacher.status === 'active' ? 'Deactivate account' : 'Activate account'}</button>
      <div className="text-center text-[11px] text-muted leading-[1.4]">Class &amp; subject assignments sync to the teacher's app instantly.</div>
    </div>
  );
}

// ---------- STAFF ADD ----------
function StaffAdd({ classes, onSent, onDone }: { classes: AdminClass[]; onSent: (t: Teacher) => void; onDone: () => void }) {
  const [sent, setSent] = useState(false);
  const [invitedName, setInvitedName] = useState('');
  const [ntName, setNtName] = useState('');
  const [ntPhone, setNtPhone] = useState('');
  const [ntSubjects, setNtSubjects] = useState<string[]>([]);
  const [ntTeach, setNtTeach] = useState<Record<string, string[]>>({});
  const [ntCt, setNtCt] = useState('');

  const phoneDigits = ntPhone.replace(/\D/g, '');
  const ready = ntName.trim().length > 0 && phoneDigits.length === 10 && ntSubjects.length > 0;

  function toggleSubject(s: string) {
    setNtSubjects((v) => (v.includes(s) ? v.filter((x) => x !== s) : [...v, s]));
  }
  function toggleClassTeach(cid: string) {
    setNtTeach((t) => {
      if (cid in t) { const n = { ...t }; delete n[cid]; if (ntCt === cid) setNtCt(''); return n; }
      return { ...t, [cid]: [...ntSubjects] };
    });
  }
  function toggleClassSubj(cid: string, su: string) {
    setNtTeach((t) => {
      const cur = (t[cid] || []).slice();
      const i = cur.indexOf(su);
      if (i >= 0) cur.splice(i, 1); else cur.push(su);
      return { ...t, [cid]: cur };
    });
  }
  function send() {
    if (!ready) return;
    const name = ntName.trim();
    const teach: Record<string, string[]> = {};
    Object.keys(ntTeach).forEach((c) => { const subs = (ntTeach[c] || []).filter((s) => ntSubjects.includes(s)); if (subs.length) teach[c] = subs; });
    const clsList = Object.keys(teach);
    const ct = ntCt && clsList.includes(ntCt) ? ntCt : '';
    onSent({ id: 'nt' + Date.now(), name, initials: initialsOf(name), subject: ntSubjects.join(', '), subjects: ntSubjects, phone: phoneDigits, classes: clsList, teach, ct, status: 'invited' });
    setInvitedName(name);
    setSent(true);
  }

  if (sent) return <SuccessScreen title="Teacher added" body={`${invitedName} can now sign in with their mobile and a one-time code. They're in your staff list — edit classes or subjects anytime.`} buttonLabel="Back to staff" onButton={onDone} />;

  return (
    <div className="px-[15px] py-4 pb-6">
      <Field label="Full name"><input value={ntName} onChange={(e) => setNtName(e.target.value)} placeholder="e.g. Priya Sharma" className={inputCls} /></Field>
      <Field label="Mobile number · their login">
        <div className="flex items-center bg-white border-[1.5px] border-line rounded-xl overflow-hidden">
          <span className="px-3 text-[13px] font-semibold border-r border-line h-11 flex items-center">+91</span>
          <input value={ntPhone} onChange={(e) => setNtPhone(e.target.value)} inputMode="numeric" placeholder="Teacher's mobile" className="flex-1 min-w-0 border-none px-3 h-11 text-[13px] bg-transparent" />
        </div>
      </Field>
      <Field label="Subjects · pick all they teach">
        <div className="flex gap-1.5 flex-wrap">
          {ALL_SUBJECTS.map((s) => <Chip key={s} active={ntSubjects.includes(s)} onClick={() => toggleSubject(s)}>{s}</Chip>)}
        </div>
      </Field>
      <Field label="Classes & subjects · which subjects in which class">
        {ntSubjects.length === 0 ? (
          <div className="text-[12px] text-[#8a6d1f] bg-[#fbf3e2] border border-[#ecd8ab] rounded-[11px] px-3 py-2.5">Pick the subjects above first, then choose which classes they teach them in.</div>
        ) : (
          classes.map((c) => {
            const sel = c.id in ntTeach;
            return (
              <div key={c.id} className={cx('border-[1.5px] rounded-[13px] p-3 mb-2', sel ? 'border-green bg-[#f3f8f4]' : 'border-line bg-white')}>
                <div onClick={() => toggleClassTeach(c.id)} className="flex items-center gap-2.5 cursor-pointer">
                  <span className={cx('w-5 h-5 rounded-md flex-none grid place-items-center border-[1.5px]', sel ? 'border-green bg-green text-white' : 'border-[#cdd5cc] bg-white')}>{sel && <Glyph d={GLYPH.check} size={13} stroke={3} />}</span>
                  <b className="text-[13px] font-bold flex-1">{c.label}</b>
                </div>
                {sel && (
                  <div className="flex gap-1.5 flex-wrap mt-2.5 pl-7">
                    {ntSubjects.map((su) => {
                      const on = (ntTeach[c.id] || []).includes(su);
                      return <button key={su} onClick={() => toggleClassSubj(c.id, su)} className={cx('px-2.5 py-1 rounded-lg text-[11px] font-semibold border', on ? 'border-green bg-green text-white' : 'border-[#dbe5db] bg-white text-green')}>{su}</button>;
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </Field>
      {Object.keys(ntTeach).length > 0 && (
        <Field label="Class teacher of">
          <div className="flex gap-1.5 flex-wrap">
            <Chip active={ntCt === ''} onClick={() => setNtCt('')}>Not a class teacher</Chip>
            {Object.keys(ntTeach).map((id) => <Chip key={id} active={ntCt === id} onClick={() => setNtCt(id)}>{classes.find((c) => c.id === id)?.label ?? id}</Chip>)}
          </div>
        </Field>
      )}
      <PrimaryButton disabled={!ready} onClick={send}>Send invite</PrimaryButton>
      <div className="flex gap-2 items-start mt-2.75">
        <span className="flex-none mt-px text-muted"><Glyph d={GLYPH.info} size={14} stroke={1.9} /></span>
        <div className="text-[11px] text-muted leading-[1.5]">They sign in with this mobile and a one-time code — no password, nothing to set up.</div>
      </div>
    </div>
  );
}

// ---------- CLASSES LIST ----------
function ClassesList({ classes, teacherName, onAdd, onOpen }: { classes: AdminClass[]; teacherName: (id: string) => string; onAdd: () => void; onOpen: (id: string) => void }) {
  return (
    <div className="px-[15px] py-4 pb-6">
      <button onClick={onAdd} className="w-full mb-3.5 py-3 rounded-[14px] bg-green text-white font-semibold text-[13px] flex items-center justify-center gap-[7px]"><Glyph d={GLYPH.plus} size={17} stroke={2} />Add a class</button>
      <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">{classes.length} classes</div>
      {classes.map((c) => (
        <Card key={c.id} onClick={() => onOpen(c.id)} className="p-[13px] mb-2.25 flex gap-3 items-center">
          <div className="w-[42px] h-[42px] rounded-[13px] bg-mist grid place-items-center flex-none text-green"><Glyph d={GLYPH.classes} size={20} stroke={1.9} /></div>
          <div className="flex-1 min-w-0"><b className="text-[14px] font-bold block">{c.label}</b><small className="text-[11px] text-muted">{c.ctId ? 'Class teacher · ' + teacherName(c.ctId) : 'No class teacher yet'}</small></div>
          <span className="text-[12px] font-bold text-green bg-[#f1f5f1] rounded-[9px] px-2.5 py-1.5 flex-none">{c.students.length}</span>
          <span className="text-[#c3ccc5] flex-none"><Glyph d={GLYPH.chevronRight} size={17} stroke={2.2} /></span>
        </Card>
      ))}
    </div>
  );
}

// ---------- CLASS DETAIL ----------
function ClassDetail({
  cls, teachers, teacherName, setClasses,
}: {
  cls: AdminClass; teachers: Teacher[]; teacherName: (id: string) => string;
  setClasses: React.Dispatch<React.SetStateAction<AdminClass[]>>;
}) {
  const [newStudent, setNewStudent] = useState('');
  const [gName, setGName] = useState('');
  const [gPhone, setGPhone] = useState('');
  const [gRel, setGRel] = useState('Mother');

  const teachesHere = teachers.filter((t) => cls.id in teachOf(t)).map((t) => ({ name: t.name, subjects: teachOf(t)[cls.id].join(', '), isCt: cls.ctId === t.id }));
  const ready = newStudent.trim().length > 0 && gPhone.replace(/\D/g, '').length === 10;

  function addStudent() {
    if (!ready) return;
    setClasses((cs) => cs.map((c) => (c.id === cls.id ? { ...c, students: [...c.students, { name: newStudent.trim(), guardian: { name: gName.trim() || 'Guardian', phone: gPhone.replace(/\D/g, ''), relation: gRel } }] } : c)));
    setNewStudent(''); setGName(''); setGPhone(''); setGRel('Mother');
  }
  function removeStudent(idx: number) {
    setClasses((cs) => cs.map((c) => (c.id === cls.id ? { ...c, students: c.students.filter((_, i) => i !== idx) } : c)));
  }

  return (
    <div className="px-[15px] py-4 pb-6">
      <Card className="p-3.5 mb-3 flex items-center gap-[11px]">
        <div className="w-10 h-10 rounded-xl bg-mist grid place-items-center flex-none text-green"><Glyph d={GLYPH.staff} size={20} stroke={1.9} /></div>
        <div className="flex-1"><small className="text-[10px] tracking-[0.1em] uppercase text-muted font-semibold block mb-0.5">Class teacher</small>
          {cls.ctId ? <b className="text-[14px] font-bold">{teacherName(cls.ctId)}</b> : <span className="text-[12px] text-[#8a6d1f] font-semibold">Not set — assign from a teacher's profile</span>}
        </div>
      </Card>
      <Card className="p-3.5 mb-3">
        <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-1.5">Teaches here</div>
        {teachesHere.length === 0 ? <div className="text-[12.5px] text-muted py-1">No teachers assigned to this class yet.</div> : teachesHere.map((t, i) => (
          <div key={i} className="flex items-center gap-2.5 py-2.25 border-t border-[#f0f3ef] first:border-t-0">
            <div className="flex-1 min-w-0"><b className="text-[13px] font-semibold block">{t.name}</b><small className="text-[11px] text-muted">{t.subjects}</small></div>
            {t.isCt && <span className="text-[9.5px] font-bold text-[#8a6d1f] bg-gold-soft px-2 py-1 rounded-[7px]">CLASS TEACHER</span>}
          </div>
        ))}
      </Card>
      <Card className="p-3.5 mb-3.5">
        <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">Add a student</div>
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
      <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">{cls.students.length} students</div>
      {cls.students.map((s, i) => {
        const g = s.guardian;
        return (
          <Card key={i} className="p-3 mb-2 flex gap-[11px] items-center rounded-[14px]">
            <span className="w-[26px] h-[26px] rounded-lg bg-[#f1f5f1] text-muted text-[11px] font-bold grid place-items-center flex-none">{('0' + (i + 1)).slice(-2)}</span>
            <div className="flex-1 min-w-0"><b className="text-[13.5px] font-semibold block">{s.name}</b>
              {g ? <small className="text-[10.5px] text-muted">{g.relation} · {g.name} · {maskPhone(g.phone)}</small> : <small className="text-[10.5px] text-[#a9761b] font-semibold">No guardian phone — can't log in yet</small>}
            </div>
            <button onClick={() => removeStudent(i)} className="w-7 h-7 rounded-[9px] bg-[#f6ecec] text-danger text-[16px] font-bold flex-none">×</button>
          </Card>
        );
      })}
      {cls.students.length === 0 && <div className="text-center text-muted text-[12.5px] py-5">No students yet. Add the first one above.</div>}
    </div>
  );
}

// ---------- CLASS ADD ----------
function ClassAdd({ teachers, onCreate }: { teachers: Teacher[]; onCreate: (c: AdminClass, ctId: string) => void }) {
  const [grade, setGrade] = useState('');
  const [section, setSection] = useState('');
  const [ct, setCt] = useState('');
  function create() {
    const g = grade.trim();
    const sec = section.trim().toUpperCase();
    if (!g || !sec) return;
    const id = `${g}-${sec}`;
    onCreate({ id, label: 'Grade ' + id, ctId: ct, students: [] }, ct);
  }
  return (
    <div className="px-[15px] py-4 pb-6">
      <div className="flex gap-2.5 mb-3.5">
        <Field label="Grade" className="flex-1"><input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. 5" className={inputCls} /></Field>
        <Field label="Section" className="flex-1"><input value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. C" className={inputCls} /></Field>
      </div>
      <Field label="Class teacher · optional">
        <div className="flex gap-1.5 flex-wrap">
          <Chip active={ct === ''} onClick={() => setCt('')}>Assign later</Chip>
          {teachers.filter((t) => t.status !== 'inactive').map((t) => <Chip key={t.id} active={ct === t.id} onClick={() => setCt(t.id)}>{t.name}</Chip>)}
        </div>
      </Field>
      <PrimaryButton onClick={create}>Create class</PrimaryButton>
      <div className="text-center text-[11px] text-muted leading-[1.5] mt-3">The class teacher can also be set or changed later from any teacher's profile. Subjects a teacher takes here are set when you add or edit the teacher.</div>
    </div>
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
