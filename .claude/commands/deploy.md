# Deploy trad-ding

trad-ding has **two separate deployment targets**:

| Target | What it deploys | Tool |
|---|---|---|
| **Vercel** | Next.js frontend + FastAPI Python serverless | `vercel --prod` |
| **Modal** | XGBoost training function | `modal deploy backend/train/modal_app.py` |

---

## Before deploying — checklist

Make sure these are set in your Vercel project environment variables:

```
DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME
NEWS_API_KEY
GROQ_API_KEY
SUPABASE_URL
SUPABASE_KEY
```

Add them in **Vercel Dashboard → Project → Settings → Environment Variables**.

For Modal, secrets are passed via `modal.Secret.from_dotenv()` — your local `.env` is used at deploy time.

---

## 1. Build check before deploy

Run the production build locally to catch any errors before pushing:

```bash
npm run build
```

Fix any TypeScript or build errors before proceeding.

---

## 2. Deploy to Vercel

### Install Vercel CLI (first time only)

```bash
npm install -g vercel
```

### Login and deploy

```bash
vercel login
vercel --prod
```

Vercel auto-detects Next.js as the framework (`vercel.json` sets `"framework": "nextjs"`).
The Python serverless function at `api/index.py` is built with `@vercel/python@4`.
API routes (`/summary`, `/predictions/*`, `/news/*`, etc.) are rewritten to `api/index.py` via `vercel.json`.

### Verify deployment

```bash
curl https://your-project.vercel.app/health
```

Expected response: `{"status": "ok"}`.

Also open the Vercel URL in the browser and verify the Next.js dashboard loads.

---

## 3. Deploy ML training function to Modal

```bash
modal deploy backend/train/modal_app.py
```

This registers the function as `trad-ding-training/train` in your Modal workspace.

### Verify Modal deployment

```bash
modal app list
```

You should see `trad-ding-training` listed as deployed.

---

## Notes

- **Database migrations are not run automatically on deploy.** Run `make db-upgrade` manually against your production DB before first deploy or after schema changes.
- The frontend is served by Vercel's Next.js CDN. The backend runs as a Python serverless function on each API request.
- The backend calls Modal **at runtime** when `/train` or `/predictions/{symbol}` (first run, no model exists) is triggered. Both Vercel and Modal must be deployed and working for full functionality.
- Do **not** add a `builds` entry for Next.js in `vercel.json` — Vercel handles it automatically via `"framework": "nextjs"`.
