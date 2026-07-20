# Module Intelligence · Purchase Orders

Route `/purchase` · Domain: Operations · Status: Planned

## 1. Business purpose

Take a purchase from requisition to approved order to received goods with a controlled, auditable trail and no off-system spending.

## 2. Problems it solves

- Purchases initiated by chat message with no record
- Approval thresholds enforced by habit, not policy
- No link between what was ordered, received, and invoiced
- Vendor pricing history invisible at order time

## 3. Primary users

Requesters (any staff), procurement officers, budget-owning managers, finance (matching), store/receiving staff.

## 4. Future integrations

Vendors (supplier data), Inventory (goods receipt), Finance (budget checks, invoices), Workflow (approval chains), OCR (invoice capture), DMS (quotes and contracts).

## 5. Database entities

`purchase_requisition`, `requisition_line`, `purchase_order`, `po_line`, `goods_receipt`, `receipt_line`, `invoice_match`, `approval_threshold`, `cost_center`.

## 6. APIs

- `GET/POST /api/purchase/requisitions` · `POST /api/purchase/requisitions/{id}/submit`
- `GET/POST /api/purchase/orders` · `POST /api/purchase/orders/{id}/issue`
- `POST /api/purchase/orders/{id}/receive`
- `GET /api/purchase/thresholds` · `GET /api/purchase/cost-centers`

## 7. Dashboard widgets

Open requisitions awaiting approval · POs awaiting delivery · Spend by cost center (period) · Overdue receipts · Three-way-match exceptions.

## 8. KPIs

Requisition-to-PO cycle time · % spend under approved PO · Receipt accuracy · Approval SLA compliance · Maverick-spend ratio.

## 9. Permissions

`purchase.requisition.create/submit`, `purchase.order.approve` (threshold-scoped), `purchase.order.issue`, `purchase.receipt.record`, `purchase.admin`.

## 10. Navigation structure

Overview · Requisitions · Purchase orders · Receiving · Thresholds & policies.

## 11. Relationships with other modules

Consumes Vendors and Finance master data; posts receipts to Inventory; emits events consumed by Finance and Analytics; approvals delegated entirely to the Workflow engine.

## 12. AI opportunities

Auto-classify requisitions to categories/cost centers · Suggest vendor from history and price · Flag anomalous prices vs history · Extract PO/invoice data via OCR and pre-match.
