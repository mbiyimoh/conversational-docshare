---
description: Push to GitHub and verify Railway deployment with automated error detection and fixing
category: workflow
allowed-tools: Bash(git:*), Bash(railway:*), Bash(curl:*), Read, Edit, Task
---

Push changes to GitHub and verify that Railway deployments complete successfully. If errors are detected, investigate and fix them, then repeat until clean deployment.

## Railway Services

This project has two Railway services:
- `conversational-docshare-frontend` - React/Vite frontend
- `conversational-docshare-backend` - Express.js backend

## Workflow Steps

### Step 1: Push to GitHub

Check for uncommitted changes and push:

```bash
git status --porcelain && git push
```

If there are uncommitted changes, ask the user if they want to commit first (or use `/git:commit`).

### Step 2: Wait for Deployment

Railway auto-deploys on push. Wait ~30 seconds for deployment to start, then check logs:

```bash
sleep 30
```

### Step 3: Check Railway Logs

Check both services for errors in parallel:

```bash
railway logs --service conversational-docshare-frontend 2>&1 | tail -50
railway logs --service conversational-docshare-backend 2>&1 | tail -50
```

Look for:
- Build failures (`error`, `ERR!`, `failed`)
- Runtime errors (`Error:`, `TypeError`, `Cannot find module`)
- Deployment issues (`exited`, `crashed`, `OOMKilled`)
- Successful indicators (`listening on`, `server running`, `Build succeeded`)

### Step 4: Error Handling

If errors are found:
1. Identify the root cause from logs
2. Fix the issue in code
3. Commit and push the fix
4. Return to Step 2 (wait and re-check)

Common issues:
- **Missing dependencies**: Check package.json, run `npm install`
- **TypeScript errors**: Check for type issues in the error stack
- **Environment variables**: Verify Railway env vars are set
- **Port binding**: Ensure server binds to `0.0.0.0` and uses `process.env.PORT`

### Step 5: Verify Health

Once logs show successful deployment, verify health endpoints:

```bash
# Frontend (should return HTML or 200)
curl -s -o /dev/null -w "%{http_code}" https://conversational-docshare-frontend-production.up.railway.app/

# Backend health check
curl -s https://conversational-docshare-backend-production.up.railway.app/health
```

Expected results:
- Frontend: HTTP 200
- Backend: `{"status":"ok"}` or similar health response

### Step 6: Report

Provide a concise summary:
- Push status
- Frontend deployment status
- Backend deployment status
- Any errors encountered and fixes applied
- Final health check results

## Efficiency Notes

- Run log checks in parallel for both services
- Only show relevant log excerpts (errors and success indicators)
- Skip verbose explanations during iteration loops
- Report final status concisely
