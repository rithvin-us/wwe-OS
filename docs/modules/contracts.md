# Module Intelligence · Contracts

Route `/contracts` · Domain: Documents & records · Status: Planned

## 1. Business purpose

Manage contract lifecycle — drafting, approval, obligations, renewal, expiry — so no agreement lapses unnoticed and every version is on record.

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
