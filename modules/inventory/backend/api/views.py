"""Inventory API — items and their stock ledger.

JWT + platform RBAC. Items are CRUD; stock changes go through the three
movement actions (receive / issue / adjust) so the balance and its ledger row
always change together in the service, never by editing a quantity field.
"""

from __future__ import annotations

from django.db.models import Count, F, Q
from django.http import HttpResponse
from drf_spectacular.utils import OpenApiResponse, extend_schema
from inventory.backend.models import InventoryItem, MovementType
from inventory.backend.serializers.inventory import (
    CreateItemSerializer,
    ExportInventorySerializer,
    InventoryItemSerializer,
    RecordMovementSerializer,
    StockMovementSerializer,
    UpdateItemSerializer,
)
from inventory.backend.services.inventory import InventoryService
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from shared.views import BaseModelViewSet


class InventoryItemViewSet(BaseModelViewSet):
    serializer_class = InventoryItemSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    filterset_fields = ("category", "is_active")
    search_fields = ("name", "sku", "supplier")
    ordering_fields = ("name", "sku", "quantity_on_hand", "created_at")
    required_permissions = {
        "list": "inventory.read",
        "retrieve": "inventory.read",
        "movements": "inventory.read",
        "low_stock": "inventory.read",
        "stats": "inventory.read",
        "export": "inventory.read",
        "create": "inventory.write",
        "partial_update": "inventory.write",
        "receive": "inventory.write",
        "issue": "inventory.write",
        "adjust": "inventory.write",
        "destroy": "inventory.manage",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return InventoryItem.objects.none()
        user = self.request.user
        if user.is_superuser:
            return InventoryItem.objects.all()
        # A non-superuser with no tenant sees nothing — never the whole table.
        if user.tenant_id is None:
            return InventoryItem.objects.none()
        return InventoryItem.objects.filter(tenant_id=user.tenant_id)

    def create(self, request: Request, *args, **kwargs) -> Response:
        data = CreateItemSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        item = InventoryService().create_item(
            tenant=request.user.tenant, actor=request.user, data=data.validated_data
        )
        return Response(InventoryItemSerializer(item).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request: Request, *args, **kwargs) -> Response:
        data = UpdateItemSerializer(data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        item = InventoryService().update_item(
            item=self.get_object(), actor=request.user, data=data.validated_data
        )
        return Response(InventoryItemSerializer(item).data)

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        InventoryService().delete_item(item=self.get_object(), actor=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # --- stock movements ------------------------------------------------ #
    def _move(self, request: Request, movement_type: str) -> Response:
        data = RecordMovementSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        movement = InventoryService().record_movement(
            item=self.get_object(),
            movement_type=movement_type,
            quantity=data.validated_data["quantity"],
            actor=request.user,
            reason=data.validated_data.get("reason", ""),
            reference=data.validated_data.get("reference", ""),
        )
        return Response(
            {
                "movement": StockMovementSerializer(movement).data,
                "item": InventoryItemSerializer(movement.item).data,
            }
        )

    @action(detail=True, methods=["post"])
    def receive(self, request: Request, pk=None) -> Response:
        return self._move(request, MovementType.RECEIPT)

    @action(detail=True, methods=["post"])
    def issue(self, request: Request, pk=None) -> Response:
        return self._move(request, MovementType.ISSUE)

    @action(detail=True, methods=["post"])
    def adjust(self, request: Request, pk=None) -> Response:
        return self._move(request, MovementType.ADJUSTMENT)

    @action(detail=True, methods=["get"])
    def movements(self, request: Request, pk=None) -> Response:
        item = self.get_object()
        rows = item.movements.select_related("actor")[:100]
        return Response(StockMovementSerializer(rows, many=True).data)

    # --- rollups -------------------------------------------------------- #
    @action(detail=False, methods=["get"], url_path="low-stock")
    def low_stock(self, request: Request) -> Response:
        # Built from the tenant-scoped queryset (not the raw repo) so scoping is
        # identical to every other endpoint on this viewset.
        rows = self.get_queryset().filter(
            is_active=True,
            reorder_level__gt=0,
            quantity_on_hand__lte=F("reorder_level"),
        )
        return Response(InventoryItemSerializer(rows, many=True).data)

    @action(detail=False, methods=["get"])
    def stats(self, request: Request) -> Response:
        qs = self.get_queryset()
        active = qs.filter(is_active=True)
        low = sum(1 for item in active if item.is_low_stock)
        value = sum((item.stock_value or 0) for item in active.exclude(unit_cost__isnull=True))
        agg = qs.aggregate(total=Count("id"), inactive=Count("id", filter=Q(is_active=False)))
        return Response(
            {
                "total_items": agg["total"],
                "active": active.count(),
                "inactive": agg["inactive"],
                "low_stock": low,
                "stock_value": f"{value:.2f}",
            }
        )

    @extend_schema(
        request=ExportInventorySerializer,
        responses={200: OpenApiResponse(description="A rendered stock-on-hand report.")},
    )
    @action(detail=False, methods=["post"])
    def export(self, request: Request) -> HttpResponse:
        data = ExportInventorySerializer(data=request.data)
        data.is_valid(raise_exception=True)
        spec = InventoryService().build_report_spec(items=self.filter_queryset(self.get_queryset()))
        from reporting.services import ReportService

        payload, content_type, filename = ReportService().render(
            spec, data.validated_data["format"], tenant=request.user.tenant, actor=request.user
        )
        response = HttpResponse(payload, content_type=content_type)
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
