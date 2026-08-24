# Module Intelligence · Workflow Engine

Route `/workflow` · Domain: Automation · Status: In development (platform capability with a management UI)

## 1. Business purpose

Let modules declare workflows — states, transitions, approver chains, SLAs, escalation — and execute them uniformly, so no module ever hand-rolls approvals.

## 2. Problems it solves

- Each process implements its own approval logic
- No SLA or escalation anywhere
- Process changes require code changes
- No audit of who approved what, under which policy version

## 3. Primary users

Platform admins and process owners (design), all modules (runtime consumers), auditors (history).

## 4. Future integrations

Every business module · Approvals inbox · Notifications · Audit · Telegram/Email actions.

## 5. Database entities

`workflow_definition`, `workflow_version`, `workflow_instance`, `workflow_task`, `transition_log`, `sla_timer`, `escalation_rule`.

## 6. APIs

The enterprise, approval-shaped surface (design target):

- `GET/POST /api/workflow/definitions` · `POST /api/workflow/definitions/{id}/publish`
- `POST /api/workflow/instances` (module-invoked) · `POST /api/workflow/tasks/{id}/complete`
- `GET /api/workflow/instances/{id}/history`

**Built today** — the platform runs on the durable *pipeline* engine
(`platform/workflow`, saga-style steps + retries + compensation, not approval
chains). Its live REST surface under `/api/v1/workflow/`:

- `GET pipelines/` — registered pipeline catalog (definitions + steps).
- `GET runs/` · `GET runs/{id}/` — run history (filter by `pipeline_key`, `status`, `trigger_type`).
- `GET runs/stats/` — aggregate counts (total, active, per-status, per-pipeline, "at risk") for the dashboard.
- `POST runs/{id}/{pause,resume,cancel,retry}/` — control-plane actions.

Permissions: `workflow.view` (read/catalog/stats), `workflow.control` (the
actions). See `platform/workflow/README.md`.

## 7. Dashboard widgets

Active instances by definition · SLA at risk · Escalations this week · Definition versions in draft.

## 8. KPIs

Instance throughput · SLA compliance · Average steps per decision · Escalation rate.

## 9. Permissions

`workflow.definition.manage`, `workflow.definition.publish`, `workflow.instance.read` (module-scoped), `workflow.admin`.

## 10. Navigation structure

Overview · Definitions · Instances · SLAs & escalation.

## 11. Relationships with other modules

The engine is platform code (`platform/workflow`); this module is its management and observability UI. Business modules declare definitions; Approvals renders its tasks; Notifications and Audit consume its events.

## 12. AI opportunities

Draft workflow definitions from a process description · Bottleneck detection and redesign suggestions · SLA breach prediction.
