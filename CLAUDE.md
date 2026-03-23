# CLAUDE.md

## Project overview

**trad-ding** is a full-stack AI-powered trading analysis app that generates investment recommendations (BUY / SELL / HOLD) for stocks, crypto, and ETFs. It combines two signals:

1. **ML signal** — XGBoost classifier trained on 1 year of OHLCV price data using technical indicators. Training runs remotely on Modal; the resulting model is serialized as `.onnx` and stored in Supabase Storage. Inference runs in Next.js via `onnxruntime-node`.
2. **LLM signal** — Recent news (from NewsAPI + yfinance) fed into Llama 3.1 via Groq to produce sentiment analysis and a structured recommendation.

Both signals are combined in `web/src/lib/services/analysis.ts`, which calls the LLM with a structured JSON prompt and returns an `AssetAnalysis` object. **There is no Python backend** — all API logic runs as Next.js Route Handlers.

## Commands

```bash
# ── Next.js app (:3000) ────────────────────────────────────────────────────
cd web && npm run dev             # next dev → http://localhost:3000
cd web && npm run build           # production build
cd web && npm run lint            # ESLint
cd web && npm run test            # vitest

# ── Modal (ML training) ────────────────────────────────────────────────────
modal deploy modal/modal_app.py   # deploy training web endpoint
```

In development, only one server is needed:
- **App:** `cd web && npm run dev` → http://localhost:3000

Linting/formatting tools available for Python: `flake8`, `black`, `isort`. Max line length is **122** characters (configured via `setup.cfg` if present).

### Slash commands

| Command | Use when |
|---|---|
| `/install` | Setting up the project for the first time |
| `/run-project` | Starting the dev server |
| `/kill-project` | Stopping all processes and freeing port 3000 |
| `/deploy` | Deploying to Dokploy + Modal |

## Architecture

> Full architecture documentation: [`docs/architecture.md`](docs/architecture.md)

```
trad-ding/
├── web/                          # Next.js 15 — frontend + all API logic
│   ├── next.config.js            # output: standalone (no proxy — no Python backend)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # Dashboard — Client Component, owns all state
│   │   │   ├── layout.tsx        # Root layout
│   │   │   ├── loading.tsx       # Skeleton loading state
│   │   │   ├── error.tsx         # Error boundary
│   │   │   ├── api/train/        # POST /api/train — auth + rate limit + Modal dispatch
│   │   │   ├── assets/           # Route Handlers: CRUD assets
│   │   │   ├── news/             # Route Handlers: news fetch + sync
│   │   │   ├── predictions/      # Route Handlers: ML + LLM analysis
│   │   │   ├── summary/          # Route Handler: asset list
│   │   │   ├── chart/            # Route Handler: price chart data
│   │   │   └── health/           # GET /health
│   │   ├── components/
│   │   │   ├── ui/               # Toast, PageLoader
│   │   │   ├── layout/           # Header, SidePanel
│   │   │   ├── assets/           # AssetCard, FilterBar, SignalSummary, CreateAssetModal
│   │   │   ├── news/             # NewsList
│   │   │   └── analysis/         # AnalysisPanel, PriceChart
│   │   ├── hooks/                # useAssets, useAnalysis, useNews, useToast, useKeyboard, useChartSummary, useTheme
│   │   ├── lib/
│   │   │   ├── api.ts            # Fetch wrapper for all API calls — never fetch directly in components
│   │   │   ├── cache.ts          # Upstash Redis getCached/setCached
│   │   │   ├── features.ts       # TS port of feature engineering (mirrors modal/features.py — keep in sync)
│   │   │   ├── constants.ts      # Design tokens, Tailwind class helpers
│   │   │   ├── utils.ts          # timeAgo, parseNewsRaw, localStorage helpers
│   │   │   └── services/
│   │   │       ├── analysis.ts   # Groq LLM call + signal combination
│   │   │       ├── prediction.ts # ONNX inference via onnxruntime-node
│   │   │       ├── news.ts       # News sync + retrieval from Supabase
│   │   │       └── supabase.ts   # Supabase JS client + DB types
│   │   └── types/                # TypeScript interfaces (asset, analysis, news)
│   └── package.json
├── modal/                        # Modal serverless ML training (Python)
│   ├── modal_app.py              # Web endpoint: OHLCV → XGBoost → ONNX → Supabase Storage
│   └── features.py               # Feature engineering (Python — mirror of web/src/lib/features.ts)
├── Dockerfile.frontend           # Multi-stage: node:22-slim
├── docker-compose.yml            # Single Next.js container + Traefik labels
├── .github/workflows/
│   └── build-and-push.yml        # CI: build → GHCR → Dokploy deploy
└── docs/                         # Project documentation (Diataxis)
```

## Key data flow

> Detailed flow diagrams: [`docs/architecture.md`](docs/architecture.md)

### Analysis (`GET /predictions/{symbol}`) — runs in Next.js
1. Route Handler (`web/src/app/predictions/[assetSymbol]/route.ts`) checks Upstash Redis cache (TTL 60s).
2. `analyzeAsset()` in `web/src/lib/services/analysis.ts` fetches general news, asset news, and runs ML prediction **concurrently** with `Promise.all`.
3. If no ML model exists for the asset, analysis proceeds without ML signal (no auto-training).
4. All context is assembled into a prompt and sent to Groq (`llama-3.1-8b-instant`, JSON mode). Response is parsed into `AssetAnalysis`.

### ML inference — runs in Next.js via ONNX Runtime
1. `predictAsset()` in `web/src/lib/services/prediction.ts` downloads the `.onnx` model from Supabase Storage.
2. Fetches 90 days of OHLCV from Yahoo Finance, computes features via `web/src/lib/features.ts`.
3. Runs single-row inference via `onnxruntime-node`. Returns signal (BUY/SELL) + confidence.

### Training (`POST /api/train`) — runs in Next.js, protected
1. Route Handler (`web/src/app/api/train/route.ts`) validates `X-API-Key` header, checks rate limit (1 per 30 min) and concurrency lock via Upstash Redis.
2. Fetches 1 year of OHLCV from Yahoo Finance for each asset (sequentially).
3. Calls Modal web endpoint (`MODAL_TRAIN_URL`) which trains XGBoost, converts to ONNX, uploads to Supabase Storage.
4. A new `AssetModel` row is saved only if ROC AUC improved or the existing model is older than 5 days.

### ML features
`FEATURES = ["sma_7", "sma_20", "rsi", "macd", "macd_signal", "volume_change", "price_change"]`

- Feature engineering exists in **both** Python (`modal/features.py`) and TypeScript (`web/src/lib/features.ts`) — **must stay in sync**.
- Label: `1` if next day close > current close, else `0`.
- Training uses 1 year of data; inference uses 90 days.

## Code conventions

### Python (Modal training only)
- Python code lives only in `modal/` — deployed as a Modal web endpoint for XGBoost training.
- No Python backend server. All API logic lives in Next.js Route Handlers.

### TypeScript (frontend + API)
- **Route Handlers** in `web/src/app/*/route.ts` handle all API logic (news, analysis, predictions, assets, training).
- **Services** in `web/src/lib/services/` own business logic — route handlers call services, not the other way around.
- All page components are Client Components (`"use client"`) — state is centralized in `web/src/app/page.tsx`.
- API calls from components go through `web/src/lib/api.ts` — never fetch directly in components.
- Design tokens (Tailwind class strings) live in `web/src/lib/constants.ts`.
- Response caching via Upstash Redis (`web/src/lib/cache.ts`) with 30-60s TTL.
- When modifying ML feature engineering, **update both** `modal/features.py` and `web/src/lib/features.ts`.

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

All variables are set in `web/.env.local` (development) or in Dokploy (production):

```ini
SUPABASE_URL                    # Supabase project URL
SUPABASE_KEY                    # Supabase service role key
NEWS_API_KEY                    # newsapi.org
GROQ_API_KEY                    # console.groq.com (Llama 3.1)
UPSTASH_REDIS_REST_URL          # Upstash Redis REST endpoint
UPSTASH_REDIS_REST_TOKEN        # Upstash Redis auth token
TRAIN_API_KEY                   # Shared secret for POST /api/train + Modal auth
MODAL_TRAIN_URL                 # Modal web endpoint URL for training
```

See `web/.env.example` for the full template with descriptions.

## External services

| Service | Purpose | Used in |
|---|---|---|
| Supabase (PostgreSQL) | Persistent storage (assets, news, model registry) | `web/src/lib/services/supabase.ts` |
| Supabase Storage | Store/retrieve `.onnx` model files | `web/src/lib/services/prediction.ts` (download), `modal/modal_app.py` (upload) |
| Groq | LLM inference (Llama 3.1 8B Instant) | `web/src/lib/services/analysis.ts` |
| NewsAPI | General business headlines | `web/src/lib/services/news.ts` |
| Yahoo Finance | Asset-specific news + OHLCV price history | `web/src/lib/services/news.ts`, `prediction.ts`, `api/train/route.ts` |
| Modal | Serverless ML training (XGBoost → ONNX) | `web/src/app/api/train/route.ts` → `modal/modal_app.py` |
| Upstash Redis | Response caching + training rate limit/lock | `web/src/lib/cache.ts` |

## Frontend (`web/`)

Next.js 15 App Router, TypeScript, Tailwind CSS v3. The dashboard at `web/src/app/page.tsx` is a Client Component that owns all UI state and delegates to hooks and sub-components.

### API Route Handlers

All API logic runs as Next.js Route Handlers (server-side). The frontend is both the UI and the API server:

| Route | Method | Description |
|---|---|---|
| `/assets` | POST | Create asset (validates via Yahoo Finance) |
| `/assets/{symbol}` | DELETE | Delete asset + models + news |
| `/news/{symbol}` | GET | Fetch news (auto-syncs if empty) |
| `/news/sync` | GET | Sync all news sources |
| `/predictions/{symbol}` | GET | Full analysis (ML + LLM), cached 60s |
| `/summary` | GET | Asset list |
| `/chart/{symbol}` | GET | Price chart data + indicators |
| `/health` | GET | Healthcheck |
| `/api/train` | POST | ML training for all assets (auth + rate limit + lock) |

### Mobile considerations

- Modal uses bottom-sheet pattern on mobile (`items-end sm:items-center`, `rounded-t-2xl sm:rounded-2xl`).
- All interactive elements meet 44px minimum touch target (`min-h-[44px]`).
- Toast container is full-width on mobile (`inset-x-3`) and anchored to corner on desktop (`sm:right-5`).
- Header shows `+ Add` (mobile) vs `+ Add asset` (desktop).

## Sistema de documentación

Al inicio de cada tarea, leer `INDEX.md` (catálogo maestro en raíz) y `docs/INDEX.md` (índice detallado).

### Nivel 1: Repo (`docs/`) — Documentación técnica (Diataxis)

| Tipo | Archivo | Contenido |
|---|---|---|
| Explanation | `docs/architecture.md` | Arquitectura completa: componentes, flujos, modelo de datos, deployment. |
| How-to | `docs/DEPLOYMENT.md` | Producción, CI/CD, Dokploy, env vars, troubleshooting. |
| Reference | `docs/LEARNINGS.md` | Lecciones no obvias: Docker, Next.js, Alpine, Traefik, GHCR, onnxruntime-node. |

### Nivel 2: Vault (Obsidian) — Visión de producto y aprendizajes transversales

| Documento | Propósito |
|---|---|
| `_Projects/TradDing.md` | Visión de producto, roadmap, decisiones estratégicas. |
| `_Learning/*.md` | Aprendizajes transversales (Docker, Next.js, ML, infra) que aplican a múltiples proyectos. |

### Cuándo actualizar la documentación

- Al completar una tarea de deploy o infraestructura: actualizar `docs/DEPLOYMENT.md`.
- Si descubres algo no obvio sobre el stack: agregar a `docs/LEARNINGS.md`.
- Si cambia la arquitectura (nuevos servicios, flujos, componentes): actualizar `docs/architecture.md`.
- Si creas un documento nuevo en `docs/`: registrarlo en `docs/INDEX.md` y `INDEX.md`.
- Si una decisión es estratégica o de producto: documentar en el vault (`_Projects/TradDing.md`).

---

## Deployment

> Full deployment guide: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)

### Production (Dokploy on Hetzner)

- **Server:** Hetzner Worker `46.62.193.225`
- **Orchestrator:** Dokploy manages `docker-compose.yml`
- **Reverse proxy:** Traefik with ACME (Let's Encrypt)
- **Domains:** `trad-ding.com`, `api.trad-ding.com` (both route to the single Next.js container)
- **Registry:** GHCR (`ghcr.io/jonatanordonez/trad-ding/frontend:latest`)

### CI/CD

```
git push origin main → GitHub Actions → Build images → GHCR → Dokploy webhook → deploy
```

### Docker image

- **Frontend** (`Dockerfile.frontend`): `node:22-slim` — must use slim (not Alpine) due to `onnxruntime-node` glibc requirement.

### Modal (ML training)

```bash
modal deploy modal/modal_app.py
```

Registers the function as `trad-ding-training/train` and creates a web endpoint URL. Store the URL as `MODAL_TRAIN_URL` env var. Called by `POST /api/train` Route Handler.
