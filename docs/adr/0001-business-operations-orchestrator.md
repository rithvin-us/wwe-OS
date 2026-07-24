# ADR-0001: The Business Operations Orchestrator is the ensemble of platform capabilities, not a new app

- **Status:** Accepted
- **Date:** 2026-07-25
- **Deciders:** rithvin-us, Claude (session_01QMh9GE3Ue1ykGfKkNhb5gJ)

## Context

The approved roadmap names "Business Orchestrator" as Subsystem 6: "This becomes the central coordinator. Every module communicates through the orchestrator." Read literally, that could mean building a new `platform/orchestrator` app that every module calls into — but by the time Subsystem 6 came up, five subsystems were already built (`workflow`, `periods`, `identity`, `metadata`, `rules`), and every one of them already communicates with every other exclusively through two existing platform mechanisms: the shared event bus (`shared.events.publish`/`subscribe`) and code-registries (`workflow.registry`, `periods.registry`, `metadata.registry`). No module has ever imported another module directly (architecture rule 2, held throughout). Building a new coordinating app on top of that would either (a) duplicate the event bus under a different name, or (b) become a God-object every module must import, which is the exact multi-tenant/coupling problem the event bus and registries already solve.

This is also stated directly in the Subsystem 1 design spec (`docs/superpowers/specs/2026-07-24-pipeline-execution-engine-design.md` §3): _"'Business Operations Orchestrator' stays the product-facing name; `platform/workflow` is its technical foundation."_ Subsystem 6 is where that claim gets tested against four more subsystems' worth of real integration — and it holds.

## Decision

**The Business Operations Orchestrator is not a new app or service.** It is the name for the ensemble already built:

- `platform/workflow` — the execution engine (retries, pause/resume/cancel, crash recovery, saga-style compensation).
- `platform/shared/events.py` — the coordination substrate every capability and module publishes to and subscribes from, so no capability imports another business module directly.
- `platform/periods`, `platform/identity`, `platform/metadata`, `platform/rules` — capabilities that any pipeline (existing or future) can call into via their public services, coordinated the same way.
- Module registries (`workflow.registry`, `periods.registry`, `metadata.registry`) — the "orchestrator learns about a new document type/pipeline/vendor mapping" mechanism, always registered from a module's own `AppConfig.ready()`, never hardcoded into the platform.

"Every module communicates through the orchestrator" is satisfied exactly as built: `documents` and `purchase` never import each other; both talk to `periods`/`identity`/`metadata`/`rules`/`storage` (platform capabilities) and emit their own domain events other subscribers react to (e.g. `automation`'s subscriber translates a finished `workflow.PipelineRun` back into a legacy `AutomationRun` without `workflow` knowing `automation` exists).

## Consequences

**Easier:** no new coordination layer to build, test, or keep in sync with the five capabilities that already exist; future subsystems (Search, Auditor Package) plug into the same substrate without a design decision to make.

**Harder / accepted tradeoff:** "the orchestrator" has no single file a newcomer can open to see the whole system — it's the sum of `platform/workflow` + `shared/events.py` + the registries + every module's `apps.py ready()`. This ADR is that map.

**Commitment:** any future subsystem that needs cross-cutting coordination extends `platform/workflow` (a new pipeline definition) or the event bus (a new event + subscriber) — it does not get its own bespoke coordination mechanism.

## Alternatives considered

- **A new `platform/orchestrator` app that every module calls directly** — rejected: duplicates the event bus, and a single import-everyone-goes-through app is the coupling architecture rule 2 exists to prevent.
- **A visual/no-code pipeline builder as "the orchestrator"** — rejected: the Subsystem 1 design spec already ruled this out explicitly ("NOT a generic drag-and-drop workflow builder" — pipelines are developer-authored code, registered like every other capability in this codebase).
