# Super Admin Dashboard

A single-file dashboard for the school platform's SUPER_ADMIN. No build step.

## Features
- **Login (SUPERADMIN)** — phone + OTP. Rejects any account that isn't `SUPER_ADMIN`.
- **Add a School** — creates a school (optional timezone).
- **Add School Admin** — provisions an `ADMIN` for a selected school.
- Lists all schools with user/student/class counts.

## Run it
Just open `index.html` in a browser, or serve the folder:

```bash
cd super-admin-dashboard
python3 -m http.server 5500
# then visit http://localhost:5500
```

## API
Talks to `https://schoolapp.shopyoume.in/api` (set as `BASE_URL` in `index.html`):

| Action           | Request                                     |
| ---------------- | ------------------------------------------- |
| Request OTP      | `POST /auth/request-otp` `{phone}`          |
| Verify / sign in | `POST /auth/verify-otp` `{phone, otp}`      |
| List schools     | `GET /platform/schools`                     |
| Add school       | `POST /platform/schools` `{name, timezone?}`|
| Add school admin | `POST /platform/schools/:id/admins` `{name, phone}` |

The JWT is stored in `localStorage` and sent as `Authorization: Bearer <token>`.
