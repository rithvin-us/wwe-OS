"""HR API.

Migrated from the legacy app's FastAPI routers. URL shapes are preserved under
`/api/v1/hr/` so the migrated frontend maps one-to-one onto the old screens.
Authentication and authorization are the platform's: JWT plus
`HasPlatformPermission` against this module's own permission vocabulary.
"""

from __future__ import annotations

from datetime import date

from django.db.models import Q
from django.http import HttpResponse
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from shared.exceptions import NotFoundError
from shared.permissions import HasPlatformPermission
from shared.views import BaseModelViewSet, ReadOnlyModelViewSet

from hr.backend.models import (
    Deduction,
    Employee,
    GenerationLog,
    Holiday,
    PayRulesConfig,
    SalaryRule,
)
from hr.backend.repositories import SalaryRuleRepository
from hr.backend.serializers import (
    AttendanceBulkSaveSerializer,
    AttendanceGridSerializer,
    DeductionSerializer,
    EmployeeSerializer,
    EmployeeWriteSerializer,
    EnrollFaceSerializer,
    EnrollResponseSerializer,
    GenerateRegisterSerializer,
    GenerationLogSerializer,
    HolidaySerializer,
    OffboardEmployeeSerializer,
    PayrollRunSerializer,
    PayrollSerializer,
    PayrollSummarySerializer,
    PayRulesConfigSerializer,
    SalaryRuleSerializer,
    VerifyRegisterSerializer,
)
from hr.backend.services.attendance import AttendanceService
from hr.backend.services.employee import EmployeeService
from hr.backend.services.enrollment import EnrollmentService
from hr.backend.services.payroll import PayrollService
from hr.backend.services.register_service import XLSX_CONTENT_TYPE, RegisterService


def _scoped(model, view):
    """Tenant-scoped queryset, built per request.

    Deliberately not a class-level `queryset` attribute: that is evaluated once
    at import time, when no tenant is in request context, so the model
    manager's tenant filter never gets a chance to apply and rows would leak
    across tenants. Same pattern as modules/purchase/backend/api/views.py.
    """
    if getattr(view, "swagger_fake_view", False):
        return model.objects.none()
    user = view.request.user
    qs = model.objects.all()
    if not user.is_superuser and user.tenant_id is not None:
        qs = qs.filter(tenant_id=user.tenant_id)
    return qs


@extend_schema(tags=["hr"])
class EmployeeViewSet(BaseModelViewSet):
    """The Employee Master.

    Employees are never destroyed — DELETE offboards instead, matching the
    legacy behaviour: status becomes "Left", `date_of_leaving` is recorded, and
    the rest of that month's attendance is filled with LEFT.
    """

    serializer_class = EmployeeSerializer
    filterset_fields = ("status", "department", "skill_category", "shift")
    search_fields = ("employee_name", "employee_code")
    ordering_fields = ("employee_code", "employee_name", "date_of_joining")
    required_permissions = {
        "default": "hr.employee.read",
        "create": "hr.employee.manage",
        "update": "hr.employee.manage",
        "partial_update": "hr.employee.manage",
        "destroy": "hr.employee.manage",
        "enroll": "hr.employee.enroll",
        "revoke_enrollment": "hr.employee.enroll",
    }

    def get_queryset(self):
        qs = _scoped(Employee, self).order_by("employee_code")
        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(Q(employee_name__icontains=search) | Q(employee_code__icontains=search))
        return qs

    def create(self, request: Request, *args, **kwargs) -> Response:
        write = EmployeeWriteSerializer(data=request.data)
        write.is_valid(raise_exception=True)
        employee = EmployeeService().create(write.validated_data)
        return Response(EmployeeSerializer(employee).data, status=status.HTTP_201_CREATED)

    def update(self, request: Request, *args, **kwargs) -> Response:
        employee = self.get_object()
        write = EmployeeWriteSerializer(
            instance=employee, data=request.data, partial=kwargs.get("partial", False)
        )
        write.is_valid(raise_exception=True)
        employee = EmployeeService().update(employee, write.validated_data)
        return Response(EmployeeSerializer(employee).data)

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        """Offboard rather than delete. `date_of_leaving` is required."""
        employee = self.get_object()
        payload = OffboardEmployeeSerializer(data=request.query_params or request.data)
        payload.is_valid(raise_exception=True)
        employee = EmployeeService().offboard(employee, payload.validated_data["date_of_leaving"])
        return Response(EmployeeSerializer(employee).data)

    @extend_schema(
        request=EnrollFaceSerializer,
        responses={200: EnrollResponseSerializer},
    )
    @action(
        detail=True,
        methods=["post"],
        parser_classes=[MultiPartParser, FormParser],
    )
    def enroll(self, request: Request, pk=None) -> Response:
        """Enrol this employee's reference face for photo check-in.

        Only the derived template is stored — the uploaded image is never
        persisted.
        """
        payload = EnrollFaceSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        employee = EnrollmentService().enroll(
            employee=self.get_object(), image_bytes=payload.validated_data["file"].read()
        )
        return Response(
            EnrollResponseSerializer(
                {
                    "employee_id": employee.pk,
                    "employee_name": employee.employee_name,
                    "employee_code": employee.employee_code,
                    "enrolled_at": employee.enrolled_at,
                    "checkin_path": "/attend",
                }
            ).data
        )

    @extend_schema(responses={200: EmployeeSerializer})
    @action(detail=True, methods=["post"], url_path="revoke-enrollment")
    def revoke_enrollment(self, request: Request, pk=None) -> Response:
        """Remove the stored face template, disabling photo check-in for them."""
        employee = EnrollmentService().revoke(employee=self.get_object())
        return Response(EmployeeSerializer(employee).data)

    @action(detail=False, methods=["post"], url_path="reset-all-biometrics")
    def reset_all_biometrics(self, request: Request) -> Response:
        """Clear all face templates to allow fresh model re-enrollment."""
        count = Employee.objects.all().update(face_embedding="", enrolled_at=None)
        return Response(
            {
                "cleared_count": count,
                "message": f"Successfully reset face biometrics for {count} employees.",
            }
        )

    @extend_schema(responses={200: SalaryRuleSerializer})
    @action(detail=True, methods=["get"], url_path="effective-salary-rule")
    def effective_salary_rule(self, request: Request, pk=None) -> Response:
        """The wage structure that applies to this employee for a month."""
        employee = self.get_object()
        year = int(request.query_params["year"])
        month = int(request.query_params["month"])
        rule = SalaryRuleRepository().effective_rule(employee.pk, year, month)
        if rule is None:
            raise NotFoundError("No effective salary rule for this employee and month.")
        return Response(SalaryRuleSerializer(rule).data)


@extend_schema(tags=["hr"])
class AttendanceGridView(APIView):
    """GET/POST /api/v1/hr/attendance/ — the monthly grid."""

    permission_classes = [IsAuthenticated, HasPlatformPermission]
    required_permissions = {"GET": "hr.attendance.read", "POST": "hr.attendance.manage"}
    # Declared so the OpenAPI generator can describe this APIView; the per-method
    # request/response shapes come from the @extend_schema decorators below.
    serializer_class = AttendanceGridSerializer

    @extend_schema(responses={200: AttendanceGridSerializer})
    def get(self, request: Request) -> Response:
        year = int(request.query_params["year"])
        month = int(request.query_params["month"])
        grid = AttendanceService().month_grid(year, month)
        return Response(AttendanceGridSerializer(grid).data)

    @extend_schema(request=AttendanceBulkSaveSerializer)
    def post(self, request: Request) -> Response:
        payload = AttendanceBulkSaveSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        touched = AttendanceService().save_grid(
            year=data["year"], month=data["month"], records=data["records"]
        )
        return Response({"message": "Attendance saved successfully", "cells": touched})


@extend_schema(tags=["hr"])
class PayrollView(APIView):
    """GET /api/v1/hr/payroll/ — a month's figures and totals."""

    permission_classes = [IsAuthenticated, HasPlatformPermission]
    required_permissions = "hr.payroll.read"

    @extend_schema(responses={200: PayrollSummarySerializer})
    def get(self, request: Request) -> Response:
        year = int(request.query_params["year"])
        month = int(request.query_params["month"])
        summary = PayrollService().month_summary(year, month)
        return Response(PayrollSummarySerializer(summary).data)


@extend_schema(tags=["hr"])
class PayrollRunView(APIView):
    """POST /api/v1/hr/payroll/run/ — (re)calculate a month."""

    permission_classes = [IsAuthenticated, HasPlatformPermission]
    required_permissions = "hr.payroll.run"

    @extend_schema(request=PayrollRunSerializer, responses={200: PayrollSerializer(many=True)})
    def post(self, request: Request) -> Response:
        payload = PayrollRunSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        records = PayrollService().run(data["year"], data["month"])
        return Response(PayrollSerializer(records, many=True).data)


@extend_schema(tags=["hr"])
class SalaryRuleViewSet(BaseModelViewSet):
    """Per-employee wage structures. Effective-dated, so salary revisions keep
    history and any past month recalculates with the right figures."""

    serializer_class = SalaryRuleSerializer
    filterset_fields = ("employee", "wage_type")
    ordering_fields = ("effective_from", "created_at")
    required_permissions = {
        "default": "hr.payroll.read",
        "create": "hr.salary_rule.manage",
        "update": "hr.salary_rule.manage",
        "partial_update": "hr.salary_rule.manage",
        "destroy": "hr.salary_rule.manage",
    }

    def get_queryset(self):
        return _scoped(SalaryRule, self).select_related("employee").order_by("-effective_from")


@extend_schema(tags=["hr"])
class PayRulesConfigViewSet(BaseModelViewSet):
    """Statutory pay rules (PF/ESI/PT/LWF), effective-dated so any past month
    can be recalculated with the rates that were actually in force."""

    serializer_class = PayRulesConfigSerializer
    ordering_fields = ("effective_from",)
    required_permissions = {
        "default": "hr.payroll.read",
        "create": "hr.pay_rules.manage",
        "update": "hr.pay_rules.manage",
        "partial_update": "hr.pay_rules.manage",
        "destroy": "hr.pay_rules.manage",
    }

    def get_queryset(self):
        return _scoped(PayRulesConfig, self).order_by("-effective_from")

    @extend_schema(responses={200: PayRulesConfigSerializer})
    @action(detail=False, methods=["get"])
    def effective(self, request: Request) -> Response:
        """The rules that were in force for a given month."""
        year = int(request.query_params["year"])
        month = int(request.query_params["month"])
        target = date(year, month, 1)
        rule = (
            self.get_queryset()
            .filter(effective_from__lte=target)
            .filter(Q(effective_to__isnull=True) | Q(effective_to__gte=target))
            .order_by("-effective_from")
            .first()
        )
        if rule is None:
            raise NotFoundError("No pay rules configured for this month.")
        return Response(PayRulesConfigSerializer(rule).data)


@extend_schema(tags=["hr"])
class HolidayViewSet(BaseModelViewSet):
    """The paid-holiday calendar the payroll engine reads."""

    serializer_class = HolidaySerializer
    filterset_fields = ("year", "type")
    ordering_fields = ("date",)
    required_permissions = {
        "default": "hr.attendance.read",
        "create": "hr.holiday.manage",
        "update": "hr.holiday.manage",
        "partial_update": "hr.holiday.manage",
        "destroy": "hr.holiday.manage",
    }

    def get_queryset(self):
        qs = _scoped(Holiday, self).order_by("date")
        month = self.request.query_params.get("month")
        if month:
            qs = qs.filter(date__month=int(month))
        return qs


@extend_schema(tags=["hr"])
class DeductionViewSet(BaseModelViewSet):
    """Advances, fines, damages and loans. Payroll subtracts these
    automatically for the month they are recorded against."""

    serializer_class = DeductionSerializer
    filterset_fields = ("employee", "year", "month", "type", "is_recovered")
    ordering_fields = ("year", "month", "created_at")
    required_permissions = {
        "default": "hr.payroll.read",
        "create": "hr.deduction.manage",
        "update": "hr.deduction.manage",
        "partial_update": "hr.deduction.manage",
        "destroy": "hr.deduction.manage",
    }

    def get_queryset(self):
        return _scoped(Deduction, self).select_related("employee").order_by("-year", "-month")


@extend_schema(tags=["hr"])
class RegisterViewSet(ReadOnlyModelViewSet):
    """Statutory registers — generation, history, re-download and verification.

    Generating a month builds the ten official forms from a copy of the company
    template, archives the workbook with a SHA-256 fingerprint under the next
    version number, and locks the month so the figures behind a submitted
    register cannot change afterwards.
    """

    serializer_class = GenerationLogSerializer
    filterset_fields = ("year", "month", "status")
    ordering_fields = ("year", "month", "version", "generated_at")
    required_permissions = {
        "default": "hr.register.read",
        "generate": "hr.register.generate",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return GenerationLog.objects.none()
        user = self.request.user
        qs = GenerationLog.objects.select_related("stored_file", "generated_by")
        if not user.is_superuser and user.tenant_id is not None:
            qs = qs.filter(tenant_id=user.tenant_id)
        return qs.order_by("-year", "-month", "-version")

    @extend_schema(request=GenerateRegisterSerializer, responses={201: GenerationLogSerializer})
    @action(detail=False, methods=["post"])
    def generate(self, request: Request) -> Response:
        payload = GenerateRegisterSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data
        log = RegisterService().generate(year=data["year"], month=data["month"], actor=request.user)
        return Response(GenerationLogSerializer(log).data, status=status.HTTP_201_CREATED)

    @extend_schema(responses={200: {"type": "string", "format": "binary"}})
    @action(detail=True, methods=["get"])
    def download(self, request: Request, pk=None) -> HttpResponse:
        """Re-download any past version, exactly as it was submitted."""
        data, filename = RegisterService().download(self.get_object())
        response = HttpResponse(data, content_type=XLSX_CONTENT_TYPE)
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

    @extend_schema(responses={200: VerifyRegisterSerializer})
    @action(detail=True, methods=["get"])
    def verify(self, request: Request, pk=None) -> Response:
        """Confirm an archived workbook has not been altered since generation."""
        result = RegisterService().verify(self.get_object())
        return Response(VerifyRegisterSerializer(result).data)
