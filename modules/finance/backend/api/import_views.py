"""HTTP surface for the bulk historical-invoice import.

Two viewsets, both thin: they resolve the tenant, hand work to
`InvoiceImportService`, and shape the response. Every rule — storage, dedupe,
OCR, numbering, the commit — lives in the service layer.
"""

from __future__ import annotations

from django.http import HttpResponse
from finance.backend.api.views import _tenant_id
from finance.backend.models import InvoiceImportBatch, InvoiceImportItem
from finance.backend.serializers.invoice_import import (
    ImportDraftSerializer,
    InvoiceImportBatchDetailSerializer,
    InvoiceImportBatchSerializer,
    InvoiceImportItemSerializer,
)
from finance.backend.services.invoice_import import InvoiceImportService
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from shared.exceptions import NotFoundError, ValidationError
from shared.views import BaseModelViewSet


class InvoiceImportBatchViewSet(BaseModelViewSet):
    """A bulk upload of historical invoice scans and its review cohort."""

    serializer_class = InvoiceImportBatchSerializer
    http_method_names = ["get", "post", "head", "options"]
    ordering_fields = ("created_at",)
    required_permissions = {
        "list": "finance.invoice.read",
        "retrieve": "finance.invoice.read",
        "create": "finance.invoice.import",
        "commit": "finance.invoice.import",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return InvoiceImportBatch.objects.none()
        tenant_id = _tenant_id(self.request.user)
        queryset = InvoiceImportBatch.objects.all().prefetch_related("items")
        return queryset if tenant_id is None else queryset.filter(tenant_id=tenant_id)

    def get_serializer_class(self):
        if self.action == "retrieve":
            return InvoiceImportBatchDetailSerializer
        return InvoiceImportBatchSerializer

    def create(self, request: Request, *args, **kwargs) -> Response:
        """Upload N scans. Returns the batch immediately; OCR runs in the
        background (see the workflow pipeline)."""
        uploads = request.FILES.getlist("files")
        if not uploads:
            raise ValidationError(detail={"files": ["Attach at least one invoice scan."]})
        files = [
            {
                "filename": f.name,
                "content_type": f.content_type or "application/octet-stream",
                "data": f.read(),
            }
            for f in uploads
        ]
        result = InvoiceImportService().create_batch(
            tenant=getattr(request.user, "tenant", None),
            actor=request.user,
            files=files,
            label=request.data.get("label", ""),
        )
        data = InvoiceImportBatchDetailSerializer(result["batch"]).data
        data["accepted"] = len(result["accepted"])
        data["duplicates"] = result["duplicates"]
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def commit(self, request: Request, pk=None) -> Response:
        """Commit every reviewable item in the batch into the register."""
        result = InvoiceImportService().commit_batch(batch=self.get_object(), actor=request.user)
        return Response(result)


class InvoiceImportItemViewSet(BaseModelViewSet):
    """One uploaded scan on its way to becoming a register invoice."""

    serializer_class = InvoiceImportItemSerializer
    http_method_names = ["get", "patch", "post", "head", "options"]
    required_permissions = {
        "retrieve": "finance.invoice.read",
        "scan": "finance.invoice.read",
        "partial_update": "finance.invoice.import",
        "recompute": "finance.invoice.import",
        "commit": "finance.invoice.import",
        "discard": "finance.invoice.import",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return InvoiceImportItem.objects.none()
        tenant_id = _tenant_id(self.request.user)
        queryset = InvoiceImportItem.objects.all().select_related("source_file", "invoice")
        return queryset if tenant_id is None else queryset.filter(tenant_id=tenant_id)

    def partial_update(self, request: Request, *args, **kwargs) -> Response:
        """Save an operator edit to the draft; totals recompute on read."""
        item = self.get_object()
        payload = ImportDraftSerializer(data=request.data, partial=True)
        payload.is_valid(raise_exception=True)
        item = InvoiceImportService().save_draft(item=item, draft=payload.validated_data)
        return Response(InvoiceImportItemSerializer(item).data)

    @action(detail=True, methods=["post"])
    def recompute(self, request: Request, pk=None) -> Response:
        """The tax split and totals the current (unsaved) draft would produce."""
        item = self.get_object()
        payload = ImportDraftSerializer(data=request.data, partial=True)
        payload.is_valid(raise_exception=True)
        draft = {**(item.proposed or {}), **payload.validated_data}
        totals = InvoiceImportService().compute_totals_for_draft(tenant=item.tenant, draft=draft)
        return Response({key: str(value) for key, value in totals.items()})

    @action(detail=True, methods=["post"])
    def commit(self, request: Request, pk=None) -> Response:
        """Back-fill this item into the register under its printed number."""
        from finance.backend.serializers.invoice import InvoiceSerializer

        invoice = InvoiceImportService().commit_item(item=self.get_object(), actor=request.user)
        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def discard(self, request: Request, pk=None) -> Response:
        item = InvoiceImportService().discard_item(item=self.get_object())
        return Response(InvoiceImportItemSerializer(item).data)

    @action(detail=True, methods=["get"])
    def scan(self, request: Request, pk=None) -> HttpResponse:
        """The original uploaded scan, served inline."""
        from storage.services import StorageService

        stored = self.get_object().source_file
        if stored is None:
            raise NotFoundError("This item has no stored scan.")
        response = HttpResponse(StorageService().open(stored), content_type=stored.content_type)
        response["Content-Disposition"] = f'inline; filename="{stored.filename}"'
        return response
