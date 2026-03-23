# Install project locally

Run the following steps to set up trad-ding on the local machine. Execute them sequentially and stop if any step fails.

## Project structure

The app is a single Next.js project under `web/`. There is no Python backend server.

- **`web/`** — Next.js 15 app (frontend + API). All development work happens here.
- **`modal/`** — Python code for ML training (deployed to Modal, not run locally).

## Steps

### 1. Check Node.js version

```bash
node --version
npm --version
```

The project requires **Node.js 22 or higher** (`onnxruntime-node` requires Node 22+). If missing:

```bash
brew install node
```

### 2. Install Node.js dependencies

```bash
cd web && npm install
```

### 3. Set up environment variables

Copy the example file:

```bash
cp web/.env.example web/.env.local
```

Then fill in the values in `web/.env.local`:

```ini
# https://supabase.com/ (service role key)
SUPABASE_URL=
SUPABASE_KEY=

# https://newsapi.org/
NEWS_API_KEY=

# https://console.groq.com/
GROQ_API_KEY=

# https://upstash.com/ (Redis REST)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Shared secret for POST /api/train — generate with: openssl rand -hex 32
TRAIN_API_KEY=

# URL from `modal deploy modal/modal_app.py` output
MODAL_TRAIN_URL=
```

> The app will silently fail on API calls if any variable is missing. Check `web/.env.example` for descriptions.

### 4. (Optional) Set up Modal for ML training

If you need to run ML training locally:

```bash
pip install modal
modal token new
modal deploy modal/modal_app.py
```

Copy the web endpoint URL printed by `modal deploy` into `MODAL_TRAIN_URL` in `web/.env.local`.

### 5. Verify the installation

Start the dev server:

```bash
cd web && npm run dev
# → http://localhost:3000
```

Check the health endpoint:

```bash
curl http://localhost:3000/health
# → {"status":"OK"}
```

## Troubleshooting

- **`Module not found` errors** — run `cd web && npm install` to make sure all dependencies are installed.
- **API calls return errors** — verify all variables in `web/.env.local` are set. Missing `SUPABASE_URL` or `SUPABASE_KEY` will break most endpoints.
- **`UPSTASH_REDIS_REST_URL` missing** — caching and training rate-limiting won't work. Create a free Upstash Redis database at https://upstash.com.
- **`onnxruntime-node` fails to load** — make sure you're using Node 22+. Do not use Alpine Linux (use `node:22-slim` in Docker).
- **`modal: command not found`** — install with `pip install modal` in a Python venv.
