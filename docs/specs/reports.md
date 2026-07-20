# Reports Module

**Status: not built.** `modules/reports/` is an empty scaffold. See
`docs/modules/reports.md` for the business blueprint.

## 1. Functional requirements

- Define a report once (query + layout + parameters), run it on demand or on
  a schedule.
- Export to PDF and Excel.
- Deliver scheduled reports by email (once `services/email-service` exists).

## 2. Non-functional requirements

- Report generation must not block the request/response cycle for anything
  beyond trivial queries — background execution from day one (see § 13).
- Exports must be byte-identical given identical input data — no
  timestamp/randomness leaking into the file unless explicitly a parameter.

## 3. Database schema (planned)

```
report_definition   id, tenant_id, name, query_spec JSONB, layout_spec JSONB
report_parameter    definition_id, name, type, required
report_run          id, definition_id, status, requested_by, started_at, finished_at
report_output       run_id, format [pdf|xlsx], storage_key   -- via platform/storage
report_schedule     definition_id, cron_expression, recipients JSONB
```

## 4. Entity relationships

```
ReportDefinition 1──* ReportParameter
ReportDefinition 1──* ReportRun 1──* ReportOutput
ReportDefinition 1──* ReportSchedule
```

## 5. Folder structure (target)

```
modules/reports/backend/
  models/        definition.py, run.py, schedule.py
  services/      report_service.py (run), export/ (pdf.py, xlsx.py)
  tasks/         run_report.py (queued execution)
  api/           views.py, urls.py
  tests/
```

## 6. Backend architecture

`query_spec` should compile to Analytics module queries (`docs/modules/
analytics.md`), not raw SQL per report — Reports is a presentation/scheduling
layer over Analytics' metric catalog, never a second place business metrics
get defined. This is the same "don't duplicate a capability" rule applied
across two future modules, worth stating now before both exist.

## 7. Frontend architecture

A library view (cards or table of saved report definitions) + a run history
per definition. Export/download uses the browser's native download, no
custom viewer needed for v1.

## 8. API design (planned)

```
GET/POST  /api/v1/reports/definitions/
POST      /api/v1/reports/definitions/{id}/run/
GET       /api/v1/reports/runs/{id}/
GET       /api/v1/reports/runs/{id}/download/?format=pdf|xlsx
GET/POST  /api/v1/reports/schedules/
```

## 9. Validation rules

- A schedule's cron expression is validated at save time (reject unparsable
  or sub-minute schedules).
- Report parameters are typed and validated against `report_parameter`
  before a run is queued — no silent coercion.

## 10. Business logic

A run is queued, not executed inline, even for "instant" reports — keeps the
API contract identical whether a report takes 200ms or 20s, and means
scheduled and on-demand runs share one code path.

## 11. Background jobs

The primary background job in this module: `run_report(run_id)`, executed by
`services/worker`. Scheduling is driven by `services/scheduler` (both
scaffolded, unimplemented) enqueuing `run_report` at each cron tick.

## 12. Event flow

`report.run.completed` / `.failed` — triggers a notification to whoever
requested it (on-demand) or the schedule's recipients (scheduled).

## 13. Queue design

Redis-backed task queue (Celery or RQ), same infrastructure DMS's indexing
job needs (`docs/specs/document-management.md` § 13) — first two real
consumers, worth building the queue infrastructure once and sharing it, not
standing up two separate queues.

## 14–17. Error handling, security, testing, deployment

Follow `_shared-conventions.md`. A failed run must be inspectable (its error
recorded on `report_run`, not just logged and lost) — operators need to know
why their scheduled report didn't arrive.

## 18. Mobile integration

View run history and download completed exports; defining new reports is a
desktop task (query/layout authoring doesn't suit a phone).

## 19. Dashboard integration

The Executive Dashboard's `FINANCIAL_SUMMARY` and other summary panels are
themselves small, hardcoded "reports" today (`apps/web/src/config/
dashboard.ts`). Once Reports exists, evaluate whether dashboard panels should
become thin views over saved report definitions instead of separately
maintained queries — avoids the two ever drifting apart.

## 20. Future scalability

Report definitions could eventually be user-authored (a query builder UI)
rather than developer-defined — out of scope for v1, which ships with a
fixed set of built-in report definitions per module.
