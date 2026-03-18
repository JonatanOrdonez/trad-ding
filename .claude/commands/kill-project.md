# Kill all project processes and ports

Stop all running processes related to trad-ding (uvicorn, FastAPI dev server) and free port 8000.

## Steps

### 1. Kill processes by port 8000

```bash
lsof -ti :8000 | xargs kill -9 2>/dev/null && echo "Port 8000 freed" || echo "Port 8000 was already free"
```

### 2. Kill any remaining uvicorn processes

```bash
pkill -f "uvicorn app.main:app" 2>/dev/null && echo "Uvicorn killed" || echo "No uvicorn process found"
```

### 3. Confirm port 8000 is free

```bash
lsof -i :8000 && echo "WARNING: Port 8000 still in use" || echo "Port 8000 is free"
```
