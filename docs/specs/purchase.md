# Purchase Module

**Status: bill ingestion, review, vendor directory, and payment tracking
built and tested (Stage 2).** A full vendor management module (contacts,
qualification, performance — `docs/modules/vendors.md`) and purchase orders
(as distinct from bills) remain not built — genuinely new, undesigned
subsystems, not extensions of what's here. This supersedes nothing in
`docs/modules/purchase.md` (business blueprint) or
`docs/modules/purchase-integration-requirements.md` (the original contract) —
it documents what actually exists now, technically, against that contract.
See `_shared-conventions.md` for platform-wide patterns.

## 1. Functional requirements

- Receive a purchase bill from an ingestion channel (built: Telegram).
- Queue it for human review (built: `status=pending_review`).
- Let the operator confirm (optionally attaching/creating a vendor) or reject
  (with a reason) a bill (built).
- Maintain a vendor directory — add, rename, deactivate, record a GST number
  (built: thin CRUD, not the future vendors.md module — see § 20).
- Track whether a confirmed bill has been paid (built: `mark-paid`).
- Purchase orders (as distinct from bills) are **not built** — see § 20.

## 2. Non-functional requirements

- A bill is never lost between "OCR extracted it" and "operator saw it" —
  ingestion always creates a durable record before responding to the channel
  (built: `PurchaseBillService.ingest()` creates then notifies, in that
  order).
- Reviewing a bill is a one-way transition — a confirmed or rejected bill
  cannot be re-reviewed (built: `ConflictError` on re-review attempts).

## 3. Database schema (built)

```
purchase_vendor
  id UUID PK · tenant_id FK · name · is_active · gst_number · created_at ·
  updated_at · is_deleted · deleted_at
  unique(tenant_id, name)

purchase_bill
  id UUID PK · tenant_id FK · vendor_id FK NULL ·
  seller_name · purchase_date · total_rate DECIMAL(12,2) · currency CHAR(3) ·
  document_url · telegram_user_id BIGINT NULL ·
  source_channel [telegram|email|upload] · raw_extraction JSONB ·
  status [pending_review|confirmed|rejected] ·
  reviewed_by_id FK NULL · reviewed_at NULL · rejection_reason ·
  payment_status [unpaid|paid] · paid_at NULL ·
  created_at · updated_at · is_deleted · deleted_at
  index(tenant_id, status) · index(tenant_id, payment_status)
```

## 4. Entity relationships

```
Tenant 1──* Vendor
Tenant 1──* PurchaseBill
Vendor 0..1──* PurchaseBill   (set on confirm, not at ingest)
User (reviewer) 0..1──* PurchaseBill
```

## 5. Folder structure (built)

```
modules/purchase/backend/
  apps.py            App config; syncs this module's permissions on migrate.
  models/            vendor.py, purchase_bill.py
  repositories/       purchase_bill.py
  serializers/       purchase_bill.py (Ingest/Vendor/Read/Confirm/Reject)
  services/          purchase_bill.py (ingest/confirm/reject/mark_paid business rules)
  api/               views.py (bills + vendors viewsets), urls.py
  events/            registry.py, subscribers.py (→ audit)
  permissions/       registry.py (purchase.bill.read/review, purchase.vendor.manage)
  tests/             conftest.py, test_ingest.py, test_review.py, test_vendors.py
  migrations/        0001_initial.py, 0002_purchasebill_paid_at_purchasebill_payment_status_and_more.py
```

## 6. Backend architecture

Layered exactly per the platform convention: `api/views.py` (thin) →
`services/purchase_bill.py` (rules: tenant resolution, status transitions,
notification) → `repositories/purchase_bill.py` (thin wrapper over the
model's manager, which already enforces tenant scoping and soft delete) →
`models/`. Two authentication paths converge on the same service layer:
`IngestBillView` (service token) and `PurchaseBillViewSet` (JWT) both call
into `PurchaseBillService`.

## 7. Frontend architecture

Built: the real review queue (`apps/web/src/app/(platform)/purchase/`) — a
`DataTable`-backed bills list with confirm (immediate) and reject (reason
required, Popover) actions, a payment column with a "Mark paid" action once
confirmed, and a vendor directory panel (add/edit via a React Hook Form +
Zod dialog, deactivate in place). All mutations are Server Actions
(`purchase/actions.ts`) calling Django through the BFF, `revalidatePath`
after each one.

## 8. API design (built)

| Method | Path                                     | Auth          | Permission               |
| ------ | ---------------------------------------- | ------------- | ------------------------ |
| POST   | `/api/v1/purchase/bills/ingest/`         | Service token | — (channel-level)        |
| GET    | `/api/v1/purchase/bills/`                | JWT           | `purchase.bill.read`     |
| GET    | `/api/v1/purchase/bills/{id}/`           | JWT           | `purchase.bill.read`     |
| GET    | `/api/v1/purchase/bills/stats/`          | JWT           | `purchase.bill.read`     |
| GET    | `/api/v1/purchase/bills/recent/`         | JWT           | `purchase.bill.read`     |
| POST   | `/api/v1/purchase/bills/{id}/confirm/`   | JWT           | `purchase.bill.review`   |
| POST   | `/api/v1/purchase/bills/{id}/reject/`    | JWT           | `purchase.bill.review`   |
| POST   | `/api/v1/purchase/bills/{id}/mark-paid/` | JWT           | `purchase.bill.review`   |
| GET    | `/api/v1/purchase/vendors/`              | JWT           | `purchase.vendor.manage` |
| POST   | `/api/v1/purchase/vendors/`              | JWT           | `purchase.vendor.manage` |
| PATCH  | `/api/v1/purchase/vendors/{id}/`         | JWT           | `purchase.vendor.manage` |

`stats` also returns `unpaid_confirmed` and `overdue_pending` (pending review
older than 3 days) — the numbers behind the dashboard's operational alerts.
`recent` returns the last 8 bills with a review decision, newest first, for
the dashboard's activity feed. Vendors are never hard-deleted — deactivate
via `PATCH {"is_active": false}`; `DELETE` is not a supported method.

Ingest payload matches `purchase-integration-requirements.md` exactly:
`seller_name, purchase_date, total_rate, currency, telegram_user_id,
document_url` (+ optional `source_channel`, `raw_extraction`).

## 9. Validation rules (built)

See `document-ingestion.md` § 9 for ingest-side rules. Review side: `reject`
requires a non-blank `reason`; both actions 409 if the bill isn't
`pending_review`.

## 10. Business logic (built)

`_resolve_ingest_tenant()` — single-operator mode has exactly one tenant,
resolved automatically; 0 or >1 tenants is a `ConflictError` (a real,
documented gap — see § 20). `confirm()` optionally creates/links a `Vendor`
by name match (no fuzzy matching — exact name only, a future improvement).
`mark_paid()` requires `status=confirmed` and rejects an already-paid bill
with `ConflictError` — payment is a one-way transition, same discipline as
review. Vendor creation via the CRUD API converts a `UniqueConstraint`
violation (duplicate name per tenant) into a `ConflictError` (409), not a
raw 500.

## 11. Background jobs

None. Everything is synchronous request/response today.

## 12. Event flow (built)

`purchase.bill.ingested` / `.confirmed` / `.rejected` / `.paid` — published
by the service, subscribed by the module's own `events/subscribers.py` to
write audit records via `platform/audit`. `ingested` also (best-effort)
creates an in-app `Notification` for whoever holds the Owner role.

## 13. Queue design

Not needed yet — see § 11.

## 14–17. Error handling, security, testing, deployment

Follow `_shared-conventions.md`. Built test coverage: 27 tests across ingest
(auth rejection, validation, tenant-not-configured, notification), review
(list, confirm+vendor-link, reject+reason-required, re-review conflict,
permission denial, audit trail, mark-paid transitions, recent-activity
ordering), and vendors (CRUD, permission denial, duplicate-name conflict,
delete-not-allowed) — `modules/purchase/backend/tests/`.

## 18. Mobile integration

Not built. The native app should surface the review queue (list, confirm,
reject) as a first-class screen — reviewing bills is exactly the kind of
short, frequent task a phone suits better than a desktop.

## 19. Dashboard integration

Built. `apps/web/src/config/dashboard.ts`'s `procurementSummary()` (bills
pending review / confirmed / rejected), `pendingApprovals()`, `buildKpis()`
(pending-approvals, bills-to-review), `operationalAlerts()` (overdue pending
review, confirmed-but-unpaid), and `recentActivity()` (confirm/reject/paid
events) are all live functions fed by `/bills/stats/` and `/bills/recent/` —
no static placeholder data remains for anything Purchase can supply.

## 20. Future scalability

- **Vendors module proper**: today's `Vendor` has name, active flag, and a
  GST number — a directory, not the full module. A real vendor management
  system (contacts, qualification, performance, document expiry — see
  `docs/modules/vendors.md`, currently removed from the single-operator app
  list) extends, not replaces, this model; it's a separate app with its own
  route and permission set, deliberately not built alongside this pass.
- **Multi-tenant ingestion**: `_resolve_ingest_tenant()` explicitly refuses
  to guess when more than one tenant exists. Needed before any multi-company
  deployment: either per-tenant bot tokens or a tenant identifier in the
  ingest payload.
- **Purchase orders** (as distinct from bills): genuinely new schema and
  business logic — a create → approve → match-against-incoming-bill workflow
  — not yet designed. A candidate for the next Purchase iteration, not
  something to bolt onto the bill/vendor model. GST number (on the vendor)
  and payment tracking (on the bill) are built — see § 3, § 8.
- **Vendor auto-matching**: today's exact-name match will misfire on minor
  spelling variance from OCR; fuzzy matching or an operator-confirmed alias
  table is the natural fix.
