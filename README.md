# Submission Tracker

A lightweight workspace for ops managers to review broker-submitted opportunities — browse the
queue, filter by business context, and open any record for full detail.

Django + DRF backend, Next.js 16 + React 19 + MUI 7 frontend.

## Live Demo

- **Frontend:** https://limit-challenge-frontend.vercel.app/submissions
- **API sample:** https://limit-challenge-backend.onrender.com/api/brokers/

> The backend runs on Render's free tier. After ~15 minutes of inactivity it spins down, and the
> first request takes ~55 seconds to warm up. The UI detects slow loads and shows a banner with a
> live countdown — when it hits zero the page auto-refreshes against the now-warm instance.

## Architecture

### Backend

- Django 5.2, Django REST Framework, `django-filter`
- `djangorestframework-camel-case` — wire format (params + responses) is camelCase
- SQLite, `PageNumberPagination` (default 10, capped at 100)

### Frontend

- Next.js 16 (app router), React 19, Material UI 7
- `@tanstack/react-query` 5 for server state, `axios` for HTTP
- URL-driven state — filters, pagination, and sort all round-trip through the query string

### Data model

Defined in `backend/submissions/models.py`:

- `Broker`, `Company`, `TeamMember`
- `Submission` — links company, broker, owner; holds status, priority, summary
- `Contact`, `Document`, `Note` — all FK into `Submission`

Seeded via `python manage.py seed_submissions` (~25 submissions with dozens of related records).

## API

Wire format is camelCase (via `djangorestframework-camel-case`). Filtering lives in
`backend/submissions/filters/submission.py`.

- `GET /api/submissions/`
  - Returns paginated submissions with company, broker, owner, counts of related documents/notes,
    and the latest note preview.
  - Supports filters via query params: `status`, `brokerId`, `companySearch`, `createdFrom`,
    `createdTo`, `hasDocuments`, `hasNotes`.
  - Pagination: `page`, `pageSize` (capped at 100).
  - Ordering: `ordering` is whitelisted server-side. `status` and `priority` use a semantic
    workflow rank (not alphabetical). `(created_at, id)` is the default; every sort pins `-id` as
    tiebreaker so pagination is stable.
  - Cross-field validation: `createdFrom > createdTo` returns a 400.
- `GET /api/submissions/<id>/`
  - Returns the full submission plus related contacts, documents, and notes.
- `GET /api/brokers/`
  - Returns brokers for the frontend dropdown (unpaginated array).

The list queryset uses `select_related` for FKs, `prefetch_related` for reverse relations, and
`Count` / `Subquery` for the related counts and latest-note preview. It issues 6 queries regardless
of page size.

## Features

### Submissions list

- Every filter and pagination control is URL-driven (`companySearch`, `status`, `brokerId`,
  `createdFrom`, `createdTo`, `hasDocuments`, `hasNotes`, `page`, `pageSize`, `ordering`).
  Deep-linkable, refresh-proof, shareable. Text inputs are debounced.
- Sortable table with loading skeleton, empty state, error state with retry, and an inline
  `LinearProgress` strip for refetch feedback.
- Page-size picker (10 / 20 / 50 / 100). Pagination footer stays mounted on a single page with
  disabled arrows so layout doesn't jump when filters change.
- Date-range guard — the picker won't let you choose `from > to`; backend returns 400 if you try
  anyway.

### Submission detail

- Hero card with company, industry · city, status + priority chips, 4-up fact grid, and summary.
- Two-column body: contacts + documents on the left, notes timeline with initial-avatars on the
  right.
- Loading skeleton, error alert with retry, per-section empty states.

### Cross-cutting

- Cold-start banner with a 55 s live countdown for the free-tier backend — auto-refreshes at 0.
- Header nav resets to a clean view.
- Shared `formatters.ts` for status/priority metadata and date formatting.

## Approach & Tradeoffs

- **URL is the source of truth for filters, pagination, and sort.** Every control reflects in the
  query string. Deep-linkable, refresh-proof, shareable. Tradeoff: a little extra parsing
  boilerplate compared to component-local state.
- **Server-side filtering via a django-filter `FilterSet`.** Keeps querysets lean and gives one
  place for cross-field validation (`createdFrom > createdTo` returns 400 instead of silently
  returning zero rows).
- **Semantic ordering for enums.** Alphabetical sort ranks "Closed" above "New" which is wrong for
  a workflow tool. `status` and `priority` are mapped to integer ranks server-side using
  `Case/When`. Every sort also pins `-id` as tiebreaker so pagination is stable.
- **Query optimization.** `select_related` for FKs, `prefetch_related` for reverse relations,
  `Count` + `Subquery` for related counts and the latest-note preview. The list view issues 6
  queries regardless of page size.
- **Configurable page size (10 / 20 / 50 / 100) capped at 100 server-side.** Pagination footer
  stays visible on a single page (disabled arrows) so the layout doesn't jump when filters change.
- **Cold-start UX.** Render's free dyno spins down after 15 min; the frontend detects slow initial
  loads, surfaces a banner after a 3 s quiet window, runs a 55 s live countdown, and hard-reloads
  at 0 in case the first request is stuck. Spares the reviewer a blank 55 s skeleton.

## Stretch Goals Shipped

- Docker + docker-compose for local parity with production.
- GitHub Actions CI (lint + typecheck + build + tests on every PR).
- Live deployment: Vercel (frontend) + Render (backend via `render.yaml`), both auto-deploy on
  push to `main`.
- Sortable columns with semantic server-side ordering.
- Date-range validation on both sides (frontend UI guards, backend 400 response).
- Configurable page size with stable pagination across filter changes.
- Header navigation that resets filters and returns to a clean view.
- Test suites: filters, pagination, ordering, API shape (backend); formatters, param builders
  (frontend).
- Cold-start banner with live countdown for the free-tier backend.

## If this were production

- Add auth (DRF `TokenAuthentication` or session + SSO) and move permissions from `AllowAny` to
  per-view permission classes.
- Ship Sentry for frontend + backend error tracking and structured logs on the backend.
- Rate-limit `GET /api/submissions/` with DRF's `UserRateThrottle`.

## Getting Started

### Docker (one command)

```bash
docker compose up --build
# → http://localhost:3000   (frontend)
# → http://localhost:8000   (backend API)
```

The backend container runs migrations and seeds demo data on first boot. SQLite is persisted in
the `backend-data` volume — wipe it with `docker compose down -v` or `make clean`. Convenience
targets: `make up`, `make down`, `make logs`, `make test`.

### Backend (local)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_submissions   # --force to rebuild the dataset
python manage.py runserver 0.0.0.0:8000
```

### Frontend (local)

```bash
cd frontend
npm install
# NEXT_PUBLIC_API_BASE_URL defaults to http://localhost:8000/api
npm run dev
```

Visit http://localhost:3000/submissions.

## Tests

```bash
# Backend — 13 tests (filters, pagination, ordering, API shape)
cd backend && source .venv/bin/activate
python manage.py test submissions

# Frontend — 17 tests (formatters, param builders)
cd frontend && npm test
```

## Project Structure

- `backend/` — Django project, REST API, seed command, submission models
- `frontend/` — Next.js app (list + detail routes under `/submissions`)
- `INTERVIEWER_NOTES.md` — context for reviewers
- `docker-compose.yml`, `Makefile`, `render.yaml`, `.github/workflows/ci.yml` — infra + CI

## Environment Variables

- Frontend: `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:8000/api`). Override via
  `frontend/.env.local`.
- Backend (all optional in local dev, documented in `render.yaml` for production):
  `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CORS_ALLOWED_ORIGINS`,
  `DJANGO_CSRF_TRUSTED_ORIGINS`, `DJANGO_DB_PATH`.
