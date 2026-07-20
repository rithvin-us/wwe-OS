"""Purchase bill API.

Two distinct audiences, two distinct authentication schemes:
- `IngestBillView` — a document-ingestion channel (Telegram bot, later email)
  posting extracted data in. Service-token authenticated, never JWT.
- `PurchaseBillViewSet` — the human operator reviewing bills. JWT authenticated,
  same permission mechanism as every other platform endpoint.
"""

from __future__ import annotations

from datetime import timedelta

from django.db import IntegrityError
from django.db.models import Count
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from shared.exceptions import ConflictError
from shared.service_auth import IngestionRateThrottle, ServiceTokenAuthentication
from shared.views import BaseModelViewSet, ReadOnlyModelViewSet

from purchase.backend.models import BillStatus, PaymentStatus, PurchaseBill, Vendor
from purchase.backend.serializers.purchase_bill import (
    ConfirmBillSerializer,
    IngestBillSerializer,
    PurchaseBillSerializer,
    RejectBillSerializer,
    VendorSerializer,
)
from purchase.backend.services.purchase_bill import PurchaseBillService

PENDING_REVIEW_ALERT_AGE = timedelta(days=3)


@extend_schema(
    tags=["purchase"],
    request=IngestBillSerializer,
    responses={201: OpenApiResponse(description="Bill accepted for review.")},
)
class IngestBillView(APIView):
    """POST /api/v1/purchase/bills/ingest/ — for ingestion channels only."""

    authentication_classes = [ServiceTokenAuthentication]
    permission_classes = [IsAuthenticated]
    throttle_classes = [IngestionRateThrottle]

    def post(self, request: Request) -> Response:
        data = IngestBillSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        source_channel = request.data.get("source_channel", "telegram")
        bill = PurchaseBillService().ingest(
            data=data.validated_data,
            source_channel=source_channel,
            raw_extraction=request.data.get("raw_extraction"),
        )
        return Response({"id": str(bill.id), "status": bill.status}, status=status.HTTP_201_CREATED)


class PurchaseBillViewSet(ReadOnlyModelViewSet):
    """The operator's review queue. Read-only except the two review actions —
    bills are never edited directly, only confirmed or rejected."""

    serializer_class = PurchaseBillSerializer
    filterset_fields = ("status", "source_channel", "vendor")
    search_fields = ("seller_name",)
    ordering_fields = ("created_at", "purchase_date", "total_rate")
    required_permissions = {
        "list": "purchase.bill.read",
        "retrieve": "purchase.bill.read",
        "stats": "purchase.bill.read",
        "recent": "purchase.bill.read",
        "confirm": "purchase.bill.review",
        "reject": "purchase.bill.review",
        "mark_paid": "purchase.bill.review",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return PurchaseBill.objects.none()
        user = self.request.user
        qs = PurchaseBill.objects.all()
        if not user.is_superuser and user.tenant_id is not None:
            qs = qs.filter(tenant_id=user.tenant_id)
        return qs

    @action(detail=False, methods=["get"])
    def stats(self, request: Request) -> Response:
        """Counts by status — the dashboard's procurement panel and the
        review queue's header both read this instead of paginating the
        full list just to count it."""
        counts = dict.fromkeys(BillStatus.values, 0)
        counts.update(
            self.get_queryset()
            .values("status")
            .annotate(count=Count("id"))
            .values_list("status", "count")
        )
        qs = self.get_queryset()
        overdue_cutoff = timezone.now() - PENDING_REVIEW_ALERT_AGE
        return Response(
            {
                "pending_review": counts[BillStatus.PENDING_REVIEW],
                "confirmed": counts[BillStatus.CONFIRMED],
                "rejected": counts[BillStatus.REJECTED],
                "total": sum(counts.values()),
                "unpaid_confirmed": qs.filter(
                    status=BillStatus.CONFIRMED, payment_status=PaymentStatus.UNPAID
                ).count(),
                "overdue_pending": qs.filter(
                    status=BillStatus.PENDING_REVIEW, created_at__lt=overdue_cutoff
                ).count(),
            }
        )

    @action(detail=False, methods=["get"])
    def recent(self, request: Request) -> Response:
        """The last N bills an operator acted on — feeds the dashboard's
        recent activity panel. Pending bills aren't "activity" yet; only
        reviewed ones (confirmed/rejected/paid) are."""
        qs = (
            self.get_queryset()
            .exclude(status=BillStatus.PENDING_REVIEW)
            .order_by("-reviewed_at")[:8]
        )
        return Response(PurchaseBillSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"])
    def confirm(self, request: Request, pk=None) -> Response:
        bill = self.get_object()
        data = ConfirmBillSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        bill = PurchaseBillService().confirm(
            bill=bill, reviewer=request.user, vendor_name=data.validated_data.get("vendor_name", "")
        )
        return Response(PurchaseBillSerializer(bill).data)

    @action(detail=True, methods=["post"])
    def reject(self, request: Request, pk=None) -> Response:
        bill = self.get_object()
        data = RejectBillSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        bill = PurchaseBillService().reject(
            bill=bill, reviewer=request.user, reason=data.validated_data["reason"]
        )
        return Response(PurchaseBillSerializer(bill).data)

    @action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request: Request, pk=None) -> Response:
        bill = self.get_object()
        bill = PurchaseBillService().mark_paid(bill=bill, actor=request.user)
        return Response(PurchaseBillSerializer(bill).data)


class VendorViewSet(BaseModelViewSet):
    """The operator's vendor directory. Deliberately thin — name, active
    flag, GST number. Never hard-deleted; deactivate via `is_active`."""

    serializer_class = VendorSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    filterset_fields = ("is_active",)
    search_fields = ("name",)
    ordering_fields = ("name", "created_at")
    required_permissions = {
        "list": "purchase.vendor.manage",
        "retrieve": "purchase.vendor.manage",
        "create": "purchase.vendor.manage",
        "partial_update": "purchase.vendor.manage",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Vendor.objects.none()
        user = self.request.user
        qs = Vendor.objects.all()
        if not user.is_superuser and user.tenant_id is not None:
            qs = qs.filter(tenant_id=user.tenant_id)
        return qs

    def perform_create(self, serializer):
        try:
            serializer.save(tenant_id=self.request.user.tenant_id)
        except IntegrityError as exc:
            raise ConflictError("A vendor with this name already exists.") from exc
