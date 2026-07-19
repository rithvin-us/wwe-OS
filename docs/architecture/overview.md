# Architecture Overview

## Layers and dependency direction

```
apps  ──────────►  packages
  │                    ▲
  ▼                    │
modules ──────────► platform ──► (nothing)
  │
  ▼ (events / queue / API only)
services
```

- `platform/` depends on nothing internal. It is the kernel.
- `modules/` depend on `platform/` and emit/consume domain events.
  Modules never depend on each other.
- `apps/` compose module frontends and `packages/`.
- `services/` are deployment-isolated: they integrate via API and queue,
  never via source imports.

## Style

- **Modular monorepo** — one repo, independent deployables.
- **Domain-Driven Design** — each module is a bounded context.
- **Clean Architecture per module** — api → controllers → services →
  repositories; dependencies point inward, domain logic in services.
- **Event-driven where appropriate** — cross-module reactions via domain
  events (`modules/*/backend/events`), executed by `services/worker`.
- **Multi-tenant** — tenant resolution and isolation contract in
  `platform/tenancy`; every tenant-owned table is tenant-scoped.

## Deployment topology

| Component                    | Runs on                     | Notes                             |
| ---------------------------- | --------------------------- | --------------------------------- |
| Frontend apps                | Vercel                      | monorepo filters per app          |
| Backend API                  | Render                      | serves platform + all module APIs |
| PostgreSQL                   | Managed                     | single system of record           |
| Worker / scheduler           | Render background services  | consume Redis queue               |
| telegram-bot / email-service | Independent services        | notification channels             |
| ai-engine                    | Cloudflare Tunnel initially | later fully independent           |

## Decisions

Recorded as ADRs in `docs/adr/`. Start with the template `0000-template.md`.
