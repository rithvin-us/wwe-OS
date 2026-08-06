# WWE OS — Project Walkthrough

A complete tour of the repository: what it is, how it's put together, how to
run it, and where every piece lives. Written from a full pipeline audit and
codebase read on 2026-07-24 — see `SECURITY.md` for the security-specific
findings from the same pass, and `docs/roadmap/development-roadmap.md` for
build status/history.

---

## 1. What this is

**WWE OS** is an Enterprise Business Operations Platform: one piece of
software intended to run an entire company's operations (HR, purchasing,
document management, inventory, contracts, reporting, and more) on one
shared kernel. It is explicitly **not** an HR app, and it is built to
present as business software for business people — never as a developer
tool or a collection of separate apps bolted together.

**Product mode: single-operator.** The company is run by one person who is
HR + IT + Accounts simultaneously. Concretely, that means:

- One sign-in (Google Workspace SSO _or_ email+password — no separate
  multi-user login flows).
- No role-gated UI. The operator is the "Owner" and sees everything; the
  Users/Roles/Permissions/Audit screens are hidden from the menu on purpose
  (the RBAC + multi-tenant backend still exists and is fully tested — it's
  dormant, not deleted, for when a second person eventually joins).
- The Executive Dashboard (`/`) is the home screen: one "what needs your
  attention" surface across every business area, not a launcher grid.
- Automation-first: each module is meant to ship a self-service/automatic
  path before a manual admin screen.

Full product direction: `docs/roadmap/single-operator-plan.md`.

---

## 2. Architecture

```
apps/            Deployable frontend applications (web, admin, employee, mobile)
platform/        Shared kernel — cross-cutting capabilities, NO business logic
modules/         Business modules — ALL business logic lives here
services/        Independently deployable background services
packages/        Reusable frontend packages (@bop/ui, @bop/icons, @bop/charts, …)
database/        Migrations, seeds, schema docs (PostgreSQL)
infrastructure/  Docker, deployment configs
docs/            Architecture, ADRs, specs, deployment, module blueprints
tests/           Placeholder for cross-cutting e2e/integration suites (currently empty)
```

**Non-negotiable rules** (enforced by review, not by tooling):

1. **Business logic only in `modules/`.** `platform/` provides capabilities
   (auth, users, roles, permissions, audit, notifications, storage, search,
   tagging, reporting, automation, ai); modules provide meaning.
2. **Modules never import each other.** Cross-module needs go through
   platform contracts or domain events (`platform/shared/events.py`).
3. **Never reimplement a platform capability** inside a module or app.
4. **Multi-tenant from day one** — tenant-owned data is tenant-scoped
   (`platform/tenancy`), even though the product currently runs single-tenant
   in practice.
5. `services/` are deployment-isolated (own Dockerfile each) and integrate
   via API and queue — never via source imports.

**Stack:** Next.js 16 (App Router, Turbopack) / TypeScript 5 / Tailwind v4 /
shadcn+Radix / TanStack Query / React Hook Form + Zod on the frontend;
Django 6 + DRF + PostgreSQL on the backend (SQLite for local dev/tests).
Deploy target: Vercel (frontend), Render (backend/services), Cloudflare
Tunnel (AI engine, initially).

---

## 3. How the backend is wired together

`platform/config/settings.py` is the single Django project. It loads three
groups of apps, in a deliberate order:

```
DJANGO_APPS + THIRD_PARTY_APPS
  → PLATFORM_APPS_BEFORE_MODULES  (shared, tenancy, users, auth, permissions,
                                    storage, ai, search, reporting, tagging,
                                    automation)
  → MODULE_APPS                   (purchase, documents, contracts, inventory,
                                    assets — each "<module>.backend")
  → PLATFORM_APPS_AFTER_MODULES   (roles, audit, notifications)
```

The ordering is load-bearing, not cosmetic: `permissions` must sync before
any module registers its own permissions, and `roles` (which grants the
Owner role every `Permission` row that exists at that point) must sync
_after_ every module's permissions are in the table — otherwise Owner would
silently miss whatever a module registers. If a future module's permission
coverage looks wrong, check this list's order first.

Business modules live in the repo-root `modules/` directory, not inside
`platform/` — `settings.py` adds `modules/` to `sys.path` so Django can load
`purchase.backend`, `documents.backend`, etc. as if they were top-level
packages.

**Config comes from environment variables only** (`platform/config/env.py`),
loaded from the repo-root `.env` via `python-dotenv` — real environment
variables (as Docker/production set them) always win over `.env`, since
`load_dotenv` never overrides an already-set variable. `.env` is gitignored;
`.env.example` documents every variable with a safe placeholder.

**Auth** is stateless JWT (`rest_framework_simplejwt`), never Django sessions
— every request is authenticated per-call via
`auth.authentication.PlatformJWTAuthentication`. Frontend never touches raw
tokens: the Next.js app proxies login through `/api/auth/login`, which sets
the access/refresh tokens as `httpOnly` cookies, so they're unreachable from
client-side JavaScript.

**Service-to-service auth** (Telegram bot → backend, and future ingestion
channels) uses a separate scheme: `Authorization: Service <token>`, checked
with a constant-time comparison (`hmac.compare_digest`) against
`INGESTION_SERVICE_TOKENS`. Service callers get a `ServiceActor`, never a
real `User` row, and can only reach views that explicitly opt into
`ServiceTokenAuthentication`.

---

## 4. Setup

```bash
git clone <repo-url>
cd "wwe OS"

cp .env.example .env          # then fill in real secrets — see SECURITY.md
pnpm install                  # frontend workspace
pip install --group dev       # root Python tooling: ruff, pytest, pre-commit
pre-commit install            # git hooks (now runs real checks — see § 8)

docker compose up -d          # postgres:5432, redis:6379, mailpit UI :8025
```

Backend (from `platform/`, its own venv):

```bash
cd platform
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt -r requirements-dev.txt
python manage.py migrate      # seeds permissions + roles via post_migrate signals
python manage.py runserver    # http://localhost:8000
```

Frontend:

```bash
pnpm --filter web dev         # http://localhost:3000
```

Full stack via Docker instead of the above: `docker compose up -d --build`
(adds the `backend` and `telegram-bot` services). Note: as of this pass,
`docker-compose.yml`'s secret-bearing variables (`DJANGO_SECRET_KEY`,
`TELEGRAM_BOT_TOKEN`, `PLATFORM_SERVICE_TOKEN`, `INGESTION_SERVICE_TOKENS`)
are now **required** — Compose will fail fast with a clear message if
they're missing from your `.env`, instead of silently falling back to a
weak or leaked default. See `SECURITY.md`.

---

## 5. Everyday commands

| Task                   | Command                                                              |
| ---------------------- | -------------------------------------------------------------------- |
| Install JS deps        | `pnpm install` (repo root)                                           |
| Install Python tooling | `pip install --group dev`                                            |
| Run web app            | `pnpm --filter web dev` (http://localhost:3000)                      |
| Build web app          | `pnpm --filter web build` — must pass before any UI work is "done"   |
| Lint / format TS       | `pnpm lint` / `pnpm format`                                          |
| Lint / format Python   | `python -m ruff check .` / `python -m ruff format .`                 |
| Backend dev server     | `cd platform && python manage.py runserver` (http://localhost:8000)  |
| Backend migrate        | `cd platform && python manage.py migrate`                            |
| Backend tests          | `cd platform && pytest` — 200 tests, must pass before backend "done" |
| Pre-commit (all hooks) | `python -m pre_commit run --all-files`                               |
| Local infra            | `docker compose up -d` (Postgres, Redis, Mailpit UI on :8025)        |
| Full stack (Docker)    | `docker compose up -d --build` (adds `backend` + `telegram-bot`)     |

Note: `pytest` run bare from the **repo root** intentionally only discovers
`services/` and `tests/` (both empty today) — the Django-dependent suite
under `platform/`/`modules/` needs `platform/.venv` and only runs via
`cd platform && pytest`. This is enforced in `pyproject.toml`'s
`[tool.pytest.ini_options]`, not accidental.

---

## 6. Tour of the apps (what the operator actually sees)

Driven by `apps/web/src/config/modules.ts` — the single source of truth for
the sidebar, home launcher, and command palette.

| App               | Route         | Availability | What it does                                                                                                                                                                         |
| ----------------- | ------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HR                | `/hr`         | In progress  | Employees, leave, attendance, onboarding — integrates with the separately-deployed HR Automation app rather than rebuilding HR logic here (`docs/specs/hr-integration-strategy.md`). |
| Purchases         | `/purchase`   | Ready        | Review bills sent in from the Telegram bot: OCR extraction → review queue → vendor directory → payment tracking. The most mature, most-tested module.                                |
| Documents (DMS)   | `/dms`        | Ready        | Store, categorize, tag, and AI-summarize company documents.                                                                                                                          |
| Delivery Challans | `/assets`     | Ready        | Generate and track Delivery Challans — a Word-template-driven PDF workflow with a SHA-256 verification hash per document.                                                            |
| Analytics         | `/analytics`  | Coming soon  | Not built.                                                                                                                                                                           |
| Reports           | `/reports`    | Ready        | On-demand and scheduled reports.                                                                                                                                                     |
| Business Timeline | `/timeline`   | Ready        | Cross-module activity feed — everything that happened, in one place.                                                                                                                 |
| Automation        | `/automation` | Ready        | Rule-based automation: define a trigger, an action, see execution history.                                                                                                           |

**Built but not in the app registry today** (reachable only by direct URL or
a dashboard alert link, not from the sidebar/command palette):

- **Inventory** (`/inventory`) — deliberately excluded per commit `aaee965`
  ("single-operator, inventory not essential yet"). Its data layer
  (`lib/inventory.ts`) is still used by the Delivery Challans feature.
- **Contracts** (`/contracts`) — fully built and tested, dashboard already
  surfaces contract-expiry alerts, but there's no app-registry entry and no
  clear documented reason why. Worth a deliberate decision — see
  `docs/roadmap/development-roadmap.md` § 6.

Admin surfaces (Users/Roles/Permissions/Audit) exist in
`apps/web/src/config/navigation.ts` but are commented out — intentionally
dormant per the single-operator product mode, not missing.

---

## 7. Tour of the modules (backend business logic)

Each module under `modules/<slug>/backend/` follows the same layering:
`api/` (views/urls) → `controllers` (where present) → `services/` (business
rules, event publishing) → `repositories/` (data access, where used) →
`models/`. `modules/purchase/backend` is the reference implementation this
pattern is copied from.

| Module                                                                                              | Wired into Django (`MODULE_APPS`)? | Status                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `purchase`                                                                                          | Yes                                | Built — bill ingestion, review, vendors, payments.                                                                                                                                                              |
| `documents`                                                                                         | Yes                                | Built — DMS backend.                                                                                                                                                                                            |
| `contracts`                                                                                         | Yes                                | Built — see § 6 for the frontend-visibility gap.                                                                                                                                                                |
| `inventory`                                                                                         | Yes                                | Built — see § 6 for the frontend-visibility gap.                                                                                                                                                                |
| `assets`                                                                                            | Yes                                | Built — Delivery Challans, plus a broader generic asset registry (models/services/tests exist) with no dedicated frontend beyond the DC flow.                                                                   |
| `analytics`, `chatbot`, `dms`\*, `finance`, `hr`, `maintenance`, `reports`\*, `vendors`, `visitors` | No                                 | `.gitkeep`-only scaffolding — prepared shells, not implemented. (`dms`/`reports` here are placeholder dirs distinct from the real `documents`/`reporting` apps that already ship the DMS and Reports features.) |

`modules/*/frontend/` directories are all empty `.gitkeep` placeholders —
the actual UI for every shipped app lives centrally in `apps/web/src`, not
per-module. That's the current pattern in practice, even though the
per-module `frontend/` directories are reserved for a future split.

---

## 8. Tour of the services (background machinery)

Shown to the operator only on the quiet `/services` page — nothing to click,
nothing to manage, plain-language descriptions only.

| Service                                                                      | Status                                                                                                                                                         |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `telegram-bot`                                                               | **Implemented.** Receives purchase-bill photos/documents, runs OCR (Gemini/OpenAI Vision), posts structured data to the platform via the service-token scheme. |
| `ai-engine`, `email-service`, `ocr`, `scheduler`, `webhook-engine`, `worker` | **Scaffolding only** — a `Dockerfile` and empty `src/`/`tests/` per service. No code, no tests, because there's nothing to test yet.                           |

Platform-side capabilities that back these (and are already built,
independent of whether the standalone service exists yet): `platform/ai`
(AI gateway — "mock" model answers deterministically with no keys, real
providers behind `GEMINI_API_KEY`/`ANTHROPIC_API_KEY`), `platform/storage`
(local filesystem or S3/R2-compatible), `platform/search`,
`platform/tagging`, `platform/reporting`, `platform/automation`.

---

## 9. A worked example: Purchase bill ingestion end to end

This is the most complete data flow in the platform and a good template for
how a new ingestion-driven feature should be wired:

1. Operator sends a receipt photo to the Telegram bot.
2. `services/telegram-bot/main.py` authenticates to the OCR provider, runs
   vision extraction (vendor, amount, date, line items), then POSTs the
   structured result to `PLATFORM_API_URL` with
   `Authorization: Service <PLATFORM_SERVICE_TOKEN>`.
3. The backend's `ServiceTokenAuthentication` validates the token
   (constant-time compare) and hands the request a `ServiceActor` — never a
   real `User`.
4. `modules/purchase/backend` creates a `PurchaseBill` row, tagged with the
   ingestion channel, and publishes a domain event.
5. `platform/audit` is subscribed to that event and records the audit trail
   — the module itself never touches the audit app directly.
6. The operator opens `/purchase` in the web app, sees it in the review
   queue (`DataTable`), confirms or rejects it, and the dashboard's
   "pending attention" surface and Business Timeline update from the same
   event.

The same shape — ingest → validate → store → publish event → subscribers
react — is the intended pattern for every future ingestion channel (email,
webhook, WhatsApp, etc.), not something to reinvent per channel.

---

## 10. Conventions

- **Commits:** Conventional Commits (`feat(hr): …`, `fix(platform/auth): …`).
- **Branches:** short-lived, `feat/<scope>-<desc>` / `fix/<scope>-<desc>`,
  trunk-based (no long-lived `develop`).
- **Python:** ruff-formatted, line length 100, typed where practical.
- **TypeScript:** Prettier + ESLint, components from `@bop/ui`, icons from
  `@bop/icons` (never `lucide-react` directly), charts from `@bop/charts`.
- **UI law:** `docs/design/design-bible.md` governs color, typography,
  spacing, motion, dark mode, accessibility, and copy — read it before any
  UI change. One sidebar, one header, one login, one command palette, ever.
- **Architectural decisions** get an ADR in `docs/adr/`.
- **Verification before "done":** `pnpm --filter web build` for any UI
  work; `pytest` + `ruff check` + `manage.py check` for any backend work.

---

## 11. Where to find more

| Question                                                        | Look here                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------ |
| Is X built, and how well tested?                                | `docs/roadmap/development-roadmap.md`                              |
| What's the product direction / why single-operator?             | `docs/roadmap/single-operator-plan.md`                             |
| What does module Y do, who uses it, what are its KPIs?          | `docs/modules/<slug>.md`                                           |
| How is module Y actually built (schema, API, events)?           | `docs/specs/<slug>.md`                                             |
| UI rules (color, spacing, components)                           | `docs/design/design-bible.md`                                      |
| Auth / RBAC internals                                           | `docs/architecture/authentication.md`, `docs/architecture/rbac.md` |
| Platform kernel internals                                       | `docs/architecture/platform-kernel.md`                             |
| API reference                                                   | `docs/api/platform-api.md`                                         |
| Deploying the backend                                           | `docs/deployment/backend.md`                                       |
| What's the security posture, what was fixed, what's still open? | `SECURITY.md` (repo root)                                          |
| Onboarding as a new contributor                                 | `docs/development/onboarding.md`                                   |

---

## 12. Current known gaps (honest, as of this pass)

- **Contracts and Inventory** are fully built but not exposed in the app
  registry — needs a product decision (§ 6).
- **`services/*`** (besides `telegram-bot`) are unimplemented scaffolding.
- **No Google/Microsoft SSO yet** — email+password auth is real and
  hardened; social sign-in is the remaining auth gap.
- **Production deployment status wasn't re-verified this pass** — check
  hosting dashboards directly rather than trusting any document's claim.
- **Credential rotation required** — see `SECURITY.md` for a real,
  actionable finding from this pass (hardcoded secrets in
  `docker-compose.yml`, committed since the first commit).
