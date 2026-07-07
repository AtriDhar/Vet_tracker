# Deployment Guide — 100% Free Tier

VetTracker is a single Next.js app (frontend + API routes in one deployable) backed by
a SQLite-dialect database. The recommended free stack:

| Layer | Service | Free tier (as of mid-2026) | Why |
|---|---|---|---|
| Frontend **and** backend | **Vercel** (Hobby) | 100 GB bandwidth/mo, serverless functions, TLS, CI from GitHub | Native Next.js host; API routes deploy as serverless functions automatically |
| Database | **Turso** (Free) | 500 databases, 9 GB total storage, 500 M row reads/mo | SQLite-compatible (libSQL) — the app's SQL runs unchanged; generous free quota |

> The app auto-migrates and auto-seeds on first request, so there is **no migration
> step** on any platform. An alternative single-service option (Render) is at the end.

---

## 0. Prerequisites

- GitHub repository (this repo): `https://github.com/AtriDhar/vet-tracker`
- Free accounts at [vercel.com](https://vercel.com) and [turso.tech](https://turso.tech)
  (both support "Sign in with GitHub")

---

## 1. Create the database (Turso)

**Option A — dashboard (no CLI):**
1. Sign in at [app.turso.tech](https://app.turso.tech) → **Create Database**
   (name: `vettracker`, pick the region closest to your Vercel region / users).
2. Open the database → copy the **URL** (`libsql://vettracker-<org>.turso.io`).
3. Go to the database's **Tokens** section → create a token (allow read & write) →
   copy it.

**Option B — CLI:**
```bash
# install:  https://docs.turso.tech/cli/installation
turso auth signup
turso db create vettracker
turso db show vettracker --url          # → TURSO_DATABASE_URL
turso db tokens create vettracker       # → TURSO_AUTH_TOKEN
```

That's the whole database setup — tables are created by the app itself on first
connection, and the demo data (accounts, pets, logs, live alerts) seeds automatically.

---

## 2. Deploy the app (Vercel)

1. [vercel.com/new](https://vercel.com/new) → **Import** `AtriDhar/vet-tracker`.
2. Framework preset: **Next.js** (auto-detected). Root directory: repository root.
   Leave build settings at defaults (`next build`).
3. Add **Environment Variables** (Settings → Environment Variables, or during import):

   | Name | Value | Notes |
   |---|---|---|
   | `JWT_SECRET` | *(random 32+ chars)* | Generate: `openssl rand -base64 32` — **required**; the app fails fast without it |
   | `TURSO_DATABASE_URL` | `libsql://vettracker-<org>.turso.io` | From step 1 |
   | `TURSO_AUTH_TOKEN` | `eyJ…` | From step 1 |
   | `SEED_DEMO` | `true` | Set `false` to skip demo accounts on a fresh DB (vet directory still seeds) |

4. Click **Deploy**. First build takes ~1–2 minutes.
5. Open `https://<project>.vercel.app` → log in with the demo account
   (`demo@vettracker.app` / `demo1234`) — the first request creates and seeds the
   database, so it may take a couple of extra seconds once.

Every subsequent `git push` to `main` redeploys automatically (preview deployments
for other branches).

### Custom domain (optional, still free)
Vercel → Project → Settings → Domains → add your domain and set the shown DNS records.
TLS is automatic.

---

## 3. Post-deploy checklist

- [ ] `/` loads and redirects to `/login` → demo login works
- [ ] Dashboard shows 3 pets with severity chips (proves DB seeding + engine ran)
- [ ] Submit a daily log with `vomiting + lethargy`, food `0` → urgent alert with
      full reasoning (proves engine + writes work in production)
- [ ] `/pets/1/report` renders and prints to PDF
- [ ] QR card page → scan with a phone → public card opens on the phone
      (proves the public token route works without cookies)
- [ ] `vet@vettracker.app` / `vet1234` → `/vet-portal` shows the triage queue
- [ ] `/toxicity` works logged-out

### Resetting the demo
Wipe and re-seed by recreating the database:
```bash
turso db destroy vettracker --yes && turso db create vettracker
turso db tokens create vettracker    # update TURSO_AUTH_TOKEN in Vercel, redeploy
```
(Seed dates are relative to "today", so a re-seed always demos fresh.)

---

## 4. Alternative: single free service (Render)

If you prefer one service and no separate DB account, Render's free web service runs
the app with the **embedded** SQLite file:

1. [render.com](https://render.com) → New → **Web Service** → connect the repo.
2. Runtime **Node**; Build `npm install && npm run build`; Start `npm start`.
3. Env vars: `JWT_SECRET` only (no Turso vars → the app uses `file:data/vettracker.db`).

**Trade-offs (why Vercel + Turso is recommended instead):**
- Render free instances have an **ephemeral disk** and spin down after ~15 min idle —
  the SQLite file (all user data) is lost on every restart/deploy. Acceptable for a
  self-resetting demo, not for real data.
- Cold starts of ~30–60 s after idle.

You can also point a Render deployment at Turso (set both `TURSO_*` vars) to get
durable data with Render hosting — useful if you hit Vercel's function limits.

---

## 5. Local development & self-hosting

```bash
git clone https://github.com/AtriDhar/vet-tracker.git
cd vet-tracker
npm install
npm run dev          # http://localhost:3000 — embedded DB, auto-seeded
```

No env vars needed locally (a dev JWT secret is built in; DB falls back to
`data/vettracker.db`). To mirror production locally:

```bash
cp .env.example .env.local   # fill in JWT_SECRET (+ Turso vars if desired)
npm run build && npm start
```

Self-hosting on a VPS is the same: Node 20+, `npm run build`, run `npm start` behind
any reverse proxy; keep the `data/` directory on persistent storage (or use Turso).

---

## 6. Environment variable reference

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `JWT_SECRET` | **prod: yes** · dev: no | dev-only fallback | HS256 session signing; app throws in production if unset |
| `TURSO_DATABASE_URL` | no | — (embedded file) | Switches storage to Turso |
| `TURSO_AUTH_TOKEN` | with URL | — | Turso auth |
| `SEED_DEMO` | no | `true` | `false` skips demo accounts/pets on empty DB |

## 7. Free-tier limits & how VetTracker fits

- **Vercel Hobby:** serverless function limits (10 s default duration, 4.5 MB request
  body) — the heaviest request (log photo as ≤ 2 MB data-URL) fits comfortably; no
  background jobs are used (reminders materialize lazily on read).
- **Turso Free:** 500 M row reads/mo, 10 M writes/mo — a daily-active demo uses a tiny
  fraction; the engine reads ≤ 30 rows per evaluation by design.
- **No other services** (mail, storage, queues) are required — nothing else to pay for
  or configure.

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| 500 on `/api/auth/login` in production | `JWT_SECRET` missing — set it and redeploy (fail-fast by design) |
| `Module not found: @libsql/client` at build | Dependency install ran in the wrong directory — `npm install` at repo root |
| Login works but data is empty after redeploy (Render free) | Ephemeral disk wiped the embedded DB — expected; use Turso for durable data |
| First request after deploy is slow | One-time migrate + seed on the new DB; subsequent requests are normal |
| Demo alerts show old dates | Seed dates are relative to seed time — reset the DB (Section 3) to refresh |
