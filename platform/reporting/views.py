"""Reporting API — the report catalog, running a report, and export history.

Modules register their reports in a platform registry (reporting/registry.py)
and never expose their own run endpoint; the catalog lists the reports a user
may run and `run` executes one by key. There is still no "render arbitrary
data" endpoint — only registered, permission-gated reports.
"""

from __future__ import annotations

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from shared.exceptions import NotFoundError, PermissionDeniedError
from shared.permissions import HasPlatformPermission
from shared.views import ReadOnlyModelViewSet

from reporting.models import ReportExport
from reporting.registry import all_reports, get_report
from reporting.serializers import ReportExportSerializer


class ReportCatalogView(APIView):
    """The reports this user may run — one entry per registered definition
    whose permission the user holds."""

    permission_classes = [IsAuthenticated, HasPlatformPermission]
    required_permissions = "reporting.view"

    @extend_schema(
        tags=["reporting"],
        responses={200: OpenApiResponse(description="Runnable report catalog.")},
    )
    def get(self, request: Request) -> Response:
        user = request.user
        rows = [
            {
                "key": definition.key,
                "label": definition.label,
                "module": definition.module,
                "description": definition.description,
            }
            for definition in all_reports()
            if user.is_superuser or user.has_platform_permission(definition.permission)
        ]
        return Response(rows)


class RunReportSerializer(serializers.Serializer):
    key = serializers.CharField()
    format = serializers.ChoiceField(choices=["csv", "xlsx", "pdf", "html"], default="csv")
    date_from = serializers.DateField(required=False, allow_null=True, default=None)
    date_to = serializers.DateField(required=False, allow_null=True, default=None)
    vendor = serializers.CharField(required=False, allow_blank=True, default="")
    tag_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )


class RunReportView(APIView):
    permission_classes = [IsAuthenticated, HasPlatformPermission]
    required_permissions = "reporting.export"

    @extend_schema(
        tags=["reporting"],
        request=RunReportSerializer,
        responses={200: OpenApiResponse(description="Export id + signed download URL.")},
    )
    def post(self, request: Request) -> Response:
        data = RunReportSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        definition = get_report(data.validated_data["key"])
        # Running a report additionally requires the owning module's permission,
        # so reporting.export alone can't run a report the user couldn't see.
        if not (
            request.user.is_superuser or request.user.has_platform_permission(definition.permission)
        ):
            raise PermissionDeniedError("You cannot run this report.")

        from storage.services import StorageService

        from reporting.services import ReportService

        filters = {
            "date_from": data.validated_data["date_from"],
            "date_to": data.validated_data["date_to"],
            "vendor": data.validated_data["vendor"],
            "tag_ids": [str(tag_id) for tag_id in data.validated_data["tag_ids"]],
        }
        export = ReportService().run(
            key=definition.key,
            format=data.validated_data["format"],
            filters=filters,
            tenant=request.user.tenant,
            actor=request.user,
        )
        download_url = (
            StorageService().signed_url(export.file, expires_seconds=600) if export.file else None
        )
        return Response(
            {
                "id": str(export.id),
                "filename": export.file.filename if export.file else None,
                "row_count": export.row_count,
                "download_url": download_url,
            }
        )


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
