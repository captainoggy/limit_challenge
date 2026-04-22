# Submission Tracker Take-home Challenge

This repository hosts the boilerplate for the Submission Tracker assignment. It includes a Django +
Django REST Framework backend and a Next.js frontend scaffold so candidates can focus on API
design, relational data modelling, and product-focused UI work.

## Challenge Overview

Operations managers need a workspace to review broker-submitted opportunities. Build a lightweight
tool that lets them browse incoming submissions, filter by business context, and inspect full
details per record. Deliver a polished frontend experience backed by clean APIs.

### Goals

- **Backend:** Model the domain, expose list and detail endpoints, and support realistic filtering.
- **Frontend (higher weight):** Craft an intuitive list and detail experience with filters that map
  to query parameters. Focus on UX clarity, organization, and maintainability.

## Data Model

Required entities (already defined in `submissions/models.py`):

- `Broker`: name, contact email
- `Company`: legal name, industry, headquarters city
- `TeamMember`: internal owner for a submission
- `Submission`: links to company, broker, owner with status, priority, and summary
- `Contact`: primary contacts for a submission
- `Document`: references to supporting files
- `Note`: threaded context for collaboration

Seed data (~25 submissions with dozens of related contacts, documents, and notes) is available via
`python manage.py seed_submissions`. Re-run with `--force` to rebuild the dataset.

## API Requirements

- `GET /api/submissions/`
  - Returns paginated submissions with company, broker, owner, counts of related documents/notes,
    and the latest note preview.
  - Supports filters via query params. `status` is wired up; extend filters for `brokerId` and
    `companySearch` (plus optional extras like `createdFrom`, `createdTo`, `hasDocuments`, `hasNotes`).
- `GET /api/submissions/<id>/`
  - Returns the full submission plus related contacts, documents, and notes.
- `GET /api/brokers/`
  - Returns brokers for the frontend dropdown.

Viewsets, serializers, and base filters are in place but intentionally minimal so you can refine
the query behavior and filtering logic.

## Frontend Workspace Overview

The Next.js 16 + React 19 app in `frontend/` is pre-wired for this challenge. Material UI handles
layout, axios powers HTTP requests, and `@tanstack/react-query` is ready for data fetching. The list
and detail routes under `/submissions` are scaffolded so you can focus on API consumption and UX
polish.

### What is pre-built?

- Global providers supply Material UI theming and a shared React Query client.
- `/submissions` hosts the list view with filter inputs and hints about required query params.
- `/submissions/[id]` hosts the detail shell and links back to the list.
- Custom hooks in `lib/hooks` define how to fetch submissions and brokers. Each hook is disabled by
  default (`enabled: false`) so no network requests fire until you enable them.

### What you need to implement

- Wire the filter state to query parameters and React Query `queryFn`s.
- Render table/card layouts for the submission list along with loading, empty, and error states.
- Build the detail page sections for summary data, contacts, documents, and notes.
- Enable the queries and handle pagination or other UX you want to highlight.

## Project Structure

- `backend/`: Django project with REST API, seed command, and submission models.
- `frontend/`: Next.js app described above.
- `INTERVIEWER_NOTES.md`: Context for reviewers/interviewers.

## Environment Variables

- Frontend requests default to `http://localhost:8000/api`. Override this by creating
  `frontend/.env.local` and setting `NEXT_PUBLIC_API_BASE_URL`.

## Getting Started

### Run with Docker (one command, recommended)

The quickest way to run the full stack — no local Python or Node install required.

```bash
docker compose up --build
# → http://localhost:3000   (frontend)
# → http://localhost:8000   (backend API)
```

On first boot the backend container applies migrations and seeds demo data
automatically. The SQLite file is persisted in a named volume (`backend-data`)
so your data survives `docker compose down`. Wipe it with
`docker compose down -v` (or `make clean`).

Common targets are wrapped in the `Makefile`: `make up`, `make down`,
`make logs`, `make clean`, `make test`.

### Run locally (manual)

Use this path if you'd rather work without Docker.

#### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_submissions  # optional but recommended
# add --force to rebuild the generated sample data
python manage.py runserver 0.0.0.0:8000
```

#### Frontend

```bash
cd frontend
npm install
# NEXT_PUBLIC_API_BASE_URL defaults to http://localhost:8000/api
# Override it by creating frontend/.env.local
npm run dev
```

Visit `http://localhost:3000/submissions` to start building.

## Deploy to free hosting (Vercel + Render)

Recommended split: **Vercel** for the Next.js frontend (native support, instant
previews) and **Render** for the Django backend (native Dockerfile support,
declarative `render.yaml` in this repo). Both have genuine free tiers and both
auto-deploy on every push to `main`.

### One-time setup (~10 min)

Run through these steps **in order** — the CORS allowlists need the other
side's URL to exist first.

**A. Deploy the backend on Render**

1. Push this repo to GitHub (you've already got it at `origin`).
2. Go to <https://dashboard.render.com/> → **New +** → **Blueprint**.
3. Pick the repo. Render reads `render.yaml` and shows the service it will
   create (`limit-challenge-backend`). Click **Apply**.
4. Wait for the first build to finish (~3 min). Copy the service URL —
   something like `https://limit-challenge-backend.onrender.com`.
5. Verify the API works: visit
   `https://<your-render-url>.onrender.com/api/brokers/` — you should see the
   JSON list of seeded brokers.

**B. Deploy the frontend on Vercel**

1. Go to <https://vercel.com/new> and import the same repo.
2. Set **Root Directory** to `frontend`. Leave build settings as-is (Vercel
   auto-detects Next.js).
3. Add one environment variable under **Environment Variables**:
   - `NEXT_PUBLIC_API_BASE_URL` = `https://<your-render-url>.onrender.com/api`
4. Click **Deploy**. Wait ~2 min and copy your Vercel URL
   (e.g. `https://limit-challenge.vercel.app`).

**C. Open up CORS on the backend**

Back in Render → your service → **Environment** tab → add:

- `DJANGO_CORS_ALLOWED_ORIGINS` = `https://<your-vercel-url>.vercel.app`
- `DJANGO_CSRF_TRUSTED_ORIGINS` = `https://<your-vercel-url>.vercel.app`

(For multiple origins, comma-separate them.) Render will automatically
redeploy. Once it's green, open the Vercel URL — the list should load live
data from Render.

### What happens on every push

Both platforms are webhook-wired to GitHub:

- Push to `main` → Render redeploys backend, Vercel redeploys frontend.
- Open a PR → Vercel comments with a unique preview URL for that branch.

CI (in `.github/workflows/ci.yml`) runs tests + typecheck + lint + build on
every PR so broken code can't reach the default branch.

### Known caveats

- **Cold starts on Render free tier.** After 15 min of inactivity the service
  spins down. The next request takes ~30–60s to warm up, after which response
  times are normal. Acceptable for a demo; upgrade to the starter plan
  (~$7/mo) to eliminate it.
- **Ephemeral SQLite.** Render's free web-service disk does not persist
  across deploys, so each deploy resets the seed data. The
  `seed_submissions` command is idempotent and runs on every boot, so the
  demo data is always present — but any data you add via the admin (there
  is no admin wired up) would be lost. Wire up a free Neon/Supabase Postgres
  if you need persistence; swap `DATABASES` in `settings.py` to read
  `DATABASE_URL`.

## Development Workflow

1. Start the Django server on port 8000 (`python manage.py runserver`).
2. Start the Next.js dev server on port 3000 (`npm run dev`).
3. Iterate on backend filters, serializers, and viewsets, then refresh the frontend to see updated
   data.
4. When ready, add README notes summarizing your approach, tradeoffs, and any stretch goals.

## Submission Instructions

- Provide a short README update summarizing approach, tradeoffs, and how to run the solution.
- Record and share a brief screen capture (max 2 minutes) demonstrating the frontend working end-to-end with the backend.
- Call out any stretch goals implemented.
- Automated tests are optional, but including targeted backend or frontend tests is a strong signal.

## Evaluation Rubric

- **Frontend (45%)** – UX clarity, filter UX tied to query params, state/data management, handling
  of loading/empty/error cases, and overall polish.
- **Backend (30%)** – API design, serialization choices, filtering implementation, and attention to
  relational data handling.
- **Code Quality (15%)** – Structure, naming, documentation/readability, testing where it adds
  value.
- **Product Thinking (10%)** – Workflow clarity, assumptions noted, and thoughtful UX details.

## Optional Bonus

Authentication, deployment, or extra tooling are not required but welcome if scope allows.
