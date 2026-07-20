# Platform Kernel

Cross-cutting capabilities shared by every module — the kernel. **No business
logic lives here** (that belongs in `modules/`). This is a Django + DRF project
exposing the platform API under `/api/v1/`.

Stage 1 implements: `shared`, `tenancy`, `users`, `auth`, `permissions`,
`roles`, `audit`, `notifications`. (`billing`, `search`, `storage`, `workflow`,
`ai` remain capability placeholders for later stages.)

## Quick start

```bash
cd platform
python -m venv .venv && . .venv/Scripts/activate   # POSIX: . .venv/bin/activate
pip install -r requirements-dev.txt
python manage.py migrate        # also seeds permissions + system roles
python manage.py runserver      # http://localhost:8000
pytest                          # test suite
```

Without `DATABASE_URL` set, the app runs on sqlite (used by tests). Point
`DATABASE_URL` at PostgreSQL for a production-like run, or use the root
`docker compose up -d --build` (postgres + redis + mailpit + backend).

## Layout

```
config/        settings, urls, wsgi/asgi, health probes
shared/        base model, repo/service/serializer/validator, event bus,
               pagination, renderer, exceptions, DRF permission, context
tenancy/       Tenant, Subscription, CompanyProfile + tenant middleware
users/         generic User (identity only)
auth/          JWT auth, sessions, lockout, reset, verification
permissions/   granular permission catalog (code-defined, DB-synced)
roles/         RBAC: system/custom roles, inheritance, assignment
audit/         immutable audit trail (event-bus driven)
notifications/ generic notification engine
tests/         pytest suite (auth, RBAC, tenancy, audit, notifications, API)
```

## Conventions

- Views thin → services hold rules → repositories/managers hit the DB.
- Every model extends `shared.models.BaseModel`; tenant-owned data extends
  `TenantOwnedModel`.
- Cross-capability reactions go through the event bus (`shared/events.py`) —
  never direct imports between capabilities.
- Config via environment only (`config/env.py`, `.env.example`).

## Docs

- Architecture: [`../docs/architecture/platform-kernel.md`](../docs/architecture/platform-kernel.md)
- Authentication: [`../docs/architecture/authentication.md`](../docs/architecture/authentication.md)
- RBAC & permission matrix: [`../docs/architecture/rbac.md`](../docs/architecture/rbac.md)
- API: [`../docs/api/platform-api.md`](../docs/api/platform-api.md)
- Deployment: [`../docs/deployment/backend.md`](../docs/deployment/backend.md)
- Live API docs (when running): `/api/v1/docs/` (Swagger), `/api/v1/redoc/`
