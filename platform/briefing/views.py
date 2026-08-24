"""Workspace cockpit API — the ranked worklist, its counts, and the
'what changed' digest, in one call."""

from __future__ import annotations

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from briefing.services import DEFAULT_WINDOW_DAYS, BriefingService


class BriefingView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["briefing"],
        responses={
            200: OpenApiResponse(description="Cockpit: counts, ranked worklist, and digest."),
        },
    )
    def get(self, request: Request) -> Response:
        try:
            days = int(request.query_params.get("days", DEFAULT_WINDOW_DAYS))
        except (TypeError, ValueError):
            days = DEFAULT_WINDOW_DAYS
        days = min(max(days, 1), 90)
        return Response(BriefingService().summary(user=request.user, days=days))
