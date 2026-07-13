# Greenwood School App

A mobile-first school app built from the Greenwood prototype. React + Tailwind
frontend, Node + MySQL backend, three roles (Parent / Teacher / Admin) behind a
single phone-OTP login. Designed to later wrap with Capacitor into a native app.

- Frontend plan → [docs/frontend-plan.md](docs/frontend-plan.md)
- Backend plan → [docs/backend-plan.md](docs/backend-plan.md)
- Product requirements → [docs/greenwood-prd.md](docs/greenwood-prd.md)

## Prerequisites

- Node 20+
- Docker (for MySQL) — or a local MySQL 8 on the URL in `backend/.env`

## Run it

```bash
# 1. Database (Docker) — MySQL on host port 3307
cd backend
docker compose up -d

# 2. Backend
npm install
cp .env.example .env          # already present; edit if needed
npx prisma migrate dev        # creates the schema
npm run seed                  # loads demo data (invented names)
npm run dev                   # → http://localhost:4000

# 3. Frontend (new terminal)
cd ../frontend
npm install
npm run dev                   # → http://localhost:5173
```

## Demo logins (OTP)

Phone + role selector on the login screen. In development the OTP is **`123456`**
(also logged to the backend console and auto-filled in the UI — no SMS sent).

| Role    | Phone        |
| ------- | ------------ |
| Parent  | `9000000003` |
| Teacher | `9000000002` |
| Admin   | `9000000001` |

The Parent account (Rahul Verma) has two linked children to exercise the
multi-child switcher.

## Later: Capacitor

The frontend is already Capacitor-ready — env-based API URL, self-hosted fonts
(no CDN), `HashRouter`, and a swappable token store (`src/lib/storage.ts`).
Wrapping is a separate step: `npm run build`, then `npx cap init` and add
platforms pointing at `dist/`.
