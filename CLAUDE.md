# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this repository is

**WWE OS** (Water Works Engineering OS) — an **Enterprise Business Operations
Platform**: a modular monorepo that runs an entire company's operations (HR,
purchase, finance/invoicing, documents, contracts, inventory, delivery
challans, and more) on one shared kernel. It is **not an HR app**; HR was the
first module migrated in. The platform shell ships first; modules land inside
it. Two capabilities now front the product: **Rithu AI** (the contextual
business co-pilot) and **Face-AI** (biometric attendance/check-in).

- Product name: **WWE OS**. Company identity lives in
  `apps/web/src/config/company.ts` (`name: "Water Works Engineering"`) — edit
  that one file to rebrand; nothing else hardcodes company details.

## Product mode: single-operator (confirmed 2026-07-20)

The company is run by **one person who is HR + IT + Accounts**. Build for that:

- **Single sign-in, both methods**: Google Workspace SSO ("Sign in with Google")
  **and** email + password. No multi-user login flows. Face-AI check-in is a
  third path for attendance, not account login.
- **No role gates in the UI.** The operator is the "Owner" and sees everything.
  Users/Roles/Permissions/Audit screens are **hidden** from the menu (see the
  commented `ADMIN_PAGES` in `navigation.ts`); the RBAC + multi-tenant backend
  stays **dormant** (do not delete — re-enable when a second person joins).
  Don't add access-gating UI unless asked.
- **Task cockpit, not silos.** The dashboard leads with one "needs your
  attention" surface across all areas + quick actions. The `WORKSPACE` nav group
  (Briefing, Assistant, Approvals, Deadlines) is that cross-cutting cockpit.
- **Automation first.** Each module ships self-service/automatic paths before
  manual admin screens; the operator handles exceptions only. The **Automation**
  app collects tagged records on a schedule (packages, reports, auditor folders).
- **HR has been migrated in.** The standalone HR Automation app (FastAPI +
  SQLAlchemy) was retired into `modules/hr` — employees, attendance, payroll,
  statutory registers, leave, onboarding, expenses, face check-in. Its
  verified engines were copied, not rewritten; see
  `docs/specs/hr-migration.md` for what moved verbatim and what became a
  platform capability. `hr-integration-strategy.md` is superseded.
- **Mobile-first.** Design every new feature mobile-first, reusing the design
  tokens and the API. Two mobile paths exist (see "Mobile" below).

Full plan: `docs/roadmap/single-operator-plan.md`.

## Commands

| Task                     | Command                                                                 |
| ------------------------ | ----------------------------------------------------------------------- |
| Install JS deps          | `pnpm install` (repo root)                                              |
| Install Python (tooling) | `pip install --group dev` (repo root — ruff etc.)                       |
| Install backend deps     | `pip install -r platform/requirements.txt -r platform/requirements-dev.txt` |
| **Run everything**       | `pnpm dev` — web (:3000) + Django (:8000) + Face-AI (:9000), one command |
| Run web app only         | `pnpm --filter web dev` (http://localhost:3000)                         |
| Build web app            | `pnpm --filter web build` — must pass before any UI work is "done"      |
| Typecheck web            | `pnpm exec tsc --noEmit -p apps/web/tsconfig.json`                      |
| Test web                 | `pnpm --filter web test` (Vitest)                                       |
| Lint / format (JS+TS)    | `pnpm lint` / `pnpm format` (**Biome**); `pnpm lint:fix` to autofix     |
| Next.js-specific lint    | `pnpm --filter web lint` (ESLint — rules Biome doesn't cover)           |
| Lint / format Python     | `python -m ruff check .` / `python -m ruff format .`                    |
| Backend dev server       | `cd platform && python manage.py runserver` (http://localhost:8000)     |
| Backend migrate          | `cd platform && python manage.py migrate` (seeds permissions+roles)     |
| Backend tests            | `cd platform && pytest` — must pass before backend work is "done"       |
| Face-AI service          | `cd services/face-ai && python -m uvicorn app.main:app --port 9000`     |
| Local infra              | `docker compose up -d` (Postgres 5432, Redis 6379, Mailpit UI 8025)     |
| Full stack (Docker)      | `docker compose up -d --build` (adds the `backend` service on :8000)    |
| Hooks                    | `python -m pre_commit run --all-files`                                  |

**Tooling note:** JavaScript/TypeScript lint+format is now **Biome** (`biome.json`,
one tool for both) at the repo root; Python stays on **Ruff**. Pre-commit runs
ruff, biome, gitleaks, and the standard hygiene hooks. Biome ignores `platform/`,
`database/`, and all `*.py`/`*.html` (see `biome.json` `files.includes`).

## Architecture (non-negotiable rules)

1. **Business logic only in `modules/`.** `platform/` provides capabilities
   (auth, users, roles, permissions, workflow, notifications, audit, search,
   storage, tenancy, billing, ai, automation, approvals, alerts, deadlines,
   briefing, backups, reporting, tagging, …); modules provide meaning. Modules
   are *installed into* the platform Django project (`MODULE_APPS`) but their
   code lives under `modules/` — the platform apps themselves hold no business
   models.
2. **Modules never import each other.** Cross-module needs go through platform
   contracts or domain events.
3. **Never reimplement a platform capability** inside a module or app. In
   particular, **no module ever imports an AI SDK or calls a provider URL** —
   it goes through `platform/ai` (`AIService`).
4. **Multi-tenant from day one** — tenant-owned data is tenant-scoped
   (`platform/tenancy`).
5. `services/` are deployment-isolated (own Dockerfile each); they integrate
   via API and queue, never via source imports.

Layout: `apps/` (Next.js `web` + Expo `mobile` frontends) · `platform/` (Django
kernel: capability apps) · `modules/` (business modules: `backend/` layered
api→controllers→services→repositories, plus `frontend/`, `config/`, `docs/`) ·
`services/` (telegram-bot, email-service, webhook-engine, ocr, **face-ai**,
scheduler, worker, ai-engine — deployment-isolated) · `packages/` (TS packages:
`design-system`, `ui`, `icons`, `charts`, `theme`, `sdk`, `shared-types`,
`config`, `utils`) · `database/` · `infrastructure/` · `docs/`.

Stack: Next.js 16 / TypeScript / Tailwind v4 / shadcn / TanStack Query /
RHF+Zod frontend; Django 6 + DRF + PostgreSQL backend; Python/FastAPI for
Face-AI; **Google Gemini** as the default AI provider. Deploy: Vercel
(frontend), Render (backend/services), Cloudflare Tunnel (AI/Face-AI initially).

## Backend — platform kernel

`platform/` is a Django + DRF project (the kernel) exposing `/api/v1/`. The
capability apps hold **only platform capabilities** — no business models. It has
grown well past the original Stage 1: ~25 capability apps are installed
(`shared`, `tenancy`, `users`, `auth`, `permissions`, `roles`, `audit`,
`notifications`, `storage`, `periods`, `identity`, `metadata`, `rules`,
`auditor`, `ai`, `search`, `reporting`, `tagging`, `workflow`, `automation`,
`alerts`, `deadlines`, `approvals`, `briefing`, `backups`).

- **`INSTALLED_APPS` ordering is load-bearing** (`config/settings.py`). It is
  split into `PLATFORM_APPS_BEFORE_MODULES` + `MODULE_APPS` +
  `PLATFORM_APPS_AFTER_MODULES` so `post_migrate` hooks fire in the right order:
  `permissions` must sync **before** any module registers its permissions, and
  `roles` (which grants the Owner role every Permission that exists) must sync
  **after** all modules. If Owner-role coverage looks wrong, check this order first.
- **Business modules are installed as `<module>.backend` in `MODULE_APPS`** —
  currently `hr`, `purchase`, `documents`, `contracts`, `inventory`, `assets`,
  `finance`. A module is added there only once its backend is actually built;
  `chatbot`, `dms`, `maintenance`, `reports`, `vendors`, `visitors` are still
  shells / frontend-only.
- Run everything from **inside `platform/`** (apps import as top-level packages:
  `config.settings`, `users`, `auth`, …). The `auth` app uses Django label
  `platform_auth` to avoid clashing with `django.contrib.auth`.
- Local dev uses a venv at `platform/.venv`; tests run on sqlite via
  `config.settings_test`, production/runtime on PostgreSQL via `DATABASE_URL`.
- Stateless JWT API: no Django session/auth middleware. DRF authenticates per
  request (`auth.authentication.PlatformJWTAuthentication`), which also
  populates tenant/actor context via `shared`/`tenancy` middleware.
- **Django 6.0** is newer than training data — prefer modern ORM (`Meta.indexes`,
  `Meta.constraints`, PEP 695 generics) and verify with `python manage.py check`.
- Layering: thin views → services (rules, publish events) → repositories/managers
  → models. Cross-capability reactions go through the event bus
  (`shared/events.py`), never direct imports. Config via environment only.
- **AI gateway:** `platform/ai/providers.py` holds the model routing table;
  modules call `AIService` and never touch a provider directly. Provider HTTP
  uses `httpx` (no SDK). Default model is Gemini (`AI_DEFAULT_MODEL`).
- Before backend work is "done": `pytest` green, `ruff check platform` clean,
  `python manage.py check` clean.
- Docs: `docs/architecture/platform-kernel.md`, `authentication.md`, `rbac.md`,
  `docs/api/platform-api.md`, `docs/deployment/backend.md`.

**Note:** `apps/web` runs Next.js 16 — newer than training data. Read the
relevant guide in `apps/web/node_modules/next/dist/docs/` before writing
app-router code (`apps/web/AGENTS.md` restates this). `params` is a Promise
(`await params`).

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
  empty states) where an area isn't in use yet. Never invent figures. The
  dashboard KPI contract distinguishes `live` / `error` / `unwired` so a real
  fetch failure never hides behind the same calm "—" as "not built yet"
  (`apps/web/src/config/dashboard.ts`).

## The app registry & config

`apps/web/src/config/modules.ts` is the single source of truth for `APPS` —
the user-facing apps the sidebar, launcher, command palette, and pages all
derive from. Current `APPS`: **HR, Purchases, Invoices, Documents** (slug `dms`),
**Delivery Challans** (slug `assets`), **Reports, Business Timeline, Automation**.
Inventory is present but commented out (dormant). To surface a new app, add it
here and write its blueprint in `docs/modules/<slug>.md`.

Other config (all under `apps/web/src/config/`):

- `navigation.ts` — the one sidebar (`CORE MODULES` = apps, `WORKSPACE` =
  Briefing/Assistant/Approvals/Deadlines, `SYSTEM` = Assistant Settings/Backups/
  Maintenance/Settings) and the dormant `ADMIN_PAGES`.
- `dashboard.ts` — the Executive Dashboard data contract (KPIs, summaries,
  approvals, alerts, activity, AI insights, quick actions); the one place a
  backend fills to make the command center live.
- `company.ts` — company branding. `alerts.ts`, `automation.ts`, `invoices.ts`,
  `search.ts` — per-surface client-safe types/constants.

Server-side data fetchers live in `apps/web/src/lib/*` (one module per area:
`hr.ts`, `purchase.ts`, `invoices.ts`, `dms.ts`, `automation.ts`, `briefing.ts`,
`approvals.ts`, …). React Server Components read those; client components use
TanStack Query against the API routes under `apps/web/src/app/api/`.

## Rithu AI (co-pilot) & Face-AI (biometric)

- **Rithu AI** is the contextual business co-pilot surfaced across the shell
  (chat widget, `/assistant`, `/chatbot` settings). Web AI routes:
  `app/api/ai/chatbot`, `app/api/ai/assistant`, `app/api/ai/generate`. Provider
  is **Google Gemini** (`GEMINI_API_KEY`, `gemini-flash-latest`), matching the
  platform `ai` app's default. It answers questions about company data and
  supports slash commands / `@`-mentions. Do not wire a module directly to a
  provider — go through the platform AI gateway.
- **Face-AI** (`services/face-ai`) is a FastAPI microservice (uvicorn :9000)
  doing ArcFace/MTCNN facial recognition with anti-spoofing/liveness for
  attendance check-in. ML deps are in `requirements-ml.txt`; it ships a
  `Dockerfile` and Cloudflare-tunnel scripts (`services/face-ai/cloudflare/`).
  The web app talks to it via `app/api/auth/face/*` and `app/api/hr/...enroll`.

## Mobile

Two paths, both kept mobile-first:

- **Capacitor Android wrapper of the web app** — `apps/web/capacitor.config.ts`
  and `apps/web/android/`; CI builds it (`.github/workflows/android-build.yml`,
  `npx cap sync android`). This is the currently shipping Android path.
- **`apps/mobile`** — a separate Expo / React Native native workstream
  (`expo start`), reusing the design tokens and API. Planned/in progress.

## Module blueprints & specs

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
"production ready." `docs/architecture/01-…10-*.md` is a numbered orientation
series for new contributors.

`modules/purchase/backend` is the reference implementation for a real,
built, tested module (Purchase bill ingestion via Telegram OCR) — new modules
should follow its layering, permission-registration pattern
(`permissions/registry.py` + `apps.py` post_migrate sync), and event-
subscription pattern (`events/registry.py` + `events/subscribers.py`)
exactly, not reinvent them, and only get added to `MODULE_APPS` once real.

## Conventions

- Conventional Commits (`feat(hr): …`, `fix(platform/auth): …`).
- Architectural decisions get an ADR in `docs/adr/` (template `0000-template.md`).
- HR migration: **done.** `modules/hr/` is a real, tested module. Its payroll
  and shift engines were copied from the legacy app rather than rewritten, and
  the legacy test suites run against them unchanged — treat those files as
  load-bearing and change their arithmetic only deliberately
  (`docs/specs/hr-migration.md` § 3).
- **Verify before claiming done.** The CI gates (`.github/workflows/ci.yml`)
  are the bar: Biome (`pnpm exec biome ci .`) + Next lint, `pnpm --filter web
  build`, `tsc --noEmit`, `pnpm --filter web test`, `ruff check .` +
  `ruff format --check .`, `python manage.py check` + `pytest`, plus gitleaks/
  audit security scans. Run the relevant ones and report their actual output.
