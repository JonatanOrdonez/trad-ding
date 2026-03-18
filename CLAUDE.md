# CLAUDE.md

## Project overview

**trad-ding** is a full-stack AI-powered trading analysis app that generates investment recommendations (BUY / SELL / HOLD) for stocks, crypto, and ETFs. It combines two signals:

1. **ML signal** — XGBoost classifier trained on 1 year of OHLCV price data using technical indicators. Training runs remotely on Modal; the resulting model is serialized as `.onnx` and stored in Supabase Storage. Inference runs locally via ONNX Runtime.
2. **LLM signal** — Recent news (from NewsAPI + yfinance) fed into Llama 3.1 via Groq to produce sentiment analysis and a structured recommendation.

Both signals are combined in `backend/services/analysis.py`, which calls the LLM with a structured JSON prompt and returns an `AssetAnalysis` dataclass.

## Commands

```bash
# ── Python backend (FastAPI on :8000) ──────────────────────────────────────
make run                          # uvicorn backend.main:app --reload

# ── Next.js frontend (:3000) ───────────────────────────────────────────────
npm run dev                       # next dev → http://localhost:3000
npm run build                     # production build
npm run lint                      # ESLint

# ── Database ───────────────────────────────────────────────────────────────
make db-upgrade                   # alembic upgrade head
make db-migrate msg="description" # autogenerate migration
make db-seed msg="description"    # blank migration (for seeds)

# ── Python dependencies ────────────────────────────────────────────────────
make install dependency=<pkg>     # pip install + freeze to requirements.txt
```

In development, run both servers simultaneously:
- **Backend:** `make run` → http://localhost:8000
- **Frontend:** `npm run dev` → http://localhost:3000 (proxies API calls to :8000 via `next.config.js`)

Linting/formatting tools available: `flake8`, `black`, `isort`. Max line length is **122** characters (configured in `setup.cfg`).

### Claude Code slash commands

| Command | Use when |
|---|---|
| `/install` | Setting up the project for the first time |
| `/run-project` | Starting both dev servers |
| `/kill-project` | Stopping all processes and freeing ports 3000 and 8000 |
| `/check-env` | Validating env vars and testing service connectivity |
| `/deploy` | Deploying to Vercel + Modal |
| `/new-migration` | Adding/changing a DB model and generating a migration |

## Architecture

```
trad-ding/
├── api/
│   └── index.py                # Vercel Python serverless entry: re-exports FastAPI app
├── backend/                    # Python FastAPI application
│   ├── main.py                 # App init, router registration
│   ├── env.py                  # Env var loader — fails fast if any missing
│   ├── db.py                   # SQLAlchemy engine + get_session() Depends generator
│   ├── supabase.py             # Supabase client factory
│   ├── models/                 # SQLModel table definitions
│   ├── repositories/           # Raw DB queries — accept Session, no HTTP
│   ├── routers/                # FastAPI route handlers — thin, delegate to services
│   ├── services/               # Business logic (analysis, news, prediction, training)
│   ├── train/
│   │   ├── features.py         # Feature engineering (shared local + remote)
│   │   └── modal_app.py        # Modal remote training function
│   ├── types/                  # Pydantic/dataclass response types
│   └── static/index.html       # Legacy SPA (kept for reference)
├── src/                        # Next.js 15 frontend (App Router)
│   ├── app/
│   │   ├── layout.tsx          # Root layout (Geist font, metadata)
│   │   ├── page.tsx            # Dashboard — Client Component, owns all state
│   │   ├── loading.tsx         # Skeleton loading state
│   │   └── error.tsx           # Error boundary
│   ├── components/
│   │   ├── ui/                 # Toast, PageLoader
│   │   ├── layout/             # Header, SidePanel
│   │   ├── assets/             # AssetCard, FilterBar, SignalSummary, CreateAssetModal
│   │   ├── news/               # NewsList
│   │   └── analysis/           # AnalysisPanel
│   ├── hooks/                  # useAssets, useAnalysis, useNews, useToast, useKeyboard
│   ├── lib/
│   │   ├── api.ts              # fetch wrapper for all backend API calls
│   │   ├── constants.ts        # design tokens, Tailwind class helpers
│   │   └── utils.ts            # timeAgo, parseNewsRaw, localStorage helpers
│   └── types/                  # TypeScript interfaces (asset, analysis, news)
├── migrations/                 # Alembic migration files
├── next.config.js              # Proxies API routes to localhost:8000 in dev
├── vercel.json                 # Vercel: Next.js framework + Python serverless rewrites
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── Makefile
└── requirements.txt
```

## Key data flow

### Analysis (`GET /predictions/{symbol}`)
1. Router (`routers/prediction.py`) calls `analysis.analyze_asset(symbol)` in a thread.
2. `services/analysis.py` fetches general news, asset-specific news, and runs ML prediction **concurrently** with `ThreadPoolExecutor`.
3. If no ML model exists for the asset, training is triggered automatically before prediction.
4. All context is assembled into a prompt and sent to Groq (`llama-3.1-8b-instant`). Response is a strict JSON object.
5. Returns `AssetAnalysis` dataclass.

### Training (`GET /train`)
1. `services/training.py` fetches 1 year of price history from yfinance.
2. Dispatches `train_fn.remote(symbol, records)` to the Modal function `trad-ding-training/train`.
3. The Modal function builds features (`backend/train/features.py`), trains XGBoost, and uploads the `.onnx` model to Supabase Storage (`ml-models` bucket).
4. A new `AssetModel` row is saved only if ROC AUC improved or the existing model is older than 5 days.

### ML features (defined in `backend/train/features.py`)
`FEATURES = ["sma_7", "sma_20", "rsi", "macd", "macd_signal", "volume_change", "price_change"]`

- Label: `1` if next day close > current close, else `0`.
- `build_features(df)` works on both training (1y history) and inference (60d history).

## Code conventions

### Python (backend)
- **Routers are thin** — validate input, call a service, raise `HTTPException` on error. No business logic in routers.
- **Services own business logic** — never import from routers. Services may import from repositories.
- **Repositories are pure DB** — only SQLModel/SQLAlchemy queries, no HTTP, no external calls. Always accept a `Session` as first argument and never create their own sessions.
- **Session lifecycle** — `get_session()` is a FastAPI `Depends()` generator: `with Session(engine) as session: yield session`. Routers use `session: Session = Depends(get_session)`.
- **Concurrency** — CPU-bound or blocking I/O (yfinance, NewsAPI, Groq, Modal) is run in `ThreadPoolExecutor`. Async route handlers use `asyncio.to_thread`.
- **Symbols are always uppercase** — normalize with `.upper()` at the router boundary.
- **Type hints are required** — all function signatures must have type hints. Use `X | None` union syntax (Python 3.10+), not `Optional[X]`.
- **Dataclasses for responses** — `AssetAnalysis` and `AssetPrediction` are plain `@dataclass`.

### TypeScript (frontend)
- All components are Client Components (`"use client"`) — state is centralized in `src/app/page.tsx`.
- API calls go through `src/lib/api.ts` — never fetch directly in components.
- Design tokens (Tailwind class strings) live in `src/lib/constants.ts`.
- `parseNewsRaw()` in `src/lib/utils.ts` parses the pipe-delimited news format from the backend — do **not** change without updating the backend too.

## Database models

| Table | Description |
|---|---|
| `assets` | Tracked assets (symbol, name, asset_type, yfinance_symbol) |
| `asset_models` | Trained ML model registry (storage_path, metrics JSONB, is_active) |
| `asset_news` | Cached news items (content JSONB, source_type: yfinance/newsapi) |

- Primary keys are UUIDs generated by `gen_random_uuid()` server-side.
- `asset_models.is_active` — only one active model per asset at a time. `deactivate_models()` flips all to `False` before inserting a new one.
- `asset_news` uses `content_id` (url or uuid from source) as a deduplication key.

## Environment variables

All variables are required. The app fails immediately at startup if any are missing (`backend/env.py`).

```ini
DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME   # PostgreSQL connection
NEWS_API_KEY                                        # newsapi.org
GROQ_API_KEY                                        # console.groq.com
SUPABASE_URL                                        # Supabase project URL
SUPABASE_KEY                                        # Supabase service role key
```

For Modal (remote training): authenticate with `modal token new`. The `.env` file is passed to the Modal function via `modal.Secret.from_dotenv()`.

## External services

| Service | Purpose | Used in |
|---|---|---|
| PostgreSQL | Persistent storage | `backend/db.py` |
| Supabase Storage | Store/retrieve `.onnx` model files | `services/prediction.py`, `train/modal_app.py` |
| Groq | LLM inference (Llama 3.1) | `services/analysis.py` |
| NewsAPI | General business news | `services/news.py` |
| yfinance | Asset-specific news + price history | `services/news.py`, `services/training.py`, `services/prediction.py` |
| Modal | Remote XGBoost training | `services/training.py`, `train/modal_app.py` |

## Frontend (`src/`)

Next.js 15 App Router, TypeScript, Tailwind CSS v3. The dashboard at `src/app/page.tsx` is a Client Component that owns all UI state and delegates to hooks and sub-components.

### News data format

The `GET /news/{symbol}` endpoint returns items where `item.summary` is a **pipe-delimited raw string**:

```
Title: <title> | Date: <ISO date> | Source: <source name> | Summary: <text> | URL: <url>
```

The frontend parses this with `parseNewsRaw()` in `src/lib/utils.ts`. Do **not** change this format without updating both sides.

### Mobile considerations

- Modal uses bottom-sheet pattern on mobile (`items-end sm:items-center`, `rounded-t-2xl sm:rounded-2xl`).
- All interactive elements meet 44px minimum touch target (`min-h-[44px]`).
- Toast container is full-width on mobile (`inset-x-3`) and anchored to corner on desktop (`sm:right-5`).
- Header shows `+ Add` (mobile) vs `+ Add asset` (desktop).

## Deployment

### Vercel (monorepo — Next.js + Python serverless)

`vercel.json` configures:
- **Framework:** `nextjs` — Vercel auto-builds the Next.js frontend.
- **Python function:** `api/index.py` built with `@vercel/python@4`.
- **Rewrites:** `/health`, `/summary`, `/assets/*`, `/news/*`, `/predictions/*`, `/train` → `api/index.py`.

Next.js serves the frontend at the root. All API routes are intercepted by Vercel rewrites and forwarded to the Python serverless function.

> **Important:** Do NOT add a `builds` entry for Next.js in `vercel.json` — Vercel handles it automatically via `"framework": "nextjs"`. Only `api/index.py` needs an explicit build entry.

### Modal (ML training)

```bash
modal deploy backend/train/modal_app.py
```

Registers the function as `trad-ding-training/train`. Called at runtime by the backend when `/train` or `/predictions/{symbol}` (first run, no model) is triggered.

### Database migrations on deploy

Migrations are **not run automatically**. Run manually against production DB before the first deploy or after schema changes:

```bash
make db-upgrade
```
