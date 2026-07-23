import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  listClasses,
  listTeachers,
  getTeacher,
  setClassSubjects,
  unassignClass,
  listClassStudents,
  addClassStudent,
  updateStudent,
  deleteStudent,
  listClassTeachers,
  listClassExams,
  addClassExam,
  deleteExam,
  listNotices,
  getNotice,
  createNotice,
  updateNotice,
  deleteNotice,
  listEvents,
  getDashboard,
  getAttendanceOverview,
  getClassAttendance,
  type AdminDashboard,
  type DashboardTrendDay,
  type DashboardClassAttendance,
  type AttendanceOverview,
  type ClassAttendance,
  createEvent,
  updateEvent,
  deleteEvent,
  type AdminNotice,
  type AdminEvent,
  type ClassStudent,
  type ClassTeacher,
  type ClassExam,
  type GuardianRelation,
  type StudentInput,
  setClassTeacher,
  createClass,
  createTeacher,
  listSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  type AdminKlass,
  type AdminTeacher,
  type AdminSubject,
  type AdminTeacherDetail,
} from "../api/admin";
import {
  AppHeader,
  Card,
  Chip,
  EmptyState,
  Glyph,
  PrimaryButton,
  SectionLabel,
  Shell,
  Spinner,
  SuccessScreen,
  cx,
  type TabDef,
} from "./kit";
import { NotificationsScreen } from "./SharedScreens";
import { AccountSheet } from "./AccountSheet";
import {
  SCHOOL,
  GLYPH,
  NOTICE_CATEGORIES,
  initialsOf,
  maskPhone,
} from "./data";

type Screen =
  | "home"
  | "staff"
  | "staffDetail"
  | "staffAdd"
  | "classes"
  | "classDetail"
  | "classAdd"
  | "adminAtt"
  | "adminAttClass"
  | "noticeBoard"
  | "notice"
  | "noticeCompose"
  | "calendar"
  | "notifs";

export function AdminApp() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [screen, setScreen] = useState<Screen>("home");
  const [acctOpen, setAcctOpen] = useState(false);
  const [activeTeacherId, setActiveTeacherId] = useState<number | null>(null);
  const [activeKlassId, setActiveKlassId] = useState<number | null>(null);
  const [attClassId, setAttClassId] = useState<number | null>(null);

  // Live notices & events.
  const [apiNotices, setApiNotices] = useState<AdminNotice[] | null>(null);
  const [noticesLoading, setNoticesLoading] = useState(false);
  const [noticesError, setNoticesError] = useState<string | null>(null);
  const [activeNoticeId, setActiveNoticeId] = useState<number | null>(null);
  const [noticeDetail, setNoticeDetail] = useState<AdminNotice | null>(null);
  // Set when opening compose in edit mode; null means a fresh notice.
  const [editingNotice, setEditingNotice] = useState<AdminNotice | null>(null);
  const [apiEvents, setApiEvents] = useState<AdminEvent[] | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  // Live home dashboard (stat cards + attendance infographics).
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashError, setDashError] = useState<string | null>(null);

  // Live attendance: the school overview, then the drilled-into class.
  const [attOverview, setAttOverview] = useState<AttendanceOverview | null>(
    null,
  );
  const [attOverviewLoading, setAttOverviewLoading] = useState(false);
  const [attOverviewError, setAttOverviewError] = useState<string | null>(null);
  const [attClassData, setAttClassData] = useState<ClassAttendance | null>(null);
  const [attClassLoading, setAttClassLoading] = useState(false);
  const [attClassError, setAttClassError] = useState<string | null>(null);

  // Live classes & teachers from the backend.
  const [apiClasses, setApiClasses] = useState<AdminKlass[] | null>(null);
  const [apiTeachers, setApiTeachers] = useState<AdminTeacher[] | null>(null);
  const [classesLoading, setClassesLoading] = useState(false);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  // Live school-level subject catalogue.
  const [apiSubjects, setApiSubjects] = useState<AdminSubject[] | null>(null);
  // The open teacher's class × subject assignments (fetched per teacher).
  const [teacherDetail, setTeacherDetail] = useState<AdminTeacherDetail | null>(
    null,
  );
  const [teacherDetailError, setTeacherDetailError] = useState<string | null>(
    null,
  );

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

  const loadNotices = useCallback(async () => {
    setNoticesLoading(true);
    setNoticesError(null);
    try {
      setApiNotices(await listNotices());
    } catch {
      setNoticesError("Couldn't load notices. Pull to retry.");
    } finally {
      setNoticesLoading(false);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError(null);
    try {
      setApiEvents(await listEvents());
    } catch {
      setEventsError("Couldn't load events. Pull to retry.");
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    setDashError(null);
    try {
      setDashboard(await getDashboard());
    } catch {
      setDashError("Couldn't load the dashboard.");
    } finally {
      setDashLoading(false);
    }
  }, []);

  const loadAttOverview = useCallback(async () => {
    setAttOverviewLoading(true);
    setAttOverviewError(null);
    try {
      setAttOverview(await getAttendanceOverview());
    } catch {
      setAttOverviewError("Couldn't load attendance.");
    } finally {
      setAttOverviewLoading(false);
    }
  }, []);

  const loadAttClass = useCallback(async () => {
    if (attClassId === null) return;
    setAttClassLoading(true);
    setAttClassError(null);
    try {
      setAttClassData(await getClassAttendance(attClassId));
    } catch {
      setAttClassError("Couldn't load this class's attendance.");
    } finally {
      setAttClassLoading(false);
    }
  }, [attClassId]);

  const loadSubjects = useCallback(async () => {
    try {
      setApiSubjects(await listSubjects());
    } catch {
      /* surfaced inline in the subject manager */
    }
  }, []);

  // Fetch the open teacher's assignments; refetch whenever a different one opens.
  useEffect(() => {
    if (screen !== "staffDetail" || activeTeacherId === null) return;
    let stale = false;
    setTeacherDetail(null);
    setTeacherDetailError(null);
    getTeacher(activeTeacherId)
      .then((d) => {
        if (!stale) setTeacherDetail(d);
      })
      .catch(() => {
        if (!stale)
          setTeacherDetailError("Couldn't load this teacher's assignments.");
      });
    return () => {
      stale = true;
    };
  }, [screen, activeTeacherId]);

  // After a mutation: assignments changed, and so may a class's class teacher.
  const refreshTeacherDetail = useCallback(async () => {
    if (activeTeacherId === null) return;
    const [d] = await Promise.all([getTeacher(activeTeacherId), loadClasses()]);
    setTeacherDetail(d);
  }, [activeTeacherId, loadClasses]);

  // The detail view refetches so ack counts are current, not list-stale.
  useEffect(() => {
    if (screen !== "notice" || activeNoticeId === null) return;
    let stale = false;
    setNoticeDetail(null);
    getNotice(activeNoticeId)
      .then((n) => {
        if (!stale) setNoticeDetail(n);
      })
      .catch(() => {
        /* the board still shows the list copy */
      });
    return () => {
      stale = true;
    };
  }, [screen, activeNoticeId]);

  // Load live data whenever the admin lands on a screen that needs it.
  useEffect(() => {
    // Add-Teacher needs live classes + subjects to build its assignment picker.
    // Staff Detail needs classes for its "assign a class" picker; Class Detail
    // needs the class itself, the subject chips, and the teacher picker.
    const needsClasses = [
      "classes",
      "classAdd",
      "classDetail",
      "staffAdd",
      "staffDetail",
    ];
    const needsSubjects = [
      "classes",
      "classAdd",
      "classDetail",
      "staffAdd",
      "staffDetail",
    ];
    const needsTeachers = ["staff", "staffDetail", "classAdd", "classDetail"];
    if (needsClasses.includes(screen) && apiClasses === null) loadClasses();
    if (needsSubjects.includes(screen) && apiSubjects === null) loadSubjects();
    if (needsTeachers.includes(screen) && apiTeachers === null) loadTeachers();
    if (screen === "noticeBoard" && apiNotices === null) loadNotices();
    // Compose needs classes for its audience picker.
    if (screen === "noticeCompose" && apiClasses === null) loadClasses();
    if (screen === "calendar" && apiEvents === null) loadEvents();
    if (screen === "home" && dashboard === null) loadDashboard();
    if (screen === "adminAtt" && attOverview === null) loadAttOverview();
  }, [
    screen,
    dashboard,
    loadDashboard,
    attOverview,
    loadAttOverview,
    apiClasses,
    loadClasses,
    apiSubjects,
    loadSubjects,
    apiTeachers,
    loadTeachers,
    apiNotices,
    loadNotices,
    apiEvents,
    loadEvents,
  ]);

  const name = user?.name ?? "Sridevi Menon";
  const activeApiTeacher =
    apiTeachers?.find((t) => t.id === activeTeacherId) ?? null;
  const activeApiKlass =
    apiClasses?.find((c) => c.id === activeKlassId) ?? null;

  // The drilled-into class refetches whenever a different one is opened.
  useEffect(() => {
    if (screen !== "adminAttClass" || attClassId === null) return;
    let stale = false;
    setAttClassData(null);
    setAttClassError(null);
    setAttClassLoading(true);
    getClassAttendance(attClassId)
      .then((d) => {
        if (!stale) setAttClassData(d);
      })
      .catch(() => {
        if (!stale) setAttClassError("Couldn't load this class's attendance.");
      })
      .finally(() => {
        if (!stale) setAttClassLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [screen, attClassId]);

  function go(s: Screen) {
    setScreen(s);
  }

  // header
  let title = user?.school?.name ?? "Greenwood";
  let sub: string | undefined = `${name.toUpperCase()} · ADMIN`;
  const M: Record<string, [string, string]> = {
    staff: ["Staff", "MANAGE TEACHERS"],
    staffAdd: ["Add Teacher", "ADD TO STAFF"],
    classes: ["Classes", "ALL CLASSES"],
    classAdd: ["Add", "CLASS OR SUBJECT"],
    adminAtt: ["Attendance", "TODAY · ALL CLASSES"],
    noticeBoard: ["Notice Board", SCHOOL.toUpperCase()],
    noticeCompose: editingNotice
      ? ["Edit Notice", "UPDATE AND REPUBLISH"]
      : ["New Notice", "TO PARENTS"],
    calendar: ["Calendar", SCHOOL.toUpperCase()],
    notifs: ["Notifications", SCHOOL.toUpperCase()],
  };
  if (M[screen]) {
    [title, sub] = M[screen];
  } else if (screen === "staffDetail") {
    title = "Teacher";
    sub = (primarySubjectOf(teacherDetail) ?? activeApiTeacher?.name ?? "")
      .toUpperCase();
  } else if (screen === "classDetail") {
    title = activeApiKlass?.label ?? "Class";
    sub = activeApiKlass?.teacher
      ? `CLASS TEACHER · ${activeApiKlass.teacher.toUpperCase()}`
      : "NO CLASS TEACHER";
  } else if (screen === "adminAttClass") {
    title =
      attClassData?.klass.label ??
      attOverview?.byClass.find((c) => c.id === attClassId)?.label ??
      "Class";
    sub = attClassData
      ? attClassData.marked > 0
        ? `${attClassData.present + attClassData.late} / ${attClassData.marked} PRESENT`
        : "NOT MARKED YET"
      : undefined;
  } else if (screen === "notice") {
    title = "Notice";
    sub = (
      noticeDetail?.from ??
      apiNotices?.find((n) => n.id === activeNoticeId)?.from ??
      ""
    ).toUpperCase();
  }

  const TOP: Screen[] = ["home", "staff", "classes", "noticeBoard", "calendar"];
  const topLevel = TOP.includes(screen);
  const backTo: Record<string, Screen> = {
    staffDetail: "staff",
    staffAdd: "staff",
    classDetail: "classes",
    classAdd: "classes",
    adminAtt: "home",
    adminAttClass: "adminAtt",
    noticeCompose: "noticeBoard",
    notice: "noticeBoard",
    notifs: "home",
  };
  const onBack = topLevel ? undefined : () => go(backTo[screen] || "home");

  const activeKey = ["staff", "staffDetail", "staffAdd"].includes(screen)
    ? "staff"
    : ["classes", "classDetail", "classAdd"].includes(screen)
      ? "classes"
      : ["noticeBoard", "notice", "noticeCompose"].includes(screen)
        ? "notices"
        : screen === "calendar"
          ? "calendar"
          : "home";

  const tabs: TabDef[] = [
    { key: "home", label: "Home", glyph: GLYPH.home, to: "home" },
    { key: "staff", label: "Staff", glyph: GLYPH.staff, to: "staff" },
    { key: "classes", label: "Classes", glyph: GLYPH.classes, to: "classes" },
    {
      key: "notices",
      label: "Notices",
      glyph: GLYPH.notices,
      to: "noticeBoard",
    },
    {
      key: "calendar",
      label: "Calendar",
      glyph: GLYPH.calendar,
      to: "calendar",
    },
  ].map((t) => ({
    key: t.key,
    label: t.label,
    glyph: t.glyph,
    active: activeKey === t.key,
    onClick: () => go(t.to as Screen),
  }));

  return (
    <Shell
      header={
        <AppHeader
          title={title}
          sub={sub}
          onBack={onBack}
          onAccount={() => setAcctOpen(true)}
          onBell={() => go("notifs")}
          brand={user?.school?.name}
          logo={user?.school?.logo}
        />
      }
      tabs={tabs}
      overlays={
        <AccountSheet
          open={acctOpen}
          onClose={() => setAcctOpen(false)}
          name={name}
          phone={user?.phone ?? "9800011122"}
          roleLabel="Admin"
          onSignOut={() => {
            logout();
            navigate("/login");
          }}
        />
      }
    >
      {screen === "home" && (
        <AdminHome
          name={name}
          data={dashboard}
          loading={dashLoading}
          error={dashError}
          onRetry={loadDashboard}
          go={go}
          openAcct={() => setAcctOpen(true)}
        />
      )}
      {screen === "staff" && (
        <StaffList
          teachers={apiTeachers}
          loading={staffLoading}
          error={staffError}
          onRetry={loadTeachers}
          onAdd={() => go("staffAdd")}
          onOpen={(id) => {
            setActiveTeacherId(id);
            go("staffDetail");
          }}
        />
      )}
      {screen === "staffDetail" && (
        <StaffDetail
          teacher={activeApiTeacher}
          detail={teacherDetail}
          detailError={teacherDetailError}
          classes={apiClasses}
          subjects={apiSubjects}
          onRefresh={refreshTeacherDetail}
        />
      )}
      {screen === "staffAdd" && (
        <StaffAdd
          subjects={apiSubjects}
          classes={apiClasses}
          onCreated={async () => {
            setApiClasses(null);
            await loadTeachers();
            go("staff");
          }}
        />
      )}
      {screen === "classes" && (
        <ClassesList
          classes={apiClasses}
          subjects={apiSubjects}
          loading={classesLoading}
          error={classesError}
          onRetry={loadClasses}
          onAdd={() => go("classAdd")}
          onOpen={(id) => {
            setActiveKlassId(id);
            go("classDetail");
          }}
        />
      )}
      {screen === "classDetail" && (
        <ClassDetail
          klass={activeApiKlass}
          subjects={apiSubjects}
          allTeachers={apiTeachers}
          onClassesChanged={loadClasses}
        />
      )}
      {screen === "adminAtt" && (
        <AdminAttendance
          data={attOverview}
          loading={attOverviewLoading}
          error={attOverviewError}
          onRetry={loadAttOverview}
          onOpen={(id) => {
            setAttClassId(id);
            go("adminAttClass");
          }}
        />
      )}
      {screen === "adminAttClass" && (
        <AdminAttendanceClass
          att={attClassData}
          loading={attClassLoading}
          error={attClassError}
          onRetry={loadAttClass}
        />
      )}
      {screen === "classAdd" && (
        <ClassOrSubjectAdd
          teachers={apiTeachers ?? []}
          onClassCreated={async () => {
            await loadClasses();
            go("classes");
          }}
          subjects={apiSubjects}
          onSubjectsChanged={loadSubjects}
        />
      )}
      {screen === "noticeBoard" && (
        <AdminNoticeBoard
          notices={apiNotices}
          loading={noticesLoading}
          error={noticesError}
          onRetry={loadNotices}
          onOpen={(id) => {
            setActiveNoticeId(id);
            go("notice");
          }}
          onCompose={() => {
            setEditingNotice(null);
            go("noticeCompose");
          }}
        />
      )}
      {screen === "notice" && (
        <AdminNoticeDetail
          notice={
            noticeDetail ??
            apiNotices?.find((n) => n.id === activeNoticeId) ??
            null
          }
          onEdit={() => {
            setEditingNotice(
              noticeDetail ??
                apiNotices?.find((n) => n.id === activeNoticeId) ??
                null,
            );
            go("noticeCompose");
          }}
          onDeleted={async () => {
            await loadNotices();
            go("noticeBoard");
          }}
        />
      )}
      {screen === "noticeCompose" && (
        <NoticeCompose
          editing={editingNotice}
          classes={apiClasses}
          onDone={async () => {
            setEditingNotice(null);
            await loadNotices();
            go("noticeBoard");
          }}
        />
      )}
      {screen === "calendar" && (
        <AdminCalendar
          events={apiEvents}
          loading={eventsLoading}
          error={eventsError}
          onRetry={loadEvents}
          onChanged={loadEvents}
        />
      )}
      {screen === "notifs" && <NotificationsScreen />}
    </Shell>
  );
}

// ---------- HOME (live dashboard) ----------

// Attendance series colours. Present/late/absent is a *status* palette, so the
// hues are fixed and never reused for anything else on this screen.
const ATT_COLORS = {
  present: "var(--color-success)",
  late: "var(--color-gold)",
  absent: "var(--color-danger)",
} as const;

function greetingFor(d: Date) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** "2026-07-18" → "Fri 18". Dates are plain day keys, so parse them as UTC. */
function weekdayLabel(key: string) {
  const d = new Date(`${key}T00:00:00.000Z`);
  const wd = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  return `${wd} ${d.getUTCDate()}`;
}

/**
 * Today's present/late/absent split as one stacked bar. Segments are separated
 * by a 2px surface gap and every segment is directly labelled below, so the
 * split is never carried by colour alone.
 */
function AttendanceSplit({
  present,
  late,
  absent,
}: {
  present: number;
  late: number;
  absent: number;
}) {
  const total = present + late + absent;
  const segments = [
    { key: "present", label: "Present", n: present },
    { key: "late", label: "Late", n: late },
    { key: "absent", label: "Absent", n: absent },
  ] as const;
  return (
    <div>
      <div className="flex gap-[2px] h-2.5 mb-3">
        {segments
          .filter((s) => s.n > 0)
          .map((s) => (
            <div
              key={s.key}
              className="first:rounded-l-[4px] last:rounded-r-[4px] h-full"
              style={{
                width: `${(s.n / total) * 100}%`,
                background: ATT_COLORS[s.key],
              }}
            />
          ))}
      </div>
      <div className="flex gap-4">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-[6px]">
            <span
              className="w-2 h-2 rounded-full flex-none"
              style={{ background: ATT_COLORS[s.key] }}
            />
            <span className="text-[11px] text-muted font-semibold">
              {s.label}
            </span>
            <b className="text-[11.5px] text-ink">{s.n}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Attendance rate across the last school days. One series, so no legend — only
 * the most recent bar is labelled, keeping the row readable at phone width.
 */
function AttendanceTrend({ trend }: { trend: DashboardTrendDay[] }) {
  const last = trend[trend.length - 1];
  return (
    <div>
      <div className="relative h-[74px] flex items-end gap-[2px]">
        {/* 100% reference — recessive, so the bars stay the figure. */}
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-line" />
        {trend.map((d) => (
          <div
            key={d.date}
            className="flex-1 rounded-t-[4px] min-h-[2px]"
            style={{
              height: `${d.pct}%`,
              background:
                d === last ? "var(--color-green)" : "var(--color-mist)",
            }}
            title={`${weekdayLabel(d.date)} · ${d.pct}%`}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] text-muted font-semibold">
        <span>{weekdayLabel(trend[0].date)}</span>
        <span className="text-green">
          {weekdayLabel(last.date)} · {last.pct}%
        </span>
      </div>
    </div>
  );
}

/**
 * Per-class attendance today. Classes nobody has marked yet read as "Not
 * marked" rather than a 0% bar — 0% would wrongly mean everyone was absent.
 */
function ClassAttendanceBars({ rows }: { rows: DashboardClassAttendance[] }) {
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((c) => (
        <div key={c.id} className="flex items-center gap-2.5">
          <span className="w-[64px] text-[11.5px] font-bold text-green flex-none truncate">
            {c.label}
          </span>
          <div className="flex-1 h-2 rounded-[4px] bg-mist overflow-hidden">
            {c.marked > 0 && (
              <div
                className="h-full rounded-[4px] bg-green"
                style={{ width: `${c.pct}%` }}
              />
            )}
          </div>
          <span
            className={cx(
              "w-[66px] text-right text-[11px] font-semibold flex-none",
              c.marked > 0 ? "text-ink" : "text-muted",
            )}
          >
            {c.marked > 0 ? `${c.pct}%` : "Not marked"}
          </span>
        </div>
      ))}
    </div>
  );
}

function AdminHome({
  name,
  data,
  loading,
  error,
  onRetry,
  go,
  openAcct,
}: {
  name: string;
  data: AdminDashboard | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  go: (s: Screen) => void;
  openAcct: () => void;
}) {
  const att = data?.attendance;
  const stats: { n: string; label: string; to: Screen }[] = [
    { n: String(data?.counts.students ?? "—"), label: "Students", to: "classes" },
    { n: String(data?.counts.teachers ?? "—"), label: "Teachers", to: "staff" },
    { n: String(data?.counts.classes ?? "—"), label: "Classes", to: "classes" },
    {
      n: att && att.marked > 0 ? `${att.pct}%` : "—",
      label: "Present today",
      to: "adminAtt",
    },
  ];
  return (
    <div className="px-[15px] pt-4 pb-6">
      <div className="flex items-center gap-2.5 mb-4">
        <div
          onClick={openAcct}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <div
            className="w-[38px] h-[38px] rounded-[13px] grid place-items-center text-green font-bold text-[14px] flex-none"
            style={{ background: "linear-gradient(140deg,#d7e4da,#a7c4b4)" }}
          >
            {initialsOf(name)}
          </div>
          <div className="font-semibold text-[14px] leading-[1.1]">
            {name}
            <small className="block text-muted font-medium text-[11px] mt-0.5">
              Principal · Admin
            </small>
          </div>
          <span className="text-[#9aa39b] flex-none">
            <Glyph d={GLYPH.chevronDown} size={16} stroke={2.2} />
          </span>
        </div>
        <div className="ml-auto font-serif text-[16px] text-green">
          {greetingFor(new Date())}
        </div>
      </div>

      {loading && data === null && (
        <div className="py-10">
          <Spinner />
        </div>
      )}

      {error && data === null && !loading && (
        <Card className="p-5 text-center mb-3">
          <div className="text-[12.5px] text-danger mb-3">{error}</div>
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-[11px] bg-green text-white font-semibold text-[12.5px]"
          >
            Retry
          </button>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2.5 mb-3">
        {stats.map((s) => (
          <Card key={s.label} onClick={() => go(s.to)} className="p-[15px]">
            <div className="font-serif text-[28px] leading-none text-green">
              {s.n}
            </div>
            <small className="text-[11px] text-muted font-semibold block mt-1">
              {s.label}
            </small>
          </Card>
        ))}
      </div>

      {att && (
        <Card className="p-[15px] mb-3">
          <SectionLabel right={weekdayLabel(att.date)}>
            Attendance today
          </SectionLabel>
          {att.marked > 0 ? (
            <>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="font-serif text-[32px] leading-none text-green">
                  {att.pct}%
                </span>
                <span className="text-[11.5px] text-muted font-semibold">
                  {att.present + att.late} of {att.marked} in school
                </span>
              </div>
              <AttendanceSplit
                present={att.present}
                late={att.late}
                absent={att.absent}
              />
            </>
          ) : (
            <div className="text-[12px] text-muted leading-[1.5] py-1">
              No attendance marked yet today.
            </div>
          )}
          {att.classesPending > 0 && (
            <div className="mt-3 pt-3 border-t border-line text-[11.5px] text-muted">
              <b className="text-ink">{att.classesPending}</b>{" "}
              {att.classesPending === 1 ? "class hasn't" : "classes haven't"}{" "}
              marked attendance yet.
            </div>
          )}
        </Card>
      )}

      {att && att.trend.length > 1 && (
        <Card className="p-[15px] mb-3">
          <SectionLabel>Attendance · last school days</SectionLabel>
          <AttendanceTrend trend={att.trend} />
        </Card>
      )}

      {att && att.byClass.length > 0 && (
        <Card className="p-[15px] mb-3">
          <SectionLabel>Today by class</SectionLabel>
          <ClassAttendanceBars rows={att.byClass} />
        </Card>
      )}

      {data && data.pendingLeaves > 0 && (
        <Card className="p-[15px] mb-3 flex items-center gap-[13px]">
          <div className="w-11 h-11 rounded-[14px] bg-[#fbf3e2] grid place-items-center flex-none text-[#a9761b]">
            <Glyph d={GLYPH.diary} size={21} stroke={1.9} />
          </div>
          <div className="flex-1">
            <b className="font-serif text-[19px] font-normal block leading-[1.1]">
              {data.pendingLeaves} leave{" "}
              {data.pendingLeaves === 1 ? "request" : "requests"}
            </b>
            <small className="text-muted text-[11.5px]">Awaiting review</small>
          </div>
        </Card>
      )}

      <div
        onClick={() => go("staff")}
        className="bg-green text-white rounded-[20px] p-[15px] mb-3 flex items-center gap-[13px] cursor-pointer"
      >
        <div className="w-11 h-11 rounded-[14px] bg-white/15 grid place-items-center flex-none">
          <Glyph d={GLYPH.staff} size={22} stroke={1.9} />
        </div>
        <div className="flex-1">
          <b className="font-serif text-[19px] font-normal block leading-[1.1]">
            Manage staff
          </b>
          <small className="text-[#cfe0d6] text-[11.5px]">
            {data?.counts.teachers ?? 0} teachers ·{" "}
            {data?.counts.subjects ?? 0} subjects
          </small>
        </div>
        <span className="text-[#9fc0ad]">
          <Glyph d={GLYPH.chevronRight} size={18} stroke={2} />
        </span>
      </div>
      <Card
        onClick={() => go("classes")}
        className="p-[15px] mb-3 flex items-center gap-[13px]"
      >
        <div className="w-11 h-11 rounded-[14px] bg-mist grid place-items-center flex-none text-green">
          <Glyph d={GLYPH.classes} size={21} stroke={1.9} />
        </div>
        <div className="flex-1">
          <b className="font-serif text-[19px] font-normal block leading-[1.1]">
            Classes &amp; students
          </b>
          <small className="text-muted text-[11.5px]">
            {data?.counts.classes ?? 0} classes · {data?.counts.students ?? 0}{" "}
            students
          </small>
        </div>
        <span className="text-[#c3ccc5]">
          <Glyph d={GLYPH.chevronRight} size={18} stroke={2} />
        </span>
      </Card>
      {data && data.upcomingEvents.length > 0 && (
        <Card onClick={() => go("calendar")} className="p-[15px] mb-3">
          <SectionLabel>Coming up</SectionLabel>
          {data.upcomingEvents.map((e) => (
            <div
              key={e.id}
              className="flex gap-[11px] items-center py-2.5 border-t border-line"
            >
              <span className="w-2 h-2 rounded-full flex-none bg-gold" />
              <div className="flex-1 min-w-0">
                <b className="text-[12.5px] font-semibold block truncate">
                  {e.title}
                </b>
                {e.description && (
                  <small className="text-[11px] text-muted block truncate">
                    {e.description}
                  </small>
                )}
              </div>
              <span className="text-[10px] text-muted font-semibold flex-none">
                {shortDay(e.date)}
              </span>
            </div>
          ))}
        </Card>
      )}

      {data && data.recentNotices.length > 0 && (
        <Card onClick={() => go("noticeBoard")} className="p-[15px]">
          <SectionLabel>Latest notices</SectionLabel>
          {data.recentNotices.map((n) => {
            const pct = n.totalParents
              ? Math.round((n.ackCount / n.totalParents) * 100)
              : 0;
            return (
              <div key={n.id} className="py-2.5 border-t border-line">
                <div className="flex gap-[11px] items-center mb-1.5">
                  <span
                    className={cx(
                      "w-2 h-2 rounded-full flex-none",
                      n.pinned ? "bg-gold" : "bg-mist",
                    )}
                  />
                  <b className="text-[12.5px] font-semibold flex-1 min-w-0 truncate">
                    {n.title}
                  </b>
                  <span className="text-[10px] text-muted font-semibold flex-none">
                    {n.ackCount}/{n.totalParents} read
                  </span>
                </div>
                {/* Read-receipt meter: a share of a known whole, so one hue. */}
                <div className="h-1.5 rounded-[4px] bg-mist overflow-hidden ml-[19px]">
                  <div
                    className="h-full rounded-[4px] bg-green"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}

// ---------- STAFF LIST (live) ----------
function StaffList({
  teachers,
  loading,
  error,
  onRetry,
  onAdd,
  onOpen,
}: {
  teachers: AdminTeacher[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onAdd: () => void;
  onOpen: (id: number) => void;
}) {
  return (
    <div className="px-[15px] py-4 pb-6">
      <button
        onClick={onAdd}
        className="w-full mb-3.5 py-3 rounded-[14px] bg-green text-white font-semibold text-[13px] flex items-center justify-center gap-[7px]"
      >
        <Glyph d={GLYPH.plus} size={17} stroke={2} />
        Add a teacher
      </button>

      {loading && teachers === null && (
        <div className="py-10">
          <Spinner />
        </div>
      )}

      {error && teachers === null && !loading && (
        <Card className="p-5 text-center">
          <div className="text-[12.5px] text-danger mb-3">{error}</div>
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-[11px] bg-green text-white font-semibold text-[12.5px]"
          >
            Retry
          </button>
        </Card>
      )}

      {teachers !== null && (
        <>
          <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">
            {teachers.length} {teachers.length === 1 ? "teacher" : "teachers"}
          </div>
          {teachers.length === 0 ? (
            <EmptyState icon={GLYPH.staff} title="No teachers yet">
              Add your first teacher — they'll sign in with their mobile and a
              one-time code.
            </EmptyState>
          ) : (
            teachers.map((t) => (
              <Card
                key={t.id}
                onClick={() => onOpen(t.id)}
                className="p-[13px] mb-2.25 flex gap-3 items-center"
              >
                <div
                  className="w-10 h-10 rounded-xl grid place-items-center text-green font-bold text-[13px] flex-none"
                  style={{
                    background: "linear-gradient(140deg,#d7e4da,#a7c4b4)",
                  }}
                >
                  {initialsOf(t.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <b className="text-[13.5px] font-semibold block">{t.name}</b>
                  <small className="text-[11px] text-muted">
                    {t.phone} · login mobile
                  </small>
                </div>
                <span className="text-[#c3ccc5] flex-none">
                  <Glyph d={GLYPH.chevronRight} size={17} stroke={2.2} />
                </span>
              </Card>
            ))
          )}
        </>
      )}
    </div>
  );
}

// ---------- STAFF DETAIL (live) ----------
function StaffDetail({
  teacher,
  detail,
  detailError,
  classes,
  subjects,
  onRefresh,
}: {
  teacher: AdminTeacher | null;
  detail: AdminTeacherDetail | null;
  detailError: string | null;
  classes: AdminKlass[] | null;
  subjects: AdminSubject[] | null;
  onRefresh: () => void | Promise<void>;
}) {
  // Keyed by the class row being mutated, so only that row shows as busy.
  const [busyKlassId, setBusyKlassId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!teacher)
    return (
      <div className="px-[15px] py-10">
        <Spinner />
      </div>
    );

  const assignments = detail?.assignments ?? [];
  const ctIds = new Set((detail?.classTeacherOf ?? []).map((c) => c.id));
  const assignedIds = new Set(assignments.map((a) => a.klassId));
  const unassigned = (classes ?? []).filter((c) => !assignedIds.has(c.id));
  // "+ Grade 6-B" reuses the subjects this teacher already teaches elsewhere.
  const ownSubjectIds = [
    ...new Set(assignments.flatMap((a) => a.subjects.map((s) => s.id))),
  ];

  async function run(klassId: number, fn: () => Promise<void>) {
    setBusyKlassId(klassId);
    setActionError(null);
    try {
      await fn();
      await onRefresh();
    } catch (e) {
      setActionError(
        (e as { response?: { data?: { error?: string } } }).response?.data
          ?.error ?? "That didn't save. Please try again.",
      );
    } finally {
      setBusyKlassId(null);
    }
  }

  const teacherId = teacher.id;

  return (
    <div className="px-[15px] py-4 pb-6">
      <Card className="p-[18px] mb-3 text-center">
        <div
          className="w-[60px] h-[60px] rounded-[18px] grid place-items-center text-green font-bold text-[19px] mx-auto mb-3"
          style={{ background: "linear-gradient(140deg,#d7e4da,#a7c4b4)" }}
        >
          {initialsOf(teacher.name)}
        </div>
        <h3 className="font-serif text-[23px] mb-[3px]">{teacher.name}</h3>
        <div className="text-[12px] text-muted font-semibold">
          {primarySubjectOf(detail) ?? "Teacher"} · Active
        </div>
        <div className="text-[11.5px] text-muted mt-1.5">
          {maskPhone(teacher.phone)} · login mobile
        </div>
      </Card>

      {(detailError || actionError) && (
        <Card className="p-[15px] mb-3 text-[12.5px] text-danger">
          {detailError ?? actionError}
        </Card>
      )}

      {!detail && !detailError ? (
        <div className="py-8">
          <Spinner />
        </div>
      ) : (
        <Card className="p-[15px] mb-3">
          <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.75">
            Assigned classes
          </div>

          {assignments.length === 0 ? (
            <div className="text-[12.5px] text-muted mb-3">
              No classes assigned yet.
            </div>
          ) : (
            <div className="flex flex-col gap-2 mb-1">
              {assignments.map((a) => {
                const isCT = ctIds.has(a.klassId);
                const busy = busyKlassId === a.klassId;
                const onIds = a.subjects.map((s) => s.id);
                return (
                  <div
                    key={a.klassId}
                    className={cx(
                      "border-[1.5px] border-line rounded-[13px] p-3",
                      busy && "opacity-60",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <b className="text-[13.5px] font-bold flex-1 min-w-0">
                        {a.label}
                      </b>
                      <button
                        disabled={busy}
                        onClick={() =>
                          run(a.klassId, () =>
                            setClassTeacher(teacherId, a.klassId, !isCT),
                          )
                        }
                        className={cx(
                          "px-3 py-2 rounded-[11px] text-[12px] font-semibold border-[1.5px] flex-none transition",
                          isCT
                            ? "bg-green border-green text-white"
                            : "bg-white border-line text-green",
                        )}
                      >
                        {isCT ? "Class teacher ✓" : "Make CT"}
                      </button>
                      <button
                        disabled={busy}
                        aria-label={`Remove ${a.label}`}
                        onClick={() =>
                          run(a.klassId, () =>
                            unassignClass(teacherId, a.klassId),
                          )
                        }
                        className="w-9 h-9 rounded-[11px] grid place-items-center bg-[#f6ecec] text-danger flex-none"
                      >
                        <Glyph d={GLYPH.close} size={15} stroke={2.4} />
                      </button>
                    </div>

                    <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mt-3 mb-2">
                      Subjects in this class
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {(subjects ?? []).map((s) => {
                        const on = onIds.includes(s.id);
                        // Turning off the last subject would leave an empty
                        // class, which is the same as unassigning it — use ×.
                        const locked = on && onIds.length === 1;
                        return (
                          <button
                            key={s.id}
                            disabled={busy || locked}
                            title={
                              locked
                                ? "A class needs at least one subject — use × to remove it"
                                : undefined
                            }
                            onClick={() =>
                              run(a.klassId, () =>
                                setClassSubjects(
                                  teacherId,
                                  a.klassId,
                                  on
                                    ? onIds.filter((x) => x !== s.id)
                                    : [...onIds, s.id],
                                ),
                              )
                            }
                            className={cx(
                              "px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold border-[1.5px] transition",
                              on
                                ? "border-green bg-green text-white"
                                : "border-line bg-white text-green",
                              locked && "opacity-70",
                            )}
                          >
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {unassigned.length > 0 && (
            <>
              <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mt-3.5 mb-2.5">
                Assign a class
              </div>
              {ownSubjectIds.length === 0 ? (
                <div className="text-[12px] text-[#8a6d1f] bg-[#fbf3e2] border border-[#ecd8ab] rounded-[11px] px-3 py-2.5">
                  Give this teacher a subject first — new classes reuse the
                  subjects they already teach.
                </div>
              ) : (
                <div className="flex gap-1.5 flex-wrap">
                  {unassigned.map((c) => (
                    <button
                      key={c.id}
                      disabled={busyKlassId === c.id}
                      onClick={() =>
                        run(c.id, () =>
                          setClassSubjects(teacherId, c.id, ownSubjectIds),
                        )
                      }
                      className="px-3 py-2 rounded-[10px] text-[12px] font-semibold border-[1.5px] border-line bg-mist text-green disabled:opacity-60"
                    >
                      + {c.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>
      )}

      <Card className="p-[15px] text-center">
        <button
          disabled
          className="text-[13px] font-semibold text-danger disabled:opacity-45"
        >
          Deactivate account
        </button>
      </Card>

      <div className="text-center text-[11px] text-muted leading-[1.5] mt-3">
        They sign in with their mobile and a one-time code — no password to set
        up.
      </div>
    </div>
  );
}

// The subject a teacher covers in the most classes — used as their headline role.
function primarySubjectOf(detail: AdminTeacherDetail | null): string | null {
  if (!detail) return null;
  const tally = new Map<string, number>();
  for (const a of detail.assignments)
    for (const s of a.subjects) tally.set(s.name, (tally.get(s.name) ?? 0) + 1);
  let best: string | null = null;
  let bestN = 0;
  for (const [nm, n] of tally) if (n > bestN) [best, bestN] = [nm, n];
  return best;
}

// ---------- STAFF ADD (live) ----------
function StaffAdd({
  subjects,
  classes,
  onCreated,
}: {
  subjects: AdminSubject[] | null;
  classes: AdminKlass[] | null;
  onCreated: () => void | Promise<void>;
}) {
  const [sent, setSent] = useState(false);
  const [addedName, setAddedName] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  // Subjects the teacher teaches (subject ids), then which of those in which class.
  const [selSubjects, setSelSubjects] = useState<number[]>([]);
  const [teach, setTeach] = useState<Record<number, number[]>>({});
  const [ctId, setCtId] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneDigits = phone.replace(/\D/g, "");
  const ready =
    name.trim().length > 0 && phoneDigits.length === 10 && !submitting;
  const subjName = (id: number) =>
    subjects?.find((s) => s.id === id)?.name ?? "";
  const teachKlassIds = Object.keys(teach).map(Number);

  function toggleSubject(id: number) {
    const removing = selSubjects.includes(id);
    setSelSubjects((v) => (removing ? v.filter((x) => x !== id) : [...v, id]));
    if (removing) {
      // Drop the de-selected subject from every per-class selection too.
      setTeach((t) => {
        const n: Record<number, number[]> = {};
        for (const k of Object.keys(t).map(Number))
          n[k] = (t[k] || []).filter((s) => s !== id);
        return n;
      });
    }
  }
  function toggleClassTeach(klassId: number) {
    setTeach((t) => {
      if (klassId in t) {
        const n = { ...t };
        delete n[klassId];
        return n;
      }
      return { ...t, [klassId]: [...selSubjects] };
    });
  }
  function toggleClassSubj(klassId: number, subjectId: number) {
    setTeach((t) => {
      const cur = (t[klassId] || []).slice();
      const i = cur.indexOf(subjectId);
      if (i >= 0) cur.splice(i, 1);
      else cur.push(subjectId);
      return { ...t, [klassId]: cur };
    });
  }

  async function send() {
    if (!ready) return;
    setSubmitting(true);
    setError(null);
    const assignments = teachKlassIds
      .map((klassId) => ({
        klassId,
        subjectIds: (teach[klassId] || []).filter((s) =>
          selSubjects.includes(s),
        ),
      }))
      .filter((a) => a.subjectIds.length > 0);
    // Being a class teacher is independent of teaching a subject in that class.
    const classTeacherOf = ctId === "" ? null : ctId;
    try {
      await createTeacher({
        name: name.trim(),
        phone: phoneDigits,
        assignments,
        classTeacherOf,
      });
      setAddedName(name.trim());
      setSent(true);
    } catch (e) {
      setError(
        (e as { response?: { data?: { error?: string } } }).response?.data
          ?.error ?? "Couldn't add the teacher. Please try again.",
      );
      setSubmitting(false);
    }
  }

  if (sent)
    return (
      <SuccessScreen
        title="Teacher added"
        body={`${addedName} can now sign in with their mobile and a one-time code. Their classes and subjects are saved to their profile.`}
        buttonLabel="Back to staff"
        onButton={onCreated}
      />
    );

  return (
    <div className="px-[15px] py-4 pb-6">
      <Field label="Full name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Priya Sharma"
          className={inputCls}
        />
      </Field>
      <Field label="Mobile number · their login">
        <div className="flex items-center bg-white border-[1.5px] border-line rounded-xl overflow-hidden">
          <span className="px-3 text-[13px] font-semibold border-r border-line h-11 flex items-center">
            +91
          </span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="numeric"
            placeholder="Teacher's mobile"
            className="flex-1 min-w-0 border-none px-3 h-11 text-[13px] bg-transparent"
          />
        </div>
      </Field>

      <Field label="Subjects · pick all they teach">
        {subjects === null ? (
          <div className="py-3">
            <Spinner />
          </div>
        ) : subjects.length === 0 ? (
          <div className="text-[12px] text-[#8a6d1f] bg-[#fbf3e2] border border-[#ecd8ab] rounded-[11px] px-3 py-2.5">
            No subjects yet — add your school's subjects from Classes → Add
            first.
          </div>
        ) : (
          <div className="flex gap-1.5 flex-wrap">
            {subjects.map((s) => (
              <Chip
                key={s.id}
                active={selSubjects.includes(s.id)}
                onClick={() => toggleSubject(s.id)}
              >
                {s.name}
              </Chip>
            ))}
          </div>
        )}
      </Field>

      <Field label="Classes & subjects · which subjects in which class">
        {classes === null ? (
          <div className="py-3">
            <Spinner />
          </div>
        ) : selSubjects.length === 0 ? (
          <div className="text-[12px] text-[#8a6d1f] bg-[#fbf3e2] border border-[#ecd8ab] rounded-[11px] px-3 py-2.5">
            Pick the subjects above first, then choose which classes they teach
            them in.
          </div>
        ) : classes.length === 0 ? (
          <div className="text-[12px] text-[#8a6d1f] bg-[#fbf3e2] border border-[#ecd8ab] rounded-[11px] px-3 py-2.5">
            No classes yet — create a class from Classes → Add first.
          </div>
        ) : (
          classes.map((c) => {
            const sel = c.id in teach;
            return (
              <div
                key={c.id}
                className={cx(
                  "border-[1.5px] rounded-[13px] p-3 mb-2",
                  sel ? "border-green bg-[#f3f8f4]" : "border-line bg-white",
                )}
              >
                <div
                  onClick={() => toggleClassTeach(c.id)}
                  className="flex items-center gap-2.5 cursor-pointer"
                >
                  <span
                    className={cx(
                      "w-5 h-5 rounded-md flex-none grid place-items-center border-[1.5px]",
                      sel
                        ? "border-green bg-green text-white"
                        : "border-[#cdd5cc] bg-white",
                    )}
                  >
                    {sel && <Glyph d={GLYPH.check} size={13} stroke={3} />}
                  </span>
                  <b className="text-[13px] font-bold flex-1">{c.label}</b>
                </div>
                {sel && (
                  <div className="flex gap-1.5 flex-wrap mt-2.5 pl-7">
                    {selSubjects.map((su) => {
                      const on = (teach[c.id] || []).includes(su);
                      return (
                        <button
                          key={su}
                          onClick={() => toggleClassSubj(c.id, su)}
                          className={cx(
                            "px-2.5 py-1 rounded-lg text-[11px] font-semibold border",
                            on
                              ? "border-green bg-green text-white"
                              : "border-[#dbe5db] bg-white text-green",
                          )}
                        >
                          {subjName(su)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </Field>

      {classes !== null && classes.length > 0 && (
        <Field label="Class teacher of · optional">
          <div className="flex gap-1.5 flex-wrap">
            <Chip active={ctId === ""} onClick={() => setCtId("")}>
              Not a class teacher
            </Chip>
            {classes.map((c) => (
              <Chip
                key={c.id}
                active={ctId === c.id}
                onClick={() => setCtId(c.id)}
              >
                {c.label}
              </Chip>
            ))}
          </div>
          <div className="text-[11px] text-muted leading-[1.5] mt-2">
            Most teachers are not class teachers — leave this as is. A class
            teacher leads one class, whether or not they teach a subject in it.
          </div>
        </Field>
      )}

      {error && (
        <div className="text-[12px] text-danger bg-[#f6ecec] border border-[#eccfcf] rounded-[11px] px-3 py-2.5 mb-3">
          {error}
        </div>
      )}
      <PrimaryButton disabled={!ready} onClick={send}>
        {submitting ? "Adding…" : "Add teacher"}
      </PrimaryButton>
      <div className="flex gap-2 items-start mt-2.75">
        <span className="flex-none mt-px text-muted">
          <Glyph d={GLYPH.info} size={14} stroke={1.9} />
        </span>
        <div className="text-[11px] text-muted leading-[1.5]">
          They sign in with this mobile and a one-time code — no password,
          nothing to set up.
        </div>
      </div>
    </div>
  );
}

// ---------- CLASSES LIST (live) ----------
function ClassesList({
  classes,
  subjects,
  loading,
  error,
  onRetry,
  onAdd,
  onOpen,
}: {
  classes: AdminKlass[] | null;
  subjects: AdminSubject[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onAdd: () => void;
  onOpen: (id: number) => void;
}) {
  return (
    <div className="px-[15px] py-4 pb-6">
      <button
        onClick={onAdd}
        className="w-full mb-3.5 py-3 rounded-[14px] bg-green text-white font-semibold text-[13px] flex items-center justify-center gap-[7px]"
      >
        <Glyph d={GLYPH.plus} size={17} stroke={2} />
        Add class or subject
      </button>

      {loading && classes === null && (
        <div className="py-10">
          <Spinner />
        </div>
      )}

      {error && classes === null && !loading && (
        <Card className="p-5 text-center">
          <div className="text-[12.5px] text-danger mb-3">{error}</div>
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-[11px] bg-green text-white font-semibold text-[12.5px]"
          >
            Retry
          </button>
        </Card>
      )}

      {classes !== null && (
        <>
          <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">
            {classes.length} {classes.length === 1 ? "class" : "classes"}
          </div>
          {classes.length === 0 ? (
            <EmptyState icon={GLYPH.classes} title="No classes yet">
              Add your first class with a grade and section.
            </EmptyState>
          ) : (
            classes.map((c) => (
              <Card
                key={c.id}
                onClick={() => onOpen(c.id)}
                className="p-[13px] mb-2.25 flex gap-3 items-center"
              >
                <div className="w-[42px] h-[42px] rounded-[13px] bg-mist grid place-items-center flex-none text-green">
                  <Glyph d={GLYPH.classes} size={20} stroke={1.9} />
                </div>
                <div className="flex-1 min-w-0">
                  <b className="text-[14px] font-bold block">{c.label}</b>
                  <small className="text-[11px] text-muted">
                    {c.teacher
                      ? "Class teacher · " + c.teacher
                      : "No class teacher yet"}
                  </small>
                </div>
                <span className="text-[12px] font-bold text-green bg-[#f1f5f1] rounded-[9px] px-2.5 py-1.5 flex-none">
                  {c.students}
                </span>
                <span className="text-[#c3ccc5] flex-none">
                  <Glyph d={GLYPH.chevronRight} size={17} stroke={2.2} />
                </span>
              </Card>
            ))
          )}

          <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5 mt-5">
            {subjects === null
              ? "Subjects"
              : `${subjects.length} ${subjects.length === 1 ? "subject" : "subjects"}`}
          </div>
          {subjects === null ? (
            <div className="py-4">
              <Spinner />
            </div>
          ) : subjects.length === 0 ? (
            <EmptyState icon={GLYPH.results} title="No subjects yet">
              Add your school's subjects from the Add screen — they'll apply
              across every class.
            </EmptyState>
          ) : (
            <div className="flex gap-1.5 flex-wrap">
              {subjects.map((s) => (
                <span
                  key={s.id}
                  className="text-[12px] font-semibold text-green bg-mist rounded-[10px] px-3 py-1.5 flex items-center gap-1.5"
                >
                  <Glyph d={GLYPH.results} size={14} stroke={1.9} />
                  {s.name}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------- CLASS DETAIL (live, 4 tabs) ----------
type ClassTab = "students" | "teachers" | "subjects" | "exams";

function ClassDetail({
  klass,
  subjects,
  allTeachers,
  onClassesChanged,
}: {
  klass: AdminKlass | null;
  subjects: AdminSubject[] | null;
  allTeachers: AdminTeacher[] | null;
  onClassesChanged: () => void | Promise<void>;
}) {
  const [tab, setTab] = useState<ClassTab>("students");
  const [students, setStudents] = useState<ClassStudent[] | null>(null);
  const [clsTeachers, setClsTeachers] = useState<ClassTeacher[] | null>(null);
  const [exams, setExams] = useState<ClassExam[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // students form
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [newStudent, setNewStudent] = useState("");
  const [gName, setGName] = useState("");
  const [gPhone, setGPhone] = useState("");
  const [gRel, setGRel] = useState<GuardianRelation>("Mother");
  const [studEditId, setStudEditId] = useState<number | null>(null);
  const [draft, setDraft] = useState<StudentInput | null>(null);
  // teachers / exams
  const [clsTAddOpen, setClsTAddOpen] = useState(false);
  const [examAddOpen, setExamAddOpen] = useState(false);
  const [newExam, setNewExam] = useState("");
  const [examAllSchool, setExamAllSchool] = useState(false);
  // null = exam covers all subjects; a subject id = single-subject test.
  const [examSubjectId, setExamSubjectId] = useState<number | null>(null);

  const klassId = klass?.id ?? null;

  const load = useCallback(async () => {
    if (klassId === null) return;
    setError(null);
    try {
      const [s, t, e] = await Promise.all([
        listClassStudents(klassId),
        listClassTeachers(klassId),
        listClassExams(klassId),
      ]);
      setStudents(s);
      setClsTeachers(t);
      setExams(e);
    } catch {
      setError("Couldn't load this class. Pull to retry.");
    }
  }, [klassId]);

  useEffect(() => {
    setStudents(null);
    setClsTeachers(null);
    setExams(null);
    load();
  }, [load]);

  if (!klass)
    return (
      <div className="px-[15px] py-10">
        <Spinner />
      </div>
    );

  const ctName =
    clsTeachers?.find((t) => t.isClassTeacher)?.name ?? klass.teacher ?? null;
  const inClassIds = new Set((clsTeachers ?? []).map((t) => t.id));
  const availableTeachers = (allTeachers ?? []).filter(
    (t) => !inClassIds.has(t.id),
  );
  const phoneDigits = gPhone.replace(/\D/g, "");
  const ready =
    newStudent.trim().length > 0 &&
    gName.trim().length > 0 &&
    phoneDigits.length === 10 &&
    !busy;

  // Every mutation refreshes this class, and the class list when a CT changed.
  async function run(fn: () => Promise<void>, alsoClasses = false) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      if (alsoClasses) await onClassesChanged();
    } catch (e) {
      setError(
        (e as { response?: { data?: { error?: string } } }).response?.data
          ?.error ?? "That didn't save. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function switchTab(t: ClassTab) {
    setTab(t);
    setAddStudentOpen(false);
    setStudEditId(null);
    setClsTAddOpen(false);
    setExamAddOpen(false);
  }

  async function addStudent() {
    if (!ready) return;
    await run(() =>
      addClassStudent(klass!.id, {
        name: newStudent.trim(),
        guardianName: gName.trim(),
        guardianPhone: phoneDigits,
        relation: gRel,
      }),
    );
    setNewStudent("");
    setGName("");
    setGPhone("");
    setGRel("Mother");
    setAddStudentOpen(false);
  }

  function beginEdit(s: ClassStudent) {
    setStudEditId(s.id);
    setDraft({
      name: s.name,
      guardianName: s.guardian?.name ?? "",
      guardianPhone: s.guardian?.phone ?? "",
      relation: (s.guardian?.relation as GuardianRelation) ?? "Mother",
    });
  }

  async function saveEdit(id: number) {
    if (!draft) return;
    await run(() => updateStudent(id, draft));
    setStudEditId(null);
    setDraft(null);
  }

  const tabs: { key: ClassTab; label: string }[] = [
    { key: "students", label: "Students" },
    { key: "teachers", label: "Teachers" },
    { key: "subjects", label: "Subjects" },
    { key: "exams", label: "Exams" },
  ];

  return (
    <div className="px-[15px] py-4 pb-6">
      <Card className="p-3.5 mb-3 flex items-center gap-[11px]">
        <div className="w-[38px] h-[38px] rounded-[11px] bg-mist grid place-items-center flex-none text-green">
          <Glyph d={GLYPH.staff} size={19} stroke={1.9} />
        </div>
        <div className="flex-1">
          <small className="text-[9.5px] tracking-[0.1em] uppercase text-muted font-semibold block">
            Class teacher
          </small>
          {ctName ? (
            <b className="text-[13.5px] font-bold">{ctName}</b>
          ) : (
            <span className="text-[12px] text-[#8a6d1f] font-semibold">
              Not set — pick one in Teachers
            </span>
          )}
        </div>
      </Card>

      <div className="flex gap-[3px] bg-[#eef1ec] rounded-[13px] p-1 mb-3.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={cx(
              "flex-1 py-2.25 rounded-[10px] text-[12px] font-bold",
              tab === t.key ? "bg-green text-white" : "text-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <Card className="p-3.5 mb-3 text-[12.5px] text-danger">{error}</Card>
      )}

      {/* ---------------- STUDENTS ---------------- */}
      {tab === "students" &&
        (students === null ? (
          <div className="py-8">
            <Spinner />
          </div>
        ) : (
          <>
            {addStudentOpen ? (
              <Card className="p-3.5 mb-3.5">
                <div className="flex items-center mb-2.5">
                  <div className="flex-1 text-[10px] tracking-[0.13em] uppercase font-semibold text-muted">
                    Add a student
                  </div>
                  <button
                    onClick={() => setAddStudentOpen(false)}
                    className="w-[26px] h-[26px] rounded-lg border border-line bg-white text-muted text-[15px] font-bold flex-none"
                  >
                    ×
                  </button>
                </div>
                <input
                  value={newStudent}
                  onChange={(e) => setNewStudent(e.target.value)}
                  placeholder="Student's full name"
                  className={cx(inputCls, "mb-2.25")}
                />
                <input
                  value={gName}
                  onChange={(e) => setGName(e.target.value)}
                  placeholder="Guardian's name"
                  className={cx(inputCls, "mb-2.25")}
                />
                <div className="flex items-center bg-white border-[1.5px] border-line rounded-[11px] overflow-hidden mb-2.25">
                  <span className="px-[11px] text-[13px] font-semibold border-r border-line h-[42px] flex items-center">
                    +91
                  </span>
                  <input
                    value={gPhone}
                    onChange={(e) => setGPhone(e.target.value)}
                    inputMode="numeric"
                    placeholder="Guardian mobile (for login)"
                    className="flex-1 min-w-0 border-none px-3 h-[42px] text-[13px] bg-transparent"
                  />
                </div>
                <div className="flex gap-1.5 mb-3">
                  {(["Mother", "Father", "Guardian"] as const).map((r) => (
                    <Chip
                      key={r}
                      active={gRel === r}
                      onClick={() => setGRel(r)}
                      className="flex-1 text-center py-2"
                    >
                      {r}
                    </Chip>
                  ))}
                </div>
                <button
                  onClick={addStudent}
                  disabled={!ready}
                  className={cx(
                    "w-full py-3 rounded-xl font-bold text-[13.5px]",
                    ready
                      ? "bg-green text-white"
                      : "bg-[#dfe5df] text-[#9aa39b]",
                  )}
                >
                  {busy ? "Adding…" : "Add student"}
                </button>
                <div className="flex gap-2 items-start mt-2.5">
                  <span className="flex-none mt-px text-muted">
                    <Glyph d={GLYPH.info} size={14} stroke={1.9} />
                  </span>
                  <div className="text-[11px] text-muted leading-[1.5]">
                    The guardian's mobile is their login. They sign in with it
                    and a one-time code — no separate sign-up.
                  </div>
                </div>
              </Card>
            ) : (
              <button
                onClick={() => setAddStudentOpen(true)}
                className="w-full mb-3.5 py-3.5 rounded-[14px] bg-green text-white font-bold text-[14px] flex items-center justify-center gap-2"
              >
                <Glyph d={GLYPH.plus} size={18} stroke={2.2} />
                Add student
              </button>
            )}

            <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">
              {students.length} {students.length === 1 ? "student" : "students"}
            </div>

            {students.map((s, i) => {
              const g = s.guardian;
              const editing = studEditId === s.id;
              return (
                <Card key={s.id} className="p-3 mb-2 rounded-[14px]">
                  {editing && draft ? (
                    <div>
                      <div className="text-[9.5px] tracking-[0.1em] uppercase font-semibold text-[#9aa39b] mb-1.5">
                        Editing {s.admissionNo}
                      </div>
                      <input
                        value={draft.name}
                        onChange={(e) =>
                          setDraft({ ...draft, name: e.target.value })
                        }
                        placeholder="Student's full name"
                        className={cx(inputCls, "mb-2", "rounded-[10px]")}
                      />
                      <input
                        value={draft.guardianName}
                        onChange={(e) =>
                          setDraft({ ...draft, guardianName: e.target.value })
                        }
                        placeholder="Guardian's name"
                        className={cx(inputCls, "mb-2", "rounded-[10px]")}
                      />
                      <div className="flex items-center bg-white border-[1.5px] border-line rounded-[10px] overflow-hidden mb-2">
                        <span className="px-2.5 text-[12.5px] font-semibold border-r border-line h-10 flex items-center">
                          +91
                        </span>
                        <input
                          value={draft.guardianPhone}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              guardianPhone: e.target.value
                                .replace(/\D/g, "")
                                .slice(0, 10),
                            })
                          }
                          inputMode="numeric"
                          placeholder="Guardian mobile (login)"
                          className="flex-1 min-w-0 border-none px-2.5 h-10 text-[13px] bg-transparent"
                        />
                      </div>
                      <div className="flex gap-1.5 mb-2.5">
                        {(["Mother", "Father", "Guardian"] as const).map(
                          (rel) => (
                            <Chip
                              key={rel}
                              active={draft.relation === rel}
                              onClick={() =>
                                setDraft({ ...draft, relation: rel })
                              }
                              className="flex-1 text-center py-1.5"
                            >
                              {rel}
                            </Chip>
                          ),
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          disabled={busy}
                          onClick={() => saveEdit(s.id)}
                          className="flex-1 py-2.75 rounded-[11px] bg-green text-white font-bold text-[13px] disabled:opacity-60"
                        >
                          {busy ? "Saving…" : "Done"}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => {
                            setStudEditId(null);
                            setDraft(null);
                          }}
                          className="px-4 rounded-[11px] bg-white border-[1.5px] border-line text-muted font-bold text-[13px]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-[11px] items-center">
                      <span className="w-[26px] h-[26px] rounded-lg bg-[#f1f5f1] text-muted text-[11px] font-bold grid place-items-center flex-none">
                        {("0" + (i + 1)).slice(-2)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <b className="text-[13.5px] font-semibold block">
                          {s.name}
                        </b>
                        {g ? (
                          <small className="text-[10.5px] text-muted">
                            {g.relation} · {g.name} · {maskPhone(g.phone)}
                          </small>
                        ) : (
                          <small className="text-[10.5px] text-[#a9761b] font-semibold">
                            No guardian phone — can't log in yet
                          </small>
                        )}
                      </div>
                      <button
                        onClick={() => beginEdit(s)}
                        className="w-7 h-7 rounded-[9px] border border-[#dbe5db] bg-white text-green grid place-items-center flex-none"
                        aria-label="Edit"
                      >
                        <Glyph d={GLYPH.edit} size={14} stroke={2} />
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => run(() => deleteStudent(s.id))}
                        aria-label={`Remove ${s.name}`}
                        className="w-7 h-7 rounded-[9px] bg-[#f6ecec] text-danger text-[16px] font-bold flex-none"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </Card>
              );
            })}
            {students.length === 0 && (
              <div className="text-center text-muted text-[12.5px] py-5">
                No students yet. Add the first one above.
              </div>
            )}
          </>
        ))}

      {/* ---------------- TEACHERS ---------------- */}
      {tab === "teachers" &&
        (clsTeachers === null ? (
          <div className="py-8">
            <Spinner />
          </div>
        ) : (
          <>
            {clsTAddOpen ? (
              <Card className="p-3 mb-3.5">
                <div className="flex items-center mb-2.5">
                  <div className="flex-1 text-[10px] tracking-[0.13em] uppercase font-semibold text-muted">
                    Pick a teacher
                  </div>
                  <button
                    onClick={() => setClsTAddOpen(false)}
                    className="w-[26px] h-[26px] rounded-lg border border-line bg-white text-muted text-[15px] font-bold flex-none"
                  >
                    ×
                  </button>
                </div>
                {(subjects ?? []).length === 0 ? (
                  <div className="text-[12px] text-[#8a6d1f] bg-[#fbf3e2] border border-[#ecd8ab] rounded-[11px] px-3 py-2.5">
                    Add a subject to the school first — a teacher joins a class
                    by teaching something in it.
                  </div>
                ) : availableTeachers.length === 0 ? (
                  <div className="text-[12.5px] text-muted px-0.5 py-1">
                    Every teacher is already in this class.
                  </div>
                ) : (
                  availableTeachers.map((t) => (
                    <button
                      key={t.id}
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          await setClassSubjects(t.id, klass.id, [
                            subjects![0].id,
                          ]);
                          setClsTAddOpen(false);
                        })
                      }
                      className="w-full text-left flex items-center gap-2 px-[11px] py-2.5 border-[1.5px] border-line rounded-[11px] bg-white mb-1.75 text-[12.5px] font-semibold text-ink"
                    >
                      <Glyph d={GLYPH.plus} size={15} stroke={2} />
                      {t.name}
                    </button>
                  ))
                )}
              </Card>
            ) : (
              <button
                onClick={() => setClsTAddOpen(true)}
                className="w-full mb-3.5 py-3.5 rounded-[14px] bg-green text-white font-bold text-[14px] flex items-center justify-center gap-2"
              >
                <Glyph d={GLYPH.plus} size={18} stroke={2.2} />
                Add teacher to class
              </button>
            )}

            {clsTeachers.length === 0 && (
              <div className="text-center text-muted text-[12.5px] py-4">
                No teachers in this class yet.
              </div>
            )}

            {clsTeachers.map((t) => {
              const onIds = t.subjects.map((s) => s.id);
              return (
                <Card key={t.id} className="p-3 mb-2.25">
                  <div className="flex items-center gap-2.5 mb-2.25">
                    <b className="flex-1 min-w-0 text-[13.5px] font-bold">
                      {t.name}
                    </b>
                    <button
                      disabled={busy}
                      onClick={() =>
                        run(
                          () =>
                            setClassTeacher(t.id, klass.id, !t.isClassTeacher),
                          true,
                        )
                      }
                      className={cx(
                        "px-2.5 py-1.5 rounded-[9px] text-[10.5px] font-bold border-[1.5px] flex-none",
                        t.isClassTeacher
                          ? "border-green bg-green text-white"
                          : "border-[#dbe5db] bg-white text-green",
                      )}
                    >
                      {t.isClassTeacher ? "Class teacher ✓" : "Make CT"}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        run(() => unassignClass(t.id, klass.id), true)
                      }
                      aria-label={`Remove ${t.name}`}
                      className="w-7 h-7 rounded-[9px] bg-[#f6ecec] text-danger text-[16px] font-bold flex-none"
                    >
                      ×
                    </button>
                  </div>
                  <div className="text-[9.5px] tracking-[0.1em] uppercase font-semibold text-[#9aa39b] mb-1.5">
                    Subjects taught here
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {(subjects ?? []).map((su) => {
                      const on = onIds.includes(su.id);
                      // The last subject can't be toggled off — that would mean
                      // no assignment at all, which is what × is for.
                      const locked = on && onIds.length === 1;
                      return (
                        <button
                          key={su.id}
                          disabled={busy || locked}
                          title={
                            locked
                              ? "A teacher needs at least one subject here — use × to remove them"
                              : undefined
                          }
                          onClick={() =>
                            run(() =>
                              setClassSubjects(
                                t.id,
                                klass.id,
                                on
                                  ? onIds.filter((x) => x !== su.id)
                                  : [...onIds, su.id],
                              ),
                            )
                          }
                          className={cx(
                            "px-2.5 py-1 rounded-lg text-[10.5px] font-semibold border",
                            on
                              ? "border-green bg-green text-white"
                              : "border-[#dbe5db] bg-white text-green",
                            locked && "opacity-70",
                          )}
                        >
                          {su.name}
                        </button>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </>
        ))}

      {/* ---------------- SUBJECTS (read-only, school-wide) ---------------- */}
      {tab === "subjects" &&
        (subjects === null ? (
          <div className="py-8">
            <Spinner />
          </div>
        ) : (
          <>
            <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">
              {subjects.length} {subjects.length === 1 ? "subject" : "subjects"}{" "}
              · school-wide
            </div>
            {subjects.length === 0 ? (
              <div className="text-center text-muted text-[12.5px] py-5">
                No subjects yet. Add them under Classes → Add.
              </div>
            ) : (
              subjects.map((s) => (
                <Card
                  key={s.id}
                  className="p-3 mb-2 rounded-[13px] flex gap-[11px] items-center"
                >
                  <div className="w-8 h-8 rounded-[9px] bg-mist grid place-items-center flex-none text-green">
                    <Glyph d={GLYPH.diary} size={16} stroke={1.9} />
                  </div>
                  <b className="flex-1 min-w-0 text-[13.5px] font-semibold">
                    {s.name}
                  </b>
                </Card>
              ))
            )}
            <div className="text-center text-[11px] text-muted leading-[1.5] mt-3">
              Subjects are shared by every class. Manage them under Classes →
              Add.
            </div>
          </>
        ))}

      {/* ---------------- EXAMS ---------------- */}
      {tab === "exams" &&
        (exams === null ? (
          <div className="py-8">
            <Spinner />
          </div>
        ) : (
          <>
            {examAddOpen ? (
              <Card className="p-3 mb-3.5">
                <div className="flex items-center mb-2.5">
                  <div className="flex-1 text-[10px] tracking-[0.13em] uppercase font-semibold text-muted">
                    New examination
                  </div>
                  <button
                    onClick={() => {
                      setExamAddOpen(false);
                      setNewExam("");
                      setExamAllSchool(false);
                      setExamSubjectId(null);
                    }}
                    className="w-[26px] h-[26px] rounded-lg border border-line bg-white text-muted text-[15px] font-bold flex-none"
                  >
                    ×
                  </button>
                </div>
                <div className="flex gap-2 mb-2.5">
                  <input
                    value={newExam}
                    onChange={(e) => setNewExam(e.target.value)}
                    placeholder="e.g. Annual Exam"
                    className="flex-1 min-w-0 border-[1.5px] border-line rounded-[11px] px-3 py-2.5 text-[13px] bg-white"
                  />
                  <button
                    disabled={!newExam.trim() || busy}
                    onClick={async () => {
                      await run(() =>
                        addClassExam(
                          klass.id,
                          newExam.trim(),
                          examAllSchool,
                          examSubjectId,
                        ),
                      );
                      setNewExam("");
                      setExamAllSchool(false);
                      setExamSubjectId(null);
                      setExamAddOpen(false);
                    }}
                    className={cx(
                      "flex-none px-4 rounded-[11px] font-bold text-[13px]",
                      newExam.trim() && !busy
                        ? "bg-green text-white"
                        : "bg-[#dfe5df] text-[#9aa39b]",
                    )}
                  >
                    Add
                  </button>
                </div>
                <div className="flex gap-1.5 mb-2.5">
                  <Chip
                    active={!examAllSchool}
                    onClick={() => setExamAllSchool(false)}
                    className="flex-1 text-center py-2"
                  >
                    {klass.label} only
                  </Chip>
                  <Chip
                    active={examAllSchool}
                    onClick={() => setExamAllSchool(true)}
                    className="flex-1 text-center py-2"
                  >
                    All school
                  </Chip>
                </div>
                <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-1.5">
                  Subject
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Chip
                    active={examSubjectId === null}
                    onClick={() => setExamSubjectId(null)}
                    className="py-2"
                  >
                    All subjects
                  </Chip>
                  {(subjects ?? []).map((s) => (
                    <Chip
                      key={s.id}
                      active={examSubjectId === s.id}
                      onClick={() => setExamSubjectId(s.id)}
                      className="py-2"
                    >
                      {s.name}
                    </Chip>
                  ))}
                </div>
                <div className="text-[11px] text-muted leading-[1.5] mt-2">
                  {examSubjectId === null
                    ? examAllSchool
                      ? "An all-subjects exam in every class. Each class keeps its own copy, graded per subject."
                      : `An all-subjects exam in ${klass.label}, graded per subject.`
                    : examAllSchool
                      ? "A single-subject test in every class. Each class keeps its own copy."
                      : `A single-subject test in ${klass.label}.`}
                </div>
              </Card>
            ) : (
              <button
                onClick={() => setExamAddOpen(true)}
                className="w-full mb-3.5 py-3.5 rounded-[14px] bg-green text-white font-bold text-[14px] flex items-center justify-center gap-2"
              >
                <Glyph d={GLYPH.plus} size={18} stroke={2.2} />
                Add examination
              </button>
            )}

            <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">
              {exams.length}{" "}
              {exams.length === 1 ? "examination" : "examinations"} in{" "}
              {klass.label}
            </div>
            {exams.length === 0 ? (
              <div className="text-center text-muted text-[12.5px] py-5">
                No examinations yet.
              </div>
            ) : (
              exams.map((e) => (
                <Card
                  key={e.id}
                  className="p-3 mb-2 rounded-[13px] flex gap-[11px] items-center"
                >
                  <div className="w-8 h-8 rounded-[9px] bg-mist grid place-items-center flex-none text-green">
                    <Glyph d={GLYPH.results} size={16} stroke={1.9} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <b className="text-[13.5px] font-semibold block">
                      {e.name}
                    </b>
                    <small className="text-[10.5px] text-muted">
                      {e.subject ? e.subject.name : "All subjects"}
                      {e.schoolWide && " · School-wide"}
                    </small>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => run(() => deleteExam(e.id))}
                    aria-label={`Remove ${e.name}`}
                    className="w-7 h-7 rounded-[9px] bg-[#f6ecec] text-danger text-[16px] font-bold flex-none"
                  >
                    ×
                  </button>
                </Card>
              ))
            )}
          </>
        ))}
    </div>
  );
}

// ---------- ADMIN ATTENDANCE (all classes) ----------
// A class's rate only means something once someone has marked it, so an
// unmarked class stays neutral instead of being painted red at 0%.
function rateColor(pct: number) {
  return pct >= 90 ? "#1f8a5b" : pct >= 80 ? "#c2882a" : "#c0392b";
}

function AdminAttendance({
  data,
  loading,
  error,
  onRetry,
  onOpen,
}: {
  data: AttendanceOverview | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpen: (id: number) => void;
}) {
  if (loading && data === null) {
    return (
      <div className="py-10">
        <Spinner />
      </div>
    );
  }
  if (error && data === null) {
    return (
      <div className="px-[15px] py-4">
        <Card className="p-5 text-center">
          <div className="text-[12.5px] text-danger mb-3">{error}</div>
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-[11px] bg-green text-white font-semibold text-[12.5px]"
          >
            Retry
          </button>
        </Card>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="px-[15px] py-4 pb-6">
      <div className="bg-green text-white rounded-[20px] p-4 mb-3.5 flex items-center gap-3.5">
        <div className="font-serif text-[36px] leading-none">
          {data.marked > 0 ? data.pct : "—"}
          {data.marked > 0 && <span className="text-[16px]">%</span>}
        </div>
        <div className="flex-1">
          <b className="text-[14px] font-bold block">Present today</b>
          <small className="text-[#cfe0d6] text-[11.5px]">
            {data.marked > 0
              ? `${data.present + data.late} of ${data.marked} marked · ${shortDay(data.date)}`
              : `Nothing marked yet · ${shortDay(data.date)}`}
          </small>
        </div>
      </div>

      <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">
        By class
      </div>

      {data.byClass.length === 0 && (
        <EmptyState icon={GLYPH.classes} title="No classes yet">
          Add a class before attendance can be tracked.
        </EmptyState>
      )}

      {data.byClass.map((c) => (
        <Card
          key={c.id}
          onClick={() => onOpen(c.id)}
          className="p-[13px] mb-2.25 rounded-[16px]"
        >
          <div className="flex items-center gap-2.5 mb-2.25">
            <b className="flex-1 min-w-0 text-[13.5px] font-bold">{c.label}</b>
            {c.marked > 0 ? (
              <>
                <small className="text-[11px] text-muted">
                  {c.present + c.late} / {c.marked} present
                </small>
                <span
                  className="text-[13px] font-bold flex-none"
                  style={{ color: rateColor(c.pct) }}
                >
                  {c.pct}%
                </span>
              </>
            ) : (
              <small className="text-[11px] text-muted font-semibold">
                {c.students === 0 ? "No students" : "Not marked"}
              </small>
            )}
            <span className="text-[#c3ccc5] flex-none">
              <Glyph d={GLYPH.chevronRight} size={16} stroke={2.2} />
            </span>
          </div>
          <div className="h-1.5 rounded-[3px] bg-[#eef1ec]">
            {c.marked > 0 && (
              <div
                className="h-1.5 rounded-[3px]"
                style={{ width: `${c.pct}%`, background: rateColor(c.pct) }}
              />
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ---------- ADMIN ATTENDANCE (one class) ----------
const STATUS_PILL: Record<string, { label: string; className: string }> = {
  PRESENT: { label: "Present", className: "bg-[#eaf4ee] text-success" },
  LATE: { label: "Late", className: "bg-[#fbf3e2] text-[#8a6d1f]" },
  ABSENT: { label: "Absent", className: "bg-[#f6ecec] text-danger" },
  HOLIDAY: { label: "Holiday", className: "bg-mist text-muted" },
};

function AdminAttendanceClass({
  att,
  loading,
  error,
  onRetry,
}: {
  att: ClassAttendance | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading && att === null) {
    return (
      <div className="py-10">
        <Spinner />
      </div>
    );
  }
  if (error && att === null) {
    return (
      <div className="px-[15px] py-4">
        <Card className="p-5 text-center">
          <div className="text-[12.5px] text-danger mb-3">{error}</div>
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-[11px] bg-green text-white font-semibold text-[12.5px]"
          >
            Retry
          </button>
        </Card>
      </div>
    );
  }
  if (!att) return null;

  return (
    <div className="px-[15px] py-4 pb-6">
      <div className="flex gap-2.5 mb-3.5">
        <div className="flex-1 bg-[#eaf4ee] border border-[#cfe3d6] rounded-2xl p-[13px] text-center">
          <div className="font-serif text-[26px] leading-none text-success">
            {att.present + att.late}
          </div>
          <small className="text-[10px] uppercase text-muted font-semibold">
            Present
          </small>
        </div>
        <div className="flex-1 bg-[#f6ecec] border border-[#eccfcf] rounded-2xl p-[13px] text-center">
          <div className="font-serif text-[26px] leading-none text-danger">
            {att.absent}
          </div>
          <small className="text-[10px] uppercase text-muted font-semibold">
            Absent
          </small>
        </div>
        <div className="flex-1 bg-cloud border border-line rounded-2xl p-[13px] text-center">
          <div className="font-serif text-[26px] leading-none text-green">
            {att.marked > 0 ? `${att.pct}%` : "—"}
          </div>
          <small className="text-[10px] uppercase text-muted font-semibold">
            Rate
          </small>
        </div>
      </div>

      <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">
        {att.students} {att.students === 1 ? "student" : "students"}
        {att.marked === 0 && att.students > 0 && " · not marked yet"}
      </div>

      {att.roster.length === 0 && (
        <EmptyState icon={GLYPH.students} title="No students yet">
          Add students to this class to track their attendance.
        </EmptyState>
      )}

      {att.roster.map((r) => {
        const pill = r.status ? STATUS_PILL[r.status] : null;
        return (
          <Card
            key={r.id}
            className="p-3 mb-2 rounded-[13px] flex gap-[11px] items-center"
          >
            <span className="w-[26px] h-[26px] rounded-lg bg-[#f1f5f1] text-muted text-[11px] font-bold grid place-items-center flex-none">
              {r.roll}
            </span>
            <b className="flex-1 min-w-0 text-[13.5px] font-semibold truncate">
              {r.name}
            </b>
            <span
              className={cx(
                "text-[10.5px] font-bold px-2.5 py-1 rounded-lg flex-none",
                pill?.className ?? "bg-[#f1f5f1] text-muted",
              )}
            >
              {pill?.label ?? "—"}
            </span>
          </Card>
        );
      })}
    </div>
  );
}

// ---------- CLASS ADD (live) ----------
function ClassAdd({
  teachers,
  onCreated,
}: {
  teachers: AdminTeacher[];
  onCreated: () => void | Promise<void>;
}) {
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  // '' = "Assign later" (the default). Otherwise the selected teacher's id.
  const [ct, setCt] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready =
    grade.trim().length > 0 && section.trim().length > 0 && !submitting;

  async function create() {
    if (!ready) return;
    setSubmitting(true);
    setError(null);
    try {
      await createClass({
        grade: grade.trim(),
        section: section.trim().toUpperCase(),
        classTeacherId: ct === "" ? null : ct,
      });
      await onCreated();
    } catch (e) {
      const status = (
        e as { response?: { status?: number; data?: { error?: string } } }
      ).response;
      setError(
        status?.data?.error ?? "Couldn't create the class. Please try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex gap-2.5 mb-3.5">
        <Field label="Grade" className="flex-1">
          <input
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder="e.g. 5"
            className={inputCls}
          />
        </Field>
        <Field label="Section" className="flex-1">
          <input
            value={section}
            onChange={(e) => setSection(e.target.value)}
            placeholder="e.g. C"
            className={inputCls}
          />
        </Field>
      </div>
      <Field label="Class teacher · optional">
        <div className="flex gap-1.5 flex-wrap">
          <Chip active={ct === ""} onClick={() => setCt("")}>
            Assign later
          </Chip>
          {teachers.map((t) => (
            <Chip key={t.id} active={ct === t.id} onClick={() => setCt(t.id)}>
              {t.name}
            </Chip>
          ))}
        </div>
        {teachers.length === 0 && (
          <div className="text-[11.5px] text-muted mt-2">
            No teachers yet — you can add them later and assign a class teacher
            then.
          </div>
        )}
      </Field>
      {error && (
        <div className="text-[12px] text-danger bg-[#f6ecec] border border-[#eccfcf] rounded-[11px] px-3 py-2.5 mb-3">
          {error}
        </div>
      )}
      <PrimaryButton disabled={!ready} onClick={create}>
        {submitting ? "Creating…" : "Create class"}
      </PrimaryButton>
      <div className="text-center text-[11px] text-muted leading-[1.5] mt-3">
        The class teacher can also be set or changed later from any teacher's
        profile.
      </div>
    </>
  );
}

// ---------- CLASS / SUBJECT ADD (chip-switched) ----------
function ClassOrSubjectAdd({
  teachers,
  onClassCreated,
  subjects,
  onSubjectsChanged,
}: {
  teachers: AdminTeacher[];
  onClassCreated: () => void | Promise<void>;
  subjects: AdminSubject[] | null;
  onSubjectsChanged: () => void | Promise<void>;
}) {
  const [mode, setMode] = useState<"class" | "subject">("class");
  return (
    <div className="px-[15px] py-4 pb-6">
      <div className="flex gap-1.5 mb-4">
        <Chip active={mode === "class"} onClick={() => setMode("class")}>
          Class
        </Chip>
        <Chip active={mode === "subject"} onClick={() => setMode("subject")}>
          Subject
        </Chip>
      </div>
      {mode === "class" ? (
        <ClassAdd teachers={teachers} onCreated={onClassCreated} />
      ) : (
        <SubjectManager subjects={subjects} onChanged={onSubjectsChanged} />
      )}
    </div>
  );
}

// ---------- SUBJECT MANAGER (school-level CRUD) ----------
function SubjectManager({
  subjects,
  onChanged,
}: {
  subjects: AdminSubject[] | null;
  onChanged: () => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  function readErr(e: unknown, fallback: string) {
    return (
      (e as { response?: { data?: { error?: string } } }).response?.data
        ?.error ?? fallback
    );
  }

  async function add() {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createSubject(n);
      setName("");
      await onChanged();
    } catch (e) {
      setError(readErr(e, "Couldn't add the subject. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: number) {
    const n = editName.trim();
    if (!n || busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateSubject(id, n);
      setEditId(null);
      await onChanged();
    } catch (e) {
      setError(readErr(e, "Couldn't rename the subject. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteSubject(id);
      await onChanged();
    } catch (e) {
      setError(readErr(e, "Couldn't delete the subject. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Field label="Subject name">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
            placeholder="e.g. Mathematics"
            className={inputCls}
          />
          <button
            onClick={add}
            disabled={!name.trim() || busy}
            className="px-4 rounded-xl bg-green text-white font-semibold text-[13px] flex items-center gap-1.5 disabled:opacity-50 flex-none"
          >
            <Glyph d={GLYPH.plus} size={16} stroke={2} />
            Add
          </button>
        </div>
      </Field>
      {error && (
        <div className="text-[12px] text-danger bg-[#f6ecec] border border-[#eccfcf] rounded-[11px] px-3 py-2.5 mb-3">
          {error}
        </div>
      )}

      {subjects === null ? (
        <div className="py-8">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="text-[10px] tracking-[0.13em] uppercase font-semibold text-muted mb-2.5">
            {subjects.length} {subjects.length === 1 ? "subject" : "subjects"}
          </div>
          {subjects.length === 0 ? (
            <EmptyState icon={GLYPH.results} title="No subjects yet">
              Add your school's subjects here — they'll be available across
              every class.
            </EmptyState>
          ) : (
            subjects.map((s) => (
              <Card
                key={s.id}
                className="p-[13px] mb-2.25 flex gap-3 items-center"
              >
                <div className="w-[42px] h-[42px] rounded-[13px] bg-mist grid place-items-center flex-none text-green">
                  <Glyph d={GLYPH.results} size={20} stroke={1.9} />
                </div>
                {editId === s.id ? (
                  <>
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(s.id);
                        if (e.key === "Escape") setEditId(null);
                      }}
                      className={cx(inputCls, "flex-1 min-w-0")}
                    />
                    <button
                      onClick={() => saveEdit(s.id)}
                      disabled={busy}
                      className="text-green flex-none"
                      aria-label="Save"
                    >
                      <Glyph d={GLYPH.check} size={20} stroke={2} />
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      className="text-muted flex-none text-[12px] font-semibold"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <b className="text-[14px] font-bold block truncate">
                        {s.name}
                      </b>
                    </div>
                    <button
                      onClick={() => {
                        setEditId(s.id);
                        setEditName(s.name);
                      }}
                      className="text-muted flex-none"
                      aria-label="Rename"
                    >
                      <Glyph d={GLYPH.edit} size={18} stroke={1.9} />
                    </button>
                    <button
                      onClick={() => remove(s.id)}
                      disabled={busy}
                      className="text-danger flex-none"
                      aria-label="Delete"
                    >
                      <Glyph d={GLYPH.trash} size={18} stroke={1.9} />
                    </button>
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
// ---------- NOTICES (live) ----------
const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function shortDay(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()} ${MONTH_ABBR[d.getMonth()]}`;
}

function AdminNoticeBoard({
  notices,
  loading,
  error,
  onRetry,
  onOpen,
  onCompose,
}: {
  notices: AdminNotice[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpen: (id: number) => void;
  onCompose: () => void;
}) {
  return (
    <div className="px-[15px] py-4 pb-6">
      <button
        onClick={onCompose}
        className="w-full mb-3.5 py-3 rounded-[14px] bg-green text-white font-semibold text-[13px] flex items-center justify-center gap-[7px]"
      >
        <Glyph d={GLYPH.plus} size={17} stroke={2} />
        Post a new notice
      </button>

      {loading && notices === null && (
        <div className="py-10">
          <Spinner />
        </div>
      )}

      {error && notices === null && !loading && (
        <Card className="p-5 text-center">
          <div className="text-[12.5px] text-danger mb-3">{error}</div>
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-[11px] bg-green text-white font-semibold text-[12.5px]"
          >
            Retry
          </button>
        </Card>
      )}

      {notices !== null &&
        (notices.length === 0 ? (
          <EmptyState icon={GLYPH.notices} title="No notices yet">
            Post your first notice — it lands on every parent's board straight
            away.
          </EmptyState>
        ) : (
          notices.map((n) => (
            <Card
              key={n.id}
              onClick={() => onOpen(n.id)}
              className="p-3.5 mb-2.5 flex gap-3 items-start"
            >
              <div className="w-[38px] h-[38px] rounded-xl bg-gold-soft grid place-items-center flex-none text-[#8a6d1f]">
                <Glyph d={GLYPH.notices} size={19} stroke={1.8} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-[7px] mb-1 flex-wrap">
                  <span className="text-[9.5px] font-bold tracking-[0.05em] uppercase text-green bg-mist px-[7px] py-[3px] rounded-md">
                    {n.category}
                  </span>
                  <span className="text-[9.5px] font-bold tracking-[0.05em] uppercase text-muted">
                    {n.audienceLabel ?? "All parents"}
                  </span>
                  {n.pinned && (
                    <span className="text-[9.5px] font-bold tracking-[0.05em] text-[#8a6d1f]">
                      PINNED
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-muted font-semibold">
                    {shortDay(n.createdAt)}
                  </span>
                </div>
                <h4 className="font-serif text-[17px] leading-[1.15] mb-[3px]">
                  {n.title}
                </h4>
                <p className="text-[12px] text-muted leading-[1.45] line-clamp-1">
                  {n.body}
                </p>
                <div className="text-[10.5px] text-muted font-semibold mt-1.5">
                  {n.ackCount} of {n.totalParents} acknowledged
                </div>
              </div>
              <span className="text-[#c3ccc5] flex-none mt-1">
                <Glyph d={GLYPH.chevronRight} size={17} stroke={2.2} />
              </span>
            </Card>
          ))
        ))}
    </div>
  );
}

function AdminNoticeDetail({
  notice,
  onEdit,
  onDeleted,
}: {
  notice: AdminNotice | null;
  onEdit: () => void;
  onDeleted: () => void | Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!notice)
    return (
      <div className="px-[15px] py-10">
        <Spinner />
      </div>
    );

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await deleteNotice(notice!.id);
      await onDeleted();
    } catch {
      setError("Couldn't delete this notice. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="px-[15px] py-4 pb-6">
      <Card className="p-3.5 mb-3">
        <div className="flex items-center gap-2 mb-[11px] flex-wrap">
          <span className="text-[9.5px] font-bold tracking-[0.05em] uppercase text-green bg-mist px-2 py-[3px] rounded-md">
            {notice.category}
          </span>
          <span className="text-[9.5px] font-bold tracking-[0.05em] uppercase text-muted">
            {notice.audienceLabel ?? "All parents"}
          </span>
          {notice.pinned && (
            <span className="text-[9.5px] font-bold tracking-[0.05em] text-[#8a6d1f]">
              PINNED
            </span>
          )}
          <span className="ml-auto text-[10.5px] text-muted font-semibold">
            {shortDay(notice.createdAt)}
          </span>
        </div>
        <h3 className="font-serif text-[24px] leading-[1.1] mb-1">
          {notice.title}
        </h3>
        <div className="text-[11px] text-muted font-semibold mb-3">
          {notice.from}
        </div>
        <p className="text-[13.5px] leading-[1.6] whitespace-pre-line">
          {notice.body}
        </p>
      </Card>

      <div className="text-center text-[11.5px] text-muted font-semibold mb-3">
        {notice.ackCount} of {notice.totalParents}{" "}
        {notice.totalParents === 1 ? "parent has" : "parents have"} acknowledged
      </div>

      {error && (
        <Card className="p-3.5 mb-3 text-[12.5px] text-danger">{error}</Card>
      )}

      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 py-3 rounded-[14px] bg-white border-[1.5px] border-line text-green font-semibold text-[13px]"
        >
          Edit notice
        </button>
        {confirming ? (
          <button
            disabled={busy}
            onClick={remove}
            className="flex-1 py-3 rounded-[14px] bg-danger text-white font-semibold text-[13px] disabled:opacity-60"
          >
            {busy ? "Deleting…" : "Tap again to delete"}
          </button>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="flex-1 py-3 rounded-[14px] bg-[#f6ecec] text-danger font-semibold text-[13px]"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// Compose doubles as the edit form — `editing` pre-fills it and switches to PUT.
function NoticeCompose({
  editing,
  classes,
  onDone,
}: {
  editing: AdminNotice | null;
  classes: AdminKlass[] | null;
  onDone: () => void | Promise<void>;
}) {
  const [sent, setSent] = useState(false);
  const [cat, setCat] = useState(editing?.category ?? "Admin");
  const [ncTitle, setNcTitle] = useState(editing?.title ?? "");
  const [ncBody, setNcBody] = useState(editing?.body ?? "");
  const [pinned, setPinned] = useState(editing?.pinned ?? false);
  const [audience, setAudience] = useState<number | null>(
    editing?.audienceClassId ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = ncTitle.trim().length > 0 && ncBody.trim().length > 0 && !busy;
  const audienceLabel =
    audience === null
      ? "all parents"
      : (classes?.find((c) => c.id === audience)?.label ?? "the class");

  async function publish() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    const payload = {
      title: ncTitle.trim(),
      body: ncBody.trim(),
      category: cat,
      pinned,
      audienceClassId: audience,
    };
    try {
      if (editing) await updateNotice(editing.id, payload);
      else await createNotice(payload);
      setSent(true);
    } catch (e) {
      setError(
        (e as { response?: { data?: { error?: string } } }).response?.data
          ?.error ?? "Couldn't save the notice. Please try again.",
      );
      setBusy(false);
    }
  }

  if (sent)
    return (
      <SuccessScreen
        title={editing ? "Notice updated" : "Notice published"}
        body={
          editing
            ? "The updated notice is live on the board."
            : `It's now on the notice board for ${audienceLabel}.`
        }
        buttonLabel="View notice board"
        onButton={onDone}
      />
    );

  return (
    <div className="px-[15px] py-4 pb-6">
      <Field label="Category">
        <div className="flex gap-1.5 flex-wrap">
          {NOTICE_CATEGORIES.map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
              {c}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Audience · who sees this">
        <div className="flex gap-1.5 flex-wrap">
          <Chip active={audience === null} onClick={() => setAudience(null)}>
            All parents
          </Chip>
          {(classes ?? []).map((c) => (
            <Chip
              key={c.id}
              active={audience === c.id}
              onClick={() => setAudience(c.id)}
            >
              {c.label}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Title">
        <input
          value={ncTitle}
          onChange={(e) => setNcTitle(e.target.value)}
          placeholder="e.g. Sports Day rescheduled"
          className={inputCls}
        />
      </Field>

      <Field label="Message to parents">
        <textarea
          value={ncBody}
          onChange={(e) => setNcBody(e.target.value)}
          placeholder="Write the notice…"
          className={cx(inputCls, "resize-none h-[120px]")}
        />
      </Field>

      <Field label="Pin to the top">
        <div className="flex gap-1.5">
          <Chip
            active={!pinned}
            onClick={() => setPinned(false)}
            className="flex-1 text-center py-2"
          >
            Normal
          </Chip>
          <Chip
            active={pinned}
            onClick={() => setPinned(true)}
            className="flex-1 text-center py-2"
          >
            Pinned
          </Chip>
        </div>
      </Field>

      {error && (
        <div className="text-[12px] text-danger bg-[#f6ecec] border border-[#eccfcf] rounded-[11px] px-3 py-2.5 mb-3">
          {error}
        </div>
      )}

      <PrimaryButton disabled={!ready} onClick={publish}>
        {busy
          ? "Saving…"
          : editing
            ? "Save changes"
            : `Publish to ${audienceLabel}`}
      </PrimaryButton>
    </div>
  );
}

// ---------- CALENDAR / EVENTS (live) ----------
function AdminCalendar({
  events,
  loading,
  error,
  onRetry,
  onChanged,
}: {
  events: AdminEvent[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ date: "", title: "", description: "" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const ready = form.title.trim().length > 0 && form.date.length === 10 && !busy;

  function openAdd() {
    setForm({ date: "", title: "", description: "" });
    setEditId(null);
    setAdding(true);
  }
  function openEdit(e: AdminEvent) {
    setForm({
      date: e.date,
      title: e.title,
      description: e.description ?? "",
    });
    setEditId(e.id);
    setAdding(true);
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      await onChanged();
      setAdding(false);
      setEditId(null);
    } catch (e) {
      setActionError(
        (e as { response?: { data?: { error?: string } } }).response?.data
          ?.error ?? "That didn't save. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!ready) return;
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      date: form.date,
    };
    run(() =>
      editId === null
        ? createEvent(payload).then(() => undefined)
        : updateEvent(editId, payload).then(() => undefined),
    );
  }

  return (
    <div className="px-[15px] py-4 pb-6">
      {!adding && (
        <button
          onClick={openAdd}
          className="w-full mb-3.5 py-3 rounded-[14px] bg-green text-white font-semibold text-[13px] flex items-center justify-center gap-[7px]"
        >
          <Glyph d={GLYPH.plus} size={17} stroke={2} />
          Add an event
        </button>
      )}

      {adding && (
        <Card className="p-3.5 mb-4">
          <div className="flex items-center mb-2.5">
            <div className="flex-1 text-[10px] tracking-[0.13em] uppercase font-semibold text-muted">
              {editId === null ? "New event" : "Edit event"}
            </div>
            <button
              onClick={() => {
                setAdding(false);
                setEditId(null);
              }}
              className="w-[26px] h-[26px] rounded-lg border border-line bg-white text-muted text-[15px] font-bold flex-none"
            >
              ×
            </button>
          </div>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className={cx(inputCls, "mb-2.25")}
          />
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Event title"
            className={cx(inputCls, "mb-2.25")}
          />
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Details — time, venue (optional)"
            className={cx(inputCls, "mb-3")}
          />
          <button
            onClick={save}
            disabled={!ready}
            className={cx(
              "w-full py-3 rounded-xl font-bold text-[13.5px]",
              ready ? "bg-green text-white" : "bg-[#dfe5df] text-[#9aa39b]",
            )}
          >
            {busy ? "Saving…" : editId === null ? "Add event" : "Save changes"}
          </button>
        </Card>
      )}

      {actionError && (
        <Card className="p-3.5 mb-3 text-[12.5px] text-danger">
          {actionError}
        </Card>
      )}

      {loading && events === null && (
        <div className="py-10">
          <Spinner />
        </div>
      )}

      {error && events === null && !loading && (
        <Card className="p-5 text-center">
          <div className="text-[12.5px] text-danger mb-3">{error}</div>
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-[11px] bg-green text-white font-semibold text-[12.5px]"
          >
            Retry
          </button>
        </Card>
      )}

      {events !== null &&
        (events.length === 0 ? (
          <EmptyState icon={GLYPH.calendar} title="No events yet">
            Add the school's first event — parents see it on their calendar.
          </EmptyState>
        ) : (
          events.map((e) => {
            const d = new Date(`${e.date}T00:00:00.000Z`);
            return (
              <Card key={e.id} className="p-3 mb-2.25 flex gap-3 items-center">
                <div className="w-[46px] flex-none text-center">
                  <div className="text-[9.5px] tracking-[0.08em] font-bold text-muted uppercase">
                    {MONTH_ABBR[d.getUTCMonth()]}
                  </div>
                  <div className="text-[19px] font-bold leading-[1.1] text-green">
                    {String(d.getUTCDate()).padStart(2, "0")}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <b className="text-[13.5px] font-semibold block">{e.title}</b>
                  <small className="text-[11px] text-muted">
                    {e.description || "School event"}
                  </small>
                </div>
                <button
                  onClick={() => openEdit(e)}
                  aria-label={`Edit ${e.title}`}
                  className="w-7 h-7 rounded-[9px] border border-[#dbe5db] bg-white text-green grid place-items-center flex-none"
                >
                  <Glyph d={GLYPH.edit} size={14} stroke={2} />
                </button>
                <button
                  disabled={busy}
                  onClick={() => run(() => deleteEvent(e.id))}
                  aria-label={`Remove ${e.title}`}
                  className="w-7 h-7 rounded-[9px] bg-[#f6ecec] text-danger text-[16px] font-bold flex-none"
                >
                  ×
                </button>
              </Card>
            );
          })
        ))}
    </div>
  );
}

// ---------- small form helpers ----------
const inputCls =
  "w-full box-border px-3 py-[11px] border-[1.5px] border-line rounded-xl text-[13px] bg-white";
function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [main, hint] = label.split(" · ");
  return (
    <div className={cx("mb-3.5", className)}>
      <label className="block text-[12px] font-semibold mb-[7px]">
        {main}
        {hint && <span className="text-muted font-medium"> · {hint}</span>}
      </label>
      {children}
    </div>
  );
}
