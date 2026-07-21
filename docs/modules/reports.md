# Module Intelligence · Reports

Route `/reports` · Domain: Insight & decisions · Status: **Built (v1) — 2026-07-21**

## 1. Business purpose

One place to run ready-made reports across the company and download them on demand.

## Built (v1) — shipped surface

Reports is a **thin surface over the platform reporting engine**, not a
data-owning module — so it adds no `modules/reports/backend`. Instead it uses a
**report registry** in `platform/reporting` (the same pattern as the search
adapter registry): each data-owning module registers a `ReportDefinition` from
its `AppConfig.ready()`, and a catalog/run API + the `/reports` UI consume it.
No module imports another; the platform never imports a module. Backend: 7 tests
in `platform/tests/test_reports_catalog.py`. Frontend:
`apps/web/src/app/(platform)/reports` (build-verified).

- **Registry** (`platform/reporting/registry.py`): `ReportDefinition(key, label,
module, permission, build_spec(tenant) -> ReportSpec)`. Registered so far:
  Document register, Contract register, Stock on hand, Asset register.
- **Catalog** — `GET /api/v1/reporting/catalog/` lists the reports whose
  permission the caller holds (a user who can only read inventory sees only the
  stock report).
- **Run** — `POST /api/v1/reporting/run/ {key, format}` builds the spec through
  the owning module's callable, renders CSV/XLSX/PDF/HTML via `ReportService`,
  stores it (as any export), and returns a signed download URL. Running requires
  `reporting.export` **and** the report's own module permission.
- **History** — every run is a `ReportExport` row, listed on the page from
  `/api/v1/reporting/exports/`.
- **Download** — a generic `/api/storage/download` BFF proxy forwards the signed
  storage token to the backend so the browser can fetch the file.
- **Permissions**: `reporting.view` (see the catalog + history) / `reporting.export`
  (run), plus each report's module permission.

**Adding a report**: a module registers a `ReportDefinition` in its `ready()`
(see `modules/*/backend/reports.py`) — it appears in the catalog automatically.

**Not in v1** (roadmap below): scheduled/emailed reports (the engine's
`export()` is ready for a future scheduler to call), custom report builder,
parameterized filters in the run UI, charts in rendered reports.

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
