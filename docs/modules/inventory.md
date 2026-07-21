# Module Intelligence · Inventory

Route `/inventory` · Domain: Operations · Status: **Built (v1) — 2026-07-21**

## 1. Business purpose

Know what the company holds and how it moves — item master, stock levels, and an append-only movement ledger.

## Built (v1) — shipped surface

Live end to end. Backend: `modules/inventory/backend` (17 tests). Frontend:
`apps/web/src/app/(platform)/inventory` (items list + item detail with ledger +
receive/issue/adjust, build-verified).

- **Entities**: `InventoryItem` (UUID, tenant-scoped, soft-delete; SKU unique per
  tenant; on-hand quantity, reorder level, unit cost, supplier as free text) and
  an append-only `StockMovement` ledger (receipt / issue / adjustment, signed
  delta, balance-after, actor).
- **Ledger integrity**: on-hand and its ledger row change together **atomically
  under a `select_for_update` row lock** — concurrent receipts/issues can't
  corrupt the balance; stock can never go negative.
- **Low-stock alerts**: crossing the reorder level notifies the operator via
  `NotificationService` and emits `inventory.low_stock`.
- **Search / Reporting / Audit** (platform): items indexed via a `SearchAdapter`;
  stock-on-hand report exported through `ReportService`; every movement + item
  change on the audit trail.
- **API**: `GET/POST …/items/`, `{id}/` (GET/PATCH/DELETE), actions `receive`,
  `issue`, `adjust`, `movements`, `low-stock`, `stats`, `export`.
- **Permissions**: `inventory.read` / `.write` / `.manage`.

**Platform services deliberately not used in v1** (and why — no contrived
integration): **storage** (items carry no files), **AI** (no genuine language
task), **workflow** (single-operator stock ops need no approval routing; a
future write-off approval is where it would slot in). The module reuses exactly
the services it needs and reimplements none.

**Not in v1** (roadmap below): multi-location transfers, batch/lot & expiry,
barcode scanning, valuation methods (FIFO/weighted average), purchase-order
linkage.

## 2. Problems it solves

- Stock counts known only at annual inventory
- Goods received but never recorded; shrinkage invisible
- Reordering by guesswork instead of levels
- No trace of who moved what, where, when

## 3. Primary users

Storekeepers (daily movements), procurement (reorder), finance (valuation), auditors (counts).

## 4. Future integrations

Purchase Orders (receipts), Assets (capitalizable items), Vendors (supply), Reports (valuation), Maintenance (spare parts), Workflow (adjustment approvals).

## 5. Database entities

`item`, `item_category`, `unit_of_measure`, `location`, `stock_level`, `stock_movement`, `stock_adjustment`, `count_session`, `count_line`, `reorder_rule`.

## 6. APIs

- `GET/POST /api/inventory/items` · `GET /api/inventory/stock?location=`
- `POST /api/inventory/movements` · `POST /api/inventory/adjustments`
- `GET/POST /api/inventory/counts` · `GET /api/inventory/reorder-alerts`

## 7. Dashboard widgets

Items below reorder point · Movements today · Open count sessions · Stock value by category · Dead stock (no movement 180 days).

## 8. KPIs

Inventory accuracy (count vs system) · Stock-out incidents · Inventory turnover · Shrinkage rate.

## 9. Permissions

`inventory.item.manage`, `inventory.movement.record`, `inventory.adjustment.approve`, `inventory.count.run`, `inventory.admin`.

## 10. Navigation structure

Overview · Items · Stock · Movements · Counts · Locations · Reorder rules.

## 11. Relationships with other modules

Receives goods from Purchase receipts; hands capitalizable items to Assets; supplies parts consumption to Maintenance; valuations flow to Finance and Analytics.

## 12. AI opportunities

Demand forecasting for reorder points · Anomaly detection on movements · Natural-language stock queries ("how many laptops in main store?").
