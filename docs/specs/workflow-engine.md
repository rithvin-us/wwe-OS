# Workflow Engine

**Status: not built.** `docs/modules/workflow.md` describes the full,
enterprise-shaped design; this document narrows that to what should actually
be built first, and why, given the confirmed single-operator direction
(`docs/roadmap/single-operator-plan.md`).

## Why this is scoped down from the original brief

A generic approval engine (multi-step chains, SLA timers, escalation rules)
solves "route a decision to the right _approver_ out of many people." With
one operator, there is no "right approver to route to" — there is only "does
this need the operator's attention, yes or no." Building the full engine now
would be real, tested code with no one to exercise most of its paths. The
Purchase module's `pending_review → confirmed/rejected` state machine
(built, Stage 2) **is** the workflow engine's v1 shape, informally. This spec
extracts that pattern into a reusable capability so the _next_ module doesn't
reinvent it, without pretending single-operator needs approval chains it
doesn't have.

## 1. Functional requirements (v1 — reviewable-item pattern)

- Any module can mark a record as needing operator attention
  (`pending_review`-shaped status).
- The operator sees one place listing everything across every module waiting
  on them (this is the dashboard's "Pending approvals" panel,
  `apps/web/src/config/dashboard.ts`, currently populated by nothing — see
  § 19).
- A reviewed item transitions once, irreversibly, to a terminal state
  (`confirmed`/`rejected`, or module-appropriate equivalents).

## 1b. Functional requirements (v2 — full engine, future/multi-user)

- Declarative workflow definitions (states, transitions, required
  approvers) versioned per module.
- Multi-step approval chains with per-step approvers or approver groups.
- SLA timers and escalation when a step exceeds its time budget.
- Full instance history (who did what, when, per step).

## 2. Non-functional requirements

- v1 must cost near-zero to adopt per module — a status field, a review
  endpoint, an event — not a new subsystem to learn.
- v2, when built, must not require rewriting v1 adopters — the migration
  path is "your status field becomes a workflow instance's current state,"
  not "redo your review endpoints."

## 3. Database schema

**v1**: no new tables. Each module owns its own status field (see
`purchase_bill.status` as the reference shape: an enum with exactly one
non-terminal value and N terminal values).

**v2** (future, per `docs/modules/workflow.md`):

```
workflow_definition, workflow_version, workflow_instance, workflow_task,
transition_log, sla_timer, escalation_rule
```

## 4. Entity relationships

**v1**: `<module record> --status--> [pending_review] --review action--> [terminal state]`,
independently per module, with a shared vocabulary (not a shared table).

**v2**: `workflow_instance` would reference the triggering record generically
(content-type + object id), decoupling the engine from any one module's
schema — genuinely new design work, not an extension of v1's tables.

## 5. Folder structure

Not built. If/when v2 is warranted, it is a **platform capability**
(`platform/workflow/`) per the original architecture doc — modules declare
workflows, they don't implement the engine themselves.

## 6–13. Backend/frontend architecture, API, validation, business logic, jobs, events, queues

v1 is not a separate subsystem — see `docs/specs/purchase.md` §§ 6–13 for the
reference implementation of the pattern every future reviewable-item module
should follow: `status` field, `confirm`/`reject` actions, `ConflictError` on
re-review, an event per transition, an audit subscriber.

## 14–17. Error handling, security, testing, deployment

Follow `_shared-conventions.md` and the Purchase module's test shape
(happy path, re-review conflict, permission enforcement, audit trail) as the
template every new reviewable-item module's tests should match.

## 18. Mobile integration

The "needs your attention" pattern is exactly what the native app's home
screen should surface first — see `docs/specs/mobile-application.md` § 3.

## 19. Dashboard integration

**Not wired yet.** `PENDING_APPROVALS` in `apps/web/src/config/dashboard.ts`
is currently a static empty array. Once a second reviewable-item module
exists alongside Purchase, this is the moment to build a small, real
aggregator (a platform-level query across modules' pending counts) rather
than each module pushing into the dashboard ad hoc.

## 20. Future scalability

Build the v2 generic engine when — and only when — a second person joins and
approval routing (not just review) becomes a real requirement. Until then,
every module repeating the v1 pattern is cheaper and more honest than a
generic engine with one caller.
