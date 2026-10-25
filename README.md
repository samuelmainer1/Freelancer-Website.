# FreelanceHub — Upwork-style Freelance Marketplace (MVP)

A full-stack marketplace where **clients post jobs** and **freelancers bid** on them.
Built with **React + Tailwind CSS** (frontend), **Node.js + Express** (backend) and **SQLite** (database, zero setup — the file is created automatically).

## Features
- 🔐 Register / login as a **Client** or **Freelancer** (JWT authentication, hashed passwords)
- 📋 Clients: post jobs, view incoming bids, **accept a bid** → job becomes "awarded", other bids are auto-rejected, or close a job
- 🧑‍💻 Freelancers: browse/search jobs, **place or update a bid** (amount, delivery days, proposal), track bid status
- 👤 **Professional profiles** for both roles: headline, bio, location, skills, hourly rate, company, website, portfolio links and **photo uploads**
- ⭐ **Ratings & reviews, both directions**: on an accepted bid each party reviews the other once (1–5 stars + comment, editable) — clients rate freelancers and freelancers rate clients; ratings are aggregated on profiles, job cards and the directory
- 🔗 **Portfolio links** for freelancers, rendered as safe external links
- 🔍 **Freelancer directory** — search by name/skill, filter by hourly rate and minimum rating, sort by rating/rate; freelancers can opt out of the directory from their profile
- 💬 **Messaging** — clients and freelancers message each other per job (only job owner ↔ bidders), with unread badges and an inbox
- ✏️ Jobs can be **edited** while open; the job feed is **paginated**
- 📊 Live stats, search + category filters, demo data seeded on first run

## Project structure
```
freelance-marketplace/
├── backend/          Express API + SQLite (node:sqlite, no external DB needed)
│   ├── server.js     API entry point (port 4000)
│   ├── db.js         Schema + migrations + demo seed (app.db auto-created)
│   ├── middleware/   JWT auth + role checks
│   └── routes/       auth, jobs, bids, users (profiles + directory), reviews, messages
└── frontend/         React + Vite + Tailwind CSS (port 5173)
    └── src/          pages: Home, JobDetail, PostJob, EditJob, MyJobs, MyBids,
                            Freelancers, Inbox, Messages, Profile, EditProfile,
                            Login, Register
        └── test/     Vitest setup + shared render helper
```

## Run it (2 terminals)
**1. Backend**
```bash
cd backend
npm install
npm run dev        # → http://localhost:4000
```

**2. Frontend**
```bash
cd frontend
npm install
npm run dev        # → http://localhost:5173  (proxies /api to the backend)
```

## Testing

**Backend** — end-to-end API tests against a running server (start the backend first):
```bash
cd backend
node test-features.mjs      # 67 assertions: auth, bids, reviews (both directions), directory, messaging, pagination
```
Safe to re-run: each section creates the data it needs, so the suite does not require a freshly seeded `app.db`.

> **Rate limits:** the API allows 300 requests/min per IP and 30 logins per 15 min. The suite handles a
> tripped general limit by waiting a second and retrying, but each run performs 4 logins — so many
> back-to-back runs can exhaust the login limit and abort with a clear message. Wait for it to reset.

**Frontend** — component/unit tests with Vitest + React Testing Library (jsdom, no server needed):
```bash
cd frontend
npm test                    # 46 tests across 6 files
npm run test:watch          # re-run on change
```

Frontend suites live next to the code (`src/**/*.test.{js,jsx}`) and cover the API wrapper, formatters,
and the review flow — including a regression test asserting that the freelancer → client review form
is actually reachable from **My Bids**, which was a real gap once.

## Demo accounts (password: `password123`)
| Role       | Email           |
|------------|-----------------|
| Client     | alice@demo.com  |
| Client     | sarah@demo.com  |
| Freelancer | joe@demo.com    |
| Freelancer | maya@demo.com   |

## API overview
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | – | Register (role: client/freelancer) |
| POST | `/api/auth/login` | – | Login → JWT |
| GET | `/api/auth/me` | ✔ | Current user |
| GET | `/api/jobs` | – | Open jobs (search, category, page/limit) |
| GET | `/api/jobs/:id` | – | Job detail (includes client rating) |
| POST | `/api/jobs` | ✔ client | Post a job (deadline must be today or later) |
| PUT | `/api/jobs/:id` | ✔ client | Edit an open job |
| GET | `/api/jobs/mine` | ✔ client | My posted jobs + bid stats |
| POST | `/api/jobs/:id/close` | ✔ client | Close a job |
| POST | `/api/jobs/:id/bids` | ✔ freelancer | Place/update a bid |
| GET | `/api/jobs/:id/bids` | ✔ | Owner: all bids + bidder ratings · Freelancer: own bid |
| GET | `/api/bids/mine` | ✔ freelancer | My bids, incl. client details and whether I already reviewed the client |
| POST | `/api/bids/:id/accept` | ✔ client | Accept a bid → job awarded |
| GET | `/api/users` | – | Freelancer directory (search, skill, min/max rate, min_rating, sort, page) |
| GET | `/api/users/:id` | – | Public profile + activity + ratings + reviews |
| PUT | `/api/users/me` | ✔ | Update my profile (incl. avatar, portfolio & directory visibility) |
| POST | `/api/bids/:id/review` | ✔ bid party | Review the other party on an accepted bid (1–5 + comment) |
| GET | `/api/inbox` | ✔ | My conversations + unread totals |
| GET | `/api/unread-count` | ✔ | Unread message count (navbar badge) |
| GET | `/api/jobs/:id/messages/:userId` | ✔ | Read a thread (marks it read) |
| POST | `/api/jobs/:id/messages/:userId` | ✔ | Send a message (owner ↔ bidders only) |

## Security & configuration

The server runs with safe defaults for local development; these variables matter in deployment:

| Variable | Default | Notes |
| --- | --- | --- |
| `JWT_SECRET` | dev fallback | **Required when `NODE_ENV=production`** — the process refuses to start without it. A fallback value is used in dev and a warning is printed at boot. |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated allow-list of frontend origins. Other origins get `403`. |
| `TRUST_PROXY` | unset | Set to `1` (or your proxy hop count) when running behind nginx/a reverse proxy so rate limiting sees real client IPs. |
| `PORT` | `4000` | API port. |

Also enabled: `helmet` security headers, a 300 req/min API ceiling, and a 30 attempts / 15 min limit on `/api/auth/login` and `/api/auth/register`.

```bash
# production
JWT_SECRET="$(openssl rand -hex 32)" \
CORS_ORIGINS="https://your-app.example" \
NODE_ENV=production \
node server.js
```
