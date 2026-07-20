# Module Intelligence · Reports

Route `/reports` · Domain: Insight & decisions · Status: Planned

## 1. Business purpose

Define reports once — content, format, audience, schedule — then generate on demand or automatically and deliver where people work.

## 2. Problems it solves

- Monthly reports rebuilt by hand from exports
- No standard formats; every author reinvents layout
- Reports mailed ad hoc with no history of what was sent
- Scheduled reporting depends on someone remembering

## 3. Primary users

Analysts and module owners (authors), managers and executives (recipients), compliance (statutory reports).

## 4. Future integrations

Analytics (data), Email (delivery), DMS (archival), Scheduler service (timing), Telegram (delivery notifications).

## 5. Database entities

`report_definition`, `report_parameter`, `report_run`, `report_output_link` (→ DMS), `report_schedule`, `distribution_list`.

## 6. APIs

- `GET/POST /api/reports/definitions` · `POST /api/reports/definitions/{id}/run`
- `GET /api/reports/runs/{id}` · `GET /api/reports/runs/{id}/download`
- `GET/POST /api/reports/schedules`

## 7. Dashboard widgets

Recent runs and their status · Scheduled reports next 7 days · Failed runs · Most-used reports.

## 8. KPIs

On-schedule delivery rate · Run failure rate · Generation time · Consumption (opens/downloads).

## 9. Permissions

`reports.run` (definition-scoped), `reports.author`, `reports.schedule.manage`, `reports.admin`.

## 10. Navigation structure

Overview · Library · Runs · Schedules.

## 11. Relationships with other modules

Pulls data through Analytics (never raw module tables); outputs archived in DMS; delivered via Email service; timed by the Scheduler service.

## 12. AI opportunities

Narrative summaries attached to generated reports · Layout drafting from a description · Anomaly callouts inside recurring reports.
