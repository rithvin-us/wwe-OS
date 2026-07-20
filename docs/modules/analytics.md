# Module Intelligence · Analytics

Route `/analytics` · Domain: Insight & decisions · Status: Planned

## 1. Business purpose

Turn activity from every module into KPIs, trends, and answers for decision makers — one analytical layer instead of per-module report silos.

## 2. Problems it solves

- Each department reports numbers its own way
- Cross-module questions ("spend per employee by site") unanswerable
- Executives see lagging monthly decks, not live state
- Metric definitions inconsistent and disputed

## 3. Primary users

Executives, department heads, analysts, module owners.

## 4. Future integrations

Every module (event streams), Reports (packaged outputs), AI Assistant (natural-language queries), warehouse/BI export.

## 5. Database entities

`metric_definition`, `metric_snapshot`, `dimension`, `dashboard`, `dashboard_widget`, `data_source_registration`.

## 6. APIs

- `GET /api/analytics/metrics` · `GET /api/analytics/metrics/{key}/series`
- `GET/POST /api/analytics/dashboards` · `POST /api/analytics/query`

## 7. Dashboard widgets

Widget library itself: KPI tile, time series, breakdown bar, table — all built on `@bop/charts` and reused by every module dashboard.

## 8. KPIs

(Meta) Metric coverage per module · Dashboard adoption · Query latency · Definition disputes resolved.

## 9. Permissions

`analytics.view` (scope-filtered by module permissions), `analytics.dashboard.manage`, `analytics.definitions.manage`, `analytics.admin`.

## 10. Navigation structure

Overview · Dashboards · Metrics catalog · Explore.

## 11. Relationships with other modules

Read-only consumer of module events and snapshots; single metric catalog other modules register into; visual layer for Reports and data source for the AI Assistant. Results always respect the viewer's module permissions.

## 12. AI opportunities

Natural-language to query ("show leave trend by department") · Automated insight narration on dashboards · Metric anomaly alerts.
