# Module Intelligence · Document Management (DMS)

Route `/dms` · Domain: Documents & records · Status: **Built (v1) — 2026-07-21**

## 1. Business purpose

One controlled home for company documents — permissioned, searchable, summarized, and routable for approval — replacing shared-drive sprawl.

## Built (v1) — shipped surface

The first version is live end to end and is the **reference example of a module
that reuses every platform service and reimplements none** (see
`docs/architecture/platform-services.md`). Backend: `modules/documents/backend`
(24 tests). Frontend: `apps/web/src/app/(platform)/dms` (list + detail + upload,
build-verified).

- **Entity**: one `Document` (UUID, tenant-scoped, soft-delete) wrapping a
  platform `storage.StoredFile`. Fields: title, description, category
  (`contract`, `invoice`, `policy`, `po`, `report`, `purchase_bill`, `correspondence`, `other`), status
  (`active` / `archived`), tags, ai_summary, owner, approval link.
- **Custom Upload Dropzone & Multi-Tag Ingestion**: Upload modal features a clean drag-and-drop file dropzone displaying filename and size (`DC_28_2026-27-1.pdf (0.45 MB)`) without native browser default "Browse..." button text. Handles multi-tag uploads cleanly via multipart `request.data.getlist("tags")` in `DocumentViewSet`.
- **Storage** (platform): bytes go to `StorageService` (local / Cloudflare R2 /
  S3), never to the module. sha256 integrity, MIME + size validation, signed
  downloads through the BFF proxy.
- **AI** (platform): `AIService.generate` produces the summary from a registered
  prompt (`documents-summary`); best-effort, never blocks upload. Cost/usage
  recorded in the AI ledger.
- **Workflow** (platform): "submit for approval" starts a `document-approval`
  workflow instance; the module reacts to `workflow.completed`/`rejected` to set
  status and notify the owner. Single review step today; multi-step is a config
  change on the engine, not a rebuild.
- **Search** (platform): a `SearchAdapter` indexes every document; results are
  tenant-scoped and gated by `documents.read`. Re-index via `search_rebuild`.
- **Reporting** (platform): `POST /documents/export` renders the register as
  CSV/XLSX/PDF/HTML through `ReportService`.
- **Notifications / Audit** (platform): approvers and owners are notified via
  `NotificationService`; every lifecycle event is on the audit trail.
- **API**: `GET/POST /api/v1/documents/documents/`, `{id}/` (GET/PATCH/DELETE),
  and actions `summarize`, `submit`, `archive`, `download`, `export`.
- **Permissions**: `documents.read` / `.write` / `.approve` / `.manage` (Owner
  holds all).

**Not in v1** (the aspirational design below remains the roadmap): document
versions, folders, typed `document_type`/`retention_policy` models, external
share grants, semantic/vector search, duplicate detection, OCR auto-
classification. The single `category` enum stands in for folders + document_type
for now.

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
