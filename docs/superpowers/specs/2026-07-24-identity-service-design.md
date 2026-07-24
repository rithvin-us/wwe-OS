# Identity Service — Design

**Status:** Approved 2026-07-24 (part of the full Business Operations Orchestrator roadmap approval) — implementation in progress.
**Scope:** Subsystem 3. A single, trusted "who sent this" layer for every incoming-document channel (Telegram today; WhatsApp/Email/Webhook reserved; Manual Upload). Employee mapping, Vendor mapping, and Rules Engine (Subsystem 5) validation are consumers of this, not built here.

---

## 1. Context

Today "who sent this" is reinvented per channel: `PurchaseBill` has `telegram_user_id`/`telegram_username` fields baked directly into the purchase model (`modules/purchase/backend/models/purchase_bill.py:45-46`); manual document uploads have no channel concept at all — identity is implicitly "whoever is authenticated" (`Document.owner`). Nothing ties a channel identity (a Telegram user ID) to a business entity (a `Vendor`) as a durable, queryable fact — `PurchaseBillService.ingest()` re-resolves `Vendor.objects.get_or_create(name=...)` from OCR text on every bill, with no memory that "this Telegram account is always this vendor."

The product requirement: every incoming document gets a trusted Source Identity **before** OCR/processing runs, and that identity can be mapped to a vendor, an employee, or nothing yet (unmapped, pending human triage).

## 2. Central decisions

**a) One model, one service, no per-channel special-casing.** `SourceIdentity` is channel-agnostic: `(tenant, channel, external_id)` is the durable, unique fact; everything else (`display_name`, the mapping) can change without touching the identity fact itself. `IdentityService.resolve_identity()` is the single entry point every channel calls — a Telegram bot and a future WhatsApp webhook call the exact same method with a different `channel` value, not two different code paths.

**b) The mapping target is opaque — same idiom as `workflow`/`tagging`/`periods`.** `mapped_module`/`mapped_object_type`/`mapped_object_id` point at a `Vendor` (`purchase.Vendor`) or a future employee reference without `platform/identity` ever importing a business module (architecture rule 1/2). No `Employee` model is created here — `docs/specs/hr-integration-strategy.md` is explicit that a real `Employee` entity is Phase 3 HR-migration work, not warranted yet; "Employee mapping" for this subsystem means the opaque slot exists and is exercised by nothing today, the same way `periods` reserved HR/Auditor/Logs folders with no producer yet.

**c) Identity is immutable; presentation is not.** `channel`/`external_id` are never rewritten after creation (enforced by never including them in an update path — `resolve_identity` only ever creates-or-fetches by that triple). `display_name` and `last_seen_at` update on every resolution (a Telegram username can change; the underlying user ID cannot) — this is "immutable source tracking" read as "the fact of which channel account this is never drifts," not "the row is frozen."

**d) Audit reuses `AuditService`, not a new log.** `IdentityService` publishes `Events.IDENTITY_RESOLVED` (only on first creation, not on every re-resolution — a busy channel would otherwise flood the audit log) and `Events.IDENTITY_MAPPED`; `platform/identity/subscribers.py` reacts and calls the existing `AuditService().record(...)`, the same per-app subscriber pattern `storage`, `purchase`, and `documents` already use (`storage/subscribers.py`) — not the older central `AUDITED_EVENTS` list, which is a closed set for auth/tenancy events only.

**e) No write API.** Identities are created by ingestion code server-side, not by a user through a form — there is no product requirement for a human to manually create one yet. Read-only API only (`identity.view`); add write endpoints when a real caller needs them (Rules Engine, later, may need `map_to` exposed for manual triage — not yet).

---

## 3. Model (`identity/models.py`)

```python
class IdentityChannel(models.TextChoices):
    TELEGRAM = "telegram", "Telegram"
    WHATSAPP = "whatsapp", "WhatsApp"      # reserved — no producer yet
    EMAIL = "email", "Email"                # reserved — no producer yet
    WEBHOOK = "webhook", "Webhook"           # reserved — no producer yet
    MANUAL = "manual", "Manual upload"


class SourceIdentity(TenantOwnedModel):
    channel = models.CharField(max_length=10, choices=IdentityChannel.choices)
    external_id = models.CharField(max_length=200)       # channel-specific: telegram user id, email address, ...
    display_name = models.CharField(max_length=200, blank=True, default="")
    mapped_module = models.CharField(max_length=50, blank=True, default="")
    mapped_object_type = models.CharField(max_length=100, blank=True, default="")
    mapped_object_id = models.CharField(max_length=64, blank=True, default="")
    last_seen_at = models.DateTimeField(auto_now=True)

    class Meta(TenantOwnedModel.Meta):
        db_table = "identity_source_identity"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "channel", "external_id"], name="uniq_identity_per_channel"
            )
        ]
        indexes = [models.Index(fields=["tenant", "channel", "external_id"])]
```

## 4. Service (`identity/services.py`)

```python
class IdentityService(BaseService):
    def resolve_identity(self, *, tenant, channel: str, external_id: str, display_name: str = "") -> SourceIdentity:
        """Idempotent by (tenant, channel, external_id). Creates + publishes
        IDENTITY_RESOLVED on first sight; on a repeat, only refreshes
        display_name/last_seen_at (no event — see design §2d)."""

    def map_to(self, *, identity: SourceIdentity, module: str, object_type: str, object_id: str) -> SourceIdentity:
        """Sets/overwrites the mapping target, publishes IDENTITY_MAPPED."""

    def list_identities(self, *, tenant, channel: str | None = None) -> list[SourceIdentity]: ...
```

## 5. Integration

- **`purchase`**: `_fetch_and_store_document`'s caller (`ingest()`) resolves identity **before** `PurchaseOCRService` runs — `channel` mapped from the existing `SourceChannel` enum (`telegram`→`telegram`, `email`→`email`, `upload`→`manual`), `external_id=str(telegram_user_id)` (or a channel-appropriate fallback), `display_name=telegram_username`. After OCR resolves a `Vendor`, `map_to(module="purchase", object_type="Vendor", object_id=vendor.id)` — the identity "learns" the vendor over repeat ingests from the same account, without this subsystem building any inference logic itself (Rules Engine, later, can read this mapping to skip re-asking).
- **`documents`**: `DocumentService.create()` resolves `channel=MANUAL, external_id=str(owner.id)` when `owner` is present (an anonymous/system upload has no identity to resolve, and is skipped) — satisfies "every incoming document gets a trusted Source Identity" for the one channel that exists in `documents` today.

## 6. Out of scope

WhatsApp/Email/Webhook producers (taxonomy only, as with `periods`' unfilled folders); a real `Employee` model (HR Phase 3); a write/manual-mapping API; Rules Engine consumption of the mapping (Subsystem 5); retroactive re-identification.

## 7. Test plan

Gate: `pytest` green, `ruff check` clean, `manage.py check` clean. `test_ingest.py` and `test_documents.py` stay green **unmodified** except for the additive identity-specific cases (same acceptance-gate discipline as Subsystem 2).

- `test_identity_models.py` — unique `(tenant, channel, external_id)`.
- `test_identity_service.py` — `resolve_identity` idempotent, event fires once not on repeat, `display_name`/`last_seen_at` update on repeat while `channel`/`external_id` never change, `map_to` sets fields and publishes, cross-tenant isolation.
- `test_identity_api.py` — list/retrieve, channel filter, permission, tenant isolation.
- Additive cases in `test_ingest.py` (bill's ingest creates/reuses a `SourceIdentity`, second ingest from the same `telegram_user_id` maps to the same identity, `map_to` fires after vendor resolution) and `test_documents.py` (manual upload resolves a `MANUAL` identity for the owner).
