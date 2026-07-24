# Metadata Engine — Design

**Status:** Approved 2026-07-24 (Business Operations Orchestrator roadmap) — implementation in progress.
**Scope:** Subsystem 4. A unified, read-side metadata view over any `StoredFile`, assembled from what already exists across platform + modules — the surface Search (Subsystem 8), the Dashboard (Subsystem 10), and AI consume instead of each reaching into `Document`/`PurchaseBill`/`tagging`/`periods` directly.

## 1. Context — most of this metadata already exists

Checked against the roadmap's field list before writing any code:

| Field                | Already lives at                                                      |
| -------------------- | --------------------------------------------------------------------- |
| Document Type        | `StoredFile.category`                                                 |
| Business Period      | `StoredFile.period_year`/`period_month`/`is_library` (Subsystem 2)    |
| Vendor               | `PurchaseBill.vendor`, `SourceIdentity.mapped_object_*` (Subsystem 3) |
| Invoice Number       | `PurchaseBill.invoice_number`                                         |
| Source Channel       | `PurchaseBill.source_channel`, `SourceIdentity.channel`               |
| Tags                 | `platform/tagging`                                                    |
| Storage Location     | `StoredFile.key`                                                      |
| Hash                 | `StoredFile.sha256`                                                   |
| Status               | `Document.status` / `PurchaseBill.status`                             |
| Created/Updated Time | every `BaseModel`'s `created_at`/`updated_at`                         |

**Employee** has no home (by design — `docs/specs/hr-integration-strategy.md`, unchanged from Subsystem 3). **Version** has no home either, and nothing in this roadmap or the codebase asks for document versioning as a real requirement — inventing a version-tracking model here would be exactly the kind of speculative feature `CLAUDE.md` says not to build. Neither is added.

Building new columns to duplicate any of the table above would violate "never reimplement a platform capability" and immediately drift from the real values. **The actual gap is that nothing assembles these into one shape** — a caller wanting "everything about this file" today has to know which module owns which field and query 3-4 tables by hand.

## 2. Design

**a) A registry of per-module extractors, same idiom as `periods.registry`/`workflow.registry`.** `platform/metadata` never imports `documents`/`purchase` (rule 1/2); each module registers a small function, keyed by the `module` string already stamped on every `StoredFile` (`storage/models.py`'s existing `module` field — no new lookup key invented), that turns a `StoredFile` into its business meaning.

```python
@dataclass(frozen=True)
class MetadataFields:
    title: str
    status: str
    business_object_type: str      # e.g. "Document", "PurchaseBill" — for tag lookup
    business_object_id: str
    extra: dict = field(default_factory=dict)   # vendor, invoice_number, category_label, ...

MetadataProviderDef(module: str, extract: Callable[[StoredFile], MetadataFields | None])
register_metadata_provider(definition)   # idempotent by module key
get_metadata_provider(module) -> MetadataProviderDef   # NotFoundError if unregistered
```

`extract()` returns `None` when no business record matches the file (an orphaned or in-flight upload) — `MetadataService` degrades to universal-fields-only rather than erroring.

**b) `MetadataService.get_metadata(stored_file)` is a live read, not a cache.** Unlike `periods`' manifest (a genuine performance cache with an explicit refresh trigger), this has no expensive aggregate to precompute — it's a handful of single-row lookups by primary/foreign key. Caching it would just be a second place for staleness to hide. Merges, in order: universal fields (straight off `StoredFile`: `storage_location=key`, `hash=sha256`, `size_bytes`, `content_type`, `document_type=category`, `period_year`, `period_month`, `is_library`, `created_at`, `updated_at`, `uploaded_by`), then the module extractor's `title`/`status`/`extra`, then tags via the **existing** `TagService.tags_for_object(module=stored_file.module, object_type=..., object_id=...)` — no new tag-storage path.

**c) Read-only, single-object API.** `GET /api/v1/metadata/files/{stored_file_id}/` — no list/search endpoint here; bulk querying across many files by metadata facet is Subsystem 8's job (Search Platform), which will index the same fields this service assembles, not duplicate this service's per-object assembly.

## 3. Out of scope

An `Employee` model; document versioning; a metadata list/search/filter API (Subsystem 8); write endpoints (nothing needs to edit metadata through this service — each field is still written by its owning module); a metadata cache.

## 4. Test plan

- `test_metadata_registry.py` — register/get/all round-trip (mirrors every other registry in this codebase).
- `test_metadata_service.py` — universal fields always present; a `documents`-module file merges `Document` fields + tags; a `purchase`-module file merges `PurchaseBill` fields + tags; an unregistered module degrades to universal-only, not an error; a file with no matching business record (extractor returns `None`) degrades the same way; cross-tenant isolation.
- `test_metadata_api.py` — 200 with the merged shape, 403 without `metadata.view`, 404 for another tenant's file.
- No changes required to any existing test file — this subsystem only reads.
