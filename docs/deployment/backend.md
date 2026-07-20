# Backend Deployment

The platform kernel is a standard Django + Gunicorn service. It is stateless
(JWT), so it scales horizontally behind a load balancer; PostgreSQL and Redis
are the only stateful dependencies.

## Runtime

- **Server:** Gunicorn (`config.wsgi`), started by `platform/entrypoint.sh`,
  which runs `migrate` (and the permission/role seeding it triggers) then
  `collectstatic`, then boots Gunicorn.
- **Database:** PostgreSQL 16 (`DATABASE_URL`).
- **Cache / throttles / lockout:** Redis (`REDIS_URL`); falls back to in-memory
  if unset (single-process only).
- **Email:** SMTP (`SMTP_*`); Mailpit locally.

## Local (Docker Compose)

```bash
cp .env.example .env          # set DJANGO_SECRET_KEY etc.
docker compose up -d --build  # postgres, redis, mailpit, backend
curl localhost:8000/healthz   # {"success":true,"data":{"status":"ok"}}
curl localhost:8000/readyz    # database + cache reachable
open  localhost:8000/api/v1/docs/
```

## Local (without Docker)

```bash
cd platform
python -m venv .venv && . .venv/Scripts/activate   # or bin/activate
pip install -r requirements-dev.txt
python manage.py migrate
python manage.py runserver
pytest
```

Without `DATABASE_URL` the app uses sqlite (handy for tests); set it to run on
PostgreSQL.

## Render (production)

Deploy `platform/` as a web service:

- Build: `pip install -r requirements.txt`
- Start: `./entrypoint.sh`
- Health check path: `/healthz`
- Environment: `DJANGO_SECRET_KEY` (long random), `DJANGO_DEBUG=0`,
  `DJANGO_ALLOWED_HOSTS`, `DATABASE_URL`, `REDIS_URL`, `SMTP_*`,
  `CORS_ALLOWED_ORIGINS`, and any JWT/lockout overrides.

With `DJANGO_DEBUG=0` the app enforces HTTPS redirect, HSTS, and secure cookies.
`python manage.py check --deploy` must report no issues before shipping.

## Configuration

All configuration is environment-driven — see `.env.example`. No secrets or
environment-specific values are hardcoded.
