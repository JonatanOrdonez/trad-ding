# Run project locally

Start the trad-ding development server. Run this after the project is already installed (see /install).

## Steps

### 1. Activate virtual environment

```bash
source .venv/bin/activate
```

### 2. Apply any pending database migrations

```bash
make db-upgrade
```

### 3. Start the development server

```bash
make run
```

The app will be available at **http://localhost:8000**.

- Frontend UI: http://localhost:8000/
- Health check: http://localhost:8000/health
- API docs: http://localhost:8000/docs

To stop the server, press `CTRL+C` in the terminal where it is running. To kill it if it gets stuck, use /kill-project.
