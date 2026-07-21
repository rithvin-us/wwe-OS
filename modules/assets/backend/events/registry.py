"""Asset module event names — published on the shared platform event bus."""

from __future__ import annotations

ASSET_CREATED = "assets.created"
ASSET_UPDATED = "assets.updated"
ASSET_ASSIGNED = "assets.assigned"
ASSET_RETURNED = "assets.returned"
MAINTENANCE_STARTED = "assets.maintenance_started"
MAINTENANCE_COMPLETED = "assets.maintenance_completed"
ASSET_DISPOSED = "assets.disposed"

ALL_EVENTS = (
    ASSET_CREATED,
    ASSET_UPDATED,
    ASSET_ASSIGNED,
    ASSET_RETURNED,
    MAINTENANCE_STARTED,
    MAINTENANCE_COMPLETED,
    ASSET_DISPOSED,
)
