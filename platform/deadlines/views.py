"""Deadline engine API — one query surface across every registered source."""

from __future__ import annotations

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from deadlines.services import DEFAULT_HORIZON_DAYS, DeadlineService


class DeadlineView(APIView):
    # Each source is permission-gated inside the service; any signed-in user may
    # ask, and only sees the deadlines their permissions allow.
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["deadlines"],
        responses={
            200: OpenApiResponse(description="Upcoming and overdue deadlines, soonest first."),
        },
    )
    def get(self, request: Request) -> Response:
        try:
            days = int(request.query_params.get("days", DEFAULT_HORIZON_DAYS))
        except (TypeError, ValueError):
            days = DEFAULT_HORIZON_DAYS
        days = min(max(days, 1), 365)
        return Response(DeadlineService().upcoming(user=request.user, within_days=days))
