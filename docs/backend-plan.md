# Backend Plan & Reference — Greenwood

Node + Express + TypeScript, Prisma ORM over MySQL. Phone-OTP auth, JWT, three
roles. Multi-school ready (`schoolId` on every core table).

## Stack

| Concern     | Choice                                              |
| ----------- | --------------------------------------------------- |
| Runtime     | Node + Express (TypeScript, ESM)                    |
| ORM         | Prisma (`mysql2` driver) + versioned migrations     |
| Validation  | zod                                                 |
| Auth        | phone → OTP → JWT (`jsonwebtoken`), `bcryptjs` hash |
| Dev DB      | MySQL 8 via `docker-compose.yml` (host port 3307)   |

## Layout

```
backend/
  docker-compose.yml        # MySQL 8
  prisma/
    schema.prisma           # data model
    migrations/             # generated
    seed.ts                 # demo data (invented names)
  src/
    config.ts               # env
    db.ts                   # PrismaClient
    app.ts                  # express wiring + error handler
    server.ts               # entry
    lib/{jwt,otp,http,access}.ts
    middleware/auth.ts       # requireAuth, requireRole
    routes/{auth,parent,teacher,admin}.ts
```

## Data model (Prisma)

Multi-school: `School` is the tenant root; `schoolId` on `User`, `Student`,
`Klass`, `Attendance`, `Notice`, `DiaryEntry`, `LeaveRequest`, `Event`, `Term`,
`PhotoAlbum`.

- **Auth/identity:** `User` (unified table, `role = PARENT|TEACHER|ADMIN`, unique
  on `[schoolId, phone, role]`), `OtpCode`.
- **People/structure:** `Student`, `Klass` (grade+section, optional class
  teacher), `Enrollment`, `ParentStudentLink` (many-to-many; multi-parent /
  multi-child).
- **Features:** `Attendance` (unique `[studentId, date]`), `Notice` +
  `NoticeAck` (real ack aggregate), `DiaryEntry` + `DiaryDone` (per-student
  parent checklist), `LeaveRequest` (status lifecycle), `Event`, `Term` +
  `Result` + `ResultMeta`, `PhotoAlbum` + `Photo`, `Notification`.

## Auth flow (phone + OTP)

1. `POST /auth/request-otp { phone, role }` — the chosen role must match a real
   `User` (a parent can't log in as admin). Stores a bcrypt-hashed 6-digit code
   with a 5-min expiry and "sends" it. **Dev:** code is `123456` (configurable
   via `DEV_FIXED_OTP`), logged to console and returned as `devCode`.
2. `POST /auth/verify-otp { phone, role, otp }` — verifies, consumes the code,
   returns a JWT `{ userId, role, schoolId }` (7-day).
3. `GET /auth/me` — current user + linked students.

The `SmsProvider` interface in `src/lib/otp.ts` isolates the sender — swap the
dev logger for Twilio/MSG91 in production with no caller changes.

## Middleware & scoping

- `requireAuth` → verifies bearer JWT, populates `req.auth`.
- `requireRole(...roles)` → 403 if the token role isn't allowed.
- Every query is scoped by `schoolId` from the token; parents are additionally
  scoped to their linked students via `assertParentOwnsStudent`
  (`src/lib/access.ts`).

## API surface

- **`/auth`** — `request-otp`, `verify-otp`, `me`.
- **`/parent`** (PARENT) — `me/students`, `me/today`, `students/:id/attendance`,
  `notices` (+ `:id`, `:id/ack`), `students/:id/diary` + `diary/:id/done`,
  `terms`, `students/:id/results`, `events`, `albums` (+ `:id`), `leave`
  (GET/POST), `notifications` (+ `:id/read`).
- **`/teacher`** (TEACHER) — `classes`, `classes/:id/roster`, `attendance`
  (bulk upsert), `notices`, `diary`, `terms`, `results`, `leave` (GET/PATCH,
  notifies parent on decision).
- **`/admin`** (ADMIN) — `users` (GET/POST), `students` (GET/POST), `classes`
  (GET/POST), `parent-links` (POST), `notices` (POST), `events` (GET/POST).

## Seed

`prisma/seed.ts` builds one school with an admin, teacher, a parent (two
children), a classmate + 24 filler parents (so ack "X of N" is meaningful), 30
days of attendance, notices with real acks, 5 days of homework, two terms of
results, events, a photo album, a leave request, and notifications — all
invented names.

## Verify

```bash
curl -s -XPOST localhost:4000/auth/request-otp -H 'content-type: application/json' \
  -d '{"phone":"9000000003","role":"PARENT"}'          # → devCode
curl -s -XPOST localhost:4000/auth/verify-otp -H 'content-type: application/json' \
  -d '{"phone":"9000000003","role":"PARENT","otp":"123456"}'   # → token
curl -s localhost:4000/parent/me/students -H "authorization: Bearer <token>"
```

## Deferred (per plan)

Real push (APNs/FCM) and object-storage photo uploads. Photos store URLs;
`Notification` rows already power the in-app notifications center.
