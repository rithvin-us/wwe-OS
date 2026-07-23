"""Registers the stock-on-hand report into the platform report catalog."""

from __future__ import annotations

from inventory.backend.models import InventoryItem
from inventory.backend.services.inventory import InventoryService
from reporting.filtering import apply_date_range, apply_tag_filter
from reporting.registry import ReportDefinition, register_report

TAG_MODULE = "inventory"
TAG_OBJECT_TYPE = "InventoryItem"


def _build(tenant, filters: dict):
    items = InventoryItem.objects.filter(tenant=tenant)
    items = apply_date_range(items, filters, field="created_at")
    items = apply_tag_filter(
        items, filters, tenant=tenant, module=TAG_MODULE, object_type=TAG_OBJECT_TYPE
    )
    vendor = filters.get("vendor") or ""
    if vendor:
        items = items.filter(supplier__icontains=vendor)
    applied = {
        "date_from": filters.get("date_from"),
        "date_to": filters.get("date_to"),
        "vendor": vendor,
        "tag_ids": filters.get("tag_ids"),
    }
    return InventoryService().build_report_spec(items=items, filters=applied)


def register_reports() -> None:
    register_report(
        ReportDefinition(
            key="inventory-stock",
            label="Stock on hand",
            module="inventory",
            permission="inventory.read",
            description="Every item with on-hand quantity, reorder level, and value.",
            build_spec=_build,
        )
    )
