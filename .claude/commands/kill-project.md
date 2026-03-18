# Kill all project processes and ports

Stop all running processes related to trad-ding and free ports 3000 (Next.js) and 8000 (FastAPI).

## Steps

### 1. Kill port 8000 (FastAPI backend)

```bash
lsof -ti :8000 | xargs kill -9 2>/dev/null && echo "Port 8000 freed" || echo "Port 8000 was already free"
```

### 2. Kill port 3000 (Next.js frontend)

```bash
lsof -ti :3000 | xargs kill -9 2>/dev/null && echo "Port 3000 freed" || echo "Port 3000 was already free"
```

### 3. Kill any remaining uvicorn processes

```bash
pkill -f "uvicorn backend.main:app" 2>/dev/null && echo "Uvicorn killed" || echo "No uvicorn process found"
```

### 4. Kill any remaining next dev processes

```bash
pkill -f "next dev" 2>/dev/null && echo "Next.js dev killed" || echo "No next dev process found"
```

### 5. Confirm both ports are free

```bash
lsof -i :8000 && echo "WARNING: Port 8000 still in use" || echo "Port 8000 is free"
lsof -i :3000 && echo "WARNING: Port 3000 still in use" || echo "Port 3000 is free"
```
