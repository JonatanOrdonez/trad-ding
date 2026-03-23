# TradDing — Document Catalog

## Project info

AI-powered trading analysis app (BUY/SELL/HOLD) combining XGBoost ML + Llama 3.1 LLM signals.
Stack: Next.js 15 (App Router) + Supabase + Modal + Groq + Upstash Redis.
Deployed on Hetzner via Dokploy + Traefik. CI/CD via GitHub Actions → GHCR.

## Document catalog

### Repo docs (`docs/`)

| Document | Type (Diataxis) | Description |
|---|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Explanation | System architecture, components, data flows, data model, deployment |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | How-to | Production deploy, CI/CD, Dokploy, env vars, troubleshooting |
| [`docs/LEARNINGS.md`](docs/LEARNINGS.md) | Reference | Non-obvious lessons: Docker, Next.js build, Alpine, Traefik, GHCR |

### Vault docs (Obsidian)

| Document | Purpose |
|---|---|
| `_Projects/TradDing.md` | Product vision, roadmap, strategic decisions |
| `_Learning/*.md` | Cross-project learnings (Docker, Next.js, ML, infra) |

### Project config

| File | Purpose |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | AI assistant instructions: conventions, commands, architecture summary |
| [`docs/INDEX.md`](docs/INDEX.md) | Per-task doc lookup guide (read at start of every task) |

## Key invariants

- **Single container** — Next.js handles ALL logic (UI, API, training orchestration). No Python backend.
- ML training runs on Modal (serverless) via protected `POST /api/train` endpoint.
- ONNX inference runs in the Next.js server via `onnxruntime-node`.
- Feature engineering exists in both Python (`modal/features.py`) and TypeScript — must stay in sync.
- Response caching + training rate limit/lock via Upstash Redis.

## Quick reference

```bash
# Dev
cd web && npm run dev       # App :3000

# Deploy
git push origin main        # CI builds → GHCR → Dokploy auto-deploy
modal deploy modal/modal_app.py  # Deploy training function

# Training (protected)
curl -X POST https://trad-ding.com/api/train -H "X-API-Key: $TRAIN_API_KEY"

# Database
make db-upgrade             # Run migrations
make db-migrate msg="..."   # Generate migration
```
