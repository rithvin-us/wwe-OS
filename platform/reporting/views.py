"""Reporting API — export history and download links.

There is deliberately no generic "render arbitrary data" endpoint: modules
build their ReportSpec server-side (behind their own permissions) and call
ReportService. The platform API only exposes what was already generated.
"""

from __future__ import annotations

from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from shared.exceptions import NotFoundError
from shared.views import ReadOnlyModelViewSet

from reporting.models import ReportExport
from reporting.serializers import ReportExportSerializer


class ReportExportViewSet(ReadOnlyModelViewSet):
    serializer_class = ReportExportSerializer
    filterset_fields = ("module", "format", "report_key")
    ordering_fields = ("created_at",)
    required_permissions = {
        "list": "reporting.view",
        "retrieve": "reporting.view",
        "url": "reporting.view",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return ReportExport.objects.none()
        user = self.request.user
        qs = ReportExport.objects.select_related("file")
        if not user.is_superuser and user.tenant_id is not None:
            qs = qs.filter(tenant_id=user.tenant_id)
        return qs

    @action(detail=True, methods=["get"])
    def url(self, request: Request, pk=None) -> Response:
        export = self.get_object()
        if export.file is None:
            raise NotFoundError("The exported file is no longer available.")
        from storage.services import StorageService

        expires = min(int(request.query_params.get("expires", 600)), 86400)
        return Response(
            {
                "url": StorageService().signed_url(export.file, expires_seconds=expires),
                "expires_in": expires,
            }
        )
