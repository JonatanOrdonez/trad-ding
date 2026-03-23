# CLAUDE.md

## Project overview

**trad-ding** is a full-stack AI-powered trading analysis app that generates investment recommendations (BUY / SELL / HOLD) for stocks, crypto, and ETFs. It combines two signals:

1. **ML signal** — XGBoost classifier trained on 1 year of OHLCV price data using technical indicators. Training runs remotely on Modal; the resulting model is serialized as `.onnx` and stored in Supabase Storage. Inference runs in Next.js via `onnxruntime-node`.
2. **LLM signal** — Recent news (from NewsAPI + yfinance) fed into Llama 3.1 via Groq to produce sentiment analysis and a structured recommendation.

Both signals are orchestrated in `web/src/lib/services/analysis.ts`, which calls Groq with a structured JSON prompt and returns an analysis object. **The Python backend only handles `/train` and `/health`.**

## Commands

```bash
# ── Python backend (FastAPI on :8000) — run from backend/ ──────────────────
cd backend && make run            # uvicorn backend.main:app --reload

# ── Next.js frontend (:3000) — run from web/ ───────────────────────────────
cd web && npm run dev             # next dev → http://localhost:3000
cd web && npm run build           # production build
cd web && npm run lint            # ESLint

# ── Python dependencies — run from backend/ ────────────────────────────────
cd backend && make install dependency=<pkg>   # pip install + freeze to requirements.txt
```

In development, run both servers simultaneously:
- **Backend:** `cd backend && make run` → http://localhost:8000
- **Frontend:** `cd web && npm run dev` → http://localhost:3000

Only `/train` is proxied to the Python backend via `web/next.config.js`. All other API routes are Next.js Route Handlers.

Linting/formatting tools available for Python: `flake8`, `black`, `isort`. Max line length is **122** characters (configured in `backend/setup.cfg`).

### Slash commands

| Command | Use when |
|---|---|
| `/install` | Setting up the project for the first time |
| `/run-project` | Starting both dev servers |
| `/kill-project` | Stopping all processes and freeing ports 3000 and 8000 |
| `/check-env` | Validating env vars and testing service connectivity |
| `/deploy` | Deploying via Dokploy + Modal |

## Architecture

```
trad-ding/
├── backend/                      # Python FastAPI — minimal (only /train + /health)
│   ├── main.py                   # App init: /health and /train routes
│   ├── env.py                    # Loads root .env — only SUPABASE_URL + SUPABASE_KEY required
│   ├── supabase.py               # Supabase client factory
│   ├── api/
│   │   └── index.py              # Vercel Python serverless entry (re-exports FastAPI app)
│   ├── services/
│   │   └── training.py           # Fetches 1y price data, dispatches to Modal, saves model to Supabase
│   ├── train/
│   │   ├── features.py           # Feature engineering shared with modal_app.py
│   │   └── modal_app.py          # Modal remote function: XGBoost → ONNX → Supabase Storage
│   ├── requirements.txt
│   ├── Makefile
│   └── setup.cfg
└── web/                          # Next.js 15 — frontend + all API logic
    ├── next.config.js            # Proxies only /train to Python backend
    ├── vercel.json               # Sets NEXT_PUBLIC_API_URL for Vercel
    └── src/
        ├── app/
        │   ├── layout.tsx        # Root layout
        │   ├── page.tsx          # Dashboard — Client Component, owns all UI state
        │   ├── loading.tsx       # Skeleton loading state
        │   ├── error.tsx         # Error boundary
        │   ├── health/route.ts         # GET /health
        │   ├── summary/route.ts        # GET /summary — asset list
        │   ├── assets/route.ts         # POST /assets
        │   ├── assets/[sym]/route.ts   # DELETE /assets/:symbol
        │   ├── predictions/[sym]/route.ts  # GET /predictions/:symbol
        │   ├── news/[sym]/route.ts     # GET /news/:symbol
        │   ├── news/sync/route.ts      # GET /news/sync
        │   └── chart/[sym]/route.ts    # GET /chart/:symbol
        ├── components/
        │   ├── ui/               # Toast, PageLoader
        │   ├── layout/           # Header, SidePanel
        │   ├── assets/           # AssetCard, FilterBar, SignalSummary, CreateAssetModal
        │   ├── news/             # NewsList
        │   └── analysis/         # AnalysisPanel, PriceChart
        ├── hooks/                # useAssets, useAnalysis, useNews, useToast, useKeyboard, useTheme, useChartSummary
        ├── lib/
        │   ├── api.ts            # fetch wrappers for all API calls — never fetch directly in components
        │   ├── utils.ts          # timeAgo, parseNewsRaw, localStorage helpers
        │   ├── constants.ts      # design tokens, Tailwind class helpers
        │   ├── cache.ts          # Upstash Redis getCached/setCached
        │   ├── features.ts       # TypeScript port of ML feature engineering (mirrors backend/train/features.py)
        │   └── services/
        │       ├── analysis.ts   # Groq LLM — assembles news + ML prediction into recommendation
        │       ├── news.ts       # NewsAPI + yfinance news sync and retrieval
        │       ├── prediction.ts # ONNX model download from Supabase + inference
        │       └── supabase.ts   # Supabase JS client + DB query helpers
        └── types/                # TypeScript interfaces (asset.ts, analysis.ts, news.ts)
```

## Key data flow

### Analysis (`GET /predictions/:symbol`)
1. Next.js Route Handler at `web/src/app/predictions/[assetSymbol]/route.ts`.
2. Calls `analyzeAsset(symbol)` from `web/src/lib/services/analysis.ts`.
3. Fetches general news, asset-specific news, and runs ML prediction **concurrently**.
4. If no ONNX model exists for the asset, triggers `/train` first (via Python backend → Modal).
5. All context assembled into a prompt, sent to Groq (`llama-3.1-8b-instant`). Response is strict JSON.
6. Result cached in Upstash Redis.

### Training (`GET /train`)
1. Proxied to Python backend (`next.config.js`).
2. `backend/services/training.py` fetches 1 year of price history from yfinance.
3. Dispatches `train.remote(symbol, records)` to Modal function `trad-ding-training/train`.
4. Modal function builds features (`backend/train/features.py`), trains XGBoost, converts to ONNX, uploads to Supabase Storage (`ml-models` bucket).
5. Saves model metadata to Supabase DB (`asset_models` table).

### ML features
`FEATURES = ["sma_7", "sma_20", "rsi", "macd", "macd_signal", "volume_change", "price_change"]`

Defined in both `backend/train/features.py` (Python, used during training) and `web/src/lib/features.ts` (TypeScript, used during inference). **Keep both in sync.**

- Label: `1` if next day close > current close, else `0`.
- Inference uses 60 days of price history; training uses 1 year.

## Code conventions

### Python (backend)
- **Backend is intentionally minimal** — only `/train` and `/health`. Do not add business logic here.
- **Concurrency** — blocking I/O (yfinance, Modal) runs in `ThreadPoolExecutor`. Async route handlers use `asyncio.to_thread`.
- **Type hints are required** — all function signatures must have type hints. Use `X | None` union syntax (Python 3.10+), not `Optional[X]`.
- **Symbols are always uppercase** — normalize with `.upper()` at the entry point.
- **`backend/env.py` loads from the repo root `.env`** — path is `Path(__file__).parent.parent / ".env"`. Python only requires `SUPABASE_URL` and `SUPABASE_KEY`.

### TypeScript (frontend + API)
- All components are Client Components (`"use client"`) — state is centralized in `web/src/app/page.tsx`.
- **API calls go through `web/src/lib/api.ts`** — never fetch directly in components.
- **Business logic lives in `web/src/lib/services/`** — route handlers call services, not the other way around.
- Design tokens (Tailwind class strings) live in `web/src/lib/constants.ts`.
- Route handlers are in `web/src/app/**/route.ts` — when adding a new endpoint, add it there.
- When modifying ML feature engineering, **update both** `backend/train/features.py` and `web/src/lib/features.ts`.

## Database

Managed via **Supabase JS client** (`web/src/lib/services/supabase.ts`). No SQLAlchemy or Alembic — schema changes are made directly in Supabase.

| Table | Description |
|---|---|
| `assets` | Tracked assets (symbol, name, asset_type, yfinance_symbol) |
| `asset_models` | Trained ML model registry (storage_path, metrics JSONB, is_active) |
| `asset_news` | Cached news items (content JSONB, source_type: yfinance/newsapi) |

- Primary keys are UUIDs generated by `gen_random_uuid()` server-side.
- `asset_models.is_active` — only one active model per asset at a time.
- `asset_news` uses `content_id` (url or uuid from source) as a deduplication key.

## Environment variables

### Python backend (root `.env`)

Only two variables are required by the Python backend:

```ini
SUPABASE_URL=    # Supabase project URL
SUPABASE_KEY=    # Supabase service role key
```

For Modal (remote training): `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` (or use `modal token new`).

### Next.js frontend (`web/.env.local`)

```ini
SUPABASE_URL=                   # Supabase project URL
SUPABASE_KEY=                   # Supabase service role key
NEWS_API_KEY=                   # newsapi.org
GROQ_API_KEY=                   # console.groq.com
UPSTASH_REDIS_REST_URL=         # Upstash Redis REST URL
UPSTASH_REDIS_REST_TOKEN=       # Upstash Redis token
NEXT_PUBLIC_API_URL=http://localhost:8000  # Python backend URL (only /train uses it)
```

## External services

| Service | Purpose | Used in |
|---|---|---|
| Supabase DB | Persistent storage (assets, models, news) | `web/src/lib/services/supabase.ts` |
| Supabase Storage | Store/retrieve `.onnx` model files | `web/src/lib/services/prediction.ts`, `backend/train/modal_app.py` |
| Groq | LLM inference (Llama 3.1) | `web/src/lib/services/analysis.ts` |
| NewsAPI | General business news | `web/src/lib/services/news.ts` |
| yfinance | Asset-specific news + price history | `web/src/lib/services/news.ts`, `backend/services/training.py` |
| Modal | Remote XGBoost training | `backend/services/training.py`, `backend/train/modal_app.py` |
| Upstash Redis | Response caching | `web/src/lib/cache.ts` |

## Frontend (`web/src/`)

Next.js 15 App Router, TypeScript, Tailwind CSS v3. The dashboard at `web/src/app/page.tsx` is a Client Component that owns all UI state and delegates to hooks and sub-components.

### Mobile considerations

- Modal uses bottom-sheet pattern on mobile (`items-end sm:items-center`, `rounded-t-2xl sm:rounded-2xl`).
- All interactive elements meet 44px minimum touch target (`min-h-[44px]`).
- Toast container is full-width on mobile (`inset-x-3`) and anchored to corner on desktop (`sm:right-5`).
- Header shows `+ Add` (mobile) vs `+ Add asset` (desktop).

## Sistema de documentación

Al inicio de cada tarea, leer `docs/INDEX.md` para saber qué documentación existe y cuándo consultarla.

### Archivos clave

| Archivo | Contenido |
|---|---|
| `docs/INDEX.md` | Índice de toda la documentación. Punto de entrada. |
| `docs/DEPLOYMENT.md` | Arquitectura de producción, CI/CD, Dokploy, variables de entorno, redeploy y troubleshooting. |
| `docs/LEARNINGS.md` | Lecciones no obvias: Docker, Next.js build-time, Alpine vs glibc, Traefik, GHCR, onnxruntime-node. |

### Cuándo actualizar la documentación

- Al completar una tarea de deploy o infraestructura: actualizar `docs/DEPLOYMENT.md` si algo cambia.
- Si descubres algo no obvio sobre el stack: agregar una entrada a `docs/LEARNINGS.md`.
- Si creas un documento nuevo en `docs/`: registrarlo en `docs/INDEX.md`.

---

## Deployment

The app is self-hosted on **Hetzner** using **Dokploy** + **Docker Compose** + **Traefik** (SSL). See `docs/DEPLOYMENT.md` for full details.

### CI/CD

Pushing to `main` triggers GitHub Actions (`.github/workflows/`) which builds and pushes Docker images to GHCR. Dokploy then pulls and restarts the services via webhook.

### Docker images

- **Frontend** (`Dockerfile.frontend`): `node:22-slim` — must use slim (not Alpine) due to `onnxruntime-node` glibc requirement.
- **Backend** (`Dockerfile.backend`): `python:3.12-slim`.

### Modal (ML training)

```bash
modal deploy backend/train/modal_app.py
```

Registers the function as `trad-ding-training/train`. Called at runtime by the backend when `/train` is triggered.
