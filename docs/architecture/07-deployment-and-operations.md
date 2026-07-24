# 07. Deployment & Operations

## Deployment Topology

```mermaid
flowchart TD
    subgraph Edge & Web
        VERCEL[Vercel<br/>Next.js 16 Frontend App]
    end

    subgraph Platform Backend
        RENDER_API[Render Web Service<br/>Django REST API Backend]
        RENDER_WORKER[Render Background Worker<br/>Celery / Redis Worker]
    end

    subgraph Data Infrastructure
        SUPABASE[(Managed PostgreSQL 16)]
        UPSTASH[(Managed Redis 7)]
        R2[(Cloudflare R2 Storage)]
    end

    VERCEL --> RENDER_API
    RENDER_API --> SUPABASE & UPSTASH & R2
    RENDER_WORKER --> SUPABASE & UPSTASH
```

---

## Local Docker Operations

### Starting Local Infrastructure

```bash
# Start all background containers (Postgres, Redis, Mailpit, Backend, Telegram Bot)
docker-compose up -d

# View status of running containers
docker ps
```

### Container Lifecycle Commands

```bash
# Restart Backend Container (Required after Python code changes)
docker restart bop-backend

# Restart Telegram Bot Container
docker restart bop-telegram-bot

# View container logs
docker logs --tail 100 bop-backend
docker logs --tail 100 bop-telegram-bot
```

---

## Production Deployment Steps

### 1. Database Migrations

Run database migrations against the production PostgreSQL instance before deploying code:

```bash
python manage.py migrate
```

### 2. Frontend Build (Vercel)

Deploy Next.js frontend to Vercel using monorepo scope:

```bash
pnpm --filter web build
```

### 3. Backend Deployment (Render / Docker)

Deploy Django backend via Render Web Service using the `./platform` Dockerfile and environment configuration.
