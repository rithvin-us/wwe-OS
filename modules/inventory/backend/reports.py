"""Registers the stock-on-hand report into the platform report catalog."""

from __future__ import annotations

from inventory.backend.models import InventoryItem
from inventory.backend.services.inventory import InventoryService
from reporting.registry import ReportDefinition, register_report


def register_reports() -> None:
    register_report(
        ReportDefinition(
            key="inventory-stock",
            label="Stock on hand",
            module="inventory",
            permission="inventory.read",
            description="Every item with on-hand quantity, reorder level, and value.",
            build_spec=lambda tenant: InventoryService().build_report_spec(
                items=InventoryItem.objects.filter(tenant=tenant)
            ),
        )
    )
