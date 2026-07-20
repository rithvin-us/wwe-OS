"""Liveness and readiness probes for orchestration."""

from __future__ import annotations

from django.core.cache import cache
from django.db import connections
from django.db.utils import OperationalError
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@extend_schema(tags=["health"], responses={200: OpenApiResponse(description="Service is up.")})
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([])
def liveness(_request) -> Response:
    """Process is up. No dependency checks."""
    return Response({"status": "ok"})


@extend_schema(
    tags=["health"],
    responses={
        200: OpenApiResponse(description="Ready — database and cache reachable."),
        503: OpenApiResponse(description="Not ready — a dependency is unavailable."),
    },
)
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([])
def readiness(_request) -> Response:
    """Ready to serve traffic — database and cache reachable."""
    checks: dict[str, str] = {}

    try:
        connections["default"].cursor().execute("SELECT 1")
        checks["database"] = "ok"
    except OperationalError:
        checks["database"] = "error"

    try:
        cache.set("readyz", "1", timeout=5)
        checks["cache"] = "ok" if cache.get("readyz") == "1" else "error"
    except Exception:  # noqa: BLE001 - readiness must never raise
        checks["cache"] = "error"

    ready = all(value == "ok" for value in checks.values())
    return Response(
        {"status": "ready" if ready else "not-ready", "checks": checks},
        status=200 if ready else 503,
    )
