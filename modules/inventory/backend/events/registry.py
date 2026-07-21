"""Inventory module event names — published on the shared platform event bus."""

from __future__ import annotations

ITEM_CREATED = "inventory.item_created"
ITEM_UPDATED = "inventory.item_updated"
STOCK_MOVED = "inventory.stock_moved"
LOW_STOCK = "inventory.low_stock"

ALL_EVENTS = (ITEM_CREATED, ITEM_UPDATED, STOCK_MOVED, LOW_STOCK)
