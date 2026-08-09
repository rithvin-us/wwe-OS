"""Metric resolvers for alert rules.

Platform apps never import business modules directly (CLAUDE.md rules
1-3 — "platform provides capabilities, modules provide meaning" — there is
zero precedent for `from <module>...` inside platform/). So a metric is
read the same way any other client reads it: through the module's own REST
API, via an in-process test client authenticated as the tenant's Owner. This
runs the real view/permission code with no network hop and no separate
server needed — the right tool here since `alerts_check_due` is a one-off
management-command process, not a long-running server with its own bound
port to call over real HTTP.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from roles.models import UserRole

from alerts.models import Metric


def _client_for_tenant(tenant) -> APIClient | None:
    assignment = (
        UserRole.objects.filter(role__slug="owner", user__tenant=tenant)
        .select_related("user")
        .first()
    )
    if assignment is None:
        return None
    access = RefreshToken.for_user(assignment.user).access_token
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    return client


def purchase_stats(tenant) -> dict[str, Any] | None:
    client = _client_for_tenant(tenant)
    if client is None:
        return None
    response = client.get("/api/v1/purchase/bills/stats/")
    return response.data if response.status_code == 200 else None


def contracts_stats(tenant) -> dict[str, Any] | None:
    client = _client_for_tenant(tenant)
    if client is None:
        return None
    response = client.get("/api/v1/contracts/contracts/stats/")
    return response.data if response.status_code == 200 else None


def resolve_metric_value(metric: str, tenant) -> Decimal | None:
    """The single current number a THRESHOLD rule compares against — `None`
    when the source data isn't reachable (e.g. no Owner user yet), so a
    rule fails safe instead of firing on bad data."""
    if metric == Metric.PURCHASE_NEEDS_ATTENTION_COUNT:
        stats = purchase_stats(tenant)
        return Decimal(stats["needs_attention"]) if stats else None
    if metric == Metric.PURCHASE_UNPAID_COUNT:
        stats = purchase_stats(tenant)
        return Decimal(stats["unpaid"]) if stats else None
    if metric == Metric.CONTRACTS_EXPIRING_COUNT:
        stats = contracts_stats(tenant)
        return Decimal(stats["expiring_soon"]) if stats else None
    return None
