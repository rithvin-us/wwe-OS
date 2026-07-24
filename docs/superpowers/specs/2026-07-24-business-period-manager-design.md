# Business Period Manager & Storage Domains — Design

**Status:** Approved 2026-07-24, refined per approval feedback (§9) — implementation in progress.
**Scope:** Subsystem 2 of the "Business Operations Orchestrator" redesign (Subsystem 1, the generic pipeline execution engine at `platform/workflow`, is built — see `docs/superpowers/specs/2026-07-24-pipeline-execution-engine-design.md`). This spec covers _only_: (a) a `platform/periods` capability that resolves which business period (or the permanent Library) a document belongs to, and (b) the additive changes to `platform/storage` needed to make the physical file tree human-readable and period/library-aware. The Incoming Document Pipeline (channel ingestion, OCR, classification, rules validation), the Auditor Package pipeline (PDF consolidation), Search facets, Cloud Sync, and the visual Dashboard are later, separate sub-projects — see § Out of scope.

---

## 1. Context

Today `StorageService.store()` (`platform/storage/services.py:37-87`) writes every file — documents, purchase bills, automation zip packages, report exports — under one opaque key shape: `t/{tenant.id}/{module}/{YYYY/MM of upload time}/{uuid}-{filename}`. On the local provider this is a real directory tree on disk (`platform/storage/providers.py:51-85`), but it means nothing to a human: a business owner browsing `.storage/t/3f9a.../purchase/2026/07/8b21c4-invoice.pdf` in Explorer can't tell what period or vendor it belongs to, and `StoredFile` has no field that says "this is a June invoice" versus "this is the permanent GST certificate."

The product requirement ("the filesystem must always mirror business reality," two domains — a rotating `Company/{Year}/{Month}/{Type}/` tree and a permanent `Company/Library/{Type}/` tree) needs three things `platform/storage` doesn't have: (1) a human-readable, collision-safe key builder, (2) a way to know which business period a file belongs to that survives being queried later (not just embedded unparseable in a key string), and (3) a shared, cross-module vocabulary for "document type" (Invoices, Purchase Bills, POs, Delivery Challans, GST, Insurance, ...) so every module files things the same way instead of each inventing its own folder names.

**Why this is a new capability, not a documents-module feature:** every business module that stores files — `documents`, `purchase` (bills), and eventually `assets` (delivery challans), `contracts`, HR-adjacent uploads — needs the same period/library resolution. Building it once into `documents` and asking other modules to import from it would violate architecture rule 2 (modules never import each other); building it separately per module would violate rule 3 (never reimplement a platform capability). It belongs in `platform/`, sitting next to `storage`, the same relationship `workflow` has to `automation`.

---

## 2. Central decisions

**a) Additive only — `platform/storage` does not change shape for existing callers.** `StorageService.store()` gets three new optional keyword arguments (`key`, `period_year`, `period_month`) and `StoredFile` gets three new nullable/defaulted columns (`period_year`, `period_month`, `is_library`). Every existing caller (automation packages, report exports, AI artifacts, today's `documents`/`purchase` calls) keeps working with zero code changes and keeps the opaque key shape. Only callers that opt in by passing `key=` get the human-readable tree. This is the same non-breaking-migration pattern automation used to adopt `workflow` (§5 of the Subsystem 1 spec) — old callers untouched, new capability layered underneath.

**b) `platform/periods` computes paths and dates; `platform/storage` still writes bytes.** `platform/periods` never touches a storage provider directly (mirrors "modules never touch a provider," `storage/services.py:1-6`). It exposes a pure resolver — given a document type and a business date, return the key prefix and period fields — that callers pass straight into `StorageService.store(key=..., period_year=..., period_month=...)`. No duplicated file-writing logic anywhere.

**c) Document type is a registry, not a new taxonomy owned by one module.** Same idiom as `SourceAdapter` (`automation/registry.py`), `PipelineDefinition` (`workflow/registry.py`), and `ReportDefinition` (`reporting/registry.py`): each module registers its document types from its own `AppConfig.ready()`. A `DocumentTypeDef` carries `(key, label, folder_segment, is_library, module)`. `documents` registers one entry per `DocumentCategory` value it already has (`invoice`, `po`, `purchase_bill`, `contract`, `policy`, `report`, `correspondence`, `other` → rotating; nothing library-only yet), `purchase` registers `purchase_bill` (rotating, `folder_segment="Purchase Bills"`) pointing at the same key `documents` uses for that category so both modules' bills land in the identical folder — the registry key is the shared vocabulary, not the module. No new taxonomy is invented in this spec beyond what's needed to satisfy the folder names explicitly listed in the product requirement (Invoices, Purchase Bills, Purchase Orders, Delivery Challans, Reports, HR, Auditor, Logs for the rotating side; the Library categories listed verbatim in the requirement). Types with no current producer (Delivery Challans, HR, Auditor, Logs, and every Library category) are registered so the folder exists in the taxonomy and future subsystems have a stable key to file into — this spec does not build their producers.

**d) The business date is caller-supplied, not upload time.** A bill dated 28 June, uploaded 2 July, belongs in June. `PeriodService.resolve()` takes an explicit `business_date: date`; the caller (documents/purchase module) passes whatever date field it already has (`PurchaseBill.invoice_date`, `purchase/backend/models/purchase_bill.py:70`) or `date.today()` if it has none. `platform/periods` never guesses a date from OCR text or a filename — that belongs to a future classification/rules subsystem, not this one.

**e) Calendar year, not fiscal year, for v1.** `Tenant` has no fiscal-year-start setting today (`platform/tenancy/models.py`). Adding one now would be speculative — nothing in the product requirement asks for a non-calendar fiscal year, and `Company/2026/January/.../December/` in the spec is explicitly calendar-named. Out of scope; add `CompanyProfile.fiscal_year_start_month` later if a real need shows up.

**f) `BusinessPeriod` is a thin, lazily-created anchor row — not a counter cache.** It exists so the future Dashboard and Auditor Package subsystems have something to point `pipeline_run`/`generated_at` fields at ("is August 2026 closed? has its auditor package been generated?"). Document counts per period are always a live `StoredFile.objects.filter(...).count()` query, never a stored counter — consistent with the "no fake data, no stale numbers" rule. `get_or_create_period()` is called by `PeriodService.resolve()` itself, so a period row appears the first time any document lands in it; nothing pre-creates twelve empty months.

**g) Root segment is `Tenant.slug`, not `CompanyProfile.legal_name`.** Slug is already unique, filesystem/URL-safe, and set at tenant creation (`tenancy/models.py:25`); legal name is free text that can contain characters unsafe in a path and is optional/blank by default. `Company/` in the product spec is realized as `{tenant.slug}/` — for a single-operator deployment (one tenant) this is indistinguishable from a literal `Company/` root in practice, and it stays correct if multi-tenancy is ever reactivated.

**h) Filename collisions get a numeric suffix, not a UUID — handled by `StorageService`, not `PeriodService` (revised, §9b).** Human-readable means `Invoice-Acme-2026-07-14.pdf`, not `Invoice-Acme-2026-07-14-8b21c4.pdf`. Because `StoredFile.key` already has a DB `unique=True` constraint (`storage/models.py:24`), collision detection belongs where the DB write already happens — `StorageService.store()` — not in the period resolver, which must stay a pure function (§9a). This is a change from today's always-UUID-prefixed opaque keys, scoped only to callers that opt into `key=`.

---

## 3. New platform app: `platform/periods`

**Module layout reflects the pure/impure split from §9a:** `periods/resolution.py` holds `DocumentContext`, `ResolvedLocation`, and `resolve_location()` — pure, no imports from `django.db`, no `BaseService`. `periods/services.py` holds `PeriodService` — the DB-touching side (period rows, manifest, lifecycle). Neither imports the other's I/O; `resolve_location()` is called first (in-memory only), its output is what `PeriodService` and `StorageService` are given.

### Models (`periods/models.py`)

```python
class PeriodStatus(models.TextChoices):
    OPEN = "open", "Open"           # accepting documents, default for a newly-touched period
    ACTIVE = "active", "Active"     # reserved for a future "current period" marker
    CLOSING = "closing", "Closing"  # future: auditor package generation in progress
    CLOSED = "closed", "Closed"     # future: locked, no further writes (not enforced yet)
    ARCHIVED = "archived", "Archived"


class BusinessPeriod(TenantOwnedModel):
    year = models.PositiveIntegerField()
    month = models.PositiveSmallIntegerField()  # 1-12
    status = models.CharField(max_length=10, choices=PeriodStatus.choices, default=PeriodStatus.OPEN)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta(TenantOwnedModel.Meta):
        db_table = "periods_business_period"
        constraints = [
            models.UniqueConstraint(fields=["tenant", "year", "month"], name="uniq_period_per_tenant")
        ]
        indexes = [models.Index(fields=["tenant", "year", "month"])]


class PeriodManifest(TenantOwnedModel):
    """A cache, not a source of truth (§9c) — always rebuildable from
    StoredFile aggregates. Exists so the Dashboard (a later subsystem)
    doesn't run a live aggregate query on every load."""
    period = models.OneToOneField(BusinessPeriod, on_delete=models.CASCADE, related_name="manifest")
    document_counts = models.JSONField(default=dict, blank=True)  # {document_type_key: count}
    total_count = models.PositiveIntegerField(default=0)
    # created_at/updated_at ("last_updated") inherited from BaseModel — not
    # redeclared, per "no duplicated logic" applied to schema too.

    class Meta(TenantOwnedModel.Meta):
        db_table = "periods_manifest"
```

No model for "Library" — the Library is simply `is_library=True` on a `StoredFile`, with `period_year`/`period_month` null; its counts are a live aggregate (§9c), not manifested, since there's no per-period rotation to cache against. No `DocumentType` database table — types are code, registered at import time (decision c).

### Registry (`periods/registry.py`) — mirrors `workflow/registry.py`

```python
DocumentTypeDef(key, label, folder_segment, is_library: bool, module: str)

register_document_type(definition)      # idempotent by key
get_document_type(key) -> DocumentTypeDef        # NotFoundError if unknown
all_document_types() -> list[DocumentTypeDef]
```

### Pure resolver (`periods/resolution.py`) — revised per §9a

```python
@dataclass(frozen=True)
class DocumentContext:
    document_type: str
    document_name: str
    tenant_slug: str
    business_date: date | None = None
    source_channel: str = ""
    metadata: dict = field(default_factory=dict)  # unused today — reserved for future callers


@dataclass(frozen=True)
class ResolvedLocation:
    key: str
    period_year: int | None
    period_month: int | None
    is_library: bool


def resolve_location(context: DocumentContext) -> ResolvedLocation:
    """Pure: an in-memory registry lookup (get_document_type) plus string
    formatting. No DB, no OCR, no Storage, no AI (§9a) — safe to call from
    anywhere, including in a request path, with no side effects."""
    definition = get_document_type(context.document_type)
    if definition.is_library:
        key = f"{context.tenant_slug}/Library/{definition.folder_segment}/{context.document_name}"
        return ResolvedLocation(key=key, period_year=None, period_month=None, is_library=True)

    if context.business_date is None:
        raise ValueError(f"document_type '{context.document_type}' is period-rotating and requires business_date.")
    year, month = context.business_date.year, context.business_date.month
    month_name = calendar.month_name[month]
    key = f"{context.tenant_slug}/{year}/{month_name}/{definition.folder_segment}/{context.document_name}"
    return ResolvedLocation(key=key, period_year=year, period_month=month, is_library=False)
```

(`ValueError`, not `shared.exceptions.ValidationError` — the latter is a DRF-facing exception type; a pure function raising it would leak an HTTP-layer concept into a layer that has no request. Callers translate it at the API boundary as they already do for other `ValueError`s.)

### `PeriodService` (`periods/services.py`) — the DB-touching side, revised per §9a/§9c/§9d

```python
class PeriodService(BaseService):
    def get_or_create_period(self, *, tenant, year: int, month: int) -> BusinessPeriod: ...

    def record_document(self, *, tenant, resolved: ResolvedLocation, document_type: str) -> None:
        """Called by a module AFTER StorageService.store() succeeds (ordering:
        never record a period/manifest entry for a file that didn't actually
        get stored). No-ops for is_library locations. Gets-or-creates the
        period, then calls refresh_manifest for it."""

    def refresh_manifest(self, *, period: BusinessPeriod) -> PeriodManifest:
        """Recomputes document_counts from a single grouped StoredFile
        aggregate query (DB, not filesystem — §9c) and upserts the manifest
        row. Cheap: one period's counts, not a platform-wide scan."""

    def list_periods(self, *, tenant) -> list[BusinessPeriod]: ...

    def set_status(self, *, period: BusinessPeriod, status: str) -> BusinessPeriod:
        """Records a lifecycle transition. No enforcement of what a given
        status forbids (§9d) — future subsystems (Auditor Package, Reporting)
        decide what CLOSING/CLOSED means for their own writes."""
```

### API (`periods/views.py`, `periods/urls.py`) — read-only, mounted at `/api/v1/periods/`

- `GET /periods/` — list `BusinessPeriod`s for the caller's tenant, each with its `manifest.document_counts`/`total_count` (cached, §9c) and `status`.
- `GET /periods/{year}/{month}/` — one period's detail: manifest counts by document type, most recent uploads (live `StoredFile` query, small `LIMIT`).
- `GET /periods/library/` — Library counts by type, live aggregate (no manifest, §3 note above).

Permission: new `periods.view` (registered in `platform/permissions/registry.py`, same pattern as `workflow.view`).

---

## 4. Storage integration (additive changes only)

`platform/storage/models.py` — add to `StoredFile`:

```python
period_year = models.PositiveIntegerField(null=True, blank=True)
period_month = models.PositiveSmallIntegerField(null=True, blank=True)
is_library = models.BooleanField(default=False)
```

`platform/storage/services.py` — `StorageService.store()` gains:

```python
def store(
    self, *, data, filename, content_type, module, tenant=None, uploaded_by=None,
    category="", metadata=None, max_size_bytes=None, allowed_types=None,
    key: str | None = None, period_year: int | None = None, period_month: int | None = None,
    is_library: bool = False,
) -> StoredFile:
    ...
    final_key = key or f"t/{tenant.id}/{module}/{timezone.now():%Y/%m}/{uuid.uuid4().hex[:12]}-{name}"
    ...
    stored = StoredFile.objects.create(..., period_year=period_year, period_month=period_month, is_library=is_library)
```

No change to `open()`, `signed_url()`, `delete()`, `verify_integrity()`, or either provider — a human-readable key is still just a string key to them; `LocalStorageProvider._path()`'s traversal guard (`providers.py:57-61`) already works for any key shape.

---

## 5. Module integration

**`documents`** (`modules/documents/backend/services/document.py:47-85`, `DocumentService.create()`): build a `DocumentContext`, call `resolve_location()` (pure), pass the result's `key`/`period_year`/`period_month`/`is_library` into `StorageService().store(...)`, then — only after `store()` returns successfully — call `PeriodService().record_document(tenant=, resolved=, document_type=category)` (§3's ordering rule). `Document` has no business-date field today — for v1, `business_date` defaults to `date.today()` for document types without a natural date (policy, contract, correspondence, other); this spec does not add a date picker to the upload UI (that's ingestion-pipeline/UI scope).

**`purchase`** (`modules/purchase/backend/services/purchase_bill.py`, `_fetch_and_store_document`/`ingest()`): pass `business_date=parsed invoice_date` when available (falls back to `date.today()` before OCR has run — bills are stored before extraction completes, per the existing store-first design, § "Store" step in `ingest()`), same store-then-record_document ordering. Re-resolve/move is **not** done retroactively if OCR later finds a different invoice date than the ingest-time guess — reclassifying an already-filed document is Rules Engine scope (out of scope here, see §6).

Both integrations are small, additive diffs to existing `create()`/`ingest()` call sites — no new duplicated storage or period logic in either module.

---

## 6. Out of scope for this spec

The Incoming Document Pipeline's Identify-Sender / OCR / Classification / Rules-Validation steps and its Telegram/WhatsApp/Email/Webhook channel abstraction; retroactive re-filing when classification changes after the fact; the Auditor Package pipeline and PDF Consolidator; Search Index period/library facets; the visual Dashboard (period cards, storage health, pipeline monitor); Cloud Sync and conflict handling; fiscal-year configuration; HR and Logs folder producers (folders are registered in the taxonomy, nothing writes into them yet); a UI for browsing the period/library tree (the read API in §3 exists so it _can_ be built later); **enforcing** `PeriodStatus` (rejecting writes to a `CLOSED` period) — the field and `set_status()` exist so later subsystems have somewhere to record and read lifecycle state, but nothing in this spec refuses a write based on it (§9d).

---

## 7. Test plan

Gate (per `CLAUDE.md`): `cd platform && pytest` green, `python -m ruff check .` clean, `python manage.py check` clean.

- `test_periods_models.py` — unique constraint on `(tenant, year, month)`; `BusinessPeriod.status` defaults to `OPEN`; `PeriodManifest` is one-to-one with its period and defaults `document_counts={}`/`total_count=0`.
- `test_periods_registry.py` — register/get/all round-trip, unknown-key error, idempotent re-registration (mirrors `test_workflow_registry.py`).
- `test_periods_resolution.py` — proves purity as much as a test can: rotating context produces `{slug}/{year}/{MonthName}/{segment}/{name}` with correct `period_year`/`period_month`; library context produces `{slug}/Library/{segment}/{name}` with `period_year`/`period_month` both `None`; rotating context without `business_date` raises `ValueError`; unknown `document_type` raises `NotFoundError` (from the registry); calling `resolve_location()` performs **zero** DB queries (`django.test.utils.CaptureQueriesContext` asserts `len(queries) == 0`) and creates no `BusinessPeriod` row — the concrete proof of §9a.
- `test_periods_service.py` — `get_or_create_period` is idempotent; `record_document` creates the period and updates its manifest, and is a no-op (creates nothing) for an `is_library` `ResolvedLocation`; `refresh_manifest` recomputes counts from `StoredFile` aggregates matching what's actually stored (not a running counter — deletes/edits are reflected on next refresh); `set_status` records the transition with no side effects beyond the field write; two tenants' periods never collide.
- Additive tests in `test_storage.py` — `store(key=...)` uses the exact key given (no opaque prefix); `period_year`/`period_month`/`is_library` persist; a second `store(key=<same key>)` gets a `-2` suffix instead of an `IntegrityError`; **all existing `test_storage.py` tests pass unmodified** — the backward-compatibility acceptance gate, same role `test_automation.py` played in Subsystem 1.
- Additive tests in `documents`' and `purchase`'s own test suites — an uploaded document/ingested bill lands at the expected human-readable key and period, and its period's manifest count increments.

---

## 8. File inventory

**New app `platform/periods/`:** `apps.py`, `models.py` (`PeriodStatus`, `BusinessPeriod`, `PeriodManifest`), `registry.py`, `resolution.py` (`DocumentContext`, `ResolvedLocation`, `resolve_location` — pure), `services.py` (`PeriodService` — DB-touching), `serializers.py`, `views.py`, `urls.py`, `migrations/0001_initial.py`.

**New inside `documents/` and `purchase/`:** each registers its `DocumentTypeDef`s from `apps.py ready()` (new `documents/document_types.py`, `purchase/document_types.py`).

**Modified:** `platform/storage/models.py`, `platform/storage/services.py` (additive fields/kwargs + collision-suffix retry only), `platform/config/settings.py` (add `"periods"` to `PLATFORM_APPS_BEFORE_MODULES`, before `documents`/`purchase`-adjacent modules that will import it), `platform/config/urls.py` (mount `periods.urls`), `platform/permissions/registry.py` (add `periods.view`), `modules/documents/backend/services/document.py`, `modules/purchase/backend/services/purchase_bill.py`.

**Untouched:** every other `StorageService.store()` caller (automation, reporting, ai) — verified by the unmodified-`test_storage.py` gate above.

---

## 9. Refinements approved 2026-07-24 (rationale)

The approval added four requirements; this section records how each maps onto §§2-8 above so the mapping stays traceable rather than silently folded in.

**a) "`PeriodService` must remain a pure function. No database access."** Read literally this contradicts `PeriodManifest`/`PeriodStatus` (§9c/§9d), which cannot exist without persistence. The engineering intent — keep path-resolution decoupled from DB/OCR/Storage/AI side effects — is preserved by moving the actual pure computation into a standalone function, `resolve_location()`, in its own module (`periods/resolution.py`) with no `BaseService`, no `django.db` import, nothing but the in-memory registry and stdlib `calendar`/`dataclasses`. `PeriodService` is the separate, explicitly DB-touching class that owns everything resolution doesn't: creating/reading `BusinessPeriod` rows, maintaining the manifest, recording lifecycle transitions. `DocumentContext` (§3) is the immutable input `resolve_location()` takes instead of positional args — new optional fields (it already reserves `source_channel` and an unused `metadata` dict) extend the object without touching existing call sites, satisfying "future additions should not require changing every caller."

**b) Filename collisions.** Originally assigned to the period resolver (§2h in the original draft); moved to `StorageService.store()` (§2h as revised, §3) because the DB unique constraint that makes a collision detectable already lives there, and giving the resolver DB access to check for collisions would violate (a).

**c) Period Manifest.** Added as `PeriodManifest` (§3), one-to-one with `BusinessPeriod`, holding `document_counts`/`total_count`. Explicitly a cache: `refresh_manifest()` always recomputes from a `StoredFile` aggregate query (DB — fast, indexed by `(tenant, period_year, period_month)` via the additive columns in §4) and never from a filesystem walk, and never accumulates via +1/-1 counters that could drift from reality after an edit or delete. "Fast dashboard loading" is satisfied by the manifest being pre-computed at write time (`record_document`, called right after every successful store) rather than at every read.

**d) Period Lifecycle.** Added as `PeriodStatus` (`OPEN/ACTIVE/CLOSING/CLOSED/ARCHIVED`) on `BusinessPeriod`, defaulting to `OPEN`, plus `PeriodService.set_status()` to record a transition. Per the approval's explicit instruction, nothing in this spec reads or enforces the status to gate a write — no period is ever locked by this subsystem. It exists purely as a field later subsystems (Auditor Package, Reporting, Automation) can set and query.

**Database-first reaffirmed:** this was already decision (b)/§4-§5 in the original draft (Period Manager and modules pass data into `StorageService`/DB rows; nothing parses a folder path back into meaning) — no design change needed, only worth restating: the human-readable key is a write-time projection for operators browsing the disk, never a read path for the platform itself. Search, Dashboard, Reports, Automation, and AI (all later subsystems) query `StoredFile`/`BusinessPeriod`/`PeriodManifest`, never the filesystem.
