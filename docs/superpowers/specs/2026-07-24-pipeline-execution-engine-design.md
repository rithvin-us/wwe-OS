# Pipeline Execution Engine — Design

**Status:** Proposed, awaiting approval before implementation.
**Scope:** Subsystem 1 of the larger "Business Operations Orchestrator" redesign. This spec covers *only* the generic pipeline execution engine and the redesign of `platform/automation` to run on it. Invoice generation, the Business Period Manager, the Auditor Package pipeline, the visual canvas dashboard, WhatsApp ingestion, universal tagging, search improvements, and "Business Recipes" are later, separate sub-projects — see § Out of scope.

---

## 1. Context

The current automation engine (`platform/automation`) collects tagged records on a schedule and delivers them to a destination (a downloaded zip, a generated report, an auditor folder). It works, but it's built the only way this codebase currently knows how to run background work: one synchronous function call, triggered by an external cron, that either fully succeeds or fully fails by the time it returns. There is no in-flight state — `AutomationRun.status` is only ever `success` or `failed`, written *after* the fact, because nothing is ever paused, resumed, or recovered mid-flight today.

The broader Business Operations Orchestrator vision (invoice generation, purchase ingestion, delivery challans, auditor packages, reports, all running as trackable, recoverable pipelines) needs properties this synchronous model can't provide: retries, rollback of partial work, crash recovery, and live pause/resume/cancel of a running pipeline. Building each future pipeline (invoices, auditor packages, …) with its own bespoke retry/crash-handling logic would violate this repo's own "never duplicate a platform capability" rule. This spec is the shared foundation those future pipelines will run on, proven first against the one pipeline that already exists — automation.

**Why automation is redesigned to *use* the engine rather than the engine being built as a feature of automation:** the orchestrator vision explicitly describes invoice generation, purchase ingestion, and auditor packages as pipelines too — none of those are "automation" in the current sense (tag-based collection + delivery). The generic step/retry/crash-recovery machinery belongs in `platform/` as its own capability; automation becomes its first, most mature consumer.

---

## 2. The central decision: no task queue

The features above (crash recovery, pause/resume/cancel, live progress) sound like they need Celery/RQ and a broker. They don't, and adopting one would go against a pattern this codebase has already chosen twice, explicitly:

- `modules/contracts/backend/services/contract.py`'s `run_expiry_scan()`: *"synchronous and pull-based by design... no background worker or queue is introduced here."*
- `platform/automation/services.py`: the same shape, citing the contracts precedent by name.

Both exist for the same stated reason: single-operator, low-volume, no ops team to run and monitor a broker. A third capability (this engine) reaching for Celery would be the inconsistent choice, not the safe one — and `services/worker`/`services/scheduler` (currently empty Dockerfile-only scaffolding) explicitly **cannot** import `platform/`/`modules/` source per their own README contracts and this repo's architecture rule 5 (`services/` integrate via API/queue only, never source imports). Filling either in as a queue consumer would mean either duplicating step logic into a separate service or making it a slow HTTP client calling back into Django per step — strictly worse than running the loop where the data already lives.

**Decision: a DB-persisted step-by-step state machine**, ticked forward by a management command (`platform/workflow/management/commands/pipeline_tick.py`), no broker, no new deployable service. Every state transition is a single atomic `UPDATE ... WHERE status = <expected>` (not `SELECT ... FOR UPDATE`, which is Postgres-only and unavailable on the SQLite test backend) — this is what makes concurrent ticks safe without a lock table.

`services/worker` and `services/scheduler` are **not** touched by this plan — they stay reserved for whenever an actual message broker becomes justified.

---

## 3. Core model: `platform/workflow`

A new platform app, named `workflow` (not `orchestrator`) because `CLAUDE.md`'s own architecture rule 1 already lists **workflow** by name as a reserved platform capability, and `shared/events.py` already pre-declares `WORKFLOW_STARTED/STEP_APPROVED/COMPLETED/REJECTED/CANCELLED` events, unused, evidently reserved for exactly this. "Business Operations Orchestrator" stays the product-facing name; `platform/workflow` is its technical foundation, the same relationship "Automation" (product) has to `platform/automation` (app).

### Models (`workflow/models.py`)

- **`PipelineRun`** (`TenantOwnedModel`) — `pipeline_key`, `pipeline_version`, `step_keys` (JSON snapshot of step order at start — frozen so a later registry change can't corrupt an in-flight run), `status` (`queued/running/paused/compensating/success/failed/cancelled`), `termination_reason` (`failed/cancelled`), `current_step_index`, `context` (JSON, accumulates each step's output), `trigger_type` (`schedule/manual/event`), `triggered_by` (actor FK), an opaque `(source_module, source_object_type, source_object_id)` triple — the same untyped back-reference idiom `platform/tagging` already uses, so the engine never needs a FK to any business model — `idempotency_key`, timestamps, `error_message`.
- **`PipelineStepRun`** — one row per step per run: `step_index`, `step_key`, `status` (`pending/running/success/failed/skipped/compensating/compensated/compensation_failed`), `attempt`, `next_attempt_at` (backoff gate), `locked_at` (stale-lock detection), timestamps, `output` (JSON), `error_message`.
- A partial unique constraint on `(tenant, pipeline_key, idempotency_key)` (excluding empty string) is the exactly-once guarantee for scheduled runs — see § 6.

No `PipelineDefinition` database table — pipelines and their steps are **code**, registered at import time, exactly like the existing `ReportDefinition`/`SourceAdapter`/`SearchAdapter` registries. This matches the product requirement directly: "NOT a generic drag-and-drop workflow builder" — pipeline shapes are developer-authored, not built by dragging boxes.

### Registry (`workflow/registry.py`) — mirrors `reporting/registry.py`

```python
StepContext(tenant, run_id, actor, data: dict, attempt: int)      # read-only view into PipelineRun.context
StepResult(output: dict = {})

StepDefinition(
    key, label,
    run: Callable[[StepContext], StepResult],
    compensate: Callable[[StepContext], None] | None = None,
    max_attempts: int = 1,
    backoff: Callable[[int], float] | None = None,                 # default: exponential, capped at 300s
    timeout_seconds: int = 300,                                    # used by the stale-lock reclaim sweep
)

PipelineDefinition(key, label, module, permission, version, steps: list[StepDefinition])

register_pipeline(definition)   # idempotent by key
get_pipeline(key) -> PipelineDefinition          # NotFoundError if unknown
all_pipelines() -> list[PipelineDefinition]
```

`workflow/apps.py` has no `ready()` override — it's the registry *host*, the same role `automation/apps.py` plays for `SourceAdapter` today.

---

## 4. The execution loop

### `advance_one(run, *, actor=None)` — advances exactly one step

1. If `run.status == PAUSED`, return immediately (no-op).
2. If `run.status == COMPENSATING`, delegate to the unwind path (§ 5).
3. Otherwise, find the `PipelineStepRun` at `current_step_index`. If none remains, the run is done — mark `SUCCESS`.
4. If the step is `PENDING` but its `next_attempt_at` backoff hasn't elapsed, do nothing this tick.
5. Atomically claim it: `PipelineStepRun.objects.filter(id=step.id, status=PENDING).update(status=RUNNING, attempt=F("attempt")+1, locked_at=now())`. If the update affected 0 rows, another tick already claimed it — return.
6. Run the step's `run(ctx)` function inside a try/except.
   - **Success**: record `output`, merge into `run.context`, advance `current_step_index`. Re-check `run.status` before persisting — if an operator paused/cancelled between the claim and now, don't silently keep advancing.
   - **Failure**: if attempts remain, reset the step to `PENDING` with `next_attempt_at = now() + backoff(attempt)` (retry on a later tick, possibly a different process — this is why backoff is a persisted deadline, not an in-process sleep). If attempts are exhausted, mark the step `FAILED` and put the **run** into `COMPENSATING`.
7. An exception in the *engine* itself (not a step's business exception, which is already caught in step 6) is caught one level up in `tick_all` and logged — the run is left untouched, retried next tick. This mirrors the existing "one bad rule/item must not stop the sweep" convention already used by `automation.run_due()` and the contracts expiry scan, applied one level down.

### `tick_all(*, tenant=None, batch_size=None)`

Runs `reclaim_stale_steps()` (crash recovery, below), then calls `advance_one()` once for every `PipelineRun` in `queued/running/compensating` status, across **all tenants implicitly** — `TenantOwnedModel`'s manager only scopes by tenant when a request-scoped thread-local tenant context exists, which a bare management-command process never has. This is documented existing behavior, not a bug to "fix" later; a regression test locks it in.

### Crash recovery: `reclaim_stale_steps()`

Any `PipelineStepRun` still `RUNNING` past its step's `timeout_seconds` almost certainly means the process executing it crashed or was killed. Reset it to `PENDING` (if retries remain) or drive it into `COMPENSATING` (if exhausted) — no special recovery process, just a check that runs at the top of every tick. This *is* what "the pipeline resumes automatically after a crash" means concretely: nothing was lost, because every step's state lives in the database before and after it runs, not in a process's memory.

### Rollback, as more ticks

A `compensate(ctx)` callback on `StepDefinition` is optional per step. When a run enters `COMPENSATING`, each tick unwinds exactly one prior `SUCCESS` step (in reverse order) by calling its `compensate()`, same claim-then-execute shape as forward execution. A failed compensation is recorded as `COMPENSATION_FAILED` on that step (visible for manual follow-up) but does **not** block unwinding earlier steps — this is a saga, not a database transaction: steps touch storage, search, and other systems that can't share one DB transaction anyway, so "rollback" here means "run each step's own undo," not "revert the database."

### Pause / resume / cancel / retry

All four are just status flips guarded by atomic conditional updates (`filter(status=X).update(status=Y)`), which `advance_one`/`tick_all` naturally honor on the next tick:

- **Pause** is cooperative, not preemptive — a step already executing finishes normally; the *next* step won't start. Step bodies should be short (seconds); long work should be split into more steps rather than relying on mid-step interruption.
- **Cancel** routes through the same `COMPENSATING` unwind as an exhausted-retries failure (just tagged `termination_reason=cancelled` instead of `failed`) — one tested code path for both.
- **Retry** (operator-triggered, on an already-`FAILED` run) re-arms the failed step and any steps after it back to `PENDING`, without re-running already-`COMPENSATED` steps or a full restart from step zero (that's a distinct, out-of-scope action).

---

## 5. Automation's migration — zero breakage to the current frontend

The existing `/automation` dashboard (`apps/web/src/lib/automation.ts`, the rules table, the run detail page) only ever calls the existing `automation/views.py`/`serializers.py`/`urls.py` endpoints. **None of those change.** The migration happens entirely underneath them:

- Automation registers two pipelines from a new `automation/pipelines.py` (called from `AutomationConfig.ready()` — automation's first `ready()` override): `automation.rule_execution.package` (steps: `collect_files` → `store_package`, splitting today's single `_collect_and_package` call into two retryable/observable steps) and `automation.rule_execution.report` (step: `run_report`, wrapping the existing `ReportService().run(...)` call unchanged). Step bodies stay owned by `AutomationService` — `pipelines.py` holds only thin adapter functions, so business logic isn't duplicated across two files.
- `AutomationService.run_rule()` becomes a thin wrapper: start a `PipelineRun` for the right pipeline key (with an idempotency key derived from the rule + its scheduled time, only for scheduled triggers — see § 6), then call a new `run_to_completion(run)` helper that repeatedly calls `advance_one()` until the run reaches a terminal state, then returns. **This is the load-bearing idea of the whole migration**: the same `advance_one()` primitive serves both today's synchronous caller (drained in a loop, indistinguishable from the old blocking behavior to `run_now`'s HTTP caller) and, later, an actual incremental tick loop for longer pipelines — no duplicated execution logic between "sync mode" and "async mode."
- The legacy `AutomationRun` row is built by a new event subscriber (`automation/events/subscribers.py`, mirroring the existing subscriber pattern used elsewhere in the codebase, e.g. `modules/purchase/backend/events/subscribers.py`), listening for the engine's `Events.WORKFLOW_COMPLETED`/`WORKFLOW_CANCELLED` (already-declared, currently-unused constants). It does exactly what `_record_run()` + `_advance_schedule()` do today, reading the finished pipeline's `context` for the file/report/items data. This keeps `platform/workflow` itself with zero knowledge that `AutomationRule`/`AutomationRun` exist — the generic engine stays generic; automation owns the meaning.
- One small, optional, additive change to `automation/models.py`: a nullable `AutomationRun.pipeline_run` FK to `workflow.PipelineRun`, so a future canvas UI can jump from a legacy run to its step-level detail. Not included in `AutomationRunSerializer`, so it's invisible to the current frontend. Easy to drop if a zero-diff `automation/models.py` is preferred.

**Files touched inside automation:** `services.py` (the wrapper + step-callable split), `apps.py` (new `ready()`), plus the two new files above. **Files explicitly not touched:** `registry.py`, `views.py`, `serializers.py`, `urls.py`, `automation_run_due.py`, and everything under `apps/web/src/**/automation*`.

---

## 6. Fixing the double-run race

`automation_run_due` today has zero concurrency guard — two overlapping cron invocations can run the same due rule twice. This is fixed with the `PipelineRun` idempotency key from § 3: `run_rule()` passes `idempotency_key=f"rule:{rule.id}:{rule.next_run_at.isoformat()}"` **only for scheduled triggers** (a manual "Run now" click keeps producing an independent run every time — that's correct, not a bug). The partial unique DB constraint means two racing calls to start the same scheduled run both resolve to the *same* `PipelineRun` row (`get_or_create` semantics); each step's own atomic claim (§ 4) then ensures only one caller actually executes any given step, while the other's `advance_one()` calls harmlessly no-op. This is a strict, DB-enforced fix — not a timing heuristic — and is independent from the stale-lock crash-recovery mechanism, which solves a different problem (a process dying mid-step, not two processes racing to start the same run).

---

## 7. Test plan

Gate (per `CLAUDE.md`): `cd platform && pytest` green, `python -m ruff check .` clean, `python manage.py check` clean.

- **`platform/tests/test_automation.py` runs unmodified.** This is the acceptance test for backward compatibility — if any existing test needs to change, the migration broke its contract.
- **New `test_workflow_registry.py`** — register/get/all round-trip, unknown-key error, idempotent re-registration.
- **New `test_workflow_engine.py`** — the core proof, covering: single-step advance, multi-step completion, retry-respects-backoff, exhausted-retries → compensating → failed, compensation unwinds in reverse order, a failed compensation doesn't block unwinding earlier steps, pause stops tick selection and resume continues it, cancel routes through compensation to cancelled, retry re-arms only the failed step forward, stale-lock reclaim (both the retry-remains and exhausted-attempts branches), concurrent claim contention (exactly one of two racing claims wins), one broken run doesn't stop others from ticking, and a regression test for the implicit cross-tenant scoping in `tick_all` (§ 4).
- **New `test_workflow_api.py`** — pause/resume/cancel/retry endpoints: success paths and `409`/`ConflictError` on invalid-state attempts; permission checks.
- **Additive tests in `test_automation.py`** (new tests, existing ones untouched): a run created via `run_rule()` links to a `PipelineRun`; two concurrent `run_due()` invocations for the same due rule produce exactly one `AutomationRun`/`PipelineRun` (the direct proof for § 6); two manual `run_now` calls correctly produce two independent runs.

---

## 8. File inventory

**New app `platform/workflow/`:** `apps.py`, `models.py`, `registry.py`, `engine.py` (`advance_one`, `_advance_compensation`, `_handle_step_failure`, `_claim_step`, `tick_all`, `reclaim_stale_steps`, `default_backoff`), `services.py` (`PipelineService`: `start`, `run_to_completion`, `request_pause/resume/cancel/retry`, `get_run`), `serializers.py`, `views.py` (`PipelineRunViewSet`, read-only + pause/resume/cancel/retry actions), `urls.py`, `migrations/0001_initial.py`, `management/commands/pipeline_tick.py`.

**New inside `automation/`:** `pipelines.py`, `events/__init__.py` + `events/subscribers.py`, one additive migration for the optional FK.

**Modified:** `config/settings.py` (add `"workflow"` to `PLATFORM_APPS_BEFORE_MODULES`, immediately before `"automation"` since automation's `ready()` will import `workflow.registry`; add `PIPELINE_STEP_STALE_TIMEOUT_SECONDS` [default 600], `PIPELINE_TICK_BATCH_SIZE` [default 50], `PIPELINE_TICK_INTERVAL_SECONDS` [default 3]), `config/urls.py` (mount `workflow.urls`), `permissions/registry.py` (add `workflow.view`, `workflow.control`), `automation/apps.py`, `automation/services.py`.

---

## 9. Out of scope for this plan

Business Period Manager; Invoice generation, Auditor Package, and every other future pipeline (they become later consumers of this same engine, not designed here); the visual pipeline-canvas frontend (the new read API exists so it *can* be built later — no frontend work in this plan); WhatsApp channel abstraction; universal tagging UI improvements; search improvements; "Business Recipes"; filling in `services/worker`/`services/scheduler`; Celery/Redis-as-broker adoption (revisit only if concurrent volume or per-step duration genuinely outgrows one tick process — not preemptively); a human-in-the-loop "approval" step kind; selective retry-from-an-earlier-step or full restart-from-zero; a generic `POST /workflow/pipelines/{key}/start/` endpoint for arbitrary future pipelines (add it when a second real pipeline consumer needs it).
