"""Wires document events into platform capabilities.

Three directions, all through public platform surfaces only:
- Module events (documents.*) → the audit trail.
- Platform workflow events (workflow.completed / workflow.rejected) → advance
  the document whose approval just finished. This is how the module reacts to
  the platform workflow engine without the engine ever knowing what a Document
  is.
- Purchase's `purchase.bill.ingested` event → auto-register a Document for the
  bill's stored file. Importing that event *name* from purchase's own
  registry is the sanctioned way to react to another module's activity (see
  purchase.backend.events.registry's docstring) — this module never imports
  purchase's models or services, only the platform event bus and its own
  Document model.
"""

from __future__ import annotations

from typing import Any

from documents.backend.events.registry import ALL_EVENTS
from purchase.backend.events.registry import PURCHASE_BILL_INGESTED
from shared.events import subscribe


def _record_audit(event: str, instance: Any = None, actor: Any = None, **_extra: Any) -> None:
    from audit.services import AuditService

    AuditService().record(
        action=event,
        module="documents",
        object_type=type(instance).__name__ if instance is not None else "",
        object_id=str(getattr(instance, "id", "") or ""),
        changes={
            "title": getattr(instance, "title", ""),
            "status": getattr(instance, "status", ""),
            "category": getattr(instance, "category", ""),
        },
        actor=actor,
        tenant=getattr(instance, "tenant", None),
    )


def _create_document_from_purchase_bill(
    event: str, instance: Any = None, actor: Any = None, **_extra: Any
) -> None:
    """Registers a purchase bill's stored file as a Document. Reads the bill
    only through duck-typed attributes (never imports PurchaseBill itself —
    the same discipline the audit subscriber above already follows)."""
    import logging

    from documents.backend.models import Document, DocumentCategory
    from storage.models import StoredFile
    from users.models import User

    logger = logging.getLogger(__name__)

    storage_key = getattr(instance, "storage_key", "") or ""
    if not storage_key:
        return  # No file was stored for this bill (yet) — nothing to register.

    tenant = getattr(instance, "tenant", None)
    stored = StoredFile.objects.filter(key=storage_key, tenant=tenant).first()
    if stored is None:
        return

    seller_name = getattr(instance, "seller_name", "") or "Unknown vendor"
    purchase_date = getattr(instance, "purchase_date", "")
    invoice_number = getattr(instance, "invoice_number", "") or "N/A"
    currency = getattr(instance, "currency", "")
    total_rate = getattr(instance, "total_rate", "")

    try:
        Document.objects.get_or_create(
            tenant=tenant,
            file=stored,
            defaults={
                "title": f"Receipt — {seller_name} ({purchase_date})",
                "owner": User.objects.filter(tenant=tenant).first(),
                "category": DocumentCategory.INVOICE,
                "description": f"Invoice #{invoice_number} · {currency} {total_rate}",
            },
        )
    except Exception as exc:
        logger.warning("Could not register document for purchase bill: %s", exc)


def register_subscribers() -> None:
    for event in ALL_EVENTS:
        subscribe(event, _record_audit)
    subscribe(PURCHASE_BILL_INGESTED, _create_document_from_purchase_bill)
