"""Registers purchase-bill ingestion as a platform ingest port.

Other modules (e.g. Documents' email-ingest view) route a raw attachment they
have classified as a purchase bill to this handler *through the platform*
(``shared.ingest``) — they never import ``PurchaseBillService`` directly. The
handler is a thin adapter: it maps the caller's ``(file bytes, filename,
content_type, channel)`` onto this module's existing ``ingest()`` contract and
returns the created ``PurchaseBill``. No business logic lives here.
"""

from __future__ import annotations

import base64
from typing import Any

from shared.ingest import IngestKind, register_ingest_handler


def _ingest_purchase_bill(
    *,
    file_data: bytes,
    filename: str = "",
    content_type: str = "",
    channel: str = "email",
    **_ignored: Any,
) -> Any:
    """Adapt raw attachment bytes onto ``PurchaseBillService.ingest``.

    The service's ingest contract carries the document as base64 inside its
    ``data`` payload and does its own storage + OCR downstream, so the bytes
    are handed over exactly the way the Telegram/webhook channels hand them
    over. No ``external_ref`` is set: ingest dedupes on it, and two unrelated
    emails that happen to share an attachment name must stay two bills, so
    each attachment is left to create its own record.
    """
    from purchase.backend.services.purchase_bill import PurchaseBillService

    payload: dict[str, Any] = {
        "document_base64": base64.b64encode(file_data).decode("ascii"),
    }
    return PurchaseBillService().ingest(data=payload, source_channel=channel)


def register_ingest_port() -> None:
    register_ingest_handler(IngestKind.PURCHASE_BILL, _ingest_purchase_bill)
