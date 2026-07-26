"""Self-service check-in API.

The one **public** endpoint in the HR module. It is deliberately unauthenticated:
an employee opens a shared link, takes a selfie and is identified by their face —
there is no login, no activation code and no device binding. That is the legacy
behaviour and the point of the feature.

Because it is public it is rate-limited, it never echoes anything about who is
enrolled beyond the person actually matched, and every attempt is logged.
"""

from __future__ import annotations

import logging

from drf_spectacular.utils import extend_schema
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.settings import api_settings
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from shared.exceptions import ValidationError
from tenancy.models import Tenant

from hr.backend.serializers.checkin import CheckInRequestSerializer, CheckInResponseSerializer
from hr.backend.services.checkin import CheckInService

logger = logging.getLogger(__name__)


class CheckInThrottle(ScopedRateThrottle):
    """Public endpoint doing face matching — throttled in its own pool so a
    hammered check-in link cannot eat into the anonymous budget.

    `get_rate` is overridden because DRF raises on an unconfigured scope, which
    would turn a missing setting into a 500 on the one endpoint that must stay
    reachable. An unconfigured rate means "no throttle" instead — that is also
    what the test settings do (they blank DEFAULT_THROTTLE_RATES).
    """

    scope = "hr_checkin"

    def get_rate(self) -> str | None:  # type: ignore[override]
        return api_settings.DEFAULT_THROTTLE_RATES.get(self.scope)

    def allow_request(self, request, view):
        if not self.get_rate():
            return True
        return super().allow_request(request, view)


def _resolve_tenant(slug: str | None) -> Tenant:
    """Which company a public check-in belongs to.

    The legacy app was single-tenant so this question never arose. Here:
    an explicit slug always wins; otherwise, if the deployment has exactly one
    tenant (the single-operator case this product is built for), that is
    unambiguous and is used. With several tenants and no slug we refuse rather
    than guess — guessing would file someone's attendance against the wrong
    company.
    """
    if slug:
        tenant = Tenant.objects.filter(slug=slug, is_active=True).first()
        if tenant is None:
            raise ValidationError(detail={"tenant": ["Unknown company."]})
        return tenant

    candidates = list(Tenant.objects.filter(is_active=True)[:2])
    if len(candidates) == 1:
        return candidates[0]
    if not candidates:
        raise ValidationError(detail={"tenant": ["No active company is configured."]})
    raise ValidationError(detail={"tenant": ["Specify which company this check-in is for."]})


@extend_schema(tags=["hr"])
class CheckInView(APIView):
    """POST /api/v1/hr/attendance/checkin/ — public self-service check-in."""

    authentication_classes: list = []
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [CheckInThrottle]
    throttle_scope = "hr_checkin"
    serializer_class = CheckInResponseSerializer

    @extend_schema(
        request=CheckInRequestSerializer,
        responses={200: CheckInResponseSerializer},
        auth=[],
    )
    def post(self, request: Request) -> Response:
        payload = CheckInRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        tenant = _resolve_tenant(data.get("tenant"))

        selfie = data["file"]
        frames = [frame.read() for frame in data.get("frames") or []]

        result = CheckInService(tenant).check_in(
            image_bytes=selfie.read(),
            extra_frames=frames,
            lat=data.get("lat"),
            lon=data.get("lon"),
            accuracy=data.get("accuracy"),
        )
        return Response(CheckInResponseSerializer(result).data)
