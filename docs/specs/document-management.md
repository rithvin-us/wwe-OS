# Document Management Module (DMS)

**Status: not built.** `modules/dms/` is an empty enterprise-shell scaffold.
This spec plans the build; nothing below is implemented yet. See
`docs/modules/dms.md` for the business blueprint and `_shared-conventions.md`
for platform-wide patterns this will reuse.

## 1. Functional requirements

- Store documents with folders, tags, and version history.
- Preview common formats (PDF, images) without downloading.
- Full-text search across document content and metadata.
- Archive (soft lifecycle state, not deletion) per retention policy.
- Accept documents from any ingestion channel via the pattern established in
  `docs/specs/document-ingestion.md` (once generalized beyond Purchase).

## 2. Non-functional requirements

- Every document access is tenant-scoped and permission-checked — DMS is the
  most sensitive module by default (it will hold contracts, HR files, and
  whatever any other module attaches).
- Version history is append-only — a new version never overwrites the
  previous one's bytes or metadata.

## 3. Database schema (planned)

```
dms_folder          id, tenant_id, parent_id NULL, name, created_by
dms_document         id, tenant_id, folder_id, document_type, current_version_id,
                     retention_policy_id NULL, is_archived
dms_document_version id, document_id, version_no, storage_key, file_size,
                     content_hash, uploaded_by, created_at
dms_tag              id, tenant_id, name
dms_document_tag     document_id, tag_id  (m2m)
dms_permission_grant  document_id NULL / folder_id NULL, grantee_user_id, level
dms_retention_policy  id, tenant_id, name, retain_days, action [archive|delete]
```

## 4. Entity relationships

```
Tenant 1──* Folder 1──* Folder (self, nesting)
Folder 1──* Document 1──* DocumentVersion
Document *──* Tag
Document/Folder 1──* PermissionGrant (per-user, until RBAC is re-enabled)
```

## 5. Folder structure (target — mirrors `modules/purchase/backend/`)

```
modules/dms/backend/
  models/        folder.py, document.py, document_version.py, tag.py, retention.py
  repositories/  one per aggregate root (folder, document)
  services/      document_service.py (upload/version/archive), search_service.py
  api/           views.py, urls.py
  events/        registry.py (document.uploaded/versioned/archived), subscribers.py
  permissions/   registry.py (dms.document.read/write/delete, dms.retention.manage)
  tests/
```

## 6. Backend architecture

Same layered pattern as Purchase. The one new architectural piece: **storage
abstraction** — `platform/storage` (currently README-only) must exist before
DMS can be more than a metadata catalog. DMS's `document_service.py` should
depend on `platform/storage`'s interface, never a specific backend (local
disk today, S3-compatible later) — this is exactly the kind of platform
capability the architecture doc anticipates and DMS is the first real
consumer of it.

## 7. Frontend architecture

A three-pane layout is standard for this kind of tool: folder tree (left),
document list with filters (center), preview pane (right) — collapsing to a
single-pane, drill-down flow on mobile. Uses `@bop/ui` throughout; no
document-specific styling outside the design bible.

## 8. API design (planned)

```
GET/POST   /api/v1/dms/folders/
GET/POST   /api/v1/dms/documents/
POST       /api/v1/dms/documents/{id}/versions/
GET        /api/v1/dms/documents/{id}/download/
GET        /api/v1/dms/documents/{id}/preview/
POST       /api/v1/dms/documents/{id}/archive/
GET        /api/v1/dms/search/?q=…
```

## 9. Validation rules

- File type/size limits enforced server-side (not just the frontend's
  `accept=` attribute).
- A new version must reference the document it's versioning; version numbers
  are strictly increasing, never reused.

## 10. Business logic

Archiving is a status change, not a delete — matches the platform's
soft-delete convention (`shared.models.BaseModel`) exactly; DMS adds no new
delete semantics.

## 11. Background jobs

Content hashing and text extraction (for search indexing) should run
asynchronously after upload, not block the upload response — the first real
candidate for a queue in this platform (see § 13).

## 12. Event flow

`document.uploaded`, `document.versioned`, `document.archived` — consumed by
audit (always) and by search indexing (once built).

## 13. Queue design

First genuine need for a task queue (Celery or RQ over the existing Redis
instance) — text extraction and indexing are the workload, not request/response.
`services/worker` (scaffolded, unimplemented) is where this runs.

## 14–17. Error handling, security, testing, deployment

Follow `_shared-conventions.md`. Security note specific to DMS: per-document
permission grants (§ 3) are additive to, not a replacement for, tenant
isolation and the dormant RBAC system — re-enabling RBAC later must not
require redesigning this table.

## 18. Mobile integration

Upload-from-camera and a lightweight browse/preview view; full folder
management is a desktop-first task.

## 19. Dashboard integration

"Recently updated documents" / "awaiting my review" (if a reviewable
document type exists) feed the Executive Dashboard's activity feed.

## 20. Future scalability

Search indexing should use `platform/search` (also currently README-only) —
DMS should not roll its own search engine any more than it should roll its
own storage backend. Both are exactly the "platform provides capability,
module provides meaning" split the architecture doc describes.
