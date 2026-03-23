# Install project locally

Run the following steps to set up trad-ding on the local machine. Execute them sequentially and stop if any step fails.

## Project structure

The repo is a monorepo with two sub-projects:

- **`backend/`** — FastAPI app. Has its own `requirements.txt`, `Makefile`, and `setup.cfg`.
- **`web/`** — Next.js frontend. Has its own `package.json` and `node_modules/`.

All commands below must be run from the **repo root** unless noted otherwise.

## Steps

### 1. Check Python version

```bash
python3 --version
```

The project requires **Python 3.12 or higher**. If missing:

```bash
brew install python@3.12
```

### 2. Create and activate virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Confirm the venv is active — the prompt should show `(.venv)`.

### 3. Install Python dependencies

Dependencies live in `backend/requirements.txt`, not the repo root.

```bash
pip install -r backend/requirements.txt
```

### 4. Check Node.js version

```bash
node --version
npm --version
```

The project requires **Node.js 18 or higher**. If missing:

```bash
brew install node
```

### 5. Install Node.js dependencies

The frontend lives in `web/`, so run `npm install` there.

```bash
cd web && npm install
```

### 6. Set up environment variables

Check if a `.env` file already exists at the repo root:

```bash
ls -la .env
```

If it does not exist, create it with the following template and fill in the values:

```ini
# PostgreSQL (Supabase connection pooler)
DB_USER=
DB_PASSWORD=
DB_HOST=
DB_PORT=6543
DB_NAME=postgres

# https://newsapi.org/
NEWS_API_KEY=

# https://console.groq.com/
GROQ_API_KEY=

# https://supabase.com/ (service role key)
SUPABASE_URL=
SUPABASE_KEY=

# https://modal.com/ (optional, only needed for ML training)
MODAL_TOKEN_ID=
MODAL_TOKEN_SECRET=
```

For Modal authentication (alternative to env vars):

```bash
modal token new
```

### 7. Run database migrations

> **Note:** `alembic.ini` and the migration source files are **gitignored** and not committed to the repo. The database schema on Supabase is already applied. Only run this step if you are setting up a brand new database or if schema changes have been made.

Migrations are managed from `backend/` using the Makefile:

```bash
cd backend && make db-upgrade
```

If `alembic.ini` is missing (first-time setup on a new machine), you will need to restore it or re-initialize Alembic before running migrations.

### 8. Verify the installation

Start both servers:

```bash
# Terminal 1 — backend (from backend/ directory)
source .venv/bin/activate
cd backend && make run
# → http://localhost:8000

# Terminal 2 — frontend (from web/ directory)
cd web && npm run dev
# → http://localhost:3000
```

- Frontend: http://localhost:3000
- API health check: http://localhost:8000/health
- API docs: http://localhost:8000/docs

## Troubleshooting

- **`RuntimeError: Environment variable 'X' is not set`** — a required variable is missing from `.env`. The backend loads `.env` via `python-dotenv`; make sure the file is at the repo root. The backend fails fast on startup if any variable is absent.
- **`pip install -r requirements.txt` not found** — dependencies are in `backend/requirements.txt`, not the root. Run `pip install -r backend/requirements.txt`.
- **`npm install` not found / wrong directory** — the frontend is in `web/`. Run `cd web && npm install`.
- **`No 'script_location' key found` (alembic error)** — `alembic.ini` is gitignored and missing. The DB schema already exists on Supabase; skip migrations unless you need to apply new ones.
- **Database connection error** — verify the `DB_*` values in `.env` are correct. The project uses Supabase's connection pooler on port `6543`.
- **`modal: command not found`** — Modal is installed as part of `backend/requirements.txt`. Make sure the venv is active.
- **API calls fail from frontend** — make sure the backend is running on `:8000`; `next.config.js` in `web/` proxies all API routes there.
