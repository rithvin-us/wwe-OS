"""Contract module event names — published on the shared platform event bus."""

from __future__ import annotations

CONTRACT_CREATED = "contracts.created"
CONTRACT_UPDATED = "contracts.updated"
CONTRACT_SUBMITTED = "contracts.submitted"
CONTRACT_ACTIVATED = "contracts.activated"
CONTRACT_REJECTED = "contracts.rejected"
CONTRACT_TERMINATED = "contracts.terminated"
CONTRACT_EXPIRED = "contracts.expired"
CONTRACT_EXPIRING = "contracts.expiring"
CONTRACT_SUMMARIZED = "contracts.summarized"

ALL_EVENTS = (
    CONTRACT_CREATED,
    CONTRACT_UPDATED,
    CONTRACT_SUBMITTED,
    CONTRACT_ACTIVATED,
    CONTRACT_REJECTED,
    CONTRACT_TERMINATED,
    CONTRACT_EXPIRED,
    CONTRACT_EXPIRING,
    CONTRACT_SUMMARIZED,
)
