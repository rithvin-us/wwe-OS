"""Liveness and readiness probes for orchestration, plus metrics exposition."""

from __future__ import annotations

import hmac

from django.conf import settings
from django.core.cache import cache
from django.db import connections
from django.db.utils import OperationalError
from django.http import Http404, HttpRequest, HttpResponse
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


def metrics(request: HttpRequest) -> HttpResponse:
    """Prometheus exposition. Disabled (404) until METRICS_TOKEN is set;
    then requires `Authorization: Bearer <token>`. Plain Django view — the
    scraper wants text/plain, not the API envelope."""
    token = getattr(settings, "METRICS_TOKEN", "")
    if not token:
        raise Http404
    supplied = request.headers.get("Authorization", "")
    if not hmac.compare_digest(supplied, f"Bearer {token}"):
        return HttpResponse(status=403)
    from shared.metrics import prometheus_text

    return HttpResponse(prometheus_text(), content_type="text/plain; version=0.0.4")
