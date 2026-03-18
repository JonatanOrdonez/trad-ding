# CLAUDE.md

## Project overview

**trad-ding** is a FastAPI backend that generates AI-powered investment recommendations (BUY / SELL / HOLD) for stocks, crypto, and ETFs. It combines two signals:

1. **ML signal** — XGBoost classifier trained on 1 year of OHLCV price data using technical indicators. Training runs remotely on Modal; the resulting model is serialized as `.onnx` and stored in Supabase Storage. Inference runs locally via ONNX Runtime.
2. **LLM signal** — Recent news (from NewsAPI + yfinance) fed into Llama 3.1 via Groq to produce sentiment analysis and a structured recommendation.

Both signals are combined in `app/services/analysis.py`, which calls the LLM with a structured JSON prompt and returns an `AssetAnalysis` dataclass.

## Commands

```bash
# Start dev server (auto-reload)
make run                          # uvicorn app.main:app --reload → http://localhost:8000

# Database
make db-upgrade                   # alembic upgrade head
make db-migrate msg="description" # autogenerate migration
make db-seed msg="description"    # blank migration (for seeds)

# Dependencies
make install dependency=<pkg>     # pip install + freeze to requirements.txt
```

Linting/formatting tools available: `flake8`, `black`, `isort`. Max line length is **122** characters (configured in `setup.cfg`).

### Claude Code slash commands

| Command | Use when |
|---|---|
| `/install` | Setting up the project for the first time |
| `/run-project` | Starting the dev server |
| `/kill-project` | Stopping all processes and freeing port 8000 |
| `/check-env` | Validating env vars and testing service connectivity |
| `/deploy` | Deploying to Vercel + Modal |
| `/new-migration` | Adding/changing a DB model and generating a migration |

## Architecture

```
app/
├── main.py              # FastAPI app, mounts routers and static files
├── env.py               # Loads all env vars; raises RuntimeError on startup if any are missing
├── db.py                # SQLAlchemy engine + session factory (get_session)
├── supabase.py          # Supabase client factory
├── models/              # SQLModel table definitions (Asset, AssetModel, AssetNews)
├── repositories/        # Raw DB query functions — one file per model
├── routers/             # FastAPI route handlers — thin, delegate to services
├── services/            # Business logic (analysis, news, prediction, training)
├── train/
│   ├── features.py      # Feature engineering shared between local and remote
│   └── modal_app.py     # Modal remote training function (deploys separately)
├── types/               # Pydantic/dataclass response types
└── static/index.html    # Frontend SPA — see "Frontend" section below
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
3. The Modal function builds features (`app/train/features.py`), trains XGBoost, and uploads the `.onnx` model to Supabase Storage (`ml-models` bucket).
4. A new `AssetModel` row is saved only if ROC AUC improved or the existing model is older than 5 days.

### ML features (defined in `app/train/features.py`)
`FEATURES = ["sma_7", "sma_20", "rsi", "macd", "macd_signal", "volume_change", "price_change"]`

- Label: `1` if next day close > current close, else `0`.
- `build_features(df)` works on both training (1y history) and inference (60d history).

## Code conventions

- **Routers are thin** — validate input, call a service, raise `HTTPException` on error. No business logic in routers.
- **Services own business logic** — never import from routers. Services may import from repositories.
- **Repositories are pure DB** — only SQLModel/SQLAlchemy queries, no HTTP, no external calls. Always accept a `Session` as first argument and never create their own sessions.
- **Session lifecycle** — sessions are created in the caller (router or service) with `get_session()`, used in a `try/finally` block, and closed in the `finally`. Repositories never open or close sessions.
- **Concurrency** — CPU-bound or blocking I/O (yfinance, NewsAPI, Groq, Modal) is run in `ThreadPoolExecutor`. Async route handlers use `asyncio.to_thread` to avoid blocking the event loop.
- **Symbols are always uppercase** — normalize with `.upper()` at the router boundary.
- **Type hints are required** — all function signatures must have type hints. Use `X | None` union syntax (Python 3.10+), not `Optional[X]`.
- **Dataclasses for responses** — `AssetAnalysis` and `AssetPrediction` are plain `@dataclass`; SQLModel/Pydantic `BaseModel` is used for DB models and request bodies.

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

All variables are required. The app fails immediately at startup if any are missing (`app/env.py`).

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
| PostgreSQL | Persistent storage | `app/db.py` |
| Supabase Storage | Store/retrieve `.onnx` model files | `services/prediction.py`, `train/modal_app.py` |
| Groq | LLM inference (Llama 3.1) | `services/analysis.py` |
| NewsAPI | General business news | `services/news.py` |
| yfinance | Asset-specific news + price history | `services/news.py`, `services/training.py`, `services/prediction.py` |
| Modal | Remote XGBoost training | `services/training.py`, `train/modal_app.py` |

## Frontend (`app/static/index.html`)

A single-file SPA with no build step. Tailwind CSS via CDN, vanilla JavaScript.

### State & data flow

- On load, `loadAssets()` calls `GET /summary` and populates `allAssets[]`.
- `renderGrid()` applies three filters in order: **type** (`activeFilter`) → **signal** (`activeSignal`) → **search** (`searchQuery`), then sorts by `sortBy`.
- Analysis results are persisted to **`localStorage`** under key `td_analysis_{symbol}` as `{ action, ts }`. This powers the last-analysis badge on cards and the portfolio signal summary strip.

### News data format

The `GET /news/{symbol}` endpoint returns items where `item.summary` is a **pipe-delimited raw string**:

```
Title: <title> | Date: <ISO date> | Source: <source name> | Summary: <text> | URL: <url>
```

The frontend parses this with `parseNewsRaw(raw)` before rendering structured news cards. Do **not** change this parsing logic without updating the backend response format.

### Key JS functions

| Function | Purpose |
|---|---|
| `renderGrid()` | Re-renders asset cards applying current filter, signal, search, and sort state |
| `analyze(symbol)` | Calls `GET /predictions/{symbol}`, renders analysis panel with score bar and sections |
| `showNews(symbol, offset)` | Calls `GET /news/{symbol}`, parses raw summaries, renders structured news cards |
| `analyzeAll()` | Sequentially calls `analyze()` for every asset; shows progress and result toast |
| `showToast(msg, type, duration)` | Shows a corner toast (`success`, `error`, `warning`, `info`); auto-dismisses |
| `updateSignalSummary()` | Reads localStorage for all assets, updates BUY/SELL/HOLD pill counts |
| `parseNewsRaw(raw)` | Parses pipe-delimited news string into `{ title, date, source, summary, url }` |

### Mobile considerations

- Modal uses bottom-sheet pattern on mobile (`items-end sm:items-center`, `rounded-t-2xl sm:rounded-2xl`).
- All interactive elements meet 44px minimum touch target (`min-h-[44px]`).
- Toast container is full-width on mobile (`inset-x-3`) and anchored to corner on desktop (`sm:right-5`).
- Header shows `+ Add` (mobile) vs `+ Add asset` (desktop).
- Search expands to full available width on mobile (`flex-1 sm:max-w-xs`).

## Deployment

- Deployed on **Vercel** via `api/index.py` (re-exports the FastAPI `app`).
- The Modal training app (`train/modal_app.py`) is deployed separately with `modal deploy app/train/modal_app.py` and referenced by name `"trad-ding-training"`.
- Static files are served from `app/static/`.
