# Greenwood Parent App — Product Requirements Document

**Status:** Draft for engineering reference
**Source:** Clickable prototype (`initial-mock.html`)
**Purpose:** Reference document for Claude Code to scaffold and build the product in phases

---

## 1. Overview

Greenwood is a mobile-first parent app for a K-12 school. Parents get a single
branded surface to check their child's attendance, homework, results, school
announcements, and photos, and to handle day-to-day admin tasks (applying for
leave, acknowledging notices) without emailing the school office.

The existing artifact is a static, single-child, single-parent clickable
prototype with no backend, hardcoded data, and no auth. This PRD scopes the
path from that prototype to a real, multi-tenant, multi-child product.

### 1.1 Goals

- Give parents a fast, reliable "is my kid okay today" view (attendance +
  notices) within one tap of opening the app.
- Reduce the school office's paper/email load for leave requests and notices.
- Give the school a reliable read receipt on important communications
  (notice acknowledgement).
- Ship incrementally: each phase should be independently usable/demoable.

### 1.2 Non-goals (for now)

- Payments / fee collection (mentioned in prototype copy, not in scope until
  a later phase — flag as Phase 5+ candidate).
- Teacher-side dashboard (the prototype explicitly marks this "coming soon" —
  treated as a separate, later product surface, not part of this PRD's phases).
- Chat/messaging between parents and teachers.
- Multi-school marketplace / school onboarding self-serve flow.

### 1.3 Primary persona

**Parent/guardian** of one or more children enrolled at a single school.
Mobile-first, often checking the app in short bursts (30–90 seconds),
frequently on a school-day morning or evening.

---

## 2. Feature Inventory (from prototype)

Reverse-engineered from the clickable mock, in the order a parent encounters
them:

| #   | Feature               | Prototype behavior                                                                                                | Notes                                                                                                            |
| --- | --------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | Lock screen           | Tap-to-open splash with a live "X was marked Present" preview notification                                        | Purely cosmetic in prototype; real app needs real OS-level push, this becomes a notification banner pattern only |
| 2   | Home dashboard        | Attendance status card, quick actions (Leave, Results, Photos), notice preview, diary preview, latest photo album | Single scrollable feed                                                                                           |
| 3   | Attendance            | Monthly calendar heatmap (present/absent/holiday), % present, present/absent counts                               | Read-only in prototype                                                                                           |
| 4   | Apply for leave       | Type (sick/casual/other), date range, reason text, submit → confirmation screen                                   | No real date picker; single child; no attachment upload                                                          |
| 5   | Notice board          | List of school notices, pinned + category tags, unread indicator, acknowledgement                                 | Acknowledgement is per-notice, tracked client-side only                                                          |
| 6   | Notice detail         | Full notice body, acknowledge button, aggregate ack count ("142 of 180 parents")                                  | Ack count is fake/static                                                                                         |
| 7   | Digital diary         | Day-by-day homework/task list per subject, tap to mark done, teacher note                                         | Marking "done" is a personal parent-side checklist, not submission                                               |
| 8   | Calendar              | Upcoming school-wide events list                                                                                  | Read-only, no personal reminders/sync                                                                            |
| 9   | Results / report card | Overall %, class rank, grade, per-subject score bars, teacher comment                                             | Single test snapshot, no historical trend                                                                        |
| 10  | Photo gallery         | Album grid, single album view                                                                                     | No real image loading, no download/share                                                                         |
| 11  | Notifications         | Flat list of recent events (attendance, notices, homework, results, photos)                                       | No read/unread state, no deep-linking verified                                                                   |

Cross-cutting gaps not visible in the prototype but required for a real
product: authentication, multi-child support, multi-parent-per-child support,
real push notifications, an admin/school-side way to actually create
attendance records/notices/homework/results/photos, and data persistence.

---

## 3. Success Metrics

- **Activation:** % of invited parents who complete onboarding within 7 days.
- **Engagement:** Weekly active parents / total enrolled families.
- **Notice reach:** % of pinned notices acknowledged within 48 hours.
- **Leave friction:** Median time from leave submission to school response.
- **Reliability:** Push notification delivery rate for attendance marks.

---

## 4. Phased Delivery Plan

Each phase is meant to produce a working, demoable slice. Phases are
sequential; later phases assume earlier ones are done unless noted.

### Phase 0 — Foundations (infra, not user-facing)

**Goal:** Nothing a parent sees yet, but the skeleton everything else needs.

- Repo scaffold: choose stack (suggest: React Native or Expo for mobile
  client to match the existing mobile-shell prototype; Node/TypeScript +
  Postgres for backend, but confirm with the team before Claude Code
  commits to a stack).
- Data model v1: `School`, `Family`, `Parent`, `Student`, `Enrollment`
  (student ↔ school/section/grade), `ParentStudentLink` (supports multiple
  parents per student and multiple students per parent).
- Auth: parent login (email/phone + OTP or password), session management,
  password reset.
- Environment/config setup, CI skeleton, basic error logging.

**Exit criteria:** A parent can create an account, log in, and see an empty
home screen with their real name and linked child(ren) listed.

---

### Phase 1 — Core "Today" Experience

**Goal:** Replicate the prototype's home + attendance + notices with real
data, single child.

- Home dashboard: today's attendance status pulled from backend, real
  notice preview, real diary preview.
- Attendance: backend model for daily attendance records; monthly calendar
  view backed by real records; %, present/absent counts computed from data.
- Notice board: backend model for notices (title, body, category, pinned,
  audience — e.g. whole school / grade / section); list + detail view;
  acknowledgement recorded per parent per notice, with a real aggregate
  count.
- Basic admin write path (even if it's an internal-only tool or seeded via
  script/API for now) so notices and attendance can actually be created —
  this doesn't need a UI yet, just an authenticated endpoint.
- Push notifications: attendance marked, new pinned notice. Real device
  push (APNs/FCM), not the fake lock-screen banner.

**Exit criteria:** A parent with one linked child can log in, see today's
real attendance, read and acknowledge a real notice, and receive a push
when either happens.

---

### Phase 2 — Daily Workflow Features

**Goal:** Round out the day-to-day toolset from the prototype.

- Digital diary/homework: backend model for daily homework entries per
  subject; parent-side "done" checklist state persisted per student (not
  just local UI state).
- Leave application: multi-child aware; date range with a real date
  picker; status lifecycle (submitted → approved/declined) with
  notification on status change; leave history list.
- Calendar: backend model for school-wide events; list view; optional
  "add to device calendar" export (.ics).
- Notifications center: real read/unread state, tap-through to the
  relevant screen (deep linking), pagination for history.

**Exit criteria:** A parent can view and check off homework, submit a
leave request and see it move through a real status, and browse upcoming
events — all backed by persisted data and reflected in notifications.

---

### Phase 3 — Multi-Child & Academics

**Goal:** Support families with more than one child and add the
results/photos surfaces.

- Multi-child switcher: all Phase 1–2 screens (attendance, diary, leave,
  results) become per-child, with a persistent child selector on the home
  screen.
- Results/report card: backend model for test/term results per subject;
  per-child, per-term view; historical view across terms (the prototype
  only shows one snapshot — this phase should add a term picker).
  Note: any UI copy or example content referencing individual students
  should use invented names — do not reuse real student data.
- Photo gallery: real album/photo storage (object storage + CDN), album
  list and detail view, lazy loading, basic download.
- Permission model refinement: which parent sees which child if custody /
  access differs (flag with the school as a policy question before
  building enforcement logic).

**Exit criteria:** A parent with 2+ children can switch between them and
see correct, isolated data for attendance/diary/results/leave for each.

---

### Phase 4 — Polish, Scale, Reliability

**Goal:** Production-hardening before wider rollout.

- Offline/poor-connectivity handling (cache last-known attendance/notices,
  optimistic UI for diary checkboxes).
- Accessibility pass (dynamic text sizing, screen reader labels — the
  current prototype is highly custom-styled and will need explicit ARIA
  work if it stays web-based).
- Localization scaffold if the school serves non-English-speaking families.
- Analytics instrumentation tied to the Section 3 success metrics.
- Load testing on notice push fan-out (a single notice can notify
  hundreds of families at once).
- School-facing admin panel (basic version): staff can create/edit
  notices, mark attendance in bulk, post homework, upload photo albums,
  approve/decline leave — this replaces the "seeded via script" approach
  from Phase 1.

**Exit criteria:** App is stable under realistic school-wide load, has a
usable (if basic) staff-facing admin tool, and meets a baseline
accessibility standard.

---

### Phase 5+ — Future / Not Yet Scoped

Candidates to revisit after Phase 4, each deserving its own PRD:

- Fee/payment collection.
- Full teacher dashboard (gradebook, attendance-taking UI, homework
  authoring flow) — the prototype flags this as a future "companion build."
- Parent-teacher messaging.
- Parent-teacher meeting slot booking (referenced in notice copy in the
  prototype).
- School onboarding self-serve / multi-tenant admin.

---

## 5. Open Questions for the Team

1. Target platform: native mobile app, PWA, or continue as a web app with
   a mobile-optimized shell (like the current prototype)?
2. Who authors notices/homework/results in Phase 1 before an admin UI
   exists — a temporary internal tool, direct DB seeding, or a minimal
   CSV import?
3. Custody / multi-guardian access rules — does the school have an
   existing policy to encode, or does this need to be defined from
   scratch?
4. Push notification provider preference (Firebase Cloud Messaging vs.
   a unified service like OneSignal)?
5. Is a single school in scope for v1, or should multi-school tenancy be
   designed in from Phase 0 even if only one school launches first?

---

## 6. How to Use This Doc with Claude Code

Suggested prompt pattern for each phase:

> "Using `greenwood-prd.md`, implement Phase N. Reference the existing
> prototype markup/behavior in `initial-mock.html` for exact copy, layout,
> and interaction patterns where this PRD doesn't specify otherwise Confirm
> the stack/data model from Phase 0 before writing Phase N code if this is
> a new session."

Keep this file updated as decisions get made in Section 5 — turn each
resolved open question into a locked-in requirement in the relevant phase
section rather than leaving it ambiguous for Claude Code to guess.
