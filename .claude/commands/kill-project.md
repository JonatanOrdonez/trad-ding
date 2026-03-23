# Kill all project processes and ports

Stop all running processes related to trad-ding and free port 3000 (Next.js).

## Steps

### 1. Kill port 3000 (Next.js)

```bash
lsof -ti :3000 | xargs kill -9 2>/dev/null && echo "Port 3000 freed" || echo "Port 3000 was already free"
```

### 2. Kill any remaining next dev processes

```bash
pkill -f "next dev" 2>/dev/null && echo "Next.js dev killed" || echo "No next dev process found"
```

### 3. Confirm port is free

```bash
lsof -i :3000 && echo "WARNING: Port 3000 still in use" || echo "Port 3000 is free"
```
