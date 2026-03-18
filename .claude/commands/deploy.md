# Deploy trad-ding

trad-ding has **two separate deployment targets** that are independent of each other:

| Target | What it deploys | Command |
|---|---|---|
| **Vercel** | FastAPI backend + static frontend | `vercel --prod` |
| **Modal** | XGBoost training function | `modal deploy app/train/modal_app.py` |

---

## Before deploying — checklist

Make sure these are set in your environment / Vercel project settings:

```bash
DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME
NEWS_API_KEY
GROQ_API_KEY
SUPABASE_URL
SUPABASE_KEY
```

> For Vercel, add these in **Project Settings → Environment Variables**.  
> For Modal, secrets are passed via `modal.Secret.from_dotenv()` — your local `.env` is used.

---

## 1. Deploy backend to Vercel

### Install Vercel CLI (if not already installed)

```bash
npm install -g vercel
```

### Login and deploy

```bash
vercel login
vercel --prod
```

Vercel uses `api/index.py` as the serverless entrypoint and `vercel.json` for routing.  
Static files in `app/static/` are served automatically.

### Verify deployment

```bash
curl https://your-project.vercel.app/health
```

Expected response: `{"status": "ok"}` or similar.

---

## 2. Deploy ML training function to Modal

The XGBoost training runs as a remote Modal function. It must be deployed separately.

### Install and authenticate Modal (first time only)

```bash
pip install modal
modal token new
```

### Deploy the training function

```bash
modal deploy app/train/modal_app.py
```

This registers the function as `trad-ding-training/train` in your Modal workspace.

### Verify Modal deployment

```bash
modal app list
```

You should see `trad-ding-training` listed as deployed.

---

## Notes

- The Vercel backend calls Modal **at runtime** when `/train` or `/predictions/{symbol}` (first time, no model exists) is triggered. Both must be deployed and working for full functionality.
- Database migrations are **not run automatically on deploy**. Run `make db-upgrade` manually against your production DB before the first deploy or after schema changes.
- The frontend (`app/static/index.html`) is deployed as part of the Vercel deploy — no separate step needed.
