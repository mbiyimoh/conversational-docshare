# Railway Deployment Guide - Conversational DocShare

This guide covers deploying the Conversational Document IDE to Railway with Docker.

---

## Quick Reference

**Railway Project:** efficient-friendship
**Environment:** production

**Services:**
- `backend` - Express.js API (Port 4000)
- `frontend` - React/Vite app via nginx (Port 80)

**GitHub Repo:** https://github.com/mbiyimoh/conversational-docshare

---

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Railway       │     │   Supabase      │     │   OpenAI        │
│   (Hosting)     │────▶│   (PostgreSQL)  │     │   (AI)          │
│                 │     │                 │     │                 │
│   Frontend:     │     │   Database      │     │   Chat          │
│   React/Vite    │     │   Auth          │     │   Embeddings    │
│   nginx         │     │                 │     │                 │
│                 │     │                 │     │                 │
│   Backend:      │     │                 │     │                 │
│   Express.js    │─────┴─────────────────┴─────┘                 │
│   Prisma        │                                               │
└─────────────────┘
```

---

## Railway CLI Commands

### Link to Project
```bash
# Initial linking (interactive)
railway link

# Select: mbiyimoh's Projects > efficient-friendship > production
```

### Link to a Service (Required before logs)
```bash
# Interactive - select backend or frontend
railway service

# Then view logs
railway logs -n 100

# Or specify service directly
railway logs --service <service-name> -n 100
```

### Check Status
```bash
railway status
```

### View Environment Variables
```bash
railway variables
```

### View Build Logs
```bash
railway logs --build -n 100
```

### View Runtime Logs
```bash
railway logs -n 100
```

### Trigger Redeploy
```bash
railway up
```

---

## Backend Configuration

### Dockerfile (backend/Dockerfile)

```dockerfile
# Multi-stage build for Node.js backend
FROM node:20-bullseye-slim AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm ci

COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-bullseye-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

# Copy Prisma schema
COPY prisma ./prisma

# Copy built application
COPY --from=builder /app/dist ./dist

# Generate Prisma client in production image
RUN npx prisma generate

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 nodejs

RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 4000

# Start server (skip migrations if using db push)
CMD ["node", "dist/index.js"]
```

**Key Changes from Original:**
- Use `node:20-bullseye-slim` instead of `node:20-alpine` (OpenSSL compatibility for Prisma)
- Remove `prisma migrate deploy` from CMD if using `db push` workflow

### Required Environment Variables (Backend)

Set these in Railway dashboard for the backend service:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `JWT_SECRET` | Secret key for JWT tokens |
| `OPENAI_API_KEY` | OpenAI API key for AI features |
| `PORT` | Set to `4000` |
| `NODE_ENV` | Set to `production` |
| `CORS_ORIGIN` | Frontend URL for CORS |

---

## Frontend Configuration

### Dockerfile (frontend/Dockerfile)

```dockerfile
# Multi-stage build for React frontend
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build argument for API URL
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Production stage with nginx
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Required Environment Variables (Frontend)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL (e.g., `https://backend-production.up.railway.app`) |

---

## Common Issues and Solutions

### 1. Prisma "libssl.so.1.1 not found"

**Symptoms:**
```
Error loading shared library libssl.so.1.1: No such file or directory
```

**Solution:** Change Dockerfile base image from `node:20-alpine` to `node:20-bullseye-slim`

**Why:** Alpine 3.22+ uses OpenSSL 3.x, but Prisma 5.x requires OpenSSL 1.1.x which is in Debian Bullseye.

### 2. TypeScript Build Errors

**Symptoms:**
```
TSError: Unable to compile TypeScript
```

**Solution:** Ensure `tsconfig.json` is copied before build:
```dockerfile
COPY tsconfig.json ./
```

### 3. Prisma Client Not Generated

**Symptoms:**
```
PrismaClientInitializationError: Unable to require prisma/client
```

**Solution:** Run `npx prisma generate` in both builder AND production stages.

### 4. Database Connection Failed

**Symptoms:**
```
Error: P1001: Can't reach database server
```

**Solutions:**
1. Verify `DATABASE_URL` is set correctly in Railway
2. Check Supabase connection pooler URL (use port 6543 for pooled connections)
3. Ensure SSL mode is enabled (`?sslmode=require`)

### 5. CORS Errors

**Symptoms:**
```
Access-Control-Allow-Origin header missing
```

**Solution:** Set `CORS_ORIGIN` environment variable to the frontend URL.

---

## Deployment Checklist

### Before Deploying

- [ ] Backend builds locally: `cd backend && npm run build`
- [ ] Frontend builds locally: `cd frontend && npm run build`
- [ ] Database schema is pushed: `cd backend && npm run db:push`
- [ ] All environment variables documented

### After Deploying

- [ ] Backend health endpoint responds: `curl https://backend-url/health`
- [ ] Frontend loads in browser
- [ ] Login/signup works
- [ ] API calls from frontend to backend work (check CORS)
- [ ] AI features work (OpenAI key valid)

---

## Troubleshooting Workflow

When deployment fails:

1. **Link to the service:**
   ```bash
   railway service
   # Select the failing service (backend or frontend)
   ```

2. **Check build logs:**
   ```bash
   railway logs --build -n 100
   ```

3. **Check runtime logs:**
   ```bash
   railway logs -n 100
   ```

4. **Check environment variables:**
   ```bash
   railway variables
   ```

5. **Verify locally first:**
   ```bash
   # Backend
   cd backend && npm run build && npm start

   # Frontend
   cd frontend && npm run build && npm run preview
   ```

---

## Database Workflow

This project uses `db push` instead of migrations:

```bash
# After schema changes
cd backend
npm run db:push
```

**Why:** Simpler workflow for rapid development. Schema changes are pushed directly without migration history.

---

## References

- [Railway Documentation](https://docs.railway.com/)
- [Prisma with Railway](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-railway)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
