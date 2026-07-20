# Module Intelligence · OCR

Route `/ocr` · Domain: Automation · Status: Planned

## 1. Business purpose

Convert scanned documents and images into structured, searchable text — the ingestion engine feeding DMS, purchase, finance, and visitor flows.

## 2. Problems it solves

- Paper archives unsearchable
- Invoice and receipt data re-typed by hand
- Scans stored as opaque images with no metadata
- Legacy contract content locked in PDFs

## 3. Primary users

Records officers (batch ingestion), finance (invoices), reception (IDs), modules calling programmatically.

## 4. Future integrations

`services/ocr` (processing), DMS (storage and enrichment), Purchase/Finance (structured extraction), Search (indexing), Workflow (validation queues).

## 5. Database entities

`ocr_job`, `ocr_page_result`, `extraction_template`, `field_extraction`, `validation_task`, `confidence_threshold`.

## 6. APIs

- `POST /api/ocr/jobs` (document reference in) · `GET /api/ocr/jobs/{id}`
- `GET /api/ocr/jobs/{id}/text` · `GET /api/ocr/jobs/{id}/fields`
- `GET/POST /api/ocr/templates`

## 7. Dashboard widgets

Jobs today by status · Average confidence · Validation queue depth · Throughput trend.

## 8. KPIs

Recognition accuracy · Auto-accept rate (no human validation) · Processing time per page · Validation backlog age.

## 9. Permissions

`ocr.submit`, `ocr.validate`, `ocr.template.manage`, `ocr.admin`.

## 10. Navigation structure

Overview · Jobs · Validation queue · Templates.

## 11. Relationships with other modules

Runs in the independent `services/ocr` container; results attach to DMS documents; extraction templates serve Purchase (invoices), Visitors (IDs), Contracts (legacy import).

## 12. AI opportunities

LLM-assisted field extraction beyond fixed templates · Document-type auto-detection · Handwriting recognition · Confidence-aware routing to human validation.
