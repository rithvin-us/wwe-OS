"""Contract API — the operator's contract register.

JWT + platform RBAC. Metadata create/edit is JSON; attaching the signed file
is multipart. Lifecycle actions (submit, terminate) run through the service so
workflow/search/notifications stay consistent. Expiry is surfaced read-only;
the actual expiry transition is the scan command's job.
"""

from __future__ import annotations

from decimal import Decimal

from contracts.backend.models import Contract, ContractStatus
from contracts.backend.serializers.contract import (
    AttachFileSerializer,
    ContractSerializer,
    CreateContractSerializer,
    ExportContractsSerializer,
    TerminateContractSerializer,
    UpdateContractSerializer,
)
from contracts.backend.services.contract import ContractService
from django.db.models import Count, Sum
from django.http import HttpResponse
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response
from shared.views import BaseModelViewSet


class ContractViewSet(BaseModelViewSet):
    serializer_class = ContractSerializer
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    filterset_fields = ("status", "category")
    search_fields = ("title", "counterparty", "notes")
    ordering_fields = ("created_at", "title", "end_date", "value")
    required_permissions = {
        "list": "contracts.read",
        "retrieve": "contracts.read",
        "stats": "contracts.read",
        "expiring": "contracts.read",
        "download": "contracts.read",
        "export": "contracts.read",
        "create": "contracts.write",
        "partial_update": "contracts.write",
        "attach": "contracts.write",
        "summarize": "contracts.write",
        "terminate": "contracts.manage",
        "destroy": "contracts.manage",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Contract.objects.none()
        user = self.request.user
        qs = Contract.objects.select_related("file", "owner")
        if not user.is_superuser and user.tenant_id is not None:
            qs = qs.filter(tenant_id=user.tenant_id)
        return qs

    def create(self, request: Request, *args, **kwargs) -> Response:
        data = CreateContractSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        contract = ContractService().create(
            tenant=request.user.tenant, owner=request.user, data=data.validated_data
        )
        return Response(ContractSerializer(contract).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request: Request, *args, **kwargs) -> Response:
        data = UpdateContractSerializer(data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        contract = ContractService().update_metadata(
            contract=self.get_object(), actor=request.user, data=data.validated_data
        )
        return Response(ContractSerializer(contract).data)

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        ContractService().delete(contract=self.get_object(), actor=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def attach(self, request: Request, pk=None) -> Response:
        data = AttachFileSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        upload = data.validated_data["file"]
        contract = ContractService().attach_file(
            contract=self.get_object(),
            data=upload.read(),
            filename=upload.name,
            content_type=upload.content_type or "application/octet-stream",
            actor=request.user,
        )
        return Response(ContractSerializer(contract).data)

    @action(detail=True, methods=["post"])
    def summarize(self, request: Request, pk=None) -> Response:
        contract = ContractService().generate_summary(self.get_object())
        return Response(ContractSerializer(contract).data)

    @action(detail=True, methods=["post"])
    def terminate(self, request: Request, pk=None) -> Response:
        data = TerminateContractSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        contract = ContractService().terminate(
            contract=self.get_object(), actor=request.user, reason=data.validated_data["reason"]
        )
        return Response(ContractSerializer(contract).data)

    @action(detail=True, methods=["get"])
    def download(self, request: Request, pk=None) -> HttpResponse:
        from shared.exceptions import NotFoundError
        from storage.services import StorageService

        contract = self.get_object()
        if contract.file is None:
            raise NotFoundError("This contract has no attached file.")
        payload = StorageService().open(contract.file)
        response = HttpResponse(payload, content_type=contract.file.content_type)
        response["Content-Disposition"] = f'attachment; filename="{contract.file.filename}"'
        return response

    @action(detail=False, methods=["get"])
    def expiring(self, request: Request) -> Response:
        """Active contracts inside their renewal-notice window — feeds the
        dashboard's alerts and the contracts 'expiring soon' view."""
        rows = [
            c
            for c in self.get_queryset().filter(status=ContractStatus.ACTIVE)
            if c.is_expiring_soon
        ]
        rows.sort(key=lambda c: c.end_date)
        return Response(ContractSerializer(rows, many=True).data)

    @action(detail=False, methods=["get"])
    def stats(self, request: Request) -> Response:
        qs = self.get_queryset()
        counts = dict.fromkeys(ContractStatus.values, 0)
        counts.update(qs.values("status").annotate(n=Count("id")).values_list("status", "n"))
        active_value = (
            qs.filter(status=ContractStatus.ACTIVE, value__isnull=False).aggregate(
                total=Sum("value")
            )["total"]
            or 0
        )
        expiring = sum(1 for c in qs.filter(status=ContractStatus.ACTIVE) if c.is_expiring_soon)
        return Response(
            {
                "draft": counts.get(ContractStatus.DRAFT, 0),
                "active": counts.get(ContractStatus.ACTIVE, 0),
                "expired": counts.get(ContractStatus.EXPIRED, 0),
                "terminated": counts.get(ContractStatus.TERMINATED, 0),
                "total": sum(counts.values()),
                "expiring_soon": expiring,
                "active_value": f"{Decimal(active_value):.2f}",
            }
        )

    @extend_schema(
        request=ExportContractsSerializer,
        responses={200: OpenApiResponse(description="A rendered contract-register report.")},
    )
    @action(detail=False, methods=["post"])
    def export(self, request: Request) -> HttpResponse:
        data = ExportContractsSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        spec = ContractService().build_report_spec(
            contracts=self.filter_queryset(self.get_queryset())
        )
        from reporting.services import ReportService

        payload, content_type, filename = ReportService().render(
            spec, data.validated_data["format"], tenant=request.user.tenant, actor=request.user
        )
        response = HttpResponse(payload, content_type=content_type)
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
