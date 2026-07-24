# Metadata Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** `platform/metadata` — a registry of per-module metadata extractors, `MetadataService.get_metadata()` unifying universal `StoredFile` fields + module fields + tags, and a single-object read API. Zero regressions; this subsystem only reads existing data, it writes nothing new.

**Architecture:** See `docs/superpowers/specs/2026-07-25-metadata-engine-design.md`.

## Global Constraints

- Gate per task: `cd platform && pytest` green, `python -m ruff check .` clean, `python manage.py check` clean.
- No existing test file needs modification — purely additive, read-only subsystem.
- No `Employee` model, no versioning, no metadata cache, no list/search endpoint.
- Small commits: one per task.
- Known, pre-existing, unrelated failure: `modules/contracts/backend/tests/test_contracts.py::test_expiry_scan_expires_and_reminds` (a timezone-boundary bug in `ContractService.run_expiry_scan`, not touched by any plan in this roadmap so far) — not this plan's regression to fix; note it in Task 5, don't let it block the gate assessment for changes actually made here.

## Milestones

| #   | Milestone               | Tasks | Exit criteria                                                          |
| --- | ----------------------- | ----- | ---------------------------------------------------------------------- |
| M1  | App + registry          | 1     | `metadata` app installed, extractor registry round-trips               |
| M2  | Service                 | 2     | `get_metadata()` merges universal + module + tags, degrades gracefully |
| M3  | Read API                | 3     | `/api/v1/metadata/files/{id}/` live, permission-gated                  |
| M4  | Module adoption         | 4     | documents + purchase register extractors, existing tests unmodified    |
| M5  | Production-quality gate | 5     | full gate green, committed                                             |

---

### Task 1: App skeleton, registry, permission

**Files:** `platform/metadata/{__init__.py,apps.py,registry.py}`, `platform/tests/test_metadata_registry.py`. Modify `platform/config/settings.py`, `platform/permissions/registry.py`.

- [ ] `MetadataConfig` (name="metadata"), added to `PLATFORM_APPS_BEFORE_MODULES` after `"identity"`.
- [ ] `registry.py`: `MetadataFields`, `MetadataProviderDef`, `register_metadata_provider`/`get_metadata_provider`/`all_metadata_providers` — mirrors `periods.registry`.
- [ ] `PermissionDef("metadata.view", "View unified document metadata", "Metadata")`.
- [ ] Failing test first (register/get round-trip, unregistered raises `NotFoundError`, idempotent by key) → implement → green.
- [ ] Full verify. Commit.

### Task 2: `MetadataService`

**Files:** `platform/metadata/services.py`, `platform/tests/test_metadata_service.py`.

**Acceptance criteria:** universal fields always present regardless of module registration; a registered module's `extract()` output merges in (`title`, `status`, `extra`, plus tags fetched via the existing `TagService.tags_for_object`); an unregistered `module` or an `extract()` returning `None` degrades to universal-only, no exception; tenant mismatch (a `StoredFile` from another tenant) raises `NotFoundError`, not a silent cross-tenant leak.

- [ ] Write failing tests per the criteria above (register a fake provider in-test, same pattern `test_periods_resolution.py` used for fake document types).
- [ ] Implement `MetadataService.get_metadata(*, stored_file, tenant)`.
- [ ] Green. Full verify. Commit.

### Task 3: Read API

**Files:** `platform/metadata/{serializers.py,views.py,urls.py}`, `platform/tests/test_metadata_api.py`. Modify `platform/config/urls.py`.

- [ ] `GET /api/v1/metadata/files/{id}/` — a plain `APIView`/`RetrieveAPIView`-style single endpoint (not a full `ModelViewSet` — there's no list route per design §3), `required_permissions = "metadata.view"`, 404 on another tenant's file.
- [ ] Failing tests → implement → green.
- [ ] Full verify. Commit.

### Task 4: `documents` + `purchase` register extractors

**Files:** `modules/documents/backend/metadata_provider.py`, `modules/purchase/backend/metadata_provider.py`. Modify both `apps.py`. Append to both modules' existing test files.

**Acceptance criteria:** a `documents`-module `StoredFile`'s unified metadata includes the `Document`'s title/category/status and its real tags; a `purchase`-module `StoredFile`'s unified metadata includes the bill's vendor/invoice_number/source_channel; every pre-existing test in both files passes unmodified.

- [ ] `documents`: `extract(stored_file)` looks up `Document.objects.get(file=stored_file)` (existing FK — no new lookup path), returns `MetadataFields(title=doc.title, status=doc.status, business_object_type="Document", business_object_id=str(doc.id), extra={"category": doc.category})`.
- [ ] `purchase`: `PurchaseBill` has no FK to `StoredFile` (`storage_key` is a plain string) — `extract()` looks up `PurchaseBill.objects.filter(storage_key=stored_file.key).first()`; returns `None` if no match (degrade gracefully per design §2b) rather than raising.
- [ ] Failing tests appended to `test_documents.py`/`test_ingest.py` → implement → green, full files unmodified otherwise.
- [ ] Full verify. Commit.

### Task 5: Final verification

- [ ] `pytest -q` (all green except the pre-noted, pre-existing `test_expiry_scan_expires_and_reminds`), `manage.py check`, `ruff check platform`, `ruff format --check platform`.
- [ ] `pnpm --filter web build` unchanged.
- [ ] Commit if formatting needed a fix.

## Migration plan

None — `platform/metadata` has no models, no migration.

## Rollback considerations

Purely additive and read-only throughout; reverting any task's commit removes code with no data-shape consequence, since nothing here is a write path any other subsystem depends on yet.

## Regression risks

| Risk                                                                                                                        | Mitigation                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| A module extractor accidentally leaks another tenant's data (e.g. forgetting a tenant filter on the business-record lookup) | Task 2's tenant-mismatch test targets exactly this at the service layer, before any module extractor is even written                       |
| `purchase`'s `storage_key`-based lookup (string match, not FK) breaks if two bills ever share a key                         | Can't happen — `StoredFile.key` is DB-unique (`storage/models.py`), so `filter(storage_key=...)` matches at most one file per bill already |
