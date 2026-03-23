# trad-ding

An AI-powered trading analysis app that combines machine learning and LLM-based sentiment analysis to generate investment recommendations (BUY / SELL / HOLD) for stocks, cryptocurrencies, and ETFs.

## How it works

For each tracked asset, trad-ding combines two independent signals:

1. **Technical / ML signal** — trains an XGBoost classifier on 1 year of price history using indicators (SMA-7, SMA-20, RSI-14, MACD, volume change) to predict the next day's price direction. Models are trained remotely on [Modal](https://modal.com) and stored as `.onnx` files in Supabase Storage. Inference runs in the Next.js server via `onnxruntime-node`.
2. **Fundamental / Sentiment signal** — fetches recent news from NewsAPI and Yahoo Finance, then uses Llama 3.1 (via Groq) to synthesize market narratives into a structured analysis.

Both signals are weighed by the LLM to produce a final recommendation that includes a sentiment score, summary, growth signals, risks, and a plain-language recommendation.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend + API | Next.js 15, React 19, TypeScript, Tailwind CSS v3 |
| Database | Supabase (PostgreSQL via JS client) |
| ML training | XGBoost (runs remotely on Modal as a web endpoint) |
| ML inference | ONNX Runtime (`onnxruntime-node`) |
| Model storage | Supabase Storage |
| LLM | Groq API — `llama-3.1-8b-instant` |
| News | NewsAPI + Yahoo Finance |
| Price data | Yahoo Finance |
| Cache | Upstash Redis (REST API via `@upstash/redis`) |
| Deployment | Self-hosted on Hetzner via Dokploy + Docker Compose + Traefik |

## Project structure

```
trad-ding/
├── web/                          # Next.js 15 — frontend + all API logic
│   ├── next.config.js            # output: standalone
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # Dashboard — Client Component, owns all state
│   │   │   ├── layout.tsx        # Root layout
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
│   │   ├── hooks/                # useAssets, useAnalysis, useNews, useToast, useKeyboard, useTheme, useChartSummary
│   │   ├── lib/
│   │   │   ├── api.ts            # fetch wrappers for all API calls
│   │   │   ├── cache.ts          # Upstash Redis getCached/setCached
│   │   │   ├── features.ts       # TypeScript port of ML feature engineering
│   │   │   ├── constants.ts      # design tokens, Tailwind class helpers
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
│   └── features.py               # Feature engineering (mirror of web/src/lib/features.ts)
├── Dockerfile.frontend           # Multi-stage: node:22-slim
├── docker-compose.yml            # Single Next.js container + Traefik labels
├── .github/workflows/            # CI: build → GHCR → Dokploy deploy
└── docs/                         # Project documentation (Diataxis)
```

## Running locally

### Prerequisites

- Node.js 22 or higher (`onnxruntime-node` requires Node 22+)
- API keys for: [Groq](https://console.groq.com), [NewsAPI](https://newsapi.org), and [Supabase](https://supabase.com)
- [Upstash Redis](https://upstash.com) database (for response caching + training locks)
- (Optional, for ML training) A [Modal](https://modal.com) account

### 1. Install Node.js dependencies

```bash
cd web && npm install
```

### 2. Configure environment variables

Copy the example file and fill in the values:

```bash
cp web/.env.example web/.env.local
```

```ini
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_service_role_key
NEWS_API_KEY=your_newsapi_key
GROQ_API_KEY=your_groq_api_key
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_token
TRAIN_API_KEY=your_secret_key          # any random string, e.g. openssl rand -hex 32
MODAL_TRAIN_URL=https://...modal.run   # from `modal deploy modal/modal_app.py`
```

For Modal (remote ML training), authenticate separately:

```bash
modal deploy modal/modal_app.py
```

### 3. Start the app

```bash
cd web && npm run dev
# → http://localhost:3000
```

> **Tip:** Use the slash command `/run-project` to run these steps interactively.

## API endpoints

All endpoints run as Next.js Route Handlers. No separate backend server.

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/summary` | List all tracked assets |
| `POST` | `/assets` | Add a new asset to track |
| `DELETE` | `/assets/{symbol}` | Remove an asset and all its data |
| `GET` | `/news/{symbol}?offset=0&limit=5` | Paginated news for an asset |
| `GET` | `/news/sync` | Fetch and store latest news for all assets |
| `GET` | `/predictions/{symbol}` | Full AI analysis (ML + LLM), cached 60s |
| `GET` | `/chart/{symbol}` | Price history + technical indicators |
| `POST` | `/api/train` | Re-train ML models for all assets (requires `X-API-Key` header) |

## Slash commands (Claude Code / Cursor)

| Command | Description |
|---|---|
| `/install` | Full local setup walkthrough |
| `/run-project` | Start the dev server |
| `/kill-project` | Stop all processes and free port 3000 |
| `/deploy` | Deploy to Dokploy + Modal |
