# Module Intelligence · Assets

Route `/assets` · Domain: Operations · Status: **Built (v1) — 2026-07-21**

## 1. Business purpose

Register company equipment, track who holds it and its servicing, and record its disposal.

## Built (v1) — shipped surface

Live end to end. Backend: `modules/assets/backend` (12 tests). Frontend:
`apps/web/src/app/(platform)/assets` (register + detail with maintenance log + Delivery Challan generator, build-verified).

- **Delivery Challan (DC) Engine**: Microsoft Word `.docx` template rendering (`dc_template.docx` / `DC 26.docx`) into client-ready PDFs.
  - **Free-Text Products & Items**: Arbitrary line item descriptions without rigid inventory lookups.
  - **Custom Measurement Units (UOM)**: Accepts arbitrary units (`2 Kg`, `5 Litre`, `1 Lot`, `10 Nos`, `3 Mtr`, `12 Pcs`).
  - **Deliver To Address**: Free-text delivery address field.
  - **Tamper-Proof Verification Hash**: Generates a SHA-256 hash (`verification_hash`) for every PDF document.
  - **DC REST APIs**: Supports creation (`POST /api/v1/assets/dcs/`), deletion (`DELETE /api/v1/assets/dcs/{id}/`), and PDF download (`/api/assets/dcs/{id}/download/`).
  - **Analytics Banner**: `DCAnalytics` header displays total DC count, Returnable vs. Non-Returnable metrics, monthly output, and visual ratio bar.
- **Entities**: `Asset` (UUID, tenant-scoped, soft-delete; asset tag unique per
  tenant; category, purchase cost/date, supplier & assignee as free text,
  optional warranty/invoice file), `DeliveryChallan`, and a `MaintenanceRecord` log.
- **Lifecycle state machine**: in stock → assigned → (return) → in stock; in
  stock/assigned → in maintenance → (complete, logs a record) → in stock; any
  active state → disposed (terminal). Every transition validates the current
  state so an asset can't be assigned while in maintenance or edited once
  disposed.
- **Storage** (platform): warranty/invoice attached/replaced via `StorageService`.
- **Search / Reporting / Notifications / Audit** (platform): assets indexed via a
  `SearchAdapter` (disposed ones drop out); asset-register export through
  `ReportService`; owners notified on disposal; every transition audited.
- **API**: `GET/POST …/assets/`, `{id}/` (GET/PATCH/DELETE), actions `assign`,
  `return`, `maintenance/start`, `maintenance/complete`, `dispose`, `attach`,
  `maintenance` (log), `download`, `stats`, `export`.
- **Permissions**: `assets.read` / `.write` / `.manage` (dispose + delete are
  manage-gated).

**Platform services deliberately not used in v1**: **AI** (no genuine language
task) and the **workflow engine** — disposal is a manage-gated direct action;
in a multi-user setup a high-value-asset disposal approval is exactly where the
workflow engine would slot in, but a single operator approving their own
disposal adds no control. The module reuses only what it needs.

**Not in v1** (roadmap below): depreciation schedules, assignment to platform
User/Employee records (assignee is free text — there is no Employees module),
barcode/QR tagging, warranty-expiry reminders, audit/stock-take workflows.

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
