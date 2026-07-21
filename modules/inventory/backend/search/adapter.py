"""Search adapter registration for inventory items."""

from __future__ import annotations

from inventory.backend.models import InventoryItem
from search.registry import SearchAdapter, register

INDEX = "inventory"


def to_document(item: InventoryItem) -> dict:
    body = " ".join(
        filter(None, [item.sku, item.category, item.supplier, item.location, item.notes])
    )
    return {
        "doc_id": str(item.id),
        "title": item.name,
        "body": body,
        "extra": {
            "category": item.category,
            "is_active": "yes" if item.is_active else "no",
            "low_stock": "yes" if item.is_low_stock else "no",
        },
        "url": f"/inventory/{item.id}",
    }


def register_search() -> None:
    register(
        SearchAdapter(
            index=INDEX,
            label="Inventory",
            permission="inventory.read",
            to_document=to_document,
            queryset=lambda: InventoryItem.objects.all(),
        )
    )
