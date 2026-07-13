# Frontend Plan & Reference — Greenwood

Vite + React + TypeScript, Tailwind CSS v4, React Router, TanStack Query. Mobile-
first, reproduces the prototype's design, Capacitor-ready.

## Stack

| Concern      | Choice                                             |
| ------------ | -------------------------------------------------- |
| Build        | Vite + React + TypeScript                          |
| Styling      | Tailwind CSS v4 (`@tailwindcss/vite`, CSS `@theme`)|
| Fonts        | `@fontsource` (self-hosted — no CDN)               |
| Routing      | `react-router-dom` `HashRouter`                    |
| Server state | TanStack Query + axios (JWT interceptor)           |
| Auth state   | React Context (`AuthProvider`)                     |

## Design tokens (from the prototype)

Defined once in `src/index.css` `@theme`, used as Tailwind classes
(`bg-green`, `text-gold`, `border-line`, `font-serif`, …):

`green #15412f` · `green-deep #0d2a1e` · `gold #c2a04e` · `ink #15211b` ·
`muted #6c766f` · `line #e6e9e3` · `mist #e8efe9` · `cloud #f6f7f3` ·
`success #1f8a5b` · `danger #c0392b`. Fonts: **Instrument Serif** (display),
**Plus Jakarta Sans** (body). Cards `rounded-[20px]` white on tinted bg.

## Layout

```
frontend/src/
  main.tsx                    # QueryClient + AuthProvider + App
  App.tsx                     # router (parent / teacher / admin trees)
  index.css                   # tailwind theme + fonts + base
  lib/storage.ts              # token store (swap for Capacitor Preferences)
  api/client.ts               # axios + JWT interceptor (VITE_API_URL)
  api/{parent,teacher,admin}.ts   # typed query/mutation hooks
  auth/AuthContext.tsx, guards.tsx
  parent/StudentContext.tsx, ChildSwitcher.tsx   # multi-child switcher
  components/                 # ui.tsx, icons.tsx, form.tsx, AppShell,
                              # ScreenHeader, StaffLayout, parent/ParentLayout
  pages/LoginPage.tsx
  pages/parent/*  pages/teacher/*  pages/admin/*
```

## App shell & responsiveness

`AppShell` renders a full-bleed mobile column, centered at `max-w-[430px]` on
desktop over the neutral radial-gradient background. Content scrolls inside the
column (`.gw-scroll`); the page body never scrolls horizontally. Parent uses a
bottom tab bar; Teacher/Admin use a top tab bar (`StaffLayout`).

## Auth & routing

- `LoginPage`: role selector (Parent/Teacher/Admin) → phone → OTP. In dev the
  OTP auto-fills. On success, routes to the role's home.
- `AuthProvider` holds the user (from `/auth/me`); `RequireRole` guards each
  route tree and redirects mismatched roles to their own home;
  `RedirectIfAuthed` bounces logged-in users off `/login`.
- Route trees: `/app/*` (parent, wrapped in `StudentProvider`), `/teacher/*`,
  `/admin/*`.

## Screens

- **Parent (full, matches the mock):** Home dashboard (attendance status, quick
  actions, notice/diary/album previews), Attendance (month heatmap + summary),
  Notices + detail (acknowledge, real ack count), Diary (persisted checklist),
  Calendar, Results/report card (term picker, subject bars, comment), Photos +
  album, Leave list + apply form, Notifications (read state, deep-link). All
  per-child via the `ChildSwitcher`.
- **Teacher (basic):** Mark attendance (roster P/A/L), post notice, post
  homework, enter results, approve/decline leave.
- **Admin (basic):** Students (add + link parent), Users (create), Classes
  (create + assign teacher), Notices & Events (broadcast).

All data is live via TanStack Query hooks in `src/api/*`; mutations invalidate
the relevant queries so the UI reflects persisted state.

## Capacitor-readiness

- API base URL from `VITE_API_URL` (never hardcoded).
- Fonts bundled locally by `@fontsource` — no external requests.
- `HashRouter` works under the `file://` origin.
- Token access goes through `src/lib/storage.ts` — swap the body for
  `@capacitor/preferences` when wrapping.

## Verify

`npm run dev`, open on a mobile viewport. Log in as **parent** (`9000000003`,
OTP `123456`) and walk every screen; toggle a diary item and reload (state
persists). Log in as **teacher** (`9000000002`), mark attendance, confirm it
shows on the parent side. Log in as **admin** (`9000000001`), add a student and
link a parent. `npm run build` must pass (it does).
