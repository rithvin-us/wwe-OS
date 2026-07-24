# Pipeline Runner (Subsystem 7) — Coverage Confirmation

**Status:** Confirmed satisfied by Subsystem 1 (`platform/workflow`) — no new implementation.

## Why this is a confirmation, not a build

The roadmap's Subsystem 7 ("Pipeline Runner — Replace the current automation engine... deterministic business pipelines... sequential execution, retries, pause, resume, cancel, rollback, execution history, logs, progress tracking, crash recovery, visual execution states") describes, feature-for-feature, what `platform/workflow` already is. It was built as Subsystem 1, before this roadmap's remaining subsystems were approved, specifically as the shared foundation "future pipelines (invoices, auditor packages, …) will run on" (`docs/superpowers/specs/2026-07-24-pipeline-execution-engine-design.md` §1). Building a second pipeline runner now would violate "no duplicated services" against a capability that's tested and already has a production consumer (`automation`).

## Requirement-by-requirement

| Roadmap requirement     | Where it lives                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Sequential execution    | `workflow.engine.advance_one` — one step at a time, `current_step_index`                                                                |
| Retries                 | `StepDefinition.max_attempts`/`.backoff`, `_handle_step_failure`                                                                        |
| Pause                   | `PipelineRunStatus.PAUSED`, cooperative — `advance_one` no-ops                                                                          |
| Resume                  | `PipelineService.request_resume`                                                                                                        |
| Cancel                  | `PipelineService.request_cancel` → routes through compensation                                                                          |
| Rollback                | `_advance_compensation` — per-step `compensate()` callbacks, reverse order, a failed compensation doesn't block unwinding earlier steps |
| Execution history       | `PipelineRun`/`PipelineStepRun` rows — one row per run, one per step per run, all timestamped                                           |
| Logs                    | `PipelineStepRun.output` (JSON) + `.error_message` per step, `PipelineRun.error_message` for the run                                    |
| Progress tracking       | `PipelineRun.current_step_index`, `status`                                                                                              |
| Crash recovery          | `reclaim_stale_steps()` — stale-lock reclaim, no special recovery process                                                               |
| Visual execution states | **Not built** — this is a UI concern, Subsystem 10 (Business Operations Dashboard)                                                      |

## What "replace the current automation engine" meant, concretely

`platform/automation` was not deleted or rewritten from scratch — its rule/run _data model_ and REST API are untouched (`docs/superpowers/specs/2026-07-24-pipeline-execution-engine-design.md` §5: "zero breakage to the current frontend"). What changed is what runs underneath: `AutomationService.run_rule()` starts a real `PipelineRun` and drains it via `advance_one()`, instead of one synchronous function call with no in-flight state. That is the replacement — automation is now workflow's first, most mature consumer, exactly as designed. `apps/web/src/**/automation*` was never touched.

## Remaining gap

"Visual execution states" — an n8n/Temporal/GitHub-Actions-inspired execution monitor — has a read API already available (`GET /api/v1/workflow/runs/`, pause/resume/cancel/retry actions) for a frontend to build against, but no frontend exists yet. That's explicitly Subsystem 10's scope, not this one's.
