# Install project locally

Run the following steps to set up trad-ding on the local machine. Execute them sequentially and stop if any step fails.

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

```bash
pip install -r requirements.txt
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

```bash
npm install
```

### 6. Set up environment variables

Check if a `.env` file already exists:

```bash
ls -la .env
```

If it does not exist, create it with the following template and fill in the values:

```ini
# PostgreSQL
DB_USER=
DB_PASSWORD=
DB_HOST=
DB_PORT=5432
DB_NAME=

# https://newsapi.org/
NEWS_API_KEY=

# https://console.groq.com/
GROQ_API_KEY=

# https://supabase.com/ (service role key)
SUPABASE_URL=
SUPABASE_KEY=
```

For Modal (optional, only needed for ML training):

```bash
modal token new
```

### 7. Run database migrations

```bash
make db-upgrade
```

This applies all Alembic migrations against the database configured in `.env`.

### 8. Verify the installation

Start both servers:

```bash
# Terminal 1
make run
# → http://localhost:8000

# Terminal 2
npm run dev
# → http://localhost:3000
```

- Frontend: http://localhost:3000
- API health check: http://localhost:8000/health
- API docs: http://localhost:8000/docs

## Troubleshooting

- **`RuntimeError: Environment variable 'X' is not set`** — a required variable is missing from `.env`. The backend fails fast on startup if any variable is absent.
- **Database connection error** — verify PostgreSQL is running and the `DB_*` values in `.env` are correct.
- **`modal: command not found`** — Modal is installed as part of `requirements.txt`. Make sure the venv is active.
- **API calls fail from frontend** — make sure the backend is running on `:8000`; `next.config.js` proxies all API routes there.
