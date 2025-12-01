# Deployment Guide

This guide covers both **local development** (using Supabase) and **production deployment** (using Docker).

## Table of Contents

1. [Local Development Setup (Recommended)](#local-development-setup-supabase)
2. [Production Deployment (Docker)](#production-deployment-docker)

---

## Local Development Setup (Supabase)

**Recommended for:** Local development, testing, and systems without Docker/virtualization support

### Prerequisites

- Node.js 18+
- npm or yarn
- OpenAI API key
- Supabase account (free tier available)

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Set project name, database password, and region
4. Wait for project to be provisioned (~2 minutes)

### 2. Get Database Connection String

1. In your Supabase dashboard, go to **Project Settings** → **Database**
2. Find the **Connection string** section
3. Copy the **URI** format (looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres`)
4. Replace `[YOUR-PASSWORD]` with your actual database password

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and set:

```env
# REQUIRED: Supabase database URL
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres

# REQUIRED: Generate a secure JWT secret (min 32 characters)
JWT_SECRET=your_very_long_and_secure_jwt_secret_here

# REQUIRED: Your OpenAI API key
OPENAI_API_KEY=sk-your-openai-api-key-here

# Application ports (defaults)
BACKEND_PORT=4000
FRONTEND_PORT=3000
```

Generate a secure JWT secret:

```bash
openssl rand -base64 48
```

### 4. Enable pgvector Extension

In your Supabase dashboard:

1. Click **SQL Editor** in the sidebar
2. Click **New query**
3. Run this SQL:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

4. Click **Run**

### 5. Set Up Database

Run the database setup script:

```bash
./setup-db.sh
```

This will:
- Verify your environment variables
- Run Prisma migrations to create all tables
- Generate the Prisma client
- Test the database connection

### 6. Start Development Servers

Run the startup script:

```bash
./start-dev.sh
```

This will start:
- **Backend** at `http://localhost:4000`
- **Frontend** at `http://localhost:3000`

### 7. Access the Application

Open your browser and go to:

```
http://localhost:3000
```

### Manual Setup (Alternative)

If you prefer to run servers separately:

**Terminal 1 - Backend:**
```bash
cd backend
npm install
npx prisma generate
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### Troubleshooting Local Development

**Database connection fails:**
- Verify DATABASE_URL is correct in `.env`
- Check your Supabase project is active
- Ensure you've replaced `[YOUR-PASSWORD]` with actual password

**Prisma migrations fail:**
- Make sure you've enabled the pgvector extension
- Check your database password is correct
- Verify network connectivity to Supabase

**Backend won't start:**
- Verify all required environment variables are set
- Check OpenAI API key is valid
- Look for port conflicts on 4000

**Frontend won't start:**
- Check for port conflicts on 3000
- Verify frontend dependencies are installed: `cd frontend && npm install`

---

## Production Deployment (Docker)

**Recommended for:** Production environments with Docker/virtualization support

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 2GB RAM available
- OpenAI API key

## Quick Start

### 1. Configure Environment Variables

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` and set the following required variables:

```env
# REQUIRED: Generate a secure JWT secret (min 32 characters)
JWT_SECRET=your_very_long_and_secure_jwt_secret_here

# REQUIRED: Your OpenAI API key
OPENAI_API_KEY=sk-your-openai-api-key-here

# REQUIRED: Set a strong database password
POSTGRES_PASSWORD=your_secure_database_password
```

Optional configurations:

```env
# Database settings (defaults shown)
POSTGRES_USER=postgres
POSTGRES_DB=conversational_docshare
POSTGRES_PORT=5432

# Application ports
BACKEND_PORT=4000
FRONTEND_PORT=3000

# OpenAI model selection
EMBEDDING_MODEL=text-embedding-3-small
CHAT_MODEL=gpt-4-turbo-preview

# CORS origin (update for production)
CORS_ORIGIN=http://localhost:3000
```

### 3. Build and Start Services

Build and start all services in detached mode:

```bash
docker-compose up -d
```

This will:
- Start PostgreSQL database
- Run database migrations
- Start the backend API server
- Build and serve the frontend React app

### 4. Verify Deployment

Check that all services are running:

```bash
docker-compose ps
```

All services should show status as "Up" and healthy.

Test the health endpoints:

```bash
# Backend health check
curl http://localhost:4000/health

# Frontend health check
curl http://localhost:3000/health
```

### 5. Access the Application

Open your browser and navigate to:

```
http://localhost:3000
```

## Service Architecture

The deployment consists of three main services:

### PostgreSQL Database (`postgres`)
- **Image**: `postgres:16-alpine`
- **Port**: 5432 (configurable via `POSTGRES_PORT`)
- **Data persistence**: `postgres_data` volume
- **Health check**: Uses `pg_isready` command

### Backend API (`backend`)
- **Built from**: `./backend/Dockerfile`
- **Port**: 4000 (configurable via `BACKEND_PORT`)
- **Dependencies**: PostgreSQL (waits for health check)
- **Features**:
  - Automatic Prisma migrations on startup
  - Document upload storage in `backend_uploads` volume
  - Health endpoint at `/health`

### Frontend (`frontend`)
- **Built from**: `./frontend/Dockerfile`
- **Port**: 3000 (configurable via `FRONTEND_PORT`)
- **Server**: nginx Alpine
- **Features**:
  - SPA routing with fallback to index.html
  - Static asset caching
  - Security headers
  - gzip compression

## Common Operations

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Stop Services

```bash
# Stop all services
docker-compose stop

# Stop specific service
docker-compose stop backend
```

### Restart Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart backend
```

### Rebuild Services

After code changes:

```bash
# Rebuild and restart all services
docker-compose up -d --build

# Rebuild specific service
docker-compose up -d --build backend
```

### Stop and Remove Everything

```bash
# Stop services and remove containers
docker-compose down

# Also remove volumes (WARNING: deletes database data)
docker-compose down -v
```

## Database Management

### Access PostgreSQL CLI

```bash
docker-compose exec postgres psql -U postgres -d conversational_docshare
```

### Backup Database

```bash
docker-compose exec postgres pg_dump -U postgres conversational_docshare > backup.sql
```

### Restore Database

```bash
cat backup.sql | docker-compose exec -T postgres psql -U postgres -d conversational_docshare
```

### Run Migrations Manually

```bash
docker-compose exec backend npx prisma migrate deploy
```

## Production Deployment

### Security Considerations

1. **Environment Variables**:
   - Never commit `.env` file to version control
   - Use strong, randomly generated passwords
   - Generate JWT_SECRET with: `openssl rand -base64 48`

2. **CORS Configuration**:
   - Update `CORS_ORIGIN` to match your production domain
   - Example: `CORS_ORIGIN=https://yourdomain.com`

3. **Database**:
   - Use a managed database service in production
   - Enable SSL connections
   - Regular automated backups

4. **HTTPS**:
   - Use a reverse proxy (nginx, Caddy) with SSL certificates
   - Let's Encrypt for free SSL certificates

### Scaling Considerations

1. **Backend Scaling**:
   ```yaml
   backend:
     deploy:
       replicas: 3
   ```

2. **Database Connection Pooling**:
   - Configure Prisma connection pool in `backend/src/utils/prisma.ts`
   - Recommended: 10-20 connections per backend instance

3. **File Storage**:
   - Consider using S3-compatible storage (AWS S3, MinIO, Cloudflare R2)
   - Update document upload logic to use cloud storage

### Monitoring

Add monitoring services to docker-compose.yml:

```yaml
services:
  # ... existing services ...

  prometheus:
    image: prom/prometheus
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
```

## Troubleshooting

### Backend Won't Start

1. Check database connection:
   ```bash
   docker-compose logs postgres
   docker-compose exec postgres pg_isready
   ```

2. Verify environment variables:
   ```bash
   docker-compose exec backend env | grep DATABASE_URL
   ```

3. Check migrations:
   ```bash
   docker-compose exec backend npx prisma migrate status
   ```

### Frontend Shows 502 Error

1. Verify backend is running:
   ```bash
   curl http://localhost:4000/health
   ```

2. Check nginx logs:
   ```bash
   docker-compose logs frontend
   ```

### Database Connection Errors

1. Ensure postgres is healthy:
   ```bash
   docker-compose ps postgres
   ```

2. Test connection manually:
   ```bash
   docker-compose exec backend npx prisma db pull
   ```

### Port Already in Use

Change ports in `.env`:

```env
POSTGRES_PORT=5433
BACKEND_PORT=4001
FRONTEND_PORT=3001
```

## Performance Tuning

### PostgreSQL

Edit `docker-compose.yml` to add performance settings:

```yaml
postgres:
  environment:
    POSTGRES_SHARED_BUFFERS: 256MB
    POSTGRES_EFFECTIVE_CACHE_SIZE: 1GB
    POSTGRES_MAX_CONNECTIONS: 100
```

### Backend

Adjust Node.js memory limit:

```yaml
backend:
  environment:
    NODE_OPTIONS: "--max-old-space-size=2048"
```

## Development vs Production

For development, you may want to mount source code as volumes:

```yaml
backend:
  volumes:
    - ./backend/src:/app/src
    - backend_uploads:/app/uploads
  command: npm run dev
```

For production, use the compiled build (default configuration).

## Support

For issues and questions:
- Check service logs: `docker-compose logs`
- Verify health checks: `docker-compose ps`
- Review environment configuration: `.env`
- Ensure all required environment variables are set

## Next Steps

After successful deployment:

1. Create your first user account at `/register`
2. Create a project and upload documents
3. Configure the AI agent via the interview flow
4. Generate and share conversation links
5. Monitor analytics and conversation metrics
