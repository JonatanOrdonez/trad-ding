# Install project locally

Run the following steps to set up trad-ding on the local machine. Execute them sequentially and stop if any step fails.

## Steps

### 1. Check Python version

```bash
python3 --version
```

The project requires **Python 3.12 or higher**. Any version 3.12+ is compatible (3.12.x, 3.13.x, etc.).

If no Python 3 is found, install it with Homebrew:

```bash
brew install python@3.12
```

> **Note:** If `brew install` fails with a permissions error, fix it first with:
> ```bash
> sudo chown -R $(whoami) /opt/homebrew
> ```

### 2. Create and activate virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Confirm the venv is active — the prompt should show `(.venv)`. Verify the Python version:

```bash
python --version
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Set up environment variables

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

# https://modal.com/ (optional, only needed for training)
MODAL_TOKEN_ID=
MODAL_TOKEN_SECRET=
```

### 5. Run database migrations

```bash
make db-upgrade
```

This applies all Alembic migrations against the database configured in `.env`.

### 6. Start the development server

```bash
make run
```

The app will be available at **http://localhost:8000**.

- Frontend UI: http://localhost:8000/
- Health check: http://localhost:8000/health
- API docs: http://localhost:8000/docs

## Troubleshooting

- **`python: command not found`** — use `python3` or `python3.12` instead. Inside the activated venv, `python` works normally.
- **`RuntimeError: Environment variable 'X' is not set`** — a required variable is missing from `.env`. The app fails fast on startup if any variable is absent.
- **Database connection error** — verify PostgreSQL is running and the `DB_*` values in `.env` are correct.
- **`modal: command not found`** — Modal is installed as part of `requirements.txt`. Make sure the venv is active. Authenticate with `modal token new` if training is needed.
