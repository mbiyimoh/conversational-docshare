---
description: Kill all dev processes and restart with clean caches - fixes HMR/caching issues where code changes don't appear
allowed-tools: Bash, Read
---

# Fresh Start: Clean Dev Environment Restart

Use this command when you've made code changes but they're not appearing in your browser, even after hard refresh or incognito mode. This safely restarts all dev processes with clean caches.

## What This Does (Safe Operations Only)

1. **Kills dev processes** - Only for THIS project (Vite, tsx backend)
2. **Clears Vite cache** - Removes `.vite` folder (module cache)
3. **Clears TypeScript cache** - Removes `tsconfig.tsbuildinfo` files
4. **Restarts servers** - Fresh frontend and backend dev servers

## What This Does NOT Do

- Does NOT touch the database
- Does NOT delete source files
- Does NOT modify git history
- Does NOT affect other projects
- Does NOT delete node_modules (use `npm install` separately if needed)

## Execution

### Step 1: Kill Existing Processes

```bash
# Kill Vite frontend (only for this project)
pkill -f "vite.*conversational-docshare" 2>/dev/null || true

# Kill tsx backend (only for this project)
pkill -f "tsx.*conversational-docshare" 2>/dev/null || true

# Also kill any node processes on our dev ports
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
lsof -ti:4000 | xargs kill -9 2>/dev/null || true

echo "✓ Dev processes killed"
```

### Step 2: Clear Caches

```bash
# Clear Vite module cache
rm -rf frontend/node_modules/.vite 2>/dev/null || true

# Clear TypeScript build info
rm -f frontend/tsconfig.tsbuildinfo 2>/dev/null || true
rm -f backend/tsconfig.tsbuildinfo 2>/dev/null || true

echo "✓ Caches cleared"
```

### Step 3: Restart Dev Servers

Start both servers in background:

```bash
# Start backend first (it needs to be ready for frontend API calls)
cd backend && npm run dev &
sleep 3

# Start frontend
cd .. && npm run dev &
sleep 2

echo "✓ Dev servers restarting..."
```

### Step 4: Verify

```bash
# Wait for servers to be ready
sleep 5

# Check backend health
curl -s http://localhost:4000/health && echo ""

# Check frontend is serving
curl -s -o /dev/null -w "Frontend: HTTP %{http_code}\n" http://localhost:5173/
```

## After Running This Command

1. **Hard refresh your browser** (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
2. Or better: **Open a fresh incognito window**
3. Clear browser site data if issues persist (DevTools → Application → Clear site data)

## When to Use This

- Code changes not appearing in browser
- HMR seems stuck or broken
- "Module not found" errors after file moves
- Vite showing stale imports
- Backend changes not taking effect
- After pulling significant changes from git
