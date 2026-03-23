# Run project locally

Start the trad-ding development server. Run this after the project is already installed (see `/install`).

trad-ding is a single Next.js app that handles both the UI and all API logic. **Only one server is needed.**

## Steps

```bash
cd web && npm run dev
```

The app will be available at **http://localhost:3000**.

- Health check: http://localhost:3000/health
- All API routes (`/summary`, `/predictions/*`, `/news/*`, `/assets`, `/chart/*`) are Next.js Route Handlers — no separate backend needed.
- ML training (`POST /api/train`) calls a Modal web endpoint — no local Python server needed.

---

To stop the server, press `CTRL+C`. To forcefully kill all processes and free port 3000, use `/kill-project`.

## Troubleshooting

- **`Address already in use` on port 3000** — use `/kill-project` to free the port.
- **`Module not found` or import errors** — run `cd web && npm install` to install dependencies.
- **Environment variable errors** — make sure `web/.env.local` exists with all required variables. See `web/.env.example` for the full template.
