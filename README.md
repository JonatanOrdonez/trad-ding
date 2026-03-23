# trad-ding

An AI-powered trading analysis app that combines machine learning and LLM-based sentiment analysis to generate investment recommendations (BUY / SELL / HOLD) for stocks, cryptocurrencies, and ETFs.

## How it works

For each tracked asset, trad-ding combines two independent signals:

1. **Technical / ML signal** — trains an XGBoost classifier on 1 year of price history using indicators (SMA-7, SMA-20, RSI-14, MACD, volume change) to predict the next day's price direction. Models are trained remotely on [Modal](https://modal.com) and stored as `.onnx` files in Supabase Storage. Inference runs in the Next.js backend via `onnxruntime-node`.
2. **Fundamental / Sentiment signal** — fetches recent news from NewsAPI and Yahoo Finance, then uses Llama 3.1 (via Groq) to synthesize market narratives into a structured analysis.

Both signals are weighed by the LLM to produce a final recommendation that includes a sentiment score, summary, growth signals, risks, and a plain-language recommendation.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS v3 |
| API layer | Next.js Route Handlers (`web/src/app/**/route.ts`) |
| Python backend | FastAPI — only handles `/train` and `/health` |
| Database | Supabase (PostgreSQL via JS client) |
| ML training | XGBoost (runs remotely on Modal) |
| ML inference | ONNX Runtime (`onnxruntime-node`) |
| Model storage | Supabase Storage |
| LLM | Groq API — `llama-3.1-8b-instant` |
| News | NewsAPI + yfinance |
| Price data | yfinance |
| Cache | Upstash Redis (REST API via `@upstash/redis`) |
| Deployment | Self-hosted on Hetzner via Dokploy + Docker Compose + Traefik |

## Project structure

```
trad-ding/
├── backend/                      # Python FastAPI app (minimal — only /train + /health)
│   ├── main.py                   # App init: /health and /train routes
│   ├── env.py                    # Env var loader (loads root .env, fails fast if missing)
│   ├── supabase.py               # Supabase client factory
│   ├── api/
│   │   └── index.py              # Vercel Python serverless entry (re-exports FastAPI app)
│   ├── services/
│   │   └── training.py           # Fetches price data, dispatches to Modal, saves model metadata
│   ├── train/
│   │   ├── features.py           # Feature engineering (shared with modal_app.py)
│   │   └── modal_app.py          # Modal remote training function (XGBoost → ONNX)
│   ├── requirements.txt
│   ├── Makefile
│   └── setup.cfg
├── web/                          # Next.js 15 frontend + API layer
│   ├── next.config.js            # Proxies only /train to Python backend
│   ├── vercel.json               # Sets NEXT_PUBLIC_API_URL for Vercel
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx        # Root layout
│   │   │   ├── page.tsx          # Dashboard — Client Component, owns all state
│   │   │   ├── loading.tsx       # Skeleton loading state
│   │   │   ├── error.tsx         # Error boundary
│   │   │   ├── health/           # GET /health
│   │   │   ├── summary/          # GET /summary — asset list
│   │   │   ├── assets/           # POST /assets, DELETE /assets/:symbol
│   │   │   ├── predictions/      # GET /predictions/:symbol — ML + LLM analysis
│   │   │   ├── news/             # GET /news/:symbol, GET /news/sync
│   │   │   └── chart/            # GET /chart/:symbol — price + indicators
│   │   ├── components/
│   │   │   ├── ui/               # Toast, PageLoader
│   │   │   ├── layout/           # Header, SidePanel
│   │   │   ├── assets/           # AssetCard, FilterBar, SignalSummary, CreateAssetModal
│   │   │   ├── news/             # NewsList
│   │   │   └── analysis/         # AnalysisPanel, PriceChart
│   │   ├── hooks/                # useAssets, useAnalysis, useNews, useToast, useKeyboard, useTheme, useChartSummary
│   │   ├── lib/
│   │   │   ├── api.ts            # fetch wrappers for all API calls
│   │   │   ├── utils.ts          # timeAgo, parseNewsRaw, localStorage helpers
│   │   │   ├── constants.ts      # design tokens, Tailwind class helpers
│   │   │   ├── cache.ts          # Upstash Redis getCached/setCached
│   │   │   ├── features.ts       # TypeScript port of ML feature engineering
│   │   │   └── services/
│   │   │       ├── analysis.ts   # Groq LLM + prediction orchestration
│   │   │       ├── news.ts       # NewsAPI + yfinance news sync
│   │   │       ├── prediction.ts # ONNX model inference
│   │   │       └── supabase.ts   # Supabase JS client + DB types
│   │   └── types/                # TypeScript interfaces (asset, analysis, news)
│   └── package.json
├── docs/
│   ├── INDEX.md                  # Documentation index
│   ├── DEPLOYMENT.md             # Production architecture, CI/CD, Dokploy
│   └── LEARNINGS.md              # Non-obvious lessons: Docker, Next.js, ONNX, etc.
├── docker-compose.yml
├── Dockerfile.backend
├── Dockerfile.frontend
└── .github/workflows/            # CI: builds and pushes Docker images to GHCR
```

## Frontend

The frontend is a Next.js 15 single-page app served at `http://localhost:3000` in development. Built with React 19, TypeScript, and Tailwind CSS v3.

**Features:**
- Asset grid with type filters (All / Stock / Crypto / ETF) and real-time search
- Sort assets by symbol, last analyzed, or signal (BUY first)
- Portfolio signal summary strip — BUY / SELL / HOLD counts from last analysis; click to filter
- Per-card last-analysis badge with relative timestamp (e.g., "BUY · 3m ago"), persisted in `localStorage`
- Side panel for full analysis results — score bar (−1 to +1), growth signals, risks, competitors, re-analyze button
- Side panel for news — structured cards with title, source badge, date, summary excerpt, and external link
- Interactive price chart with technical indicators (SMA-7, SMA-20, RSI, MACD)
- Toast notification system for all async actions
- "Analyze All" to run ML + LLM analysis for every asset in sequence
- Keyboard shortcut: `/` to focus search
- Dark/light theme toggle
- Mobile-first: bottom-sheet modal, full-width inputs, 44px touch targets

## Running locally

### Prerequisites

- Python 3.12 or higher
- Node.js 22 or higher (`onnxruntime-node` requires Node 22+)
- API keys for: [Groq](https://console.groq.com), [NewsAPI](https://newsapi.org), and [Supabase](https://supabase.com)
- [Upstash Redis](https://upstash.com) database (for response caching)
- (Optional, for ML training) A [Modal](https://modal.com) account

### 1. Clone and set up Python environment

```bash
git clone <repo-url>
cd trad-ding

python3 -m venv .venv
source .venv/bin/activate   # macOS / Linux
pip install -r backend/requirements.txt
```

### 2. Install Node.js dependencies

```bash
cd web && npm install
```

### 3. Configure environment variables

Create a `.env` file in the **project root** (loaded by `backend/env.py`):

```ini
# Supabase — used by both backend (Python) and frontend (Next.js)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_service_role_key
```

Create a `.env.local` file inside **`web/`** (loaded by Next.js):

```ini
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_service_role_key

# External APIs
NEWS_API_KEY=your_newsapi_key
GROQ_API_KEY=your_groq_api_key

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# Python backend URL (only /train is proxied)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

For Modal (remote ML training), authenticate separately:

```bash
modal token new
```

### 4. Start the servers

In two separate terminals:

```bash
# Terminal 1 — Python backend (http://localhost:8000)
source .venv/bin/activate
cd backend && make run

# Terminal 2 — Next.js frontend (http://localhost:3000)
cd web && npm run dev
```

> **Tip:** Use the slash command `/run-project` to run these steps interactively.

> **Note:** No database migrations needed — Supabase manages the schema.

## API endpoints

All endpoints except `/train` are implemented as **Next.js Route Handlers** in `web/src/app/`. Only `/train` is handled by the Python backend (proxied via `next.config.js`).

| Method | Path | Handler | Description |
|---|---|---|---|
| `GET` | `/health` | Next.js | Health check |
| `GET` | `/summary` | Next.js | List all tracked assets |
| `POST` | `/assets` | Next.js | Add a new asset to track |
| `DELETE` | `/assets/{symbol}` | Next.js | Remove an asset and all its data |
| `GET` | `/news/{symbol}?offset=0&limit=5` | Next.js | Paginated news for an asset |
| `GET` | `/news/sync` | Next.js | Fetch and store latest news for all assets |
| `GET` | `/predictions/{symbol}` | Next.js | Full AI analysis (ML + LLM) |
| `GET` | `/chart/{symbol}` | Next.js | Price history + technical indicators |
| `GET` | `/train` | Python (FastAPI) | Re-train ML models for all assets via Modal |

## Makefile reference

The `Makefile` lives in `backend/`. Run these commands from `backend/` or use `cd backend && make <target>` from the root.

| Command | Description |
|---|---|
| `make run` | Start the Python backend with auto-reload |
| `make install dependency=<pkg>` | Install a Python package and update `requirements.txt` |

## Slash commands (Claude Code / Cursor)

| Command | Description |
|---|---|
| `/install` | Full local setup walkthrough |
| `/run-project` | Start both servers (backend + frontend) |
| `/kill-project` | Stop all processes and free ports 3000 and 8000 |
| `/check-env` | Validate all env vars and test service connectivity |
| `/deploy` | Deploy to Dokploy + Modal |
