# Platform · Workflow

The durable **pipeline execution engine**. A pipeline is a sequence of steps
run one at a time, with retries, compensation (saga-style rollback of partial
work), crash recovery, and live pause/resume/cancel — no task queue, no broker,
no extra deployable service. Full rationale:
`docs/superpowers/specs/2026-07-24-pipeline-execution-engine-design.md`.

- **Owns:** step execution, retry/backoff, compensation, crash recovery, the
  run control-plane, and the run/stat/catalog read API.
- **Does not own:** what a step *means*. Step bodies live in the consuming
  module; the engine never imports a business model. `platform/automation` is
  the first, most mature consumer (`automation/pipelines.py`).

## Concepts

- **`PipelineDefinition` / `StepDefinition`** (`registry.py`) — pipelines are
  **code, not database rows**, registered once at import time from a module's
  `AppConfig.ready()`, the same pattern as `reporting.register_report` /
  `automation.register_source`. A step declares `run` (and optional
  `compensate`), `max_attempts`, `backoff`, and `timeout_seconds`.
- **`PipelineRun` / `PipelineStepRun`** (`models.py`) — the persisted state.
  `step_keys` are snapshotted at start so a later registry change can't corrupt
  an in-flight run; `context` accumulates `{step_key: output}` as steps succeed.

## Adopting the engine from a module

```python
# module/pipelines.py — registered from AppConfig.ready()
register_pipeline(PipelineDefinition(
    key="invoices.issue", label="Issue invoice", module="finance",
    permission="finance.invoice.issue", version=1,
    steps=[StepDefinition(key="render", label="Render PDF", run=_render,
                          compensate=_unrender, max_attempts=3)],
))

# start a run (control-plane)
run, created = PipelineService().start(pipeline_key="invoices.issue", tenant=tenant, actor=user)

# react to the outcome — the module owns the meaning (see
# automation/events/subscribers.py for the reference wiring)
subscribe(Events.WORKFLOW_COMPLETED, _on_success)
subscribe(Events.WORKFLOW_FAILED, _on_failure)
```

## Lifecycle

`queued → running → success` on the happy path. A step that exhausts its
retries drives the run into `compensating`, which unwinds every
already-succeeded step in reverse (calling its `compensate`) and lands on
`failed`; a cancel does the same but lands on `cancelled`. A step still
`running` past its timeout is assumed crashed and reclaimed at the top of the
next tick (`reclaim_stale_steps`). `paused` is honored between steps.

## Events

Each terminal state announces itself distinctly, so a subscriber can react to
failure without inspecting `run.status`:

| Event                 | Fires when a run reaches |
| --------------------- | ------------------------ |
| `WORKFLOW_COMPLETED`  | `success` (success only) |
| `WORKFLOW_FAILED`     | `failed`                 |
| `WORKFLOW_CANCELLED`  | `cancelled`              |

## Ticking it forward

`advance_one(run)` executes exactly one step and is safe to call concurrently
(every transition is a single atomic `UPDATE ... WHERE status = <expected>`).
Two callers drive it:

- `python manage.py pipeline_tick [--loop]` — advances every active run once;
  meant for an external cron, or `--loop` for faster-than-cron progress.
- `PipelineService().run_to_completion(run)` — drains one run synchronously in
  the current process (what `automation.run_rule` uses for a blocking result).

## REST API (`/api/v1/workflow/`)

- `GET pipelines/` — the registered-pipeline catalog (definitions + steps).
  `workflow.view`.
- `GET runs/` · `GET runs/{id}/` — run history (tenant-scoped, filterable by
  `pipeline_key`, `status`, `trigger_type`). `workflow.view`.
- `GET runs/stats/` — aggregate counts (total, active, per-status,
  per-pipeline, and "at risk" = active runs past `PIPELINE_RUN_AT_RISK_SECONDS`)
  for the dashboard. `workflow.view`.
- `POST runs/{id}/{pause,resume,cancel,retry}/` — control-plane actions.
  `workflow.control`.

## Settings

`PIPELINE_STEP_STALE_TIMEOUT_SECONDS` (default 600), `PIPELINE_TICK_BATCH_SIZE`
(50), `PIPELINE_TICK_INTERVAL_SECONDS` (3), `PIPELINE_RUN_AT_RISK_SECONDS`
(3600).
