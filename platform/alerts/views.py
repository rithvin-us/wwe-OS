"""Alerts API — rule CRUD + an explicit "check now" action for testing a
rule without waiting for the next scheduled sweep."""

from __future__ import annotations

from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from shared.views import BaseModelViewSet

from alerts.models import AlertRule
from alerts.serializers import AlertRuleSerializer, AlertRuleWriteSerializer
from alerts.services import AlertService


class AlertRuleViewSet(BaseModelViewSet):
    serializer_class = AlertRuleSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    ordering_fields = ("name", "created_at")
    filterset_fields = ("condition_type", "metric", "is_active")
    required_permissions = {
        "list": "alerts.view",
        "retrieve": "alerts.view",
        "create": "alerts.manage",
        "partial_update": "alerts.manage",
        "destroy": "alerts.manage",
        "check_now": "alerts.manage",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return AlertRule.objects.none()
        user = self.request.user
        qs = AlertRule.objects.all()
        if not user.is_superuser and user.tenant_id is not None:
            qs = qs.filter(tenant_id=user.tenant_id)
        return qs

    def create(self, request: Request, *args, **kwargs) -> Response:
        data = AlertRuleWriteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        payload = dict(data.validated_data)
        AlertService().validate_rule(data=payload)
        rule = AlertRule.objects.create(tenant=request.user.tenant, **payload)
        return Response(AlertRuleSerializer(rule).data, status=201)

    def partial_update(self, request: Request, *args, **kwargs) -> Response:
        rule = self.get_object()
        data = AlertRuleWriteSerializer(data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        changes = dict(data.validated_data)

        merged = {
            "condition_type": changes.get("condition_type", rule.condition_type),
            "metric": changes.get("metric", rule.metric),
            "operator": changes.get("operator", rule.operator),
            "threshold_value": changes.get("threshold_value", rule.threshold_value),
            "schedule_time": changes.get("schedule_time", rule.schedule_time),
        }
        AlertService().validate_rule(data=merged)

        for field, value in changes.items():
            setattr(rule, field, value)
        rule.save()
        return Response(AlertRuleSerializer(rule).data)

    @action(detail=True, methods=["post"], url_path="check-now")
    def check_now(self, request: Request, pk=None) -> Response:
        rule = self.get_object()
        fired = AlertService().check_rule(rule=rule)
        rule.refresh_from_db()
        return Response({"fired": fired, "rule": AlertRuleSerializer(rule).data})
