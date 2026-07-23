"""Registers purchase bills as an automation-engine source.

Bills don't hold a `storage.StoredFile` foreign key like assets/contracts/
documents do — ingestion writes the document straight to the storage
provider and keeps only the raw `storage_key` (see
`purchase.backend.services.purchase_bill._fetch_and_store_document`). There
is no download endpoint for bills anywhere in the app today; this adapter
reads the provider directly rather than adding one, to keep this change
scoped to the automation engine. A bill with no `storage_key` (the source
document couldn't be fetched at ingest time) has no file to collect.
"""

from __future__ import annotations

import mimetypes

from automation.registry import CollectedFile, SourceAdapter, register_source

from purchase.backend.models import PurchaseBill
from purchase.backend.reports import TAG_MODULE, TAG_OBJECT_TYPE


def _list_tagged(tenant, tag_ids: list[str]) -> list[dict[str, str]]:
    from tagging.services import TagService

    object_ids = TagService().object_ids_for_tags(
        tenant=tenant, module=TAG_MODULE, object_type=TAG_OBJECT_TYPE, tag_ids=tag_ids
    )
    bills = PurchaseBill.objects.filter(tenant=tenant, id__in=object_ids)
    return [
        {"object_id": str(b.id), "title": f"{b.seller_name} — {b.invoice_number or b.id}"}
        for b in bills
    ]


def _collect_file(object_id: str) -> CollectedFile | None:
    bill = PurchaseBill.objects.filter(id=object_id).first()
    if bill is None or not bill.storage_key:
        return None
    from storage.providers import get_provider

    data = get_provider().get(bill.storage_key)
    filename = bill.storage_key.rsplit("/", 1)[-1]
    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    return CollectedFile(filename=filename, content_type=content_type, data=data)


def register_collectible() -> None:
    register_source(
        SourceAdapter(
            module=TAG_MODULE,
            label="Purchase bills",
            permission="purchase.bill.read",
            object_type=TAG_OBJECT_TYPE,
            list_tagged=_list_tagged,
            collect_file=_collect_file,
        )
    )
