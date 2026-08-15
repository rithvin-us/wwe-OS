# Developer Onboarding

Welcome to the Business Operations Platform. This guide gets you from clone to
productive in ~15 minutes.

## 1. Prerequisites

| Tool    | Version    | Purpose                               |
| ------- | ---------- | ------------------------------------- |
| Node.js | ≥ 20       | Frontend apps and packages            |
| pnpm    | ≥ 9        | Monorepo package manager              |
| Python  | ≥ 3.12     | Backend (platform, modules, services) |
| Docker  | any recent | Local Postgres, Redis, Mailpit        |
| Git     | ≥ 2.40     | Version control                       |

## 2. Setup

```bash
git clone <repo-url>
cd business-operations-platform

# Environment
cp .env.example .env          # then edit secrets as needed

# Frontend workspace
pnpm install

# Python tooling (ruff, pytest, pre-commit)
pip install --group dev

# Git hooks
pre-commit install

# Local infrastructure
docker compose up -d          # postgres:5432, redis:6379, mailpit UI :8025
```

## 3. Repository tour

```
apps/            Frontend applications (web, admin, employee, mobile)
platform/        Shared kernel: auth, users, permissions, workflow, notifications,
                 audit, search, storage, tenancy, billing, ai, shared
modules/         Business modules: hr, purchase, dms, inventory, … (ALL business logic)
services/        Independent services: telegram-bot, email-service, webhook-engine,
                 ocr, scheduler, worker, ai-engine
packages/        Shared TS packages: @bop/ui, @bop/sdk, @bop/shared-types, …
database/        Migrations, seeds, schema docs
infrastructure/  Deployment: docker, k8s, nginx, terraform, monitoring, providers
docs/            Architecture, ADRs, guides (you are here)
tests/           Cross-cutting e2e/integration suites
```

Read `platform/README.md` and `modules/README.md` before writing any code —
they define the dependency rules.

## 4. The three rules you must not break

1. **Business logic only in `modules/`.** If you're writing a leave-approval rule
   in `platform/`, stop.
2. **Modules never import other modules.** Use platform contracts or domain events.
3. **Never reimplement a platform capability.** Auth, permissions, workflow,
   notifications, audit, search, files — always consumed from `platform/`.

## 5. Everyday commands

| Command                          | What                                   |
| -------------------------------- | -------------------------------------- |
| `pnpm lint` / `pnpm format`      | ESLint / Prettier across the workspace |
| `ruff check .` / `ruff format .` | Python lint / format                   |
| `pytest`                         | Python tests                           |
| `pre-commit run --all-files`     | Run all hooks manually                 |
| `docker compose up -d` / `down`  | Local infra up / down                  |

## 6. Conventions

- **Branches:** `feat/<scope>-<desc>`, `fix/<scope>-<desc>`; PRs into `main`.
- **Commits:** Conventional Commits (`feat(hr): …`, `fix(platform/auth): …`).
- **Python:** ruff-formatted, line length 100, typed where practical.
- **TypeScript:** Prettier + ESLint, types come from `@bop/shared-types`.
- **Decisions:** anything architectural gets an ADR in `docs/adr/`
  (copy `0000-template.md`).

## 7. Where things run

| Component          | Local                      | Production                            |
| ------------------ | -------------------------- | ------------------------------------- |
| Frontend apps      | `pnpm dev` (per app)       | Vercel                                |
| Backend API        | uvicorn (once implemented) | Render                                |
| PostgreSQL         | docker compose             | Managed PostgreSQL                    |
| Workers/bots/email | per-service `src/`         | Render background services            |
| AI engine          | local process              | Cloudflare Tunnel → independent later |

> **Whichever machine hosts the Face-AI / Telegram-bot local services must
> install the Cloudflare Tunnel as a Windows service**, not run it as a
> foreground process — Render's production backend depends on
> `ai.water-works.in` / `bot.water-works.in` staying up continuously.
> See `docs/deployment/cloudflare-tunnel-setup.md` Step 5 and
> `services/face-ai/cloudflare/install-tunnel-service.ps1`.
