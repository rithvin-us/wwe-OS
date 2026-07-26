# HR Integration Strategy

> **Superseded — read `docs/specs/hr-migration.md` instead.**
>
> The operator has scheduled the full migration: the standalone HR app's
> source is now in the repo and is being moved into `modules/hr`. That means
> Phase 4 below is the plan and Phases 1–3 are skipped. This document is kept
> for the reasoning behind the phasing and the rollback thinking (§ Phase 5,
> § Non-negotiables), which still apply. Everything it guesses about the HR
> app's stack is now answered — by the migration spec, from the real source.

## An honest caveat before anything else

This document proposes a **generic, sound integration pattern** — it is not
informed by the existing HR app's actual tech stack, database schema, or API
surface, because I have not seen that system. Nothing below should be taken
as a concrete plan until the first step (discovery) actually happens. Where
this document says "the HR app," read that as a placeholder for "whatever
the real system turns out to look like."

*(Discovery has since happened — see the migration spec. The legacy app is
FastAPI + async SQLAlchemy + Alembic + Pydantic v2, with a Next.js frontend,
an InsightFace microservice, and a Capacitor check-in app.)*

## Phase 0 — Discovery (do this before any code)

- What's the HR app's stack (framework, database)?
- Does it already expose an API, or only a UI? If an API, what
  authentication does it use?
- What's its data model for the entities WWE OS will eventually need to
  reference (employees, at minimum)?
- Is it actively maintained/deployed by the same person, or does it have
  its own release process to coordinate with?

Everything in Phases 1–4 depends on the answers here — this document
sequences the _kind_ of work, not the specific tasks, until discovery
happens.

## Phase 1 — Read-only API integration (no data migration)

Goal: WWE OS can _display_ HR data without owning it.

- If the HR app has an API: WWE OS's `modules/hr/backend` becomes a thin
  client — a service that calls out to the HR app's API and re-shapes
  responses for the dashboard/sidebar, storing nothing itself.
- If the HR app has no API: expose one on the HR app side first (a small,
  read-only surface: employee list, leave-today, headcount) — this is HR-app
  work, not WWE OS work, but is the actual prerequisite.
- Auth between the two systems: the same `ServiceTokenAuthentication`
  pattern already built for Telegram ingestion
  (`platform/shared/service_auth.py`) works symmetrically — either system
  can be the "service" caller of the other's API, reusing existing,
  tested infrastructure rather than building a second integration
  mechanism.
- **User-visible outcome**: the Executive Dashboard's `PEOPLE_SUMMARY`
  (`apps/web/src/config/dashboard.ts`) shows real numbers — total employees,
  on leave today — sourced live from the HR app, with WWE OS still not the
  source of truth for anything.

## Phase 2 — Identity unification

Goal: one login for both systems.

- If the HR app has its own login, decide which system owns identity going
  forward. Given WWE OS's `platform/auth` is already built, tested, and
  designed for SSO (`docs/specs/integration-layer.md`), the natural
  direction is: **WWE OS owns identity, the HR app either federates to it
  (accepts WWE OS's JWT) or is retired in favor of WWE OS-native screens
  once Phase 4 happens.**
- This phase is the first one with real migration risk — plan a maintenance
  window and a tested rollback (Phase 5) before touching it.

## Phase 3 — Selective data migration (only what WWE OS needs to own)

Goal: entities other WWE OS modules need to reference (e.g. Purchase
attributing a bill to an employee, once that's a real requirement) get a
canonical home.

- Not a full database migration — only the minimum entity (e.g. a generic
  `Employee` reference, distinct from the platform's generic `User`,
  per the original architecture's "User is identity, Employee is HR
  business data" split, `docs/modules/hr.md` § 3).
- Migration script pattern: read from the HR app's database/API, upsert
  into WWE OS's schema, run in dry-run mode first (report what _would_
  change), then for-real, idempotently (safe to re-run).

## Phase 4 — Full functional migration (last, and only if warranted)

Goal: HR Automation's actual features (leave requests, attendance,
onboarding) become native WWE OS screens in `modules/hr`, following the
automation-first design already specified in `docs/modules/hr.md`.

- Only worth doing if maintaining two separate applications becomes more
  costly than migrating — for a single-operator company, "the HR app
  already works, leave it alone" may be the permanently correct answer.
  This phase existing in the plan is not a commitment to execute it.

## Phase 5 — Rollback strategy (applies to every phase above)

- **Phase 1 (read-only API)**: rollback is trivial — stop calling the HR
  app's API, dashboard panels revert to their honest empty state. No data
  was ever owned by WWE OS, nothing to undo.
- **Phase 2 (identity)**: rollback requires the HR app's original login to
  still exist and work — do not decommission it until Phase 2 has run in
  production long enough to trust it (a real, time-boxed parallel-run
  period, not a same-day cutover).
- **Phase 3 (selective data)**: every migration script must be reversible
  or, at minimum, non-destructive — write into new WWE OS tables, never
  delete or mutate the HR app's source data. The HR app remains the
  source of truth until Phase 4 (if it ever happens) explicitly says
  otherwise.
- **Phase 4 (full migration)**: not attempted until Phases 1–3 have been
  stable in production for a meaningful period, and only with an explicit
  decision to retire the standalone HR app — the biggest risk phase, gated
  behind the most confidence.

## Non-negotiables regardless of phase

- WWE OS's architecture rule stands: **no HR business logic gets written
  into `platform/`.** Whatever lands in `modules/hr/backend` follows the
  same layered pattern as `modules/purchase/backend` (the reference
  implementation, Stage 2).
- Every integration point reuses existing platform capabilities
  (`ServiceTokenAuthentication`, the event bus, the audit trail) — this
  integration does not invent new infrastructure any more than Purchase's
  ingestion did.
