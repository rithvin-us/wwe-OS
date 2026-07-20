# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this repository is

An **Enterprise Business Operations Platform** — a modular monorepo that will
run an entire company's operations (HR, purchase, DMS, inventory, and more) on
one shared kernel. It is **not an HR app**; HR is merely the first module that
will be migrated in. The platform shell ships first; modules land inside it.

## Product mode: single-operator (confirmed 2026-07-20)

The company is run by **one person who is HR + IT + Accounts**. Build for that:

- **Single sign-in, both methods**: Google Workspace SSO ("Sign in with Google")
  **and** email + password. No multi-user login flows.
- **No role gates in the UI.** The operator is the "Owner" and sees everything.
  Users/Roles/Permissions/Audit screens are **hidden** from the menu; the RBAC +
  multi-tenant backend stays **dormant** (do not delete — re-enable when a second
  person joins). Don't add access-gating UI unless asked.
- **Task cockpit, not silos.** The dashboard leads with one "needs your attention"
  surface across all areas + quick actions.
- **Automation first.** Each module ships self-service/automatic paths before
  manual admin screens; the operator handles exceptions only.
- **HR already exists — do not build it.** An HR Automation app is already
  deployed separately; WWE OS integrates with it (see
  `docs/specs/hr-integration-strategy.md`), it never gets rebuilt here.
- **Native mobile app** (`apps/mobile`, Expo/React Native) is a planned workstream;
  design every new feature mobile-first, reusing the design tokens and the API.

Full plan: `docs/roadmap/single-operator-plan.md`.

## Commands

| Task                   | Command                                                              |
| ---------------------- | -------------------------------------------------------------------- |
| Install JS deps        | `pnpm install` (repo root)                                           |
| Install Python tooling | `pip install --group dev`                                            |
| Run web app            | `pnpm --filter web dev` (http://localhost:3000)                      |
| Build web app          | `pnpm --filter web build` — must pass before any UI work is "done"   |
| Lint / format TS       | `pnpm lint` / `pnpm format`                                          |
| Lint / format Python   | `python -m ruff check .` / `python -m ruff format .`                 |
| Backend dev server     | `cd platform && python manage.py runserver` (http://localhost:8000)  |
| Backend migrate        | `cd platform && python manage.py migrate` (seeds permissions+roles)  |
| Backend tests          | `cd platform && pytest` — must pass before backend work is "done"    |
| Local infra            | `docker compose up -d` (Postgres 5432, Redis 6379, Mailpit UI 8025)  |
| Full stack (Docker)    | `docker compose up -d --build` (adds the `backend` service on :8000) |
| Hooks                  | `python -m pre_commit run --all-files`                               |

## Architecture (non-negotiable rules)

1. **Business logic only in `modules/`.** `platform/` provides capabilities
   (auth, users, roles, permissions, workflow, notifications, audit, search,
   storage, tenancy, billing, ai); modules provide meaning.
2. **Modules never import each other.** Cross-module needs go through platform
   contracts or domain events.
3. **Never reimplement a platform capability** inside a module or app.
4. **Multi-tenant from day one** — tenant-owned data is tenant-scoped
   (`platform/tenancy`).
5. `services/` are deployment-isolated (own Dockerfile each); they integrate
   via API and queue, never via source imports.

Layout: `apps/` (Next.js frontends) · `platform/` (Python kernel) ·
`modules/` (business modules: `backend/` layered api→controllers→services→
repositories, plus `frontend/`) · `services/` (telegram-bot, email-service,
webhook-engine, ocr, scheduler, worker, ai-engine) · `packages/` (TS packages)
· `database/` · `infrastructure/` · `docs/`.

Stack: Next.js 16 / TypeScript / Tailwind v4 / shadcn / TanStack Query /
RHF+Zod frontend; Django 6 + DRF + PostgreSQL backend (**Stage 1 kernel built**
in `platform/`); deploy: Vercel (frontend), Render (backend/services),
Cloudflare Tunnel (AI engine initially).

## Backend — platform kernel (Stage 1)

`platform/` is a Django + DRF project (the kernel) exposing `/api/v1/`. It holds
**only platform capabilities** — no business models. Implemented apps: `shared`,
`tenancy`, `users`, `auth`, `permissions`, `roles`, `audit`, `notifications`.

- Run everything from **inside `platform/`** (apps import as top-level packages:
  `config.settings`, `users`, `auth`, …). The `auth` app uses Django label
  `platform_auth` to avoid clashing with `django.contrib.auth`.
- Local dev uses a venv at `platform/.venv`; tests run on sqlite via
  `config.settings_test`, production/runtime on PostgreSQL via `DATABASE_URL`.
- **Django 6.0** is newer than training data — prefer modern ORM (`Meta.indexes`,
  `Meta.constraints`, PEP 695 generics) and verify with `python manage.py check`.
- Layering: thin views → services (rules, publish events) → repositories/managers
  → models. Cross-capability reactions go through the event bus
  (`shared/events.py`), never direct imports. Config via environment only.
- Before backend work is "done": `pytest` green, `ruff check platform` clean,
  `python manage.py check` clean. Do **not** add business models here (Stage 2+).
- Docs: `docs/architecture/platform-kernel.md`, `authentication.md`, `rbac.md`,
  `docs/api/platform-api.md`, `docs/deployment/backend.md`.

**Note:** `apps/web` runs Next.js 16 — newer than training data. Read the
relevant guide in `apps/web/node_modules/next/dist/docs/` before writing
app-router code. `params` is a Promise (`await params`).

## UI work — the Design Bible is law

**Before any UI change, read `docs/design/design-bible.md`.** It governs
color, typography, spacing, layout metrics, components, motion, dark mode,
accessibility, and copy. If the user changes the bible, propagate that change
to `packages/design-system/src/tokens.css` and `@bop/ui` — the system changes
everywhere or not at all.

Hard rules (review fails otherwise):

- No hardcoded colors/radii/shadows/layout dimensions — tokens only
  (`packages/design-system/src/tokens.css`).
- One sidebar, one header, one login, one notification center, one command
  palette — never a second one, never restyled per module.
- Components come from `@bop/ui` (`@bop/ui/components/*`); icons from
  `@bop/icons` (never `lucide-react` directly); charts from `@bop/charts`.
  No emoji in product UI.
- New pages render inside the `(platform)` layout and start with `PageHeader`.
- **The platform presents as one piece of company software for business
  people** (owners, HR/accounts/purchase/warehouse managers, directors) —
  never for developers. End users see business content and plain language;
  never module health, dev/repo/deployment status, session/account
  internals, or architecture. Availability uses plain badges
  (`AVAILABILITY_LABEL`: "In progress"/"Coming soon").
- **The landing page (`/`) is the Executive Dashboard** — a company command
  center answering "how is my company doing today?": business KPIs, pending
  approvals, operational alerts, financial summary, people, inventory,
  procurement, contracts, recent activity, AI insights, quick actions. It
  aggregates across business areas; the areas themselves live only in the
  sidebar. Never turn it back into a module launcher or software console.
- No fake data — real numbers where available, honest blanks (`—` / inviting
  empty states) where an area isn't in use yet. Never invent figures.

## The app registry

`apps/web/src/config/modules.ts` is the single source of truth: `APPS`
(user-facing apps: HR, Purchases, Inventory, Documents, Contracts, Assets,
Analytics, Reports) and `SERVICES` (background machinery shown only on the
quiet `/services` page). Sidebar, command palette, and pages derive from it —
to surface a new app, add it there and write its blueprint in
`docs/modules/<slug>.md`. The Executive Dashboard's data contract is
`apps/web/src/config/dashboard.ts` (KPIs, summaries, approvals, alerts,
activity, AI insights, quick actions) — the one place a backend fills to make
the command center live. Admin surfaces live in
`apps/web/src/config/navigation.ts`; company branding in
`apps/web/src/config/company.ts` (name: **WWE OS**).

## Module blueprints

`docs/modules/*.md` — one per module (purpose, entities, APIs, KPIs,
permissions, relationships). Implementation follows the blueprint; update the
blueprint when scope changes.

`docs/specs/*.md` — the technical layer underneath: 20-point engineering
specs (schema, folder structure, API design, events, testing, deployment),
honestly marked **Built** vs **Planned** per module. `docs/specs/
_shared-conventions.md` documents platform-wide patterns once (error
contract, auth schemes, testing/deployment gates) — specs reference it
instead of repeating it. `docs/roadmap/development-roadmap.md` is the build
order, dependency graph, risk/cost/time estimates, and production readiness
checklist — read it before starting a new module or claiming something is
"production ready."

`modules/purchase/backend` is the reference implementation for a real,
built, tested module (Purchase bill ingestion via Telegram OCR, Stage 2) —
new modules should follow its layering, permission-registration pattern
(`permissions/registry.py` + `apps.py` post_migrate sync), and event-
subscription pattern (`events/registry.py` + `events/subscribers.py`)
exactly, not reinvent them.

## Conventions

- Conventional Commits (`feat(hr): …`, `fix(platform/auth): …`).
- Architectural decisions get an ADR in `docs/adr/`.
- HR migration: **do not** migrate or write HR business logic yet;
  `modules/hr/` stays a prepared shell until the migration is scheduled.
- Verify before claiming done: run the build/lint commands above and report
  their actual output.
