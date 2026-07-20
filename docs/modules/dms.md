# Module Intelligence · Document Management (DMS)

Route `/dms` · Domain: Documents & records · Status: Planned

## 1. Business purpose

One controlled home for company documents — versioned, permissioned, searchable, and retained by policy — replacing shared-drive sprawl.

## 2. Problems it solves

- Multiple conflicting copies of the same document
- No access control or audit on sensitive files
- Documents unfindable without asking their owner
- Retention and disposal ungoverned

## 3. Primary users

All staff (read/upload within permissions), records officers, compliance, module services storing generated documents.

## 4. Future integrations

OCR (scan ingestion), platform Search (full-text), Storage (objects), Contracts and HR (typed documents), Email (attachment capture), Workflow (review/approval of documents).

## 5. Database entities

`document`, `document_version`, `folder`, `document_type`, `retention_policy`, `document_permission`, `document_link` (module ↔ document), `share_grant`, `tag`.

## 6. APIs

- `GET/POST /api/dms/documents` · `GET /api/dms/documents/{id}`
- `POST /api/dms/documents/{id}/versions` · `GET /api/dms/documents/{id}/download`
- `GET/POST /api/dms/folders` · `POST /api/dms/documents/{id}/share`
- `GET /api/dms/search` (delegates to platform search)

## 7. Dashboard widgets

Recently updated documents · Awaiting my review · Retention actions due · Storage usage by type.

## 8. KPIs

Search success rate · % documents with owner and type · Retention compliance · Average review turnaround.

## 9. Permissions

`dms.document.read/write/delete` (folder- and type-scoped), `dms.share.external`, `dms.retention.manage`, `dms.admin`.

## 10. Navigation structure

Overview · Browse · My documents · Shared with me · Reviews · Retention.

## 11. Relationships with other modules

Every module stores files through DMS links rather than raw storage; Contracts and HR define typed documents on top of it; OCR enriches content; platform Search indexes it.

## 12. AI opportunities

Auto-classification and tagging on upload · Summarization of long documents · Semantic search over content · Duplicate detection.
