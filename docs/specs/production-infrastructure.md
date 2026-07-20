# Production & Infrastructure

**Status: local dev infrastructure built and verified; production deployment
not yet executed.** Docker Compose runs Postgres, Redis, Mailpit, the
backend, and the Telegram bot locally (config verified via
`docker compose config`; a live container run was not possible in this
session — Docker Desktop's daemon was unavailable — see the roadmap's
verification notes).

## 1. Functional requirements

- One command (`docker compose up -d --build`) brings up a working local
  stack (built).
- Backend deploys to Render from the same Dockerfile used locally (planned,
  designed, not yet executed against a real Render account).
- Health (`/healthz`) and readiness (`/readyz`) probes exist and are wired
  into the container's `HEALTHCHECK` (built).

## 2. Non-functional requirements

- No environment-specific value is hardcoded anywhere — every deployment
  target is configured via environment variables only (`_shared-conventions.md`).
- `DJANGO_DEBUG=0` enforces HTTPS redirect, HSTS, and secure cookies
  automatically (built, verified via `manage.py check --deploy`).

## 3–5. Schema, entity relationships, folder structure

N/A in the usual sense — this section is infrastructure, not application
data. Relevant folders:

```
platform/Dockerfile, entrypoint.sh    Built.
services/telegram-bot/Dockerfile      Built.
docker-compose.yml                    Built: postgres, redis, mailpit,
                                       backend, telegram-bot.
infrastructure/render/                README-only — Render blueprint
                                       (render.yaml) not yet written.
infrastructure/vercel/                README-only — frontend deploy config
                                       not yet written.
infrastructure/github-actions/        README-only — CI workflow not yet
                                       written (see docs/roadmap/
                                       development-roadmap.md § CI/CD gap).
```

## 6. Backend architecture

Gunicorn behind `entrypoint.sh` (migrate → collectstatic → serve). Stateless
by design (JWT auth, no server-side sessions) — horizontally scalable
without sticky sessions, whenever scale warrants more than one instance.

## 7. Frontend architecture

Next.js on Vercel (per `docs/deployment/backend.md` and the original
architecture doc) — not yet configured as an actual Vercel project.

## 8. API design

N/A — infrastructure serves the API already designed elsewhere; nothing new
here.

## 9. Validation rules

`manage.py check --deploy` is the enforced gate — CI (once built) should
run it on every push, not just locally before commit.

## 10. Business logic

N/A.

## 11. Background jobs

`services/worker` and `services/scheduler` are scaffolded, unimplemented —
needed once Reports/DMS's queued jobs (§ `reports.md`, `document-
management.md`) exist. No production job runner is deployed yet because
nothing needs one yet.

## 12. Event flow

N/A at the infrastructure layer.

## 13. Queue design

Redis is already provisioned locally (`docker-compose.yml`) and used for
cache/throttling; using it as a task queue backend (Celery/RQ) is additive,
not a new piece of infrastructure.

## 14. Error handling

Structured logging to stdout (`platform/config/settings.py` `LOGGING`),
ready for any log aggregator (CloudWatch, Render's own log stream, etc.) to
pick up without code changes.

## 15. Security

- Secrets: environment variables at the platform level (Render's secret
  environment groups, Vercel's env vars) — never in the repo.
- `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` must
  be set precisely per environment — verified locally, not yet verified
  against a real production domain.
- Dependency scanning: not yet configured (candidate for the CI workflow
  once it exists).

## 16. Testing strategy

`_shared-conventions.md` § Testing strategy is the application-level gate.
Infrastructure-level: `docker compose config --quiet` (validated this
session) is the fast check; an actual `docker compose up` + smoke test
against `/healthz`/`/readyz` inside containers is the real gate and is
**pending** — flagged explicitly, not assumed passing.

## 17. Deployment strategy

| Component             | Target                        | Status                                          |
| --------------------- | ----------------------------- | ----------------------------------------------- |
| Backend + services    | Render                        | Designed, not executed                          |
| Frontend (`apps/web`) | Vercel                        | Designed, not executed                          |
| Database              | Managed PostgreSQL            | Designed, not provisioned                       |
| AI engine             | Cloudflare Tunnel (initially) | Not applicable yet — no AI engine service built |

## 18. Mobile integration

App Store / Play Store submission via Expo EAS — see
`docs/specs/mobile-application.md` § 17. Not started (no mobile app exists
yet).

## 19. Dashboard integration

N/A.

## 20. Future scalability

Kubernetes (`infrastructure/kubernetes/`, README-only) is explicitly a
later-stage option, not a near-term need — the architecture doc already
frames this correctly: don't build ahead of actual scale requirements.
