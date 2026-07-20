# Module Intelligence · Vendor Management

Route `/vendors` · Domain: Operations · Status: Planned

## 1. Business purpose

Maintain one qualified supplier base — contacts, terms, documents, and performance history — so every purchase starts from known, approved vendors.

## 2. Problems it solves

- Vendor details duplicated across spreadsheets and inboxes
- No record of qualification, insurance, or expiry of vendor documents
- Performance issues invisible at reorder time
- Onboarding a vendor is an untracked email exchange

## 3. Primary users

Procurement officers (owners), finance (payment terms), requesters (directory), compliance (qualification).

## 4. Future integrations

Purchase Orders (ordering), Contracts (agreements), Finance (terms, payments), DMS (vendor documents), Workflow (vendor approval), Notifications (document expiry alerts).

## 5. Database entities

`vendor`, `vendor_contact`, `vendor_category`, `qualification_record`, `vendor_document_link`, `performance_review`, `payment_terms`.

## 6. APIs

- `GET/POST /api/vendors` · `GET/PATCH /api/vendors/{id}`
- `POST /api/vendors/{id}/qualify` · `GET /api/vendors/{id}/performance`
- `GET /api/vendors/categories`

## 7. Dashboard widgets

Vendors pending qualification · Documents expiring in 60 days · Top vendors by open POs · Recently added vendors.

## 8. KPIs

Qualified-vendor ratio · Document compliance rate · On-time delivery rate per vendor · Average qualification lead time.

## 9. Permissions

`vendors.read`, `vendors.manage`, `vendors.qualify`, `vendors.admin`.

## 10. Navigation structure

Overview · Directory · Qualification · Performance · Categories.

## 11. Relationships with other modules

Master data source for Purchase Orders and Contracts; receipt and invoice events from Purchase feed performance; documents live in DMS.

## 12. AI opportunities

Duplicate-vendor detection · Risk scoring from document status and performance · Extraction of vendor data from registration documents via OCR.
