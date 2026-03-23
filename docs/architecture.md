# Architecture — TradDing

## System overview

TradDing is a full-stack AI-powered trading analysis app that generates BUY / SELL / HOLD recommendations for stocks, crypto, and ETFs. It combines two independent signals:

1. **ML signal** — XGBoost classifier trained on 1 year of OHLCV data with technical indicators. Training runs on Modal (serverless). The model is serialized as `.onnx` and stored in Supabase Storage. Inference runs in the Next.js server via `onnxruntime-node`.
2. **LLM signal** — Recent news (from NewsAPI + Yahoo Finance) fed into Llama 3.1 via Groq to produce sentiment analysis and a structured recommendation.

Both signals are combined in `web/src/lib/services/analysis.ts`, which calls Groq with a structured JSON prompt and returns an `AssetAnalysis` object.

---

## Component diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Hetzner Worker                               │
│                        46.62.193.225                                │
│                                                                     │
│  ┌─────────────┐     ┌──────────────────────────────────────────┐  │
│  │   Traefik    │────▶│  Next.js 15 container                    │  │
│  │   :443/:80   │     │  node:22-slim  :3000                     │  │
│  │   SSL/ACME   │     │                                          │  │
│  │             │     │  ┌─ Route Handlers (server-side) ───────┐ │  │
│  │             │     │  │ /assets          CRUD assets          │ │  │
│  │             │     │  │ /news/:symbol    fetch + cache news   │ │  │
│  │             │     │  │ /predictions/:s  ML + LLM analysis    │ │  │
│  │             │     │  │ /api/train       ML training (auth)   │ │  │
│  │             │     │  │ /summary         asset list           │ │  │
│  │             │     │  │ /chart/:symbol   price chart data     │ │  │
│  │             │     │  │ /health          healthcheck          │ │  │
│  │             │     │  │ /news/sync       sync all news        │ │  │
│  │             │     │  └──────────────────────────────────────┘ │  │
│  │             │     │                                          │  │
│  │             │     │  ┌─ Client (React) ─────────────────────┐ │  │
│  │             │     │  │ Dashboard SPA at /                    │ │  │
│  │             │     │  │ Components: AssetCard, AnalysisPanel, │ │  │
│  │             │     │  │ FilterBar, NewsList, PriceChart, etc. │ │  │
│  │             │     │  └──────────────────────────────────────┘ │  │
│  │             │     └──────────────────────────────────────────┘  │
│  └─────────────┘                                                    │
│                                                                     │
│  Dokploy manages docker-compose, restarts, and deploys              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## External services

```
                    ┌────────────────┐
                    │  Supabase      │
                    │  (PostgreSQL)  │◀─── Frontend: reads/writes assets, news, models
                    │  (Storage)     │◀─── Modal: uploads .onnx models
                    └────────────────┘     Frontend: downloads .onnx for inference
                           │
    ┌──────────────────────┼──────────────────────┐
    │                      │                      │
┌───▼────┐          ┌──────▼─────┐         ┌──────▼─────┐
│  Groq  │          │   Modal    │         │  Upstash   │
│  (LLM) │          │ (Training) │         │  (Redis)   │
│ llama  │          │ XGBoost →  │         │  Response  │
│ 3.1    │          │ ONNX       │         │  cache     │
└────────┘          └────────────┘         └────────────┘
    ▲                      ▲
    │                      │
    Frontend               Backend
    (analysis.ts)          (training.py)

┌──────────────┐    ┌──────────────┐
│  NewsAPI     │    │Yahoo Finance │
│ (headlines)  │    │ (news+prices)│
└──────────────┘    └──────────────┘
       ▲                    ▲
       │                    │
       Frontend             Frontend + Backend
       (news.ts)            (news.ts, prediction.ts, training.py)
```

| Service | Purpose | Used by | Config |
|---|---|---|---|
| **Supabase (PostgreSQL)** | Persistent storage for assets, news, model registry | Frontend + Backend | `SUPABASE_URL`, `SUPABASE_KEY` |
| **Supabase Storage** | `.onnx` model file storage (bucket: `ml-models`) | Frontend (download), Modal (upload) | Same keys |
| **Groq** | LLM inference (Llama 3.1 8B Instant) | Frontend (`analysis.ts`) | `GROQ_API_KEY` |
| **Modal** | Serverless ML training (XGBoost → ONNX) | Next.js (`/api/train`) → `modal/modal_app.py` | `MODAL_TRAIN_URL` + `modal token new` |
| **NewsAPI** | Global business headlines | Frontend (`news.ts`) | `NEWS_API_KEY` |
| **Yahoo Finance** | Asset-specific news + OHLCV price history | Frontend (`news.ts`, `prediction.ts`) | No key needed |
| **Upstash Redis** | Response caching (TTL 30-60s) | Frontend (`cache.ts`) | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |

---

## Data model

```
┌──────────────────────────┐
│         assets           │
├──────────────────────────┤
│ id          UUID  PK     │
│ symbol      TEXT  UNIQUE │
│ name        TEXT         │
│ asset_type  TEXT         │  "stock" | "crypto" | "etf"
│ yfinance_symbol TEXT     │
│ created_at  TIMESTAMPTZ  │
└─────────┬────────────────┘
          │ 1:N
          │
    ┌─────▼────────────────────┐     ┌─────────────────────────────┐
    │      asset_news          │     │      asset_models           │
    ├──────────────────────────┤     ├─────────────────────────────┤
    │ id          UUID  PK     │     │ id            UUID  PK      │
    │ asset_id    UUID  FK     │     │ asset_id      UUID  FK      │
    │ content_id  TEXT  UNIQUE │     │ storage_path  TEXT          │
    │ source_type TEXT         │     │ metrics       JSONB         │
    │ content     JSONB        │     │ is_active     BOOLEAN       │
    │ created_at  TIMESTAMPTZ  │     │ created_at    TIMESTAMPTZ   │
    └──────────────────────────┘     └─────────────────────────────┘
```

- **Primary keys**: UUIDs via `gen_random_uuid()` server-side.
- **`asset_news.asset_id`**: `NULL` for general market news (NewsAPI headlines).
- **`asset_news.content_id`**: Deduplication key (URL for NewsAPI, UUID for Yahoo Finance).
- **`asset_models.is_active`**: Only one active model per asset. Training deactivates all before inserting a new one.
- **`asset_models.metrics`**: `{ "balanced_accuracy": float, "roc_auc": float }`.

---

## Data flows

### 1. Analysis flow (`GET /predictions/{symbol}`)

```
Browser
  │
  ▼
Route Handler (web/src/app/predictions/[assetSymbol]/route.ts)
  │
  ├── Check Upstash Redis cache (TTL 60s)
  │   └── Hit? → return cached response
  │
  ▼
analyzeAsset() — web/src/lib/services/analysis.ts
  │
  ├── Promise.all([
  │     getGeneralNews()      → Supabase: last 5 general news items
  │     getNewsBySymbol()     → Supabase: last 5 asset news (auto-sync if empty)
  │     predictAsset()        → ML inference (see flow below)
  │   ])
  │
  ▼
Groq LLM call (Llama 3.1 8B Instant, temperature=0.3, JSON mode)
  │
  ▼
Return AssetAnalysis { sentiment, score, action, summary, risks, ... }
```

### 2. ML inference flow (runs inside Next.js server)

```
predictAsset() — web/src/lib/services/prediction.ts
  │
  ├── Supabase: get active model for asset
  │   └── No model? → return null (analysis proceeds without ML signal)
  │
  ├── Supabase Storage: download .onnx model bytes
  │
  ├── Yahoo Finance: fetch 90 days of OHLCV data
  │
  ├── buildFeatures() — web/src/lib/features.ts
  │   └── Compute: SMA-7, SMA-20, RSI-14, MACD, MACD signal, volume change, price change
  │
  ├── ONNX Runtime: run inference on last feature row
  │
  └── Return { signal: BUY|SELL, confidence, balanced_accuracy, roc_auc }
```

### 3. Training flow (`POST /api/train` — protected)

```
External caller (cron, CLI, etc.)
  │  POST /api/train
  │  Header: X-API-Key: <TRAIN_API_KEY>
  │
  ▼
Route Handler (web/src/app/api/train/route.ts)
  │
  ├── Validate X-API-Key header (403 if invalid)
  ├── Check rate limit via Upstash Redis (429 if <30 min since last run)
  ├── Acquire concurrency lock via Redis (409 if already running)
  │
  ├── Supabase: get all assets
  │
  ├── For each asset (sequential):
  │     │
  │     ├── Yahoo Finance (yahoo-finance2): fetch 1 year OHLCV history
  │     │
  │     ├── HTTP POST to Modal web endpoint (MODAL_TRAIN_URL):
  │     │     │
  │     │     ├── Validate api_key in request body
  │     │     ├── build_features() — modal/features.py
  │     │     ├── XGBClassifier.fit() (n_estimators=100, max_depth=4)
  │     │     ├── Convert to ONNX via skl2onnx
  │     │     ├── Upload .onnx to Supabase Storage
  │     │     └── Return { metrics, storage_path }
  │     │
  │     └── Save model to DB if improved or stale (>5 days)
  │
  ├── Set rate limit key (30 min TTL)
  ├── Release concurrency lock
  └── Return results for all assets
```

### 4. News sync flow

```
Two trigger points:
  1. GET /news/sync           → syncAllNews(): all assets + world news
  2. GET /news/{symbol}       → auto-sync if asset has 0 news in DB

Sources:
  - Yahoo Finance search API  → per-asset news (uuid-based dedup)
  - NewsAPI top-headlines      → general business news (url-based dedup)

Storage: Supabase asset_news table (content as JSONB)
```

---

## Project structure

```
trad-ding/
├── web/                          # Next.js 15 frontend (App Router)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # Dashboard — Client Component, owns all state
│   │   │   ├── layout.tsx        # Root layout (Geist font, metadata)
│   │   │   ├── loading.tsx       # Skeleton loading state
│   │   │   ├── error.tsx         # Error boundary
│   │   │   ├── health/route.ts   # Healthcheck endpoint
│   │   │   ├── summary/route.ts  # Asset list with URLs
│   │   │   ├── api/train/route.ts # POST: ML training (auth + rate limit + lock)
│   │   │   ├── assets/           # POST create, DELETE by symbol
│   │   │   ├── news/             # GET by symbol, sync endpoint
│   │   │   ├── predictions/      # GET analysis by symbol
│   │   │   └── chart/            # GET price chart data
│   │   ├── components/
│   │   │   ├── ui/               # Toast, PageLoader
│   │   │   ├── layout/           # Header, SidePanel
│   │   │   ├── assets/           # AssetCard, FilterBar, SignalSummary, CreateAssetModal
│   │   │   ├── news/             # NewsList
│   │   │   └── analysis/         # AnalysisPanel, PriceChart
│   │   ├── hooks/                # useAssets, useAnalysis, useNews, useToast, useKeyboard, useChartSummary, useTheme
│   │   ├── lib/
│   │   │   ├── api.ts            # Fetch wrapper for API calls
│   │   │   ├── cache.ts          # Upstash Redis caching layer
│   │   │   ├── constants.ts      # Design tokens, Tailwind class helpers
│   │   │   ├── features.ts       # TS port of feature engineering (shared with Python)
│   │   │   ├── utils.ts          # timeAgo, parseNewsRaw, localStorage helpers
│   │   │   └── services/
│   │   │       ├── analysis.ts   # Groq LLM call + signal combination
│   │   │       ├── prediction.ts # ONNX inference via onnxruntime-node
│   │   │       ├── news.ts       # News sync + retrieval from Supabase
│   │   │       └── supabase.ts   # Supabase client + DB type definitions
│   │   └── types/                # TypeScript interfaces (asset, analysis, news)
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── tsconfig.json
├── modal/                        # Modal serverless ML training
│   ├── modal_app.py              # Web endpoint: XGBoost → ONNX
│   └── features.py               # Feature engineering (Python version)
├── Dockerfile.frontend           # Multi-stage: deps → build → runner (node:22-slim)
├── docker-compose.yml            # Dokploy-managed: single container + Traefik labels
├── .github/workflows/
│   └── build-and-push.yml        # CI: build images → GHCR → trigger Dokploy deploy
├── migrations/                   # Alembic migration files
└── docs/                         # Project documentation
```

---

## Deployment architecture

### CI/CD pipeline

```
git push origin main
        │
        ▼
GitHub Actions (build-and-push.yml)
  ├── Build frontend image  →  ghcr.io/jonatanordonez/trad-ding/frontend:latest
  └── Trigger Dokploy webhook → docker pull + restart
```

### Production infrastructure

| Component | Technology | Details |
|---|---|---|
| **Server** | Hetzner Worker | `46.62.193.225` |
| **Orchestrator** | Dokploy | Manages docker-compose lifecycle |
| **Reverse proxy** | Traefik | SSL via ACME (Let's Encrypt) |
| **App** | `trad-ding.com` + `api.trad-ding.com` | Next.js 15 standalone, port 3000 (single container) |
| **Registry** | GHCR | `ghcr.io/jonatanordonez/trad-ding/frontend:latest` |
| **DB** | Supabase (hosted PostgreSQL) | Managed, no self-hosted DB |
| **Cache** | Upstash Redis | Serverless Redis for response caching |
| **ML training** | Modal | Serverless, triggered via `POST /api/train` (Next.js Route Handler) |

### Environment variables

| Variable | Service | Purpose |
|---|---|---|
| `SUPABASE_URL` | Supabase | Project URL |
| `SUPABASE_KEY` | Supabase | Service role key |
| `NEWS_API_KEY` | NewsAPI | API key |
| `GROQ_API_KEY` | Groq | LLM inference |
| `UPSTASH_REDIS_REST_URL` | Upstash | Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash | Redis auth token |
| `TRAIN_API_KEY` | Internal | Shared secret for `/api/train` + Modal auth |
| `MODAL_TRAIN_URL` | Modal | Web endpoint URL for training function |

Modal authentication uses `modal token new` + `.env` passed via `modal.Secret.from_dotenv()`.

---

## Security considerations

### Protections in place

1. **`POST /api/train` is authenticated** — Requires `X-API-Key` header matching `TRAIN_API_KEY` env var (403 if invalid).
2. **Rate limiting** — Max 1 training run every 30 minutes via Upstash Redis.
3. **Concurrency lock** — Redis-based lock prevents parallel training runs (409 if already running).
4. **POST method** — Training uses POST, not GET, preventing accidental triggering by crawlers/bots.
5. **Sequential training** — Assets are trained one at a time, not in parallel, preventing resource exhaustion.
6. **Modal auth** — The Modal web endpoint validates a shared `api_key` in the request body.

### Known risks

1. **No authentication on other endpoints** — `/assets`, `/predictions`, `/news`, etc. are publicly accessible.
2. **No rate limiting on public endpoints** — Only `/api/train` has rate limiting.

### Mitigations in place

- ML inference is lightweight (ONNX Runtime, single row prediction).
- Response caching via Upstash Redis (30-60s TTL) prevents redundant LLM/inference calls.
- Training runs on Modal (not on the server), limiting server-side resource consumption to orchestration + data fetching only.

---

## Feature engineering

Both Python (`modal/features.py`) and TypeScript (`web/src/lib/features.ts`) implement the same feature set:

| Feature | Description |
|---|---|
| `sma_7` | Simple Moving Average (7 periods) |
| `sma_20` | Simple Moving Average (20 periods) |
| `rsi` | Relative Strength Index (14 periods) |
| `macd` | MACD line (EMA-12 minus EMA-26) |
| `macd_signal` | MACD signal line (EMA-9 of MACD) |
| `volume_change` | Volume percent change |
| `price_change` | Close price percent change |

- **Training label**: `1` if next day close > current close, else `0`.
- **Training data**: 1 year of daily OHLCV from Yahoo Finance.
- **Inference data**: 90 days of daily OHLCV, prediction on last row.
