# Module Intelligence · Assets

Route `/assets` · Domain: Documents & records · Status: Planned

## 1. Business purpose

Register company assets, assign them to people and places, and track condition, custody, and lifecycle from acquisition to disposal.

## 2. Problems it solves

- Nobody knows what equipment exists or who holds it
- Leavers walk out with unreturned assets
- Warranty and service dates missed
- Disposal decisions without asset history

## 3. Primary users

Admin/asset officers, IT (equipment), department managers, finance (depreciation), auditors.

## 4. Future integrations

Inventory (acquisition source), HR (custodians, offboarding checks), Maintenance (service history), Finance (depreciation), DMS (purchase and warranty documents), Notifications (return/warranty alerts).

## 5. Database entities

`asset`, `asset_category`, `asset_assignment`, `asset_location_history`, `warranty`, `depreciation_profile`, `disposal_record`, `condition_check`.

## 6. APIs

- `GET/POST /api/assets` · `GET/PATCH /api/assets/{id}`
- `POST /api/assets/{id}/assign` · `POST /api/assets/{id}/return`
- `POST /api/assets/{id}/dispose` · `GET /api/assets/by-custodian/{employee_id}`

## 7. Dashboard widgets

Assets by category and status · Unassigned pool · Warranties expiring · Assets held by departing employees · Recent assignments.

## 8. KPIs

Register completeness (%) · Return rate on offboarding · Average asset downtime · Utilization of pool assets.

## 9. Permissions

`assets.read`, `assets.manage`, `assets.assign`, `assets.dispose.approve`, `assets.admin`.

## 10. Navigation structure

Overview · Register · Assignments · Warranties · Disposals.

## 11. Relationships with other modules

Custodians resolve to HR employees; service events come from Maintenance; acquisition from Purchase/Inventory; depreciation feeds Finance; offboarding checks block HR exit until assets return.

## 12. AI opportunities

Asset recognition from photos on intake · Predictive replacement from maintenance history · Auto-matching invoices to registered assets.
