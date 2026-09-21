# MedTrain

Healthcare equipment training & compliance management. A standalone
full-stack application — Node/Express API + PostgreSQL, React/Tailwind
frontend — with real email/password authentication. No dependency on any
third-party AI platform account; deploy it on your own hosting.

## Stack

- **Backend**: Node.js + Express, PostgreSQL (`server/`)
- **Auth**: bcrypt password hashing, HTTP-only signed session cookies
  (`express-session` + `connect-pg-simple`), rate-limited login
- **PDF generation**: server-side via headless Chromium (Playwright),
  with the Amiri and DejaVu Sans fonts embedded directly in the PDF so
  Arabic text renders correctly regardless of what's installed on the host
- **Frontend**: React + Tailwind + Vite (`client/`)

## Project layout

```
server/   Express API, PostgreSQL migrations/seed, PDF/report generation
client/   React + Tailwind SPA
```

## Running it in CodeSandbox

The repo ships `.codesandbox/tasks.json`, so importing it sets up both
`server/` and `client/` dependencies automatically and starts both dev
servers.

1. Open **[this GitHub URL imported into CodeSandbox](https://codesandbox.io/p/github/naifprog/Medical-Training-Dashboard/tree/claude/medtrain-healthcare-app-wp2yxo)**
   (or in CodeSandbox: **Create → Import Project** and paste the repo URL,
   branch `claude/medtrain-healthcare-app-wp2yxo`).
2. You still need a real PostgreSQL database — CodeSandbox doesn't provide
   one. The fastest option is a free instance at
   [neon.tech](https://neon.tech) or [supabase.com](https://supabase.com);
   copy the connection string it gives you.
3. In the CodeSandbox sidebar, open the **`server/.env`** file that setup
   created from `.env.example` and paste your connection string into
   `DATABASE_URL`.
4. Open the **Tasks** panel and run, in order: **"DB: run migrations"**,
   then **"DB: seed initial admin + roles"** (its output prints the admin
   email/password). The **"API server"** and **"Web app"** tasks are
   already running — the web app's preview panel is your live app.
5. (Optional, for Arabic PDF export) run the **"Install Chromium for PDF
   export"** task once.

## Local setup

### 1. Database

Create a PostgreSQL database and user (adjust to taste):

```sql
CREATE ROLE medtrain LOGIN PASSWORD 'medtrain_dev_pw';
CREATE DATABASE medtrain OWNER medtrain;
```

### 2. Server

```bash
cd server
cp .env.example .env       # edit DATABASE_URL, SESSION_SECRET, etc.
npm install
npm run migrate            # creates tables
npm run seed                # creates the initial Administrator account
npm run dev                  # http://localhost:4000
```

The seed script prints the initial admin email/password (also configurable
via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env`). Change it after
first login — there is no public registration; every other account is
created by an administrator from the Users page and gets a one-time
temporary password with a forced change on first login.

**PDF generation**: the server depends on the `playwright` package for
Chromium. After `npm install`, install its browser binary once:

```bash
npx playwright install chromium
```

If your hosting environment already provides a Chromium binary, point
`PLAYWRIGHT_EXECUTABLE_PATH` in `.env` at it instead of downloading one.

### 3. Client

```bash
cd client
npm install
npm run dev                  # http://localhost:5173, proxies /api to :4000
```

For production, `npm run build` outputs static files in `client/dist/` —
serve them from any static host or from the Express server itself behind a
reverse proxy, with `/api` and `/uploads` routed to the Node process.

## Environment variables (server/.env)

See `server/.env.example` for the full list: `DATABASE_URL`,
`SESSION_SECRET`, `COOKIE_SECURE` (set `true` behind HTTPS), `CORS_ORIGIN`,
`SEED_ADMIN_*`, `UPLOAD_DIR`, `PLAYWRIGHT_EXECUTABLE_PATH`.

## Permission model

Roles are named bundles of individual permissions (not hardcoded role
strings). A user's effective permission set is the role's permissions
merged with that user's own per-permission overrides (overrides win). Three
starter roles ship out of the box — Administrator, Trainer, Trainee — all
editable from Roles & Permissions.

## Data model

See `server/db/migrations/001_init.sql` for the full schema: departments,
roles, users, devices (with embedded alarms/quiz JSON), assignments,
per-user-per-device progress, and sessions.
