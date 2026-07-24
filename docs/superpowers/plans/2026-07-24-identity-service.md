# Identity Service — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `platform/identity` — `SourceIdentity` model, `IdentityService` (resolve/map/list), audit-subscriber wiring, read API, and integration into `purchase` (before OCR) and `documents` (manual uploads) — zero regressions.

**Architecture:** See `docs/superpowers/specs/2026-07-24-identity-service-design.md`. One model, one service, opaque mapping target (no cross-module FK, no new Employee model), audit via the existing per-app subscriber pattern, read-only API.

## Global Constraints

- Gate per task: `cd platform && pytest` green, `python -m ruff check .` clean, `python manage.py check` clean.
- `test_ingest.py` (purchase) and `test_documents.py` stay green with only additive cases — same acceptance-gate discipline as the Business Period Manager plan.
- No write API, no `Employee` model, no WhatsApp/Email/Webhook producers (taxonomy only).
- Small commits: one per task.

## Milestones

| #   | Milestone               | Tasks | Exit criteria                                                                            |
| --- | ----------------------- | ----- | ---------------------------------------------------------------------------------------- |
| M1  | App + model             | 1, 2  | `identity` app installed, migrated                                                       |
| M2  | Service + audit         | 3     | resolve/map idempotent, audited via existing `AuditService`                              |
| M3  | Read API                | 4     | `/api/v1/identity/identities/` live, permission-gated                                    |
| M4  | Module adoption         | 5, 6  | purchase + documents resolve identity, both modules' existing tests unmodified and green |
| M5  | Production-quality gate | 7     | full gate green, committed                                                               |

---

### Task 1: App skeleton, settings, permission, events

**Files:** Create `platform/identity/{__init__.py,apps.py,migrations/__init__.py}`. Modify `platform/config/settings.py`, `platform/permissions/registry.py`, `platform/shared/events.py`.

- [ ] `IdentityConfig` (name="identity"), added to `PLATFORM_APPS_BEFORE_MODULES` after `"periods"`.
- [ ] `PermissionDef("identity.view", "View source identities", "Identity")`.
- [ ] Add `IDENTITY_RESOLVED = "identity.resolved"` and `IDENTITY_MAPPED = "identity.mapped"` to `shared.events.Events`.
- [ ] Verify: `manage.py check`, full `pytest` unmodified-green. Commit.

### Task 2: `SourceIdentity` model + migration

**Files:** `identity/models.py`, `identity/migrations/0001_initial.py`, `platform/tests/test_identity_models.py`.

- [ ] Write failing test: unique `(tenant, channel, external_id)`; two tenants with the same channel/external_id don't collide.
- [ ] Implement model per design §3, `makemigrations identity`.
- [ ] Green. Full verify. Commit.

### Task 3: `IdentityService` + audit subscriber

**Files:** `identity/services.py`, `identity/subscribers.py` (wired in `apps.ready()`), `platform/tests/test_identity_service.py`.

**Acceptance criteria:** `resolve_identity` is idempotent (same triple → same row); a repeat resolution updates `display_name`/`last_seen_at` but never `channel`/`external_id`; `IDENTITY_RESOLVED` publishes exactly once (on creation only — assert via a monkeypatched `publish` call count, or by checking exactly one `AuditLog` row exists after two resolutions of the same identity); `map_to` sets the mapping fields and publishes `IDENTITY_MAPPED` every call (re-mapping is legitimate, unlike identity creation); an `AuditLog` row exists for each event with `module="identity"`.

- [ ] Write failing tests per the acceptance criteria above.
- [ ] Implement `IdentityService` + `subscribers.py` (mirrors `storage/subscribers.py`: subscribe to `IDENTITY_RESOLVED`/`IDENTITY_MAPPED`, call `AuditService().record(action=event, module="identity", object_type="SourceIdentity", object_id=str(instance.id))`).
- [ ] Green. Full verify. Commit.

### Task 4: Read API

**Files:** `identity/serializers.py`, `identity/views.py`, `identity/urls.py`, `platform/tests/test_identity_api.py`. Modify `platform/config/urls.py`.

- [ ] `GET /api/v1/identity/identities/` (list, tenant-scoped, `filterset_fields=("channel",)`), `GET .../{id}/` (retrieve). `required_permissions = {"default": "identity.view"}`.
- [ ] Write failing tests: list, channel filter, permission-denied, tenant isolation.
- [ ] Green. Full verify. Commit.

### Task 5: `purchase` integration

**Files:** Modify `modules/purchase/backend/services/purchase_bill.py`. Append to `modules/purchase/backend/tests/test_ingest.py`.

**Acceptance criteria:** identity resolved before `PurchaseOCRService` runs (assert via call-order or by checking the identity exists even when OCR is mocked to fail... simplest: assert a `SourceIdentity` row exists after ingest with `external_id=str(telegram_user_id)`); a second ingest from the same `telegram_user_id` reuses the same `SourceIdentity` row; after a vendor is resolved from OCR, the identity's `mapped_object_type == "Vendor"` and `mapped_object_id == str(vendor.id)`; every existing `test_ingest.py` test passes unmodified.

- [ ] Write failing tests.
- [ ] Add a `_CHANNEL_MAP = {"telegram": IdentityChannel.TELEGRAM, "email": IdentityChannel.EMAIL, "upload": IdentityChannel.MANUAL}` and the two `IdentityService` calls in `ingest()` (resolve before the OCR step; `map_to` right after `bill.vendor` is set from `extracted["vendor"]`).
- [ ] Full `test_ingest.py`, all green, unmodified originals included. Full verify. Commit.

### Task 6: `documents` integration

**Files:** Modify `modules/documents/backend/services/document.py`. Append to `modules/documents/backend/tests/test_documents.py`.

**Acceptance criteria:** a document created with an `owner` resolves a `MANUAL` `SourceIdentity` for that owner; a document created without an owner (system/anonymous) skips identity resolution without error; every existing `test_documents.py` test passes unmodified.

- [ ] Write failing tests.
- [ ] Add the `resolve_identity` call in `DocumentService.create()`, guarded on `owner is not None`.
- [ ] Full `test_documents.py`, all green. Full verify. Commit.

### Task 7: Final verification

- [ ] `pytest -q`, `manage.py check`, `ruff check platform`, `ruff format --check platform` — all green.
- [ ] `pnpm --filter web build` — unchanged (no `apps/web` files touched).
- [ ] Commit if formatting needed a fix.

## Migration plan

One additive migration: a new `identity_source_identity` table. No existing table touched — zero-downtime, no backfill.

## Rollback considerations

Same shape as the Business Period Manager plan: Tasks 1-4 are a new, unreferenced app until Task 5/6 land — revertible with a plain `git revert`. Tasks 5/6 are isolated to their own module's integration point; reverting either independently restores that module's prior behavior (bills/documents just stop gaining a `SourceIdentity`, nothing already stored is affected since `SourceIdentity` rows are additive, never referenced by a required FK from either module).

## Regression risks

| Risk                                                                                                                                                                              | Mitigation                                                                                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolve_identity` publishes `IDENTITY_RESOLVED` on every call (audit log flooding under a busy channel)                                                                          | Task 3's acceptance criteria explicitly test that a repeat resolution does not re-publish                                                                                                                                                                                                                                         |
| `purchase`'s existing ingestion tests break because identity resolution runs inside the same `transaction.atomic()` block and a resolution failure would roll back the whole bill | Identity resolution happens in `_fetch_and_store_document`, which already runs outside the `transaction.atomic()` block (before it, alongside the existing storage-fetch tolerance) — a resolution hiccup must not block ingestion, matching the existing "`document_url` retained either way" tolerance already in that function |
| `documents` upload breaks for system-created documents with no owner (e.g. a future automated import)                                                                             | Guarded explicitly on `owner is not None`, tested                                                                                                                                                                                                                                                                                 |
