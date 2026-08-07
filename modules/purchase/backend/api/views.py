"""Purchase bill API.

Two distinct audiences, two distinct authentication schemes:
- `IngestBillView` — a document-ingestion channel (Telegram bot, email)
  posting extracted data in. Service-token authenticated, never JWT.
- `PurchaseBillViewSet` — digitized purchase records & AI insights. JWT authenticated.
"""

from __future__ import annotations

import base64
import mimetypes

from django.db import IntegrityError
from django.db.models import Count
from django.http import Http404, HttpResponse
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from shared.exceptions import ConflictError
from shared.service_auth import IngestionRateThrottle, ServiceTokenAuthentication
from shared.views import BaseModelViewSet

from purchase.backend.models import BillStatus, PaymentStatus, PurchaseBill, Vendor
from purchase.backend.serializers.purchase_bill import (
    IngestBillSerializer,
    PurchaseBillSerializer,
    UpdatePurchaseBillSerializer,
    VendorSerializer,
)
from purchase.backend.services.purchase_bill import PurchaseBillService
from purchase.backend.services.purchase_insights import PurchaseInsightsService


@extend_schema(
    tags=["purchase"],
    request=IngestBillSerializer,
    responses={201: OpenApiResponse(description="Purchase document ingested and digitized.")},
)
class IngestBillView(APIView):
    """POST /api/v1/purchase/bills/ingest/ — for ingestion channels only."""

    authentication_classes = [ServiceTokenAuthentication]
    permission_classes = [IsAuthenticated]
    throttle_classes = [IngestionRateThrottle]

    def post(self, request: Request) -> Response:
        serializer = IngestBillSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        source_channel = request.data.get("source_channel", "telegram")
        bill = PurchaseBillService().ingest(
            data=serializer.validated_data,
            source_channel=source_channel,
            raw_extraction=request.data.get("raw_extraction"),
            document_text=request.data.get("document_text", ""),
        )
        return Response(
            {
                "id": str(bill.id),
                "status": bill.status,
                "seller_name": bill.seller_name,
                "invoice_number": bill.invoice_number,
                "total_rate": str(bill.total_rate),
                "currency": bill.currency,
                "confidence_score": float(bill.confidence_score),
            },
            status=status.HTTP_201_CREATED,
        )


class PurchaseBillViewSet(BaseModelViewSet):
    """Digitized purchase records & AI procurement insights."""

    serializer_class = PurchaseBillSerializer
    filterset_fields = ("status", "source_channel", "vendor", "is_duplicate")
    search_fields = ("seller_name", "invoice_number", "gst_number")
    ordering_fields = ("created_at", "purchase_date", "total_rate", "confidence_score")
    required_permissions = {
        "list": "purchase.bill.read",
        "retrieve": "purchase.bill.read",
        "file": "purchase.bill.read",
        "stats": "purchase.bill.read",
        "insights": "purchase.bill.read",
        "recent": "purchase.bill.read",
        "update_bill": "purchase.bill.review",
        "mark_paid": "purchase.bill.review",
        "unmark_paid": "purchase.bill.review",
        "destroy": "purchase.bill.review",
        "upload": "purchase.bill.upload",
    }

    def perform_destroy(self, instance):
        PurchaseBillService().delete_bill(bill=instance, actor=self.request.user)

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
        """Counts by status — processed, needs_attention, total, unpaid."""
        counts = dict.fromkeys(BillStatus.values, 0)
        counts.update(
            self.get_queryset()
            .values("status")
            .annotate(count=Count("id"))
            .values_list("status", "count")
        )
        qs = self.get_queryset()
        return Response(
            {
                "processed": counts[BillStatus.PROCESSED],
                "needs_attention": counts[BillStatus.NEEDS_ATTENTION],
                "total": sum(counts.values()),
                "unpaid": qs.filter(payment_status=PaymentStatus.UNPAID).count(),
            }
        )

    @action(detail=False, methods=["get"])
    def insights(self, request: Request) -> Response:
        """AI Insights: Spend analysis, vendor analysis, duplicate detection, GST summary."""
        tenant = getattr(request.user, "tenant", None) or getattr(request.user, "tenant_id", None)
        data = PurchaseInsightsService().get_insights(tenant)
        return Response(data)

    @action(detail=False, methods=["get"])
    def recent(self, request: Request) -> Response:
        """Latest digitized purchases."""
        qs = self.get_queryset().order_by("-created_at")[:8]
        return Response(PurchaseBillSerializer(qs, many=True).data)

    @action(detail=False, methods=["post"])
    def upload(self, request: Request) -> Response:
        """Operator-facing bill upload — the JWT-authenticated counterpart to
        `IngestBillView`. Same ingest pipeline (storage, OCR, auto-classify)
        as Telegram/email, just reachable by a signed-in user directly
        instead of requiring a service token no client app can safely hold.
        """
        file = request.FILES.get("file")
        if not file:
            raise ValidationError({"file": ["This field is required."]})
        document_base64 = base64.b64encode(file.read()).decode("ascii")
        bill = PurchaseBillService().ingest(
            data={"document_base64": document_base64, "caption": file.name},
            source_channel="upload",
        )
        return Response(PurchaseBillSerializer(bill).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch"], url_path="update-bill")
    def update_bill(self, request: Request, pk=None) -> Response:
        bill = self.get_object()
        serializer = UpdatePurchaseBillSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated_bill = PurchaseBillService().update_bill(
            bill=bill, actor=request.user, data=serializer.validated_data
        )
        return Response(PurchaseBillSerializer(updated_bill).data)

    @action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request: Request, pk=None) -> Response:
        bill = self.get_object()
        bill = PurchaseBillService().mark_paid(bill=bill, actor=request.user)
        return Response(PurchaseBillSerializer(bill).data)

    @action(detail=True, methods=["post"], url_path="unmark-paid")
    def unmark_paid(self, request: Request, pk=None) -> Response:
        bill = self.get_object()
        bill = PurchaseBillService().unmark_paid(bill=bill, actor=request.user)
        return Response(PurchaseBillSerializer(bill).data)

    @action(detail=True, methods=["get"], url_path="file")
    def file(self, request: Request, pk=None):
        bill = self.get_object()

        if bill.storage_key:
            from storage.models import StoredFile
            from storage.services import StorageService

            stored = StoredFile.objects.filter(key=bill.storage_key).first()
            if stored:
                data = StorageService().open(stored)
                content_type = stored.content_type
                filename = stored.filename
            else:
                from storage.providers import get_provider

                data = get_provider().get(bill.storage_key)
                filename = bill.storage_key.rsplit("/", 1)[-1]
                content_type = mimetypes.guess_type(filename)[0] or "application/pdf"

            response = HttpResponse(data, content_type=content_type)
            response["Content-Disposition"] = f'inline; filename="{filename}"'
            return response

        if bill.document_url and bill.document_url.startswith("http"):
            import httpx

            try:
                res = httpx.get(bill.document_url, timeout=10.0)
                if res.status_code == 200:
                    ct = res.headers.get("content-type", "application/pdf").split(";")[0]
                    response = HttpResponse(res.content, content_type=ct)
                    response["Content-Disposition"] = 'inline; filename="purchase_document.pdf"'
                    return response
            except Exception:
                pass

        raise Http404("Document file not found.")


class VendorViewSet(BaseModelViewSet):
    """The vendor directory."""

    serializer_class = VendorSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    filterset_fields = ("is_active",)
    search_fields = ("name", "gst_number")
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
