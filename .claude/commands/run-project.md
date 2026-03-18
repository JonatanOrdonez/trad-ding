# Run project locally

Start the trad-ding development servers. Run this after the project is already installed (see `/install`).

trad-ding requires **two servers** running simultaneously:
- **Backend** — FastAPI on http://localhost:8000
- **Frontend** — Next.js on http://localhost:3000 (proxies API calls to :8000)

## Steps

### Terminal 1 — Python backend

```bash
source .venv/bin/activate
make db-upgrade
make run
```

The backend will be available at **http://localhost:8000**.

- Health check: http://localhost:8000/health
- API docs: http://localhost:8000/docs

### Terminal 2 — Next.js frontend

```bash
npm run dev
```

The frontend will be available at **http://localhost:3000**.

API calls from the browser (`/summary`, `/predictions/*`, `/news/*`, etc.) are automatically proxied to `localhost:8000` via the rewrites in `next.config.js`.

---

To stop either server, press `CTRL+C` in its terminal. To forcefully kill all processes and free ports, use `/kill-project`.
