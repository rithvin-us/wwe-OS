"""Asset API — the company asset register and its lifecycle.

JWT + platform RBAC. Metadata create/edit is JSON; attaching a warranty/invoice
file is multipart. Lifecycle transitions (assign, return, maintenance, dispose)
run through the service so status guards, search, and notifications stay
consistent.
"""

from __future__ import annotations

from assets.backend.models import Asset, AssetStatus
from assets.backend.serializers.asset import (
    AssetSerializer,
    AssignSerializer,
    AttachFileSerializer,
    CreateAssetSerializer,
    DisposeSerializer,
    ExportAssetsSerializer,
    MaintenanceRecordSerializer,
    MaintenanceSerializer,
    UpdateAssetSerializer,
)
from assets.backend.services.asset import AssetService
from django.db.models import Count
from django.http import HttpResponse
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response
from shared.views import BaseModelViewSet


class AssetViewSet(BaseModelViewSet):
    serializer_class = AssetSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    filterset_fields = ("status", "category")
    search_fields = ("name", "asset_tag", "assigned_to", "serial_number")
    ordering_fields = ("name", "asset_tag", "created_at", "status")
    required_permissions = {
        "list": "assets.read",
        "retrieve": "assets.read",
        "maintenance": "assets.read",
        "stats": "assets.read",
        "export": "assets.read",
        "create": "assets.write",
        "partial_update": "assets.write",
        "attach": "assets.write",
        "assign": "assets.write",
        "return_asset": "assets.write",
        "start_maintenance": "assets.write",
        "complete_maintenance": "assets.write",
        "dispose": "assets.manage",
        "destroy": "assets.manage",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Asset.objects.none()
        user = self.request.user
        if user.is_superuser:
            return Asset.objects.select_related("file").all()
        if user.tenant_id is None:
            return Asset.objects.none()
        return Asset.objects.select_related("file").filter(tenant_id=user.tenant_id)

    def create(self, request: Request, *args, **kwargs) -> Response:
        data = CreateAssetSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        asset = AssetService().create(
            tenant=request.user.tenant, actor=request.user, data=data.validated_data
        )
        return Response(AssetSerializer(asset).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request: Request, *args, **kwargs) -> Response:
        data = UpdateAssetSerializer(data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        asset = AssetService().update_metadata(
            asset=self.get_object(), actor=request.user, data=data.validated_data
        )
        return Response(AssetSerializer(asset).data)

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        AssetService().delete(asset=self.get_object(), actor=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # --- lifecycle ------------------------------------------------------ #
    @action(detail=True, methods=["post"])
    def assign(self, request: Request, pk=None) -> Response:
        data = AssignSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        asset = AssetService().assign(
            asset=self.get_object(),
            actor=request.user,
            assigned_to=data.validated_data["assigned_to"],
        )
        return Response(AssetSerializer(asset).data)

    @action(detail=True, methods=["post"], url_path="return")
    def return_asset(self, request: Request, pk=None) -> Response:
        asset = AssetService().return_asset(asset=self.get_object(), actor=request.user)
        return Response(AssetSerializer(asset).data)

    @action(detail=True, methods=["post"], url_path="maintenance/start")
    def start_maintenance(self, request: Request, pk=None) -> Response:
        asset = AssetService().start_maintenance(asset=self.get_object(), actor=request.user)
        return Response(AssetSerializer(asset).data)

    @action(detail=True, methods=["post"], url_path="maintenance/complete")
    def complete_maintenance(self, request: Request, pk=None) -> Response:
        data = MaintenanceSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        asset = self.get_object()
        AssetService().complete_maintenance(
            asset=asset,
            actor=request.user,
            description=data.validated_data["description"],
            cost=data.validated_data.get("cost"),
            currency=data.validated_data.get("currency", "USD"),
            vendor=data.validated_data.get("vendor", ""),
            performed_on=data.validated_data.get("performed_on"),
        )
        asset.refresh_from_db()
        return Response(AssetSerializer(asset).data)

    @action(detail=True, methods=["post"])
    def dispose(self, request: Request, pk=None) -> Response:
        data = DisposeSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        asset = AssetService().dispose(
            asset=self.get_object(),
            actor=request.user,
            reason=data.validated_data["reason"],
            proceeds=data.validated_data.get("proceeds"),
        )
        return Response(AssetSerializer(asset).data)

    @action(detail=True, methods=["post"])
    def attach(self, request: Request, pk=None) -> Response:
        data = AttachFileSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        upload = data.validated_data["file"]
        asset = AssetService().attach_file(
            asset=self.get_object(),
            data=upload.read(),
            filename=upload.name,
            content_type=upload.content_type or "application/octet-stream",
            actor=request.user,
        )
        return Response(AssetSerializer(asset).data)

    @action(detail=True, methods=["get"])
    def maintenance(self, request: Request, pk=None) -> Response:
        rows = self.get_object().maintenance.select_related("actor")[:100]
        return Response(MaintenanceRecordSerializer(rows, many=True).data)

    @action(detail=True, methods=["get"])
    def download(self, request: Request, pk=None) -> HttpResponse:
        from shared.exceptions import NotFoundError
        from storage.services import StorageService

        asset = self.get_object()
        if asset.file is None:
            raise NotFoundError("This asset has no attached file.")
        payload = StorageService().open(asset.file)
        response = HttpResponse(payload, content_type=asset.file.content_type)
        response["Content-Disposition"] = f'attachment; filename="{asset.file.filename}"'
        return response

    # --- rollups -------------------------------------------------------- #
    @action(detail=False, methods=["get"])
    def stats(self, request: Request) -> Response:
        qs = self.get_queryset()
        counts = dict.fromkeys(AssetStatus.values, 0)
        counts.update(qs.values("status").annotate(n=Count("id")).values_list("status", "n"))
        active = qs.exclude(status=AssetStatus.DISPOSED)
        value = sum(a.purchase_cost or 0 for a in active if a.purchase_cost is not None)
        return Response(
            {
                "in_stock": counts[AssetStatus.IN_STOCK],
                "assigned": counts[AssetStatus.ASSIGNED],
                "in_maintenance": counts[AssetStatus.IN_MAINTENANCE],
                "disposed": counts[AssetStatus.DISPOSED],
                "total": sum(counts.values()),
                "active_value": f"{value:.2f}",
            }
        )

    @extend_schema(
        request=ExportAssetsSerializer,
        responses={200: OpenApiResponse(description="A rendered asset-register report.")},
    )
    @action(detail=False, methods=["post"])
    def export(self, request: Request) -> HttpResponse:
        data = ExportAssetsSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        spec = AssetService().build_report_spec(assets=self.filter_queryset(self.get_queryset()))
        from reporting.services import ReportService

        payload, content_type, filename = ReportService().render(
            spec, data.validated_data["format"], tenant=request.user.tenant, actor=request.user
        )
        response = HttpResponse(payload, content_type=content_type)
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
