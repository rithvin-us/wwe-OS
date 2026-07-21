"""Workflow API.

Read surfaces for definitions and instances plus the three decisions
(approve / reject / cancel). Step-level authorization (who may act on the
current step) is enforced in the service; the view-level permissions gate the
endpoints themselves.
"""

from __future__ import annotations

from django.db import models
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from shared.views import ReadOnlyModelViewSet

from workflow.models import WorkflowDefinition, WorkflowInstance
from workflow.serializers import (
    ApproveSerializer,
    CancelSerializer,
    RejectSerializer,
    WorkflowDefinitionSerializer,
    WorkflowInstanceSerializer,
)
from workflow.services import WorkflowService


class WorkflowDefinitionViewSet(ReadOnlyModelViewSet):
    serializer_class = WorkflowDefinitionSerializer
    filterset_fields = ("module", "is_active")
    search_fields = ("key", "name")
    ordering_fields = ("key", "created_at")
    required_permissions = "workflow.view"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return WorkflowDefinition.objects.none()
        user = self.request.user
        qs = WorkflowDefinition.objects.prefetch_related("steps")
        if not user.is_superuser:
            qs = qs.filter(models.Q(tenant__isnull=True) | models.Q(tenant_id=user.tenant_id))
        return qs


class WorkflowInstanceViewSet(ReadOnlyModelViewSet):
    serializer_class = WorkflowInstanceSerializer
    filterset_fields = ("status", "definition", "subject_type")
    ordering_fields = ("created_at", "completed_at")
    required_permissions = {
        "list": "workflow.view",
        "retrieve": "workflow.view",
        "pending": "workflow.view",
        "approve": "workflow.act",
        "reject": "workflow.act",
        "cancel": "workflow.manage",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return WorkflowInstance.objects.none()
        user = self.request.user
        qs = WorkflowInstance.objects.select_related(
            "definition", "current_step", "started_by"
        ).prefetch_related("actions")
        if not user.is_superuser and user.tenant_id is not None:
            qs = qs.filter(tenant_id=user.tenant_id)
        return qs

    @action(detail=False, methods=["get"])
    def pending(self, request: Request) -> Response:
        """The caller's approval queue — running instances whose current step
        they can act on. Feeds the dashboard's "needs your attention" surface."""
        qs = WorkflowService().pending_for(request.user).order_by("created_at")
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(WorkflowInstanceSerializer(page, many=True).data)
        return Response(WorkflowInstanceSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"])
    def approve(self, request: Request, pk=None) -> Response:
        data = ApproveSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        instance = WorkflowService().approve(
            instance=self.get_object(),
            actor=request.user,
            comment=data.validated_data.get("comment", ""),
        )
        return Response(WorkflowInstanceSerializer(instance).data)

    @action(detail=True, methods=["post"])
    def reject(self, request: Request, pk=None) -> Response:
        data = RejectSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        instance = WorkflowService().reject(
            instance=self.get_object(),
            actor=request.user,
            reason=data.validated_data["reason"],
        )
        return Response(WorkflowInstanceSerializer(instance).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request: Request, pk=None) -> Response:
        data = CancelSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        instance = WorkflowService().cancel(
            instance=self.get_object(),
            actor=request.user,
            reason=data.validated_data.get("reason", ""),
        )
        return Response(WorkflowInstanceSerializer(instance).data)
