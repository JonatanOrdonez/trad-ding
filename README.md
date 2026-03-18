# trad-ding

An AI-powered trading analysis API that combines machine learning and LLM-based sentiment analysis to generate investment recommendations (BUY / SELL / HOLD) for stocks, cryptocurrencies, and ETFs.

## How it works

For each tracked asset, trad-ding combines two independent signals:

1. **Fundamental / Sentiment signal** — fetches recent news from NewsAPI and Yahoo Finance, then uses Llama 3.1 (via Groq) to synthesize market narratives into a structured analysis.
2. **Technical / ML signal** — trains an XGBoost classifier on 1 year of price history using indicators (SMA-7, SMA-20, RSI-14, MACD, volume change) to predict the next day's price direction. Models are trained remotely on [Modal](https://modal.com) and stored as `.onnx` files in Supabase Storage.

Both signals are weighed by the LLM to produce a final recommendation that includes a sentiment score, summary, growth signals, risks, and a plain-language recommendation.

## Tech stack

| Layer | Technology |
|---|---|
| Language | Python 3.12+ |
| Web framework | FastAPI + Uvicorn |
| Database | PostgreSQL (SQLModel + SQLAlchemy, migrations via Alembic) |
| ML training | XGBoost (runs remotely on Modal) |
| ML inference | ONNX Runtime |
| Model storage | Supabase Storage |
| LLM | Groq API — `llama-3.1-8b-instant` |
| News | NewsAPI + yfinance |
| Price data | yfinance |
| Deployment | Vercel (Python serverless) + Modal (ML training) |

## Project structure

```
trad-ding/
├── api/index.py              # Vercel serverless entrypoint
├── app/
│   ├── main.py               # FastAPI app & router registration
│   ├── env.py                # Environment variable loader (fails fast if any are missing)
│   ├── db.py                 # Database session factory
│   ├── models/               # SQLModel table definitions (Asset, AssetModel, AssetNews)
│   ├── repositories/         # Database query layer
│   ├── routers/              # FastAPI route handlers
│   ├── services/             # Business logic (analysis, news, prediction, training)
│   ├── train/                # Feature engineering & Modal remote training
│   ├── types/                # Pydantic response types
│   └── static/index.html     # Frontend SPA (see Frontend section below)
├── migrations/               # Alembic migration files
├── .claude/commands/         # Claude Code slash commands
├── Makefile
├── requirements.txt
└── vercel.json
```

## Frontend

The frontend is a single-page app served at `http://localhost:8000/`. Built with Tailwind CSS (CDN) and vanilla JavaScript — no build step required.

**Features:**
- Asset grid with type filters (All / Stock / Crypto / ETF) and real-time search
- Sort assets by symbol, last analyzed, or signal (BUY first)
- Portfolio signal summary strip — shows BUY / SELL / HOLD counts from last analysis; click to filter
- Per-card last-analysis badge with relative timestamp (e.g., "BUY · 3m ago"), persisted in `localStorage`
- Side panel for full analysis results — includes score bar (−1 to +1), growth signals, risks, competitors, timestamp, and re-analyze button
- Side panel for news — structured cards with title, source badge, date, summary excerpt, and external link
- Toast notification system for all async actions (sync, delete, create, analyze all)
- "Analyze All" action to run ML + LLM analysis for every asset in sequence
- Keyboard shortcut: `/` to focus search
- Accessible: ARIA labels, focus rings, keyboard navigation, `prefers-reduced-motion` support
- Mobile-first: bottom sheet modal, full-width inputs, 44px touch targets throughout

## Running locally

### Prerequisites

- Python 3.12 or higher
- A running PostgreSQL instance (or Supabase project)
- API keys for: [Groq](https://console.groq.com), [NewsAPI](https://newsapi.org), and [Supabase](https://supabase.com)
- (Optional, for ML training) A [Modal](https://modal.com) account

### 1. Clone and set up the environment

```bash
git clone <repo-url>
cd trad-ding

python3 -m venv .venv
source .venv/bin/activate   # macOS / Linux
# .venv\Scripts\activate    # Windows

pip install -r requirements.txt
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```ini
# Database
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=trad_ding

# External APIs
NEWS_API_KEY=your_newsapi_key
GROQ_API_KEY=your_groq_api_key

# Supabase (for ML model storage)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_service_role_key
```

> The app will refuse to start if any of these variables are missing.

For Modal (remote ML training), authenticate separately:

```bash
modal token new
```

### 3. Apply database migrations

```bash
make db-upgrade
```

### 4. Start the server

```bash
make run
```

The app will be available at **http://localhost:8000**.

> **Tip:** Use the Claude Code slash command `/run-project` to run these steps interactively.

## API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Frontend SPA |
| `GET` | `/health` | Health check |
| `GET` | `/summary` | List all tracked assets |
| `POST` | `/assets` | Add a new asset to track |
| `DELETE` | `/assets/{symbol}` | Remove an asset and all its data |
| `GET` | `/news/{symbol}?offset=0&limit=5` | Paginated news for an asset |
| `GET` | `/news/sync` | Fetch and store latest news for all assets |
| `GET` | `/predictions/{symbol}` | Full AI analysis (ML + LLM) |
| `GET` | `/train` | Re-train ML models for all assets |

## Makefile reference

| Command | Description |
|---|---|
| `make run` | Start the dev server with auto-reload |
| `make db-upgrade` | Apply all pending database migrations |
| `make db-migrate msg="..."` | Generate a new auto migration |
| `make db-seed msg="..."` | Create a blank migration (for seed data) |
| `make install dependency=<pkg>` | Install a package and update `requirements.txt` |

## Claude Code commands

| Command | Description |
|---|---|
| `/install` | Full local setup walkthrough |
| `/run-project` | Start the server (after install) |
| `/kill-project` | Stop all project processes and free port 8000 |
| `/check-env` | Validate all env vars and test service connectivity |
| `/deploy` | Deploy to Vercel (backend) and Modal (ML training) |
| `/new-migration` | Create and apply a new Alembic database migration |
