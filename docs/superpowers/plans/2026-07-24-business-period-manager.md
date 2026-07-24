# Business Period Manager & Storage Domains — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `platform/periods` (a pure `resolve_location()` path resolver + a DB-backed `PeriodService` for period rows, manifest cache, and lifecycle status), extend `platform/storage` additively so it can write human-readable, period/library-aware keys, and wire `documents`/`purchase` to use both — with zero regressions to either module's existing behavior.

**Architecture:** See `docs/superpowers/specs/2026-07-24-business-period-manager-design.md` (§9 records the approved refinements) for full rationale. Summary: `resolve_location(DocumentContext) -> ResolvedLocation` is a pure function (registry lookup + string formatting, no DB/IO); `PeriodService` owns `BusinessPeriod`/`PeriodManifest` persistence and is called only after a file is actually stored; `StorageService.store()` gains optional `key`/`period_year`/`period_month`/`is_library` kwargs plus collision-suffix retry, with every existing caller unaffected.

**Tech Stack:** Django 6, DRF, PostgreSQL (SQLite for tests) — no new dependencies.

## Global Constraints

- Gate before any task counts as done: `cd platform && pytest` green, `python -m ruff check .` clean, `python manage.py check` clean.
- `platform/tests/test_storage.py` and `platform/tests/test_automation.py` must pass **completely unmodified** through every task — the backward-compatibility acceptance gate for this plan (mirrors the role `test_automation.py` played in the Subsystem 1 plan).
- `resolve_location()` must never import `django.db`, `BaseService`, or anything from `storage`/`documents`/`purchase` — enforced by a dedicated zero-query test (Task 4).
- No enforcement of `PeriodStatus` anywhere in this plan (field + setter only, per design §9d) — do not add a check that rejects a write to a `CLOSED` period.
- New Django app name: `periods`.
- Small commits: one commit per task, after that task's own gate passes — never batch multiple tasks into one commit.

---

## File Structure

**New app `platform/periods/`:**

| File                         | Responsibility                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `apps.py`                    | `PeriodsConfig` — registry host, no `ready()` override                                                       |
| `models.py`                  | `PeriodStatus`, `BusinessPeriod`, `PeriodManifest`                                                           |
| `registry.py`                | `DocumentTypeDef`, `register_document_type`/`get_document_type`/`all_document_types`                         |
| `resolution.py`              | `DocumentContext`, `ResolvedLocation`, `resolve_location` — pure                                             |
| `services.py`                | `PeriodService`: `get_or_create_period`, `record_document`, `refresh_manifest`, `list_periods`, `set_status` |
| `serializers.py`             | `BusinessPeriodSerializer`, `PeriodManifestSerializer`                                                       |
| `views.py`                   | `PeriodViewSet` (read-only: list, retrieve, `library` action)                                                |
| `urls.py`                    | router → `periods`                                                                                           |
| `migrations/0001_initial.py` | generated via `makemigrations`, not hand-written                                                             |

**New inside `documents/` and `purchase/`:** `documents/document_types.py`, `purchase/document_types.py` (registered from each app's `ready()`).

**Modified:** `platform/storage/models.py`, `platform/storage/services.py`, `platform/config/settings.py`, `platform/config/urls.py`, `platform/permissions/registry.py`, `modules/documents/backend/apps.py`, `modules/documents/backend/services/document.py`, `modules/purchase/backend/apps.py`, `modules/purchase/backend/services/purchase_bill.py`.

**New test files (`platform/tests/`):** `test_periods_models.py`, `test_periods_registry.py`, `test_periods_resolution.py`, `test_periods_service.py`, `test_periods_api.py`. **Additive tests appended to** `test_storage.py` (existing tests untouched). **New in module suites:** additive cases in `modules/documents/backend/tests/test_documents.py`, `modules/purchase/backend/tests/test_ingest.py`.

---

**Execution-order note:** Task 5 (`PeriodService.refresh_manifest`) reads `StoredFile.period_year`/`period_month`, which Task 6 adds. Implemented in dependency order — Task 6 before Task 5 — despite the numbering above; each task's own gate (tests/ruff/check) still passes standalone before its commit, so the small-commit/no-regression discipline is unaffected, only the sequence.

## Milestones

| #   | Milestone                 | Tasks | Exit criteria                                                                                                                   |
| --- | ------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------- |
| M1  | App skeleton + data model | 1, 2  | `periods` app installed, migrated, `manage.py check` clean                                                                      |
| M2  | Pure resolution layer     | 3, 4  | `resolve_location()` proven pure (zero-query test), registry round-trips                                                        |
| M3  | Persistence layer         | 5     | `PeriodService` creates periods, maintains manifest from live aggregates, records lifecycle                                     |
| M4  | Storage integration       | 6     | `StorageService.store()` accepts human-readable keys, collision-safe, `test_storage.py` unmodified and green                    |
| M5  | Read API                  | 7     | `/api/v1/periods/*` live, permission-gated                                                                                      |
| M6  | Module adoption           | 8, 9  | `documents` and `purchase` file real uploads/bills into period/library paths, both modules' existing tests unmodified and green |
| M7  | Production-quality gate   | 10    | Full backend + frontend gate green, committed                                                                                   |

---

### Task 1: App skeleton, settings, permissions

**Files:** Create `platform/periods/{__init__.py,apps.py,migrations/__init__.py}`. Modify `platform/config/settings.py`, `platform/permissions/registry.py`.

**Acceptance criteria:** `periods` importable as a Django app label; `periods.view` permission seeded on `migrate`; no behavior change to any existing app.

- [ ] Create `platform/periods/apps.py`:

```python
from django.apps import AppConfig


class PeriodsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "periods"
    verbose_name = "Platform · Business Periods"
```

- [ ] In `platform/config/settings.py`, add `"periods"` to `PLATFORM_APPS_BEFORE_MODULES`, immediately before `"workflow"`/`"automation"` is fine (no import-order dependency either way, but keep it near `"storage"` since it's conceptually adjacent) — place directly after `"storage"`.
- [ ] In `platform/permissions/registry.py`, add after the Workflow block: `PermissionDef("periods.view", "View business periods and the document library", "Periods")`.
- [ ] Verify: `manage.py check` clean, full `pytest` unmodified-green (this task adds no tests of its own — it must not break anything).
- [ ] Commit: `feat(platform/periods): scaffold the periods app`

---

### Task 2: Models — `BusinessPeriod`, `PeriodManifest`

**Files:** Create `platform/periods/models.py`, `platform/periods/migrations/0001_initial.py` (generated), `platform/tests/test_periods_models.py`.

**Acceptance criteria:** unique `(tenant, year, month)`; `status` defaults `OPEN`; `PeriodManifest` one-to-one with defaults `{}`/`0`; cross-tenant rows never collide.

- [ ] Write `test_periods_models.py`: `test_year_month_unique_per_tenant`, `test_default_status_is_open`, `test_manifest_defaults_to_empty`, `test_two_tenants_same_year_month_do_not_collide`.
- [ ] Run — expect `ModuleNotFoundError: periods.models`.
- [ ] Write `periods/models.py` per design §3 (`PeriodStatus`, `BusinessPeriod`, `PeriodManifest`).
- [ ] `manage.py makemigrations periods` → generated `0001_initial.py`.
- [ ] Run tests — green.
- [ ] Full verify (`pytest -q`, `ruff check platform/periods`, `manage.py check`) — green.
- [ ] Commit: `feat(platform/periods): add BusinessPeriod/PeriodManifest models`

---

### Task 3: Document type registry

**Files:** Create `platform/periods/registry.py`, `platform/tests/test_periods_registry.py`.

**Acceptance criteria:** register/get/all round-trip; unknown key raises `NotFoundError`; re-registration by the same key is idempotent (last-write-wins, single entry in `all_document_types()`) — same contract as `workflow.registry`/`automation.registry`.

- [ ] Write `test_periods_registry.py` (mirrors `test_workflow_registry.py` structure: round-trip, unregistered-raises, idempotent-by-key).
- [ ] Run — expect import failure.
- [ ] Write `periods/registry.py`: `DocumentTypeDef(key, label, folder_segment, is_library, module)`, `register_document_type`, `get_document_type`, `all_document_types`.
- [ ] Run — green. Full verify. Commit: `feat(platform/periods): add document-type registry`

---

### Task 4: `DocumentContext` + pure `resolve_location()`

**Files:** Create `platform/periods/resolution.py`, `platform/tests/test_periods_resolution.py`.

**Acceptance criteria (the load-bearing task of this plan):**

- Rotating context → `{tenant_slug}/{year}/{MonthName}/{folder_segment}/{document_name}`, correct `period_year`/`period_month`, `is_library=False`.
- Library context → `{tenant_slug}/Library/{folder_segment}/{document_name}`, `period_year`/`period_month` both `None`, `is_library=True`.
- Rotating context with `business_date=None` → `ValueError`.
- Unknown `document_type` → `NotFoundError` (propagated from the registry).
- **Zero DB queries** — assert via `django.test.utils.CaptureQueriesContext(connection)` wrapping a `resolve_location()` call, `len(ctx.captured_queries) == 0`. This is the literal proof of design §9a, not just a docstring claim.
- No `BusinessPeriod` row exists after calling `resolve_location()` for a rotating context (proves it doesn't secretly call `get_or_create_period`).

- [ ] Register two test document types in a test fixture (one rotating, one library) via `register_document_type` — do not depend on Task 8/9's real registrations existing yet.
- [ ] Write `test_periods_resolution.py` with the cases above.
- [ ] Run — expect import failure.
- [ ] Write `periods/resolution.py` (`DocumentContext`, `ResolvedLocation`, `resolve_location`) per design §3. Imports: `dataclasses`, `calendar`, `datetime.date`, `periods.registry` only — no `django.db`, no `shared.services.BaseService`.
- [ ] Run — green. `ruff check platform/periods/resolution.py` — confirm no forbidden imports slipped in.
- [ ] Full verify. Commit: `feat(platform/periods): add DocumentContext and pure resolve_location()`

---

### Task 5: `PeriodService` — persistence, manifest, lifecycle

**Files:** Create `platform/periods/services.py`, `platform/tests/test_periods_service.py`.

**Acceptance criteria:**

- `get_or_create_period(tenant, year, month)` idempotent (second call returns the same row, no duplicate).
- `record_document(tenant, resolved, document_type)`: for a rotating `ResolvedLocation`, creates/reuses the period and calls `refresh_manifest`; for an `is_library` location, no-ops entirely (no period row, no manifest row created).
- `refresh_manifest(period)` recomputes `document_counts`/`total_count` from a **single grouped `StoredFile.objects.filter(tenant=, period_year=, period_month=).values("category").annotate(count=Count("id"))`** query — not from `PeriodManifest`'s own prior state, so it self-heals after an out-of-band delete/edit (test: manually delete a `StoredFile` row, call `refresh_manifest` again, assert the count drops — proves it's a cache, not a counter, per design §9c).
- `list_periods(tenant)` tenant-scoped, ordered `-year, -month`.
- `set_status(period, status)` writes the field, no other side effect; invalid status string raises `ValidationError`.

- [ ] Write `test_periods_service.py` with the cases above (`pytest.mark.django_db`).
- [ ] Run — expect import failure.
- [ ] Write `periods/services.py` (`PeriodService(BaseService)`).
- [ ] Run — green. Full verify. Commit: `feat(platform/periods): add PeriodService (persistence, manifest, lifecycle)`

---

### Task 6: Storage integration — additive key/period support + collision suffix

**Files:** Modify `platform/storage/models.py`, `platform/storage/services.py`. Append to `platform/tests/test_storage.py`.

**Acceptance criteria:**

- `StoredFile` gains nullable `period_year`, `period_month`, defaulted `is_library=False` — migration is purely additive (no column removed/renamed).
- `StorageService.store(..., key=None, period_year=None, period_month=None, is_library=False)`: when `key` is given, it's used verbatim (no opaque prefix) unless it collides with an existing `StoredFile.key`, in which case a numeric suffix (`-2`, `-3`, ...) is inserted before the file extension and retried until unique.
- When `key` is omitted, behavior is **byte-for-byte identical** to today — same opaque-key format, same everything. This is checked by the constraint that every existing `test_storage.py` test needs zero modification.
- `signed_url`/`open`/`delete`/`verify_integrity`/both providers: no changes (§4 of the design doc) — confirmed by their existing tests passing unmodified too.

- [ ] Add fields to `storage/models.py`; `manage.py makemigrations storage`.
- [ ] Append new tests to `test_storage.py`: `test_store_uses_given_key_verbatim`, `test_store_appends_numeric_suffix_on_key_collision`, `test_store_persists_period_and_library_fields`, `test_store_without_key_is_unchanged_from_today` (this last one can literally be one of the existing tests re-asserted, or a new one that pins the opaque-key regex — either way, prove no regression, don't just hope).
- [ ] Run — expect failures for the new tests only; **run the full existing `test_storage.py` file and confirm every pre-existing test still passes untouched before writing any implementation** (this is the baseline snapshot).
- [ ] Modify `StorageService.store()` per design §4, with a small `_dedupe_key(key)` helper (loop: check existence via `StoredFile.objects.filter(key=candidate).exists()`, insert `-N` before the extension, retry — bounded, e.g. max 100 attempts before raising `ConflictError`, to avoid an infinite loop on a pathological input).
- [ ] Run — all green, including every pre-existing test in the file, unmodified.
- [ ] Full verify (`pytest -q`, `ruff check platform`, `manage.py check`). Commit: `feat(platform/storage): additive key/period/library support with collision-safe keys`

---

### Task 7: Read API

**Files:** Create `platform/periods/serializers.py`, `platform/periods/views.py`, `platform/periods/urls.py`, `platform/tests/test_periods_api.py`. Modify `platform/config/urls.py`.

**Acceptance criteria:** `GET /api/v1/periods/` lists tenant's periods with manifest counts and status; `GET /api/v1/periods/{year}/{month}/` returns detail + recent uploads; `GET /api/v1/periods/library/` returns live library counts by type; all three require `periods.view`; all three are tenant-scoped (a second tenant's periods never appear).

- [ ] Write `test_periods_api.py`: list/detail/library happy paths, 403 without permission, tenant isolation.
- [ ] Run — expect 404s (URLs not mounted).
- [ ] Write serializers/views/urls; mount in `config/urls.py`.
- [ ] Run — green. Full verify. Commit: `feat(platform/periods): add read API`

---

### Task 8: `documents` module integration

**Files:** Create `modules/documents/backend/document_types.py`. Modify `modules/documents/backend/apps.py`, `modules/documents/backend/services/document.py`. Append to `modules/documents/backend/tests/test_documents.py`.

**Acceptance criteria:** every `DocumentCategory` value has a registered `DocumentTypeDef`; `DocumentService.create()` produces a `StoredFile` whose `key` is the human-readable period/library path, and whose period's manifest count reflects the new document; **every existing test in `test_documents.py` (including the tag-handling fix from the earlier session) passes unmodified.**

- [ ] Write `document_types.py`: one `DocumentTypeDef` per `DocumentCategory` (rotating for all current values — no library-only document category exists in `documents` yet; library types come from other modules in future subsystems), registered in `DocumentsConfig.ready()`.
- [ ] Append tests to `test_documents.py`: uploading a `policy` document lands at `{slug}/{year}/{MonthName}/Policies/...` (or whatever `folder_segment` is chosen — pick names matching the product spec's listed folders where they overlap, e.g. `invoice`→"Invoices", `purchase_bill`→"Purchase Bills", `po`→"Purchase Orders"); its period's manifest `document_counts["policy"] == 1` after upload.
- [ ] Run — expect failures (service not yet calling `resolve_location`).
- [ ] Modify `DocumentService.create()`: build `DocumentContext`, call `resolve_location()`, pass through to `StorageService.store()`, then `PeriodService().record_document(...)` after success.
- [ ] Run — **entire `test_documents.py` file**, confirm every test (old and new) passes.
- [ ] Full verify. Commit: `feat(documents): file uploads into period/library paths via periods.resolve_location`

---

### Task 9: `purchase` module integration

**Files:** Create `modules/purchase/backend/document_types.py`. Modify `modules/purchase/backend/apps.py`, `modules/purchase/backend/services/purchase_bill.py`. Append to `modules/purchase/backend/tests/test_ingest.py`.

**Acceptance criteria:** `purchase_bill` document type registered pointing at the same `folder_segment` `documents` uses for its `purchase_bill` category (so both land in the identical "Purchase Bills" folder); `ingest()` passes `invoice_date` as `business_date` when the bot supplied `raw_extraction` with a parseable date, else `date.today()`; **every existing ingestion test passes unmodified.**

- [ ] Write `document_types.py` for `purchase` — register `purchase_bill` with the **same key** `documents/document_types.py` uses for its `purchase_bill` `DocumentTypeDef` (register once is idempotent by key per Task 3 — whichever app's `ready()` runs first wins, and both define it identically, so this is safe either order; note this explicitly in a code comment to prevent future drift between the two definitions).
- [ ] Append ingestion tests: a bill ingested with a known `invoice_date` lands in that month's folder even if ingested later; a bill ingested with no date yet (pre-OCR) lands in the current month.
- [ ] Run — expect failures.
- [ ] Modify `PurchaseBillService.ingest()` / `_fetch_and_store_document()` to build `DocumentContext` and call `resolve_location()`/`StorageService.store()`/`PeriodService().record_document()` the same way.
- [ ] Run — full `test_purchase_ingestion.py`, all green, unmodified originals included.
- [ ] Full verify. Commit: `feat(purchase): file ingested bills into period paths via periods.resolve_location`

---

### Task 10: Final verification

**Files:** none — verification only.

**Acceptance criteria:** identical bar to Subsystem 1's Task 15.

- [ ] `cd platform && pytest -q` — all green (original suite + every new `test_periods_*.py` + additive `test_storage.py`/`test_documents.py`/`test_purchase_ingestion.py` cases).
- [ ] `manage.py check` — clean.
- [ ] `python -m ruff check platform` — clean.
- [ ] `python -m ruff format --check platform` — clean.
- [ ] `pnpm --filter web build` — succeeds unchanged (this plan touches no `apps/web` files).
- [ ] `python -m pre_commit run --all-files` — clean.
- [ ] Final commit if formatting needed a fix.

---

## Migration plan

Two additive Django migrations only: `periods/migrations/0001_initial.py` (new tables, no existing table touched) and one additive `storage` migration (three new nullable/defaulted columns on `storage_file`). Both are safe to run against a populated production database with zero downtime: new tables don't lock anything existing; adding nullable/defaulted columns to `storage_file` is a metadata-only change on PostgreSQL for `NULL`-default columns and a fast rewrite at most for the `is_library` boolean default — no data backfill required, since every pre-existing `StoredFile` row correctly has `period_year=NULL, period_month=NULL, is_library=False` (it was never period-aware, and defaulting `is_library` to `False` is correct — nothing already stored was meant to be a permanent Library document by virtue of this migration alone). No data migration step exists or is needed.

## Rollback considerations

- **Before Task 6 lands:** rolling back any of Tasks 1-5 is a plain `git revert` — nothing outside `platform/periods` (a new, unreferenced app) changed yet.
- **Task 6 (storage):** the new columns and kwargs are additive; reverting the migration (`manage.py migrate storage <previous>`) is safe since nothing depends on the new columns being present until Task 8/9 land. Reverting the code change restores the exact prior `store()` behavior.
- **Tasks 8-9 (module integration):** each module's change is isolated to its own `create()`/`ingest()` method; reverting either commit independently restores that module's prior (opaque-key) storage behavior without affecting the other module or `platform/periods` itself. The two modules do not depend on each other.
- **Full subsystem rollback:** revert Tasks 6-9's commits (storage integration + both module integrations) and the `periods` app becomes dead code with no callers — safe to leave in place or revert Tasks 1-5 too. No data loss in either case: files already stored under human-readable keys keep working (their `key` is just a string; `open()`/`signed_url()`/`delete()` don't care about its shape), they just wouldn't gain any _new_ period-aware uploads after a rollback.

## Regression risks

| Risk                                                                                                                  | Mitigation                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `store()`'s default (no `key`) path accidentally changes for existing callers (automation, reporting, ai)             | `test_storage.py` kept fully unmodified through Task 6 is the literal regression gate; a passing unmodified suite is the proof, not an assumption                                                                                                                                                                                                                                            |
| `resolve_location()` accidentally gains a DB dependency later (e.g. someone "helpfully" adds a lookup)                | Task 4's zero-query test fails immediately if this happens — it's a regression test, not a one-time check                                                                                                                                                                                                                                                                                    |
| Two modules' `DocumentTypeDef` for the same folder (`purchase_bill`) drift apart (different `folder_segment` strings) | Called out explicitly as a code-comment risk in Task 9; both register under the identical key, and `register_document_type` is last-write-wins by design (Task 3), so a drift would silently overwrite rather than error — acceptable for v1 given both are authored together in this plan, but worth a follow-up test in a later subsystem if a third module ever registers `purchase_bill` |
| Manifest drifts from reality after a direct DB delete/edit bypassing `record_document`                                | Task 5's `refresh_manifest` recomputes from a live aggregate every time it's called — never trusts its own prior value — so drift is self-healing on next refresh, not permanent                                                                                                                                                                                                             |
| Filename collision retry loop never terminates on a pathological key                                                  | `_dedupe_key` (Task 6) is bounded (raises `ConflictError` past a fixed attempt count) rather than looping forever                                                                                                                                                                                                                                                                            |
| `documents`/`purchase` integration breaks the tag-upload bug fixed in the prior session (`views.py` `setlist` fix)    | Task 8's acceptance criteria explicitly requires the full existing `test_documents.py` file (which includes that regression test) to stay green, not just the new period-specific tests                                                                                                                                                                                                      |
