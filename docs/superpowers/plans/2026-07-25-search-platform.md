# Search Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** Enrich `documents`' and `purchase`'s existing search adapters with the facets Subsystems 2-4 already produce. No `platform/search` changes — the infrastructure is already generic (design doc §1).

## Global Constraints

- Gate per task: `cd platform && pytest` green, `python -m ruff check .` clean, `python manage.py check` clean.
- `platform/tests/test_search.py` stays fully unmodified — proof that no platform-level search behavior changed.
- Known, pre-existing, unrelated failure: `test_contracts.py::test_expiry_scan_expires_and_reminds` — not this plan's regression.

## Milestones

| #   | Milestone               | Tasks | Exit criteria                                                                |
| --- | ----------------------- | ----- | ---------------------------------------------------------------------------- |
| M1  | `documents` adapter     | 1     | `extra` carries document_type/period/is_library, `test_search.py` unmodified |
| M2  | `purchase` adapter      | 2     | `extra` carries document_type/vendor/source_channel/period/is_library        |
| M3  | Production-quality gate | 3     | full gate green, committed                                                   |

---

### Task 1: `documents` adapter — richer facets

**Files:** Modify `modules/documents/backend/search/adapter.py`. Append to `modules/documents/backend/tests/test_documents.py`.

- [ ] `queryset()` gains `.select_related("file")`.
- [ ] `to_document()`: rename `extra["category"]` → `extra["document_type"]`; add `period_year`, `period_month`, `is_library` from `doc.file`.
- [ ] Failing test: a document's `SearchDocument.extra` includes the new keys → implement → green. Every existing `test_documents.py` test passes unmodified.
- [ ] Full verify. Commit.

### Task 2: `purchase` adapter — richer facets

**Files:** Modify `modules/purchase/backend/search/adapter.py`. Append to `modules/purchase/backend/tests/test_ingest.py`.

- [ ] `to_document()`: add `document_type="purchase_bill"`, `vendor` (`bill.vendor.name` or `bill.seller_name`), `source_channel=bill.source_channel`, and `period_year`/`period_month`/`is_library` looked up via `StoredFile.objects.filter(key=bill.storage_key).first()` (same pattern as `purchase/backend/metadata_provider.py`, Subsystem 4) — `None`/absent when no stored file exists yet, never an error.
- [ ] Failing test → implement → green. Every existing `test_ingest.py` test passes unmodified.
- [ ] Full verify. Commit.

### Task 3: Final verification

- [ ] `pytest -q` (contracts flake excluded, noted), `manage.py check`, `ruff check platform`, `ruff format --check platform`.
- [ ] `pnpm --filter web build` unchanged.
- [ ] Commit if formatting needed a fix.

## Migration plan

None — no model changes.

## Rollback considerations

Both tasks are isolated to one module's adapter file each; reverting either independently restores that index's prior `extra` shape with no data-loss (the next `rebuild()` or natural re-index on save repopulates it either way — `SearchDocument` is a derived index, never a source of truth).

## Regression risks

| Risk                                                                                               | Mitigation                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Renaming `category`→`document_type` breaks a hidden caller                                         | Verified via grep before deciding (design §2a) — nothing references `extra__category`/`filter.category` anywhere in the repo                                               |
| `purchase`'s `StoredFile` lookup by `storage_key` string adds an N+1 query per bill on `rebuild()` | Same tradeoff already accepted in `metadata_provider.py` (Subsystem 4) for the same lookup — `rebuild()` is an explicit admin/management operation, not a hot request path |
