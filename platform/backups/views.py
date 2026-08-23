"""Backup & recovery status API — read-only management view."""

from __future__ import annotations

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from backups.services import BackupService


class BackupStatusView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["backups"],
        responses={200: OpenApiResponse(description="Backup areas, storage usage, failures.")},
    )
    def get(self, request: Request) -> Response:
        return Response(BackupService().summary(user=request.user))
