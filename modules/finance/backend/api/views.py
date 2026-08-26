"""Finance HTTP surface: the billing master and the bill register.

Views stay thin — they resolve the tenant and the customer, hand the rest to
`InvoiceService`, and shape the response. Every rule (numbering, SEZ, AMC
period, rounding) lives in the service layer.
"""

from __future__ import annotations

from django.http import HttpResponse
from finance.backend.models.invoice import (
    Customer,
    InvoiceStatus,
    InvoiceType,
    PaymentStatus,
)
from finance.backend.repositories.invoice import CustomerRepository, InvoiceRepository
from finance.backend.serializers.invoice import (
    CancelInvoiceSerializer,
    CustomerSerializer,
    DueDateSerializer,
    GenerateInvoiceSerializer,
    InvoiceSerializer,
)
from finance.backend.services.customer_overview import CustomerOverviewService
from finance.backend.services.invoice import InvoiceService
from finance.backend.services.numbering import (
    InvoiceNumberingService,
    financial_year_for,
    format_invoice_number,
)
from finance.backend.services.pdf import CONTENT_TYPE as PDF_CONTENT_TYPE
from finance.backend.services.renderer import CONTENT_TYPE
from finance.backend.services.site_directory import SiteDirectoryService
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from shared.exceptions import NotFoundError
from shared.permissions import HasPlatformPermission
from shared.views import BaseModelViewSet


def _tenant_id(user):
    """`None` means "not scoped to one tenant" — superusers and the
    single-operator setup where the platform runs untenanted."""
    return None if (user.is_superuser or user.tenant_id is None) else user.tenant_id


class CustomerViewSet(BaseModelViewSet):
    """The billing/site master. `is_sez` is set here and nowhere else."""

    serializer_class = CustomerSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    search_fields = ("name", "facility", "gstin")
    ordering_fields = ("name", "created_at")
    required_permissions = {
        "list": "finance.invoice.read",
        "retrieve": "finance.invoice.read",
        "overview": "finance.invoice.read",
        "create": "finance.customer.manage",
        "partial_update": "finance.customer.manage",
        "destroy": "finance.customer.manage",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Customer.objects.none()
        return CustomerRepository().for_tenant(_tenant_id(self.request.user))

    def perform_create(self, serializer):
        serializer.save(tenant=getattr(self.request.user, "tenant", None))

    @action(detail=True, methods=["get"])
    def overview(self, request: Request, pk=None) -> Response:
        """Customer 360 — profile, financials, derived sites, recent invoices,
        AMC and activity, aggregated read-only from existing data."""
        customer = self.get_object()
        return Response(CustomerOverviewService().overview(customer=customer))


class SiteViewSet(viewsets.ViewSet):
    """Site 360 — a read-only, facility-centric view derived from the bill
    register. Sites are not a model of their own (see SiteDirectoryService);
    this surface just lists the facilities invoices were raised against and
    assembles one site's picture on demand."""

    permission_classes = [IsAuthenticated, HasPlatformPermission]
    required_permissions = "finance.invoice.read"

    def list(self, request: Request) -> Response:
        tenant = _tenant_from(request.user)
        return Response(SiteDirectoryService().list_sites(tenant=tenant))

    @action(detail=False, methods=["get"])
    def overview(self, request: Request) -> Response:
        tenant = _tenant_from(request.user)
        name = request.query_params.get("name", "")
        return Response(SiteDirectoryService().site_overview(tenant=tenant, name=name))


def _tenant_from(user):
    """The tenant object to scope by, or None when untenanted (superuser / the
    single-operator setup) — mirrors `_tenant_id`."""
    return None if (user.is_superuser or user.tenant_id is None) else getattr(user, "tenant", None)


class InvoiceViewSet(BaseModelViewSet):
    """The bill register.

    No DELETE: a raised invoice is cancelled, never removed — its number has
    already been seen by the outside world and must stay consumed.
    """

    serializer_class = InvoiceSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    search_fields = ("number", "consignee_name", "facility")
    ordering_fields = ("invoice_date", "sequence_number", "created_at")
    filterset_fields = ("invoice_type", "financial_year", "status")
    required_permissions = {
        "list": "finance.invoice.read",
        "retrieve": "finance.invoice.read",
        "download": "finance.invoice.read",
        "pdf": "finance.invoice.read",
        "next_number": "finance.invoice.read",
        "stats": "finance.invoice.read",
        "create": "finance.invoice.generate",
        "preview": "finance.invoice.generate",
        "preview_document": "finance.invoice.generate",
        "partial_update": "finance.invoice.generate",
        "cancel": "finance.invoice.cancel",
        "destroy": "finance.invoice.delete",
        "delete_invoice": "finance.invoice.delete",
        "mark_sent": "finance.invoice.generate",
        "mark_paid": "finance.invoice.generate",
        "unmark_paid": "finance.invoice.generate",
        "set_due_date": "finance.invoice.generate",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return InvoiceRepository().for_tenant(None).none()
        return InvoiceRepository().for_tenant(_tenant_id(self.request.user))

    @action(detail=False, methods=["get"])
    def stats(self, request: Request) -> Response:
        """Revenue aggregates for the Executive Dashboard. Cancelled invoices
        never count as revenue; "outstanding" is issued-but-unpaid. `monthly`
        is the last six months of issued-invoice revenue, oldest first — the
        revenue half of the dashboard's Revenue-vs-Expenses trend."""
        from datetime import date
        from decimal import Decimal

        from django.db.models import Count, Sum

        issued = self.get_queryset().filter(status=InvoiceStatus.ISSUED)
        today = date.today()
        month_start = today.replace(day=1)

        def _sum(qs) -> float:
            return float(qs.aggregate(s=Sum("total"))["s"] or Decimal("0.00"))

        monthly_rows = (
            issued.values("invoice_date__year", "invoice_date__month")
            .annotate(total=Sum("total"), count=Count("id"))
            .order_by("-invoice_date__year", "-invoice_date__month")[:6]
        )
        monthly = [
            {
                "period": f"{row['invoice_date__year']}-{row['invoice_date__month']:02d}",
                "amount": float(row["total"] or 0),
                "count": row["count"],
            }
            for row in reversed(list(monthly_rows))
        ]

        return Response(
            {
                "revenue_month": _sum(issued.filter(invoice_date__gte=month_start)),
                "revenue_total": _sum(issued),
                "outstanding": _sum(issued.filter(payment_status=PaymentStatus.UNPAID)),
                "invoice_count": issued.count(),
                "monthly": monthly,
            }
        )

    # -- Generation ------------------------------------------------------- #
    def create(self, request: Request, *args, **kwargs) -> Response:
        payload = GenerateInvoiceSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        invoice = InvoiceService().generate(
            actor=request.user, **self._service_kwargs(request, payload.validated_data)
        )
        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request: Request, *args, **kwargs) -> Response:
        """Corrects a raised bill and regenerates its documents under the same
        number. The whole payload is required, not a patch of fields — an
        invoice is recomputed from scratch, never half-edited."""
        invoice = self.get_object()
        payload = GenerateInvoiceSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        kwargs_ = self._service_kwargs(request, payload.validated_data)
        kwargs_.pop("tenant", None)
        corrected = InvoiceService().update(invoice=invoice, actor=request.user, **kwargs_)
        return Response(InvoiceSerializer(corrected).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request: Request, pk=None) -> Response:
        payload = CancelInvoiceSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        invoice = InvoiceService().cancel(
            invoice=self.get_object(), actor=request.user, reason=payload.validated_data["reason"]
        )
        return Response(InvoiceSerializer(invoice).data)

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        invoice = self.get_object()
        InvoiceService().delete(invoice=invoice, actor=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post", "delete"], url_path="delete")
    def delete_invoice(self, request: Request, pk=None) -> Response:
        invoice = self.get_object()
        InvoiceService().delete(invoice=invoice, actor=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    # -- Lifecycle -------------------------------------------------------- #
    @action(detail=True, methods=["post"], url_path="mark-sent")
    def mark_sent(self, request: Request, pk=None) -> Response:
        invoice = InvoiceService().mark_sent(invoice=self.get_object(), actor=request.user)
        return Response(InvoiceSerializer(invoice).data)

    @action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request: Request, pk=None) -> Response:
        invoice = InvoiceService().mark_paid(invoice=self.get_object(), actor=request.user)
        return Response(InvoiceSerializer(invoice).data)

    @action(detail=True, methods=["post"], url_path="unmark-paid")
    def unmark_paid(self, request: Request, pk=None) -> Response:
        invoice = InvoiceService().unmark_paid(invoice=self.get_object(), actor=request.user)
        return Response(InvoiceSerializer(invoice).data)

    @action(detail=True, methods=["post"], url_path="due-date")
    def set_due_date(self, request: Request, pk=None) -> Response:
        payload = DueDateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        invoice = InvoiceService().set_due_date(
            invoice=self.get_object(),
            actor=request.user,
            due_date=payload.validated_data["due_date"],
        )
        return Response(InvoiceSerializer(invoice).data)

    @action(detail=False, methods=["post"])
    def preview(self, request: Request) -> Response:
        """Everything generation would produce — number included — without
        reserving the number or writing a file."""
        payload = GenerateInvoiceSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        prepared = InvoiceService().preview(**self._service_kwargs(request, payload.validated_data))
        return Response(_preview_payload(prepared))

    @action(detail=False, methods=["post"], url_path="preview-document")
    def preview_document(self, request: Request) -> HttpResponse:
        """The invoice itself, as a watermarked PDF, before it exists."""
        payload = GenerateInvoiceSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        document = InvoiceService().preview_document(
            **self._service_kwargs(request, payload.validated_data)
        )
        response = HttpResponse(document, content_type=PDF_CONTENT_TYPE)
        response["Content-Disposition"] = 'inline; filename="invoice-preview.pdf"'
        return response

    @action(detail=False, methods=["get"], url_path="next-number")
    def next_number(self, request: Request) -> Response:
        """What the next bill number will be, for the form to show up front."""
        from datetime import date

        raw_date = request.query_params.get("invoice_date")
        day = date.fromisoformat(raw_date) if raw_date else date.today()
        financial_year = financial_year_for(day)
        tenant = getattr(request.user, "tenant", None)
        sequence_number = InvoiceNumberingService().peek(
            tenant=tenant, financial_year=financial_year
        )
        return Response(
            {
                "financial_year": financial_year,
                "sequence_number": sequence_number,
                "number": format_invoice_number(sequence_number, financial_year),
            }
        )

    @action(detail=True, methods=["get"])
    def download(self, request: Request, pk=None) -> HttpResponse:
        """The workbook — the master copy the figures live in."""
        return self._serve(self.get_object().file, content_type=CONTENT_TYPE)

    @action(detail=True, methods=["get"])
    def pdf(self, request: Request, pk=None) -> HttpResponse:
        """The PDF — the copy that gets sent to the customer."""
        return self._serve(
            self.get_object().pdf_file, content_type=PDF_CONTENT_TYPE, disposition="inline"
        )

    @staticmethod
    def _serve(stored, *, content_type: str, disposition: str = "attachment") -> HttpResponse:
        from storage.services import StorageService

        if stored is None:
            raise NotFoundError("This invoice has no such document.")
        response = HttpResponse(StorageService().open(stored), content_type=content_type)
        response["Content-Disposition"] = f'{disposition}; filename="{stored.filename}"'
        return response

    # -- Helpers ---------------------------------------------------------- #
    def _service_kwargs(self, request: Request, data: dict) -> dict:
        tenant = getattr(request.user, "tenant", None)
        customer = None
        customer_id = data.get("customer_id")
        if customer_id:
            customer = (
                CustomerRepository()
                .for_tenant(_tenant_id(request.user))
                .filter(id=customer_id)
                .first()
            )
            if customer is None:
                raise NotFoundError("That customer no longer exists.")
            tenant = tenant or customer.tenant
        return {
            "tenant": tenant,
            "invoice_type": data["invoice_type"],
            "invoice_date": data["invoice_date"],
            "customer": customer,
            "consignee_name": data.get("consignee_name", ""),
            "consignee_address": data.get("consignee_address", ""),
            "facility": data.get("facility", ""),
            "gstin": data.get("gstin", ""),
            "is_sez": data.get("is_sez"),
            "gst_rate": data.get("gst_rate"),
            "period_year": data.get("period_year"),
            "period_month": data.get("period_month"),
            "lines": data["lines"],
        }


def _preview_payload(prepared: dict) -> dict:
    totals = prepared["totals"]
    return {
        "number": prepared["number"],
        "sequence_number": prepared["sequence_number"],
        "financial_year": prepared["financial_year"],
        "invoice_type": prepared["invoice_type"],
        "invoice_date": prepared["invoice_date"].isoformat(),
        "consignee_name": prepared["consignee_name"],
        "consignee_address": prepared["consignee_address"],
        "facility": prepared["facility"],
        "gstin": prepared["gstin"],
        "is_sez": prepared["is_sez"],
        "tax_mode": prepared["tax_mode"],
        "gst_rate": str(prepared["gst_rate"]),
        "period_text": prepared["period_text"],
        "is_amc": prepared["invoice_type"] == InvoiceType.AMC,
        "lines": [
            {
                "position": line.position,
                "description": line.description,
                "hsn": line.hsn,
                "quantity": str(line.quantity),
                "uom": line.uom,
                "rate": str(line.rate),
                "amount": str(line.amount),
            }
            for line in prepared["lines"]
        ],
        "subtotal": str(totals.subtotal),
        "cgst_amount": str(totals.cgst_amount),
        "sgst_amount": str(totals.sgst_amount),
        "igst_amount": str(totals.igst_amount),
        "round_off": str(totals.round_off),
        "total": str(totals.total),
        "amount_in_words": prepared["amount_in_words"],
    }
