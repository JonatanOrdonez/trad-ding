# Run project locally

Start the trad-ding development servers. Run this after the project is already installed (see `/install`).

trad-ding requires **two servers** running simultaneously:
- **Backend** — FastAPI on http://localhost:8000
- **Frontend** — Next.js on http://localhost:3000

The frontend handles most API routes via Next.js Route Handlers. Only `/train` is proxied to the backend.

## Steps

### Terminal 1 — Python backend

Run from the **`backend/`** subdirectory. The Makefile handles changing to the repo root.

```bash
source .venv/bin/activate
cd backend && make run
```

The backend will be available at **http://localhost:8000**.

- Health check: http://localhost:8000/health
- API docs: http://localhost:8000/docs

> **Note:** Do NOT run `make db-upgrade` on every start — `alembic.ini` is gitignored. The DB schema already exists on Supabase. Only run migrations when schema changes have been made.

### Terminal 2 — Next.js frontend

Run from the **`web/`** subdirectory.

```bash
cd web && npm run dev
```

The frontend will be available at **http://localhost:3000**.

Only the `/train` endpoint is proxied to `localhost:8000` via `next.config.js`. All other API routes (`/assets`, `/predictions/*`, `/news/*`, `/summary`, `/chart/*`, `/health`) are handled by Next.js Route Handlers in `web/src/app/`.

---

To stop either server, press `CTRL+C` in its terminal. To forcefully kill all processes and free ports, use `/kill-project`.

## Troubleshooting

- **`RuntimeError: Environment variable 'X' is not set`** — the `.env` file must be at the repo root. `backend/env.py` loads it from `Path(__file__).parent.parent / ".env"` (i.e., one level above `backend/`).
- **`Address already in use` on port 8000 or 3000** — kill the existing process: `kill $(lsof -t -i:8000)` or use `/kill-project`.
- **`No 'script_location' key found` (alembic error)** — `alembic.ini` is gitignored; skip `make db-upgrade` unless you need to run migrations.
