"""Automation API — rules (CRUD + run-now), run history (read-only), and
the registered source catalog a rule can be built from."""

from __future__ import annotations

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from shared.exceptions import NotFoundError
from shared.views import BaseModelViewSet, ReadOnlyModelViewSet

from automation.models import AutomationRule, AutomationRun, TriggerType
from automation.registry import all_sources
from automation.serializers import (
    AutomationRuleSerializer,
    AutomationRuleWriteSerializer,
    AutomationRunSerializer,
)
from automation.services import AutomationService


class AutomationRuleViewSet(BaseModelViewSet):
    serializer_class = AutomationRuleSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    ordering_fields = ("name", "next_run_at", "created_at")
    filterset_fields = ("destination", "is_active")
    required_permissions = {
        "list": "automation.view",
        "retrieve": "automation.view",
        "sources": "automation.view",
        "create": "automation.manage",
        "partial_update": "automation.manage",
        "destroy": "automation.manage",
        "run_now": "automation.run",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return AutomationRule.objects.none()
        user = self.request.user
        qs = AutomationRule.objects.all()
        if not user.is_superuser and user.tenant_id is not None:
            qs = qs.filter(tenant_id=user.tenant_id)
        return qs

    def create(self, request: Request, *args, **kwargs) -> Response:
        data = AutomationRuleWriteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        payload = dict(data.validated_data)
        payload["required_tags"] = [str(tag_id) for tag_id in payload["required_tags"]]
        AutomationService().validate_rule(data=payload)
        rule = AutomationRule.objects.create(tenant=request.user.tenant, **payload)
        return Response(AutomationRuleSerializer(rule).data, status=201)

    def partial_update(self, request: Request, *args, **kwargs) -> Response:
        rule = self.get_object()
        data = AutomationRuleWriteSerializer(data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        changes = dict(data.validated_data)
        if "required_tags" in changes:
            changes["required_tags"] = [str(tag_id) for tag_id in changes["required_tags"]]

        # Validate the fully merged state (current values + this update) —
        # a partial edit must never leave the rule in an invalid shape, e.g.
        # clearing source_modules while destination stays a file destination.
        AutomationService().validate_rule(
            data={
                "required_tags": changes.get("required_tags", rule.required_tags),
                "source_modules": changes.get("source_modules", rule.source_modules),
                "destination": changes.get("destination", rule.destination),
                "report_key": changes.get("report_key", rule.report_key),
            }
        )
        for field, value in changes.items():
            setattr(rule, field, value)
        rule.save()
        return Response(AutomationRuleSerializer(rule).data)

    @extend_schema(
        tags=["automation"],
        responses={200: OpenApiResponse(description="Registered automation sources.")},
    )
    @action(detail=False, methods=["get"])
    def sources(self, request: Request) -> Response:
        return Response([{"module": a.module, "label": a.label} for a in all_sources()])

    @extend_schema(
        tags=["automation"],
        responses={200: OpenApiResponse(response=AutomationRunSerializer)},
    )
    @action(detail=True, methods=["post"], url_path="run-now")
    def run_now(self, request: Request, pk=None) -> Response:
        rule = self.get_object()
        run = AutomationService().run_rule(
            rule=rule, actor=request.user, triggered_by=TriggerType.MANUAL
        )
        return Response(AutomationRunSerializer(run).data)


class AutomationRunViewSet(ReadOnlyModelViewSet):
    serializer_class = AutomationRunSerializer
    filterset_fields = ("rule", "destination", "status", "triggered_by")
    ordering_fields = ("created_at",)
    required_permissions = {
        "list": "automation.view",
        "retrieve": "automation.view",
        "url": "automation.view",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return AutomationRun.objects.none()
        user = self.request.user
        qs = AutomationRun.objects.select_related("rule")
        if not user.is_superuser and user.tenant_id is not None:
            qs = qs.filter(tenant_id=user.tenant_id)
        return qs

    @action(detail=True, methods=["get"])
    def url(self, request: Request, pk=None) -> Response:
        run = self.get_object()
        if run.output_file is None:
            raise NotFoundError("This run has no downloadable file.")
        from storage.services import StorageService

        expires = min(int(request.query_params.get("expires", 600)), 86400)
        return Response(
            {
                "url": StorageService().signed_url(run.output_file, expires_seconds=expires),
                "expires_in": expires,
            }
        )
