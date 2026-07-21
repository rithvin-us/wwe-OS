# Backend production readiness review

**Date: 2026-07-21.** Full audit of the Python backend (platform kernel,
purchase module, services) followed by an implementation pass. Verified this
session: `pytest` 82/82, `ruff check` + `format --check` clean,
`manage.py check` clean, `check --deploy` clean (with a real secret),
`makemigrations --check` clean, `spectacular` schema generation warning-free.

Scoring: **5** production-grade · **4** solid, minor gaps · **3** works,
known gaps · **2** partial · **1** missing.

## Subsystem scores

| Subsystem               | Score | Evidence / gap                                                                                                                                                                                                                                                         |
| ----------------------- | :---: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture & layering |   5   | Kernel/module split enforced; views→services→repos→models; event bus for cross-capability; module never imports module                                                                                                                                                 |
| Authentication          |   4   | JWT rotation + blacklist, Argon2, lockout, password reset/verify flows, service tokens. Gap: Google SSO not built (planned, model-ready)                                                                                                                               |
| Authorization (RBAC)    |   5   | Code-defined permissions, role inheritance, Owner auto-grant, per-view + per-workflow-step enforcement, dormant multi-user backend per product mode                                                                                                                    |
| Multi-tenancy           |   4   | Tenant-scoped managers, context middleware, DB constraints per tenant. Gap: no per-tenant row-level-security at the DB layer (app-layer only)                                                                                                                          |
| API design              |   4   | /api/v1 versioning, uniform envelope, error contract, pagination, filters, OpenAPI. Gap: no cursor pagination for very large tables                                                                                                                                    |
| Error handling          |   5   | Single exception handler; typed domain errors (409/422/403/404/429); envelope everywhere incl. 500                                                                                                                                                                     |
| Database                |   4   | UUID PKs, soft delete, FKs, partial unique constraints, tenant indexes, migrations clean. Gaps: no squashing plan yet, sqlite for tests (Postgres only in CI-future)                                                                                                   |
| **Workflow engine**     |   4   | **Built this session**: versioned definitions, permission-gated sequential steps, locked transitions, action trail, events, API, 15 tests. Future: SLA timers, escalation                                                                                              |
| Rate limiting           |   4   | Global user/anon throttles + scoped (login, password reset, ingestion). Gap: cache-backed, resets on locmem restart (fine under Redis)                                                                                                                                 |
| Caching                 |   3   | Redis-backed cache used by throttles/lockout/metrics. Gap: no response/query caching strategy yet (little read traffic to justify it)                                                                                                                                  |
| Observability           |   4   | **Built this session**: request IDs (accepted/generated/echoed), access log w/ actor+tenant, JSON log option, slow-request warnings, token-gated Prometheus /metrics, health/readiness probes. Gap: no tracing, no crash reporter (Sentry hook point documented below) |
| File/document pipeline  |   4   | **platform/storage built (2026-07-21 pm)**: provider abstraction (local + R2/S3/MinIO), validation, sha256 integrity, signed URLs, scan hook, audit. Remaining: point the Telegram bot at it (bills still reference Telegram CDN URLs), server-side OCR                |
| AI layer                |   4   | **platform/ai built (2026-07-21 pm)**: one gateway, provider registry (OpenAI/Anthropic/mock), routing+fallback+retry, prompt library, usage/cost ledger, tenant rate limit, cache. Remaining: migrate the bot's OCR call onto the gateway                             |
| Background jobs / queue |   1   | Event bus is synchronous in-process by design (contract allows async transport later). No Celery/queue/scheduler yet — `services/{worker,scheduler}` are scaffolds                                                                                                     |
| Testing                 |   4   | 82 tests: auth, RBAC, tenancy, audit, notifications, workflow, observability, purchase (ingest/dedupe/review/vendors). Gaps: no load tests, no Postgres-backed test run                                                                                                |
| CI/CD                   |   3   | **CI test job enabled this session** (lint FE/PY + backend check + pytest). Gaps: no CD, no Docker image build/publish job                                                                                                                                             |
| Deployment              |   3   | Prod-shaped Dockerfile (gunicorn, healthcheck), compose stack w/ healthchecks, entrypoint migrate+collectstatic. Gaps: production deploy never executed; live compose smoke test still unrun                                                                           |
| Backup / restore        |   3   | **Scripts + drill doc added this session** (pg_dump custom format, retention, restore w/ confirmation). Gaps: not scheduled anywhere yet, no off-site automation                                                                                                       |
| Security posture        |   4   | HSTS/SSL redirect/secure cookies (prod), nosniff, X-Frame DENY, CSRF, CORS allow-list, https-only ingest URLs, token-gated metrics, secrets via env only. Gaps: no CSP header, no dependency-audit job                                                                 |

## Weaknesses found in the audit (and what happened to each)

| #   | Weakness                                                                   | Status                                                                                                                  |
| --- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | Workflow capability missing entirely (README stub)                         | **Fixed** — `platform/workflow` app built + tested                                                                      |
| 2   | No request correlation: logs unattributable to requests                    | **Fixed** — request-ID middleware + context filter                                                                      |
| 3   | No metrics surface at all                                                  | **Fixed** — cache-backed counters + `/metrics` (Prometheus format, token-gated, 404 when unconfigured)                  |
| 4   | No structured log option for aggregators                                   | **Fixed** — `LOG_FORMAT=json`                                                                                           |
| 5   | Duplicate ingestion: resent Telegram document created a second review item | **Fixed** — `external_ref` dedupe (service check + partial unique constraint + bot sends `file_unique_id`, handles 409) |
| 6   | Ingest accepted any URL scheme for `document_url`                          | **Fixed** — https-only validation                                                                                       |
| 7   | CI ran lint only; tests commented out                                      | **Fixed** — `test-backend` job (deps, `manage.py check`, pytest)                                                        |
| 8   | No backup/restore tooling at all                                           | **Fixed** — `database/backups/{backup.sh,restore.sh,README.md}`                                                         |
| 9   | Documents live on Telegram's CDN, not durable storage                      | **Capability built** (`platform/storage`, R2-ready) — bot upload wiring still open                                      |
| 10  | AI calls locked to one provider inline in the bot                          | **Capability built** (`platform/ai` gateway + prompt library) — bot migration still open                                |
| 11  | Sync-only event bus; no background workers/queue/scheduler                 | **Open** — deliberate for current scale; contract already async-ready                                                   |
| 12  | No crash reporting (Sentry) or tracing                                     | **Open**                                                                                                                |
| 13  | Local-dev secrets never rotated for prod; deploy never executed            | **Open** — operational, not code                                                                                        |

## Prioritized improvement roadmap

Ordered by risk-to-the-business per unit of effort. Nothing below blocks the
single-operator deployment; items 1–3 block "thousands of companies."

1. **Durable document storage** (2–3 days). Implement `platform/storage`
   (capability, not module): S3/R2 backend behind a storage service, bot
   uploads bytes through a new ingest-upload endpoint, `PurchaseBill.document_url`
   becomes a storage key. Kills weakness #9, unblocks the DMS module.
2. **Execute the production deploy + secrets rotation** (0.5–1 day).
   Render backend + managed Postgres + Redis, Vercel frontend, real domain,
   rotated `DJANGO_SECRET_KEY`/`INGESTION_SERVICE_TOKENS`/`METRICS_TOKEN`;
   schedule `backup.sh` with off-site copy. Turns scores 3 → 4 across
   deployment/backups.
3. **Crash reporting + uptime** (0.5 day). `sentry-sdk` behind `SENTRY_DSN`
   env (no-op when unset), uptime check on `/readyz`.
4. **Async transport for the event bus + worker service** (2–3 days, when a
   real queue consumer exists). Redis Streams or Celery; the
   publish/subscribe contract already permits swapping transport without
   touching modules. Prerequisite for OCR-server-side and scheduled reports.
5. **AI gateway** (2–3 days, with #4). `services/ai-engine`: provider
   registry (OpenAI vision for OCR, Anthropic for insights), per-call cost
   log, response cache, retry with backoff; bot and future modules call the
   gateway instead of providers. Kills weakness #10.
6. **Purchase on the workflow engine** (1 day, optional until a second
   approval stage exists). Declare `purchase-bill-approval`, start on ingest,
   subscribe to `WORKFLOW_COMPLETED/REJECTED` to drive bill status. The
   single-step review UX is unchanged; do it when HR/DMS approvals arrive so
   all queues share the `pending/` surface.
7. **Postgres-backed CI test run** (0.5 day). Add a `services: postgres`
   block to the CI job and run pytest against it (catches Postgres-only
   constraint behavior; today's suite runs sqlite).
8. **CSP + dependency audit** (0.5 day). `django-csp` (API-safe policy),
   `pip-audit`/`pnpm audit` CI job.
9. **Load/performance baseline** (1 day, pre-multi-tenant launch). k6 or
   locust against login + list + ingest; record p95s; add `select_related`
   audits where they miss.

## What was deliberately NOT built (and why)

- **Celery/queue/scheduler now** — no consumer exists yet; a queue with no
  workers is operational surface without benefit. The event-bus contract is
  written so the swap is additive (roadmap #4).
- **Rebuilding purchase review on the workflow engine today** — the module's
  single-step machine is live and tested; migrating it buys nothing until a
  second approval stage or second module queue exists (roadmap #6).
- **HR endpoints** — HR is an external, already-deployed app; WWE OS
  integrates, never rebuilds (see `docs/specs/hr-integration-strategy.md`).
- **Response caching / cursor pagination** — no read traffic or table sizes
  that justify them; revisit at multi-tenant scale.
