"""Search adapter registration for assets."""

from __future__ import annotations

from assets.backend.models import Asset
from search.registry import SearchAdapter, register

INDEX = "assets"


def to_document(asset: Asset) -> dict:
    body = " ".join(
        filter(
            None,
            [
                asset.asset_tag,
                asset.serial_number,
                asset.get_category_display(),
                asset.assigned_to,
                asset.supplier,
                asset.location,
                asset.notes,
            ],
        )
    )
    return {
        "doc_id": str(asset.id),
        "title": asset.name,
        "body": body,
        "extra": {"status": asset.status, "category": asset.category},
        "url": f"/assets/{asset.id}",
    }


def register_search() -> None:
    register(
        SearchAdapter(
            index=INDEX,
            label="Assets",
            permission="assets.read",
            to_document=to_document,
            queryset=lambda: Asset.objects.all(),
        )
    )
