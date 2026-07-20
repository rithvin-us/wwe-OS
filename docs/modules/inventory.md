# Module Intelligence · Inventory

Route `/inventory` · Domain: Operations · Status: Planned

## 1. Business purpose

Know what the company holds, where it is, and how it moves — item master, stock levels, movements, and locations across every site.

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
