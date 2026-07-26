"""Leave API.

Migrated from the legacy app's leaves router. Kept in its own module so
`views.py` stays readable now that HR covers the whole monthly cycle plus leave.
"""

from __future__ import annotations

from datetime import datetime

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from shared.exceptions import NotFoundError
from shared.permissions import HasPlatformPermission
from shared.views import BaseModelViewSet

from hr.backend.models import Employee, LeaveBalance, LeaveRequest, LeaveType
from hr.backend.serializers import (
    LeaveBalanceSerializer,
    LeaveDecisionSerializer,
    LeaveRequestCreateSerializer,
    LeaveRequestSerializer,
    LeaveTypeSerializer,
)
from hr.backend.services.leave import LeaveService


def _scoped(model, view):
    """Tenant-scoped queryset built per request — see the note in views.py."""
    if getattr(view, "swagger_fake_view", False):
        return model.objects.none()
    user = view.request.user
    qs = model.objects.all()
    if not user.is_superuser and user.tenant_id is not None:
        qs = qs.filter(tenant_id=user.tenant_id)
    return qs


@extend_schema(tags=["hr"])
class LeaveTypeViewSet(BaseModelViewSet):
    """The catalogue of leave kinds and their default annual quotas."""

    serializer_class = LeaveTypeSerializer
    required_permissions = {
        "default": "hr.leave.read",
        "create": "hr.leave.manage",
        "update": "hr.leave.manage",
        "partial_update": "hr.leave.manage",
        "destroy": "hr.leave.manage",
    }

    def get_queryset(self):
        # Seed the standard types on first read so the screen is never empty.
        if not getattr(self, "swagger_fake_view", False) and self.request.user.tenant_id:
            LeaveService().seed_default_types(tenant=self.request.user.tenant)
        return _scoped(LeaveType, self).order_by("code")


@extend_schema(tags=["hr"])
class LeaveBalanceView(APIView):
    """GET /api/v1/hr/leave/balances/ — quota, used and remaining.

    With an employee given, every leave type's row is materialised first so the
    screen always shows the full picture rather than only types already used.
    """

    permission_classes = [IsAuthenticated, HasPlatformPermission]
    required_permissions = "hr.leave.read"
    serializer_class = LeaveBalanceSerializer

    @extend_schema(responses={200: LeaveBalanceSerializer(many=True)})
    def get(self, request: Request) -> Response:
        year = int(request.query_params.get("year") or datetime.now().year)
        employee_id = request.query_params.get("employee")

        if employee_id:
            employee = _scoped(Employee, self).filter(pk=employee_id).first()
            if employee is None:
                raise NotFoundError("Employee not found.")
            balances = LeaveService().balances_for(employee=employee, year=year)
        else:
            balances = (
                _scoped(LeaveBalance, self)
                .filter(year=year)
                .select_related("employee", "leave_type")
                .order_by("employee__employee_code", "leave_type__code")
            )

        return Response(LeaveBalanceSerializer(balances, many=True).data)


@extend_schema(tags=["hr"])
class LeaveRequestViewSet(BaseModelViewSet):
    """Leave requests and their decisions.

    Self-service first (docs/modules/hr.md): an employee raises a request, the
    operator only handles the decision.
    """

    serializer_class = LeaveRequestSerializer
    filterset_fields = ("status", "employee", "leave_type")
    ordering_fields = ("created_at", "start_date")
    required_permissions = {
        "default": "hr.leave.read",
        "create": "hr.leave.read",
        "decide": "hr.leave.manage",
        "destroy": "hr.leave.read",
    }

    def get_queryset(self):
        return (
            _scoped(LeaveRequest, self)
            .select_related("employee", "leave_type", "decided_by")
            .order_by("-created_at")
        )

    @extend_schema(request=LeaveRequestCreateSerializer, responses={201: LeaveRequestSerializer})
    def create(self, request: Request, *args, **kwargs) -> Response:
        payload = LeaveRequestCreateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        employee = _scoped(Employee, self).filter(pk=data["employee"]).first()
        if employee is None:
            raise NotFoundError("Employee not found.")
        leave_type = _scoped(LeaveType, self).filter(pk=data["leave_type"]).first()
        if leave_type is None:
            raise NotFoundError("Leave type not found.")

        leave_request = LeaveService().request_leave(
            employee=employee, leave_type=leave_type, data=data
        )
        return Response(LeaveRequestSerializer(leave_request).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=LeaveDecisionSerializer, responses={200: LeaveRequestSerializer})
    @action(detail=True, methods=["post"])
    def decide(self, request: Request, pk=None) -> Response:
        """Approve or reject. Approval is refused if the balance cannot cover it."""
        payload = LeaveDecisionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        leave_request = LeaveService().decide(
            request=self.get_object(),
            status=data["status"],
            note=data.get("decision_note", ""),
            actor=request.user,
        )
        return Response(LeaveRequestSerializer(leave_request).data)

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        """Withdraw a pending request."""
        LeaveService().withdraw(request=self.get_object())
        return Response(status=status.HTTP_204_NO_CONTENT)
