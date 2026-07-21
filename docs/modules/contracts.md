# Module Intelligence · Contracts

Route `/contracts` · Domain: Documents & records · Status: **Built (v1) — 2026-07-21**

## 1. Business purpose

Manage contract lifecycle — drafting, approval, renewal, expiry — so no agreement lapses unnoticed.

## Built (v1) — shipped surface

Live end to end; another module that reuses every platform service and
reimplements none. Backend: `modules/contracts/backend` (16 tests). Frontend:
`apps/web/src/app/(platform)/contracts` (list + detail + create, build-verified).

- **Entity**: one `Contract` (UUID, tenant-scoped, soft-delete). Fields: title,
  `counterparty` (free text — there is no Vendors module and modules never
  import one another), category, status (draft→in_review→active→expired /
  terminated), value + currency, start/end dates, `auto_renew`,
  `renewal_notice_days`, notes, optional signed `file` (platform storage),
  ai_summary, owner, approval link.
- **Storage** (platform): the signed document is attached/replaced via
  `StorageService`; old files are cleaned up on replace.
- **AI** (platform): `AIService.generate` summarizes from the attached text or
  the contract metadata (`contracts-summary` prompt).
- **Workflow** (platform): "submit" starts a `contract-approval` instance;
  completion activates the contract, rejection returns it to draft — the module
  reacts to `workflow.completed`/`rejected`.
- **Renewal / expiry**: `contracts_expiry_scan` management command (pull-based,
  no worker introduced) expires past-due contracts and notifies owners of ones
  inside their renewal-notice window. Surfaced read-only at `…/expiring/` and on
  the detail page.
- **Search / Reporting / Notifications / Audit** (platform): indexed via a
  `SearchAdapter`; register exported via `ReportService`; owners notified via
  `NotificationService`; all lifecycle events audited.
- **API**: `GET/POST …/contracts/`, `{id}/` (GET/PATCH/DELETE), actions
  `attach`, `summarize`, `submit`, `terminate`, `download`, `expiring`, `stats`,
  `export`.
- **Permissions**: `contracts.read` / `.write` / `.approve` / `.manage`.

**Not in v1** (roadmap below): contract versions, obligation/deliverable
tracking, clause library, e-signature integration, party/vendor records as their
own entities.

## 2. Problems it solves

- Contracts expire silently; renewals missed
- Signed versions scattered; "final_v3_REAL" chaos
- Obligations (payments, deliverables) untracked after signature
- No approval trail for terms

## 3. Primary users

Legal/admin officers, budget owners, procurement (vendor contracts), HR (employment agreements), executives (visibility).

## 4. Future integrations

DMS (documents and versions), Vendors (counterparties), Workflow (approval), Notifications (renewal alerts), Finance (payment obligations), OCR (legacy contract capture).

## 5. Database entities

`contract`, `contract_party`, `contract_type`, `contract_version_link` (→ DMS), `obligation`, `renewal_alert_rule`, `signature_record`.

## 6. APIs

- `GET/POST /api/contracts` · `GET/PATCH /api/contracts/{id}`
- `POST /api/contracts/{id}/submit-approval` · `POST /api/contracts/{id}/renew`
- `GET /api/contracts/expiring?days=90` · `GET/POST /api/contracts/{id}/obligations`

## 7. Dashboard widgets

Expiring in 30/60/90 days · Awaiting approval · Obligations due this month · Contracts by type and counterparty.

## 8. KPIs

Renewal decisions made before expiry (%) · Approval cycle time · Obligation on-time rate · Contracts with complete metadata (%).

## 9. Permissions

`contracts.read` (type-scoped), `contracts.manage`, `contracts.approve`, `contracts.admin`.

## 10. Navigation structure

Overview · All contracts · Approvals · Obligations · Expiry calendar.

## 11. Relationships with other modules

Documents live in DMS; counterparties come from Vendors (or HR for employment); approvals run on Workflow; obligation payments surface in Finance.

## 12. AI opportunities

Clause extraction and metadata pre-fill from uploaded contracts · Deviation detection against standard templates · Plain-language contract summaries · Renewal recommendation from usage and spend.
