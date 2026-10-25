# FreelanceHub — Upwork-style Freelance Marketplace (MVP)

A full-stack marketplace where **clients post jobs** and **freelancers bid** on them.
Built with **React + Tailwind CSS** (frontend), **Node.js + Express** (backend) and **SQLite** (database, zero setup — the file is created automatically).

## Features
- 🔐 Register / login as a **Client** or **Freelancer** (JWT authentication, hashed passwords)
- 📋 Clients: post jobs, view incoming bids, **accept a bid** → job becomes "awarded", other bids are auto-rejected, or close a job
- 🧑‍💻 Freelancers: browse/search jobs, **place or update a bid** (amount, delivery days, proposal), track bid status
- ⚡ **Connects (bid credits)** — each new bid costs 1 Connect; updating an existing bid is free. New freelancers
  start with 10, the navbar shows the live balance, and bundles can be bought from **/connects**
- 📈 **Rich freelancer profiles**: total earned, jobs done, win rate, active bids, a 5→1 star rating
  breakdown, verified badge, skills, portfolio and recent awarded work (with agreed amounts)
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
│   └── routes/       auth, jobs, bids, users (profiles + directory), reviews, messages, connects
└── frontend/         React + Vite + Tailwind CSS (port 5173)
    └── src/          pages: Home, JobDetail, PostJob, EditJob, MyJobs, MyBids,
                            Freelancers, Inbox, Messages, Profile, EditProfile,
                            BuyConnects, Login, Register
        └── test/     Vitest setup + shared render helper
```

## Known limitations (read before deploying)

This is an **MVP demo**. These are intentional gaps, not bugs — they must be closed before
handling real users or real money:

- **No payment processor.** Buying Connects credits the balance immediately and records a row in
  `connect_purchases`. Nothing is charged. Wire a PSP (Stripe etc.) and verify a receipt **before**
  crediting — see the comment in `backend/routes/connects.js`.
- **Verified badges are admin-only with no admin UI.** `is_verified` can only be set directly in the
  database; there is no endpoint or screen for granting it.
- **SQLite is a single file on local disk.** Fine for a demo, but it does not survive most
  container/scale-out deploys (ephemeral filesystems, multiple instances). Use a managed DB and put
  the file on a persistent volume if you deploy as-is.
- **No password reset, email verification, or account deletion.**
- **Avatars are inline base64 data URLs** stored in the user row, size-capped. Fine for an MVP;
  a CDN/object store is the real answer.
- **The backend test suite mutates demo data** — it awards jobs and places bids by design. Run it
  against a disposable database, then reseed (`backend/app.db` is gitignored; delete and restart to
  reseed).

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
npm test                    # 85 tests across 12 files
npm run test:watch          # re-run on change
```

Frontend suites live next to the code (`src/**/*.test.{js,jsx}`) and cover the API wrapper, formatters,
the review flow, the Connects gate (a new bid costs a Connect, updating one is free, and a zero balance
blocks the form) and the profile stats. Two regressions they lock in:
- the freelancer → client review form is actually reachable from **My Bids** (a real gap once)
- a freelancer's **Connects balance is never rendered — or even requested — on someone else's profile**

> **Testing note:** the backend suite is idempotent, but it *does* award jobs and place bids as it runs, so
> repeated runs make the demo data look odd (many awarded jobs on the same account). To get the tidy demo
> back, delete `backend/app.db` and restart the backend to reseed. The Connects assertions in the UI tests
> use mocked fetch responses, so they never touch the real balance.

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
| POST | `/api/jobs/:id/bids` | ✔ freelancer | Place/update a bid (1 Connect for a new bid; free to update) |
| GET | `/api/jobs/:id/bids` | ✔ | Owner: all bids + bidder ratings · Freelancer: own bid |
| GET | `/api/bids/mine` | ✔ freelancer | My bids, incl. client details and whether I already reviewed the client |
| POST | `/api/bids/:id/accept` | ✔ client | Accept a bid → job awarded |
| GET | `/api/users` | – | Freelancer directory (search, skill, min/max rate, min_rating, sort, page) |
| GET | `/api/users/:id` | – | Public profile + activity + ratings + reviews |
| PUT | `/api/users/me` | ✔ | Update my profile (incl. avatar, portfolio & directory visibility) |
| GET | `/api/connects` | ✔ freelancer | My Connect balance, bundles and purchase history |
| POST | `/api/connects/purchase` | ✔ freelancer | Buy a Connect bundle (demo mode — credited instantly) |
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

**Frontend** is configured at build time:

| Variable | Default | Notes |
| --- | --- | --- |
| `VITE_API_URL` | *(unset)* | Base URL of the deployed API, e.g. `https://api.example.com`. When unset the frontend calls relative `/api`, which works if frontend and API share an origin behind a reverse proxy. Must be set **before** `npm run build` — Vite bakes it into the bundle. |

Also enabled: `helmet` security headers, a 300 req/min API ceiling, and a 30 attempts / 15 min limit on `/api/auth/login` and `/api/auth/register`.

**Connects & badges.** Connects are spent in the same transaction as the bid insert (a conditional
`UPDATE … WHERE connect_balance >= 1`), so two concurrent bids can never overdraw the balance, and a
rejected bid leaves no charge behind. The balance is only ever returned for the signed-in freelancer.
`is_verified` is an admin-granted flag — it is not writable through `PUT /api/users/me`.

```bash
# production
JWT_SECRET="$(openssl rand -hex 32)" \
CORS_ORIGINS="https://your-app.example" \
NODE_ENV=production \
node server.js
```
