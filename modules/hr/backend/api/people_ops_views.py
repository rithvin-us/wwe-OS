"""Onboarding checklists, expense claims, workforce analytics and policy chat."""

from __future__ import annotations

from datetime import datetime

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from shared.exceptions import NotFoundError
from shared.permissions import HasPlatformPermission
from shared.views import BaseModelViewSet, ReadOnlyModelViewSet

from hr.backend.models import Employee, EmployeeTask, ExpenseClaim, TaskTemplate
from hr.backend.serializers.people_ops import (
    EmployeeTaskSerializer,
    ExpenseClaimCreateSerializer,
    ExpenseClaimSerializer,
    ExpenseDecisionSerializer,
    PolicyChatRequestSerializer,
    PolicyChatResponseSerializer,
    TaskTemplateSerializer,
)
from hr.backend.services import analytics
from hr.backend.services.expense import ExpenseService
from hr.backend.services.onboarding import OnboardingService
from hr.backend.services.policy_chat import answer_query


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
class TaskTemplateViewSet(BaseModelViewSet):
    """The reusable onboarding/offboarding checklist items."""

    serializer_class = TaskTemplateSerializer
    filterset_fields = ("workflow", "is_active", "department")
    required_permissions = {
        "default": "hr.onboarding.manage",
    }

    def get_queryset(self):
        if not getattr(self, "swagger_fake_view", False) and self.request.user.tenant_id:
            OnboardingService().seed_default_templates(tenant=self.request.user.tenant)
        return _scoped(TaskTemplate, self).order_by("workflow", "sort_order")


@extend_schema(tags=["hr"])
class EmployeeTaskViewSet(ReadOnlyModelViewSet):
    """Checklists issued to employees. Created automatically when someone joins
    or leaves — never by hand, so a checklist always matches the templates that
    were active at the time."""

    serializer_class = EmployeeTaskSerializer
    filterset_fields = ("employee", "workflow", "status", "department")
    ordering_fields = ("due_date", "created_at")
    required_permissions = {
        "default": "hr.employee.read",
        "complete": "hr.onboarding.manage",
        "reopen": "hr.onboarding.manage",
    }

    def get_queryset(self):
        return (
            _scoped(EmployeeTask, self)
            .select_related("employee", "completed_by")
            .order_by("due_date", "created_at")
        )

    @extend_schema(responses={200: EmployeeTaskSerializer})
    @action(detail=True, methods=["post"])
    def complete(self, request: Request, pk=None) -> Response:
        task = OnboardingService().complete(task=self.get_object(), actor=request.user)
        return Response(EmployeeTaskSerializer(task).data)

    @extend_schema(responses={200: EmployeeTaskSerializer})
    @action(detail=True, methods=["post"])
    def reopen(self, request: Request, pk=None) -> Response:
        task = OnboardingService().reopen(task=self.get_object())
        return Response(EmployeeTaskSerializer(task).data)


@extend_schema(tags=["hr"])
class ExpenseClaimViewSet(BaseModelViewSet):
    """Employee expense claims. An approved claim is reimbursed with that
    month's salary, after deductions — it never enters gross."""

    serializer_class = ExpenseClaimSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ("employee", "status", "category")
    ordering_fields = ("expense_date", "amount", "created_at")
    required_permissions = {
        "default": "hr.expense.read",
        "create": "hr.expense.read",
        "decide": "hr.expense.manage",
        "receipt": "hr.expense.read",
    }
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        return (
            _scoped(ExpenseClaim, self)
            .select_related("employee", "receipt", "decided_by")
            .order_by("-expense_date")
        )

    @extend_schema(request=ExpenseClaimCreateSerializer, responses={201: ExpenseClaimSerializer})
    def create(self, request: Request, *args, **kwargs) -> Response:
        payload = ExpenseClaimCreateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        employee = _scoped(Employee, self).filter(pk=data["employee"]).first()
        if employee is None:
            raise NotFoundError("Employee not found.")

        claim = ExpenseService().submit(employee=employee, data=data, receipt=data.get("receipt"))
        return Response(ExpenseClaimSerializer(claim).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=ExpenseDecisionSerializer, responses={200: ExpenseClaimSerializer})
    @action(detail=True, methods=["post"])
    def decide(self, request: Request, pk=None) -> Response:
        payload = ExpenseDecisionSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        claim = ExpenseService().decide(
            claim=self.get_object(),
            status=data["status"],
            note=data.get("decision_note", ""),
            actor=request.user,
        )
        return Response(ExpenseClaimSerializer(claim).data)

    @extend_schema(responses={200: {"type": "object"}})
    @action(detail=True, methods=["get"])
    def receipt(self, request: Request, pk=None) -> Response:
        """A time-limited link to the claim's receipt."""
        url = ExpenseService().receipt_url(self.get_object())
        if url is None:
            raise NotFoundError("This claim has no receipt attached.")
        return Response({"url": url})


@extend_schema(tags=["hr"])
class WorkforceAnalyticsView(APIView):
    """GET /api/v1/hr/analytics/summary/ — headcount, attendance, OT,
    compliance and payroll readiness for a month, plus the anomaly count."""

    permission_classes = [IsAuthenticated, HasPlatformPermission]
    required_permissions = "hr.attendance.read"

    def get(self, request: Request) -> Response:
        now = datetime.now()
        year = int(request.query_params.get("year") or now.year)
        month = int(request.query_params.get("month") or now.month)
        return Response(analytics.workforce_summary(year, month))


@extend_schema(tags=["hr"])
class AttendanceTrendsView(APIView):
    """GET /api/v1/hr/analytics/trends/ — attendance and OT over recent months."""

    permission_classes = [IsAuthenticated, HasPlatformPermission]
    required_permissions = "hr.attendance.read"

    def get(self, request: Request) -> Response:
        now = datetime.now()
        year = int(request.query_params.get("year") or now.year)
        month = int(request.query_params.get("month") or now.month)
        months = int(request.query_params.get("months") or 6)
        return Response(analytics.attendance_trends(year, month, months))


@extend_schema(tags=["hr"])
class AnomaliesView(APIView):
    """GET /api/v1/hr/analytics/anomalies/ — the things that need a human look:
    missing punches, excessive OT, missing attendance, flagged check-ins,
    double punches, and present-versus-absent conflicts."""

    permission_classes = [IsAuthenticated, HasPlatformPermission]
    required_permissions = "hr.attendance.read"

    def get(self, request: Request) -> Response:
        now = datetime.now()
        year = int(request.query_params.get("year") or now.year)
        month = int(request.query_params.get("month") or now.month)
        return Response(analytics.detect_anomalies(year, month))


@extend_schema(tags=["hr"])
class PolicyChatView(APIView):
    """POST /api/v1/hr/policy-chat/ — answer a question from the company policy
    document by retrieval. Deterministic and offline: it quotes the policy, it
    never composes one."""

    permission_classes = [IsAuthenticated]
    serializer_class = PolicyChatResponseSerializer

    @extend_schema(
        request=PolicyChatRequestSerializer, responses={200: PolicyChatResponseSerializer}
    )
    def post(self, request: Request) -> Response:
        payload = PolicyChatRequestSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        answer, sources = answer_query(payload.validated_data["question"])
        return Response(PolicyChatResponseSerializer({"answer": answer, "sources": sources}).data)
