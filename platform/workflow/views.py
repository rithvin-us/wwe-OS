"""Pipeline API — the registered-pipeline catalog, run read access plus
aggregate stats, and the pause/resume/cancel/retry control-plane actions."""

from __future__ import annotations

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from shared.permissions import HasPlatformPermission
from shared.views import ReadOnlyModelViewSet

from workflow.models import PipelineRun
from workflow.serializers import PipelineRunSerializer
from workflow.services import PipelineService


class PipelineCatalogViewSet(viewsets.ViewSet):
    """Read-only catalog of the pipelines registered in this process. They
    are code, not database rows (see workflow/registry.py), so there is no
    queryset — the management UI's "Definitions" view renders this list."""

    permission_classes = [IsAuthenticated, HasPlatformPermission]
    required_permissions = {"list": "workflow.view"}

    @extend_schema(
        tags=["workflow"],
        responses={200: OpenApiResponse(description="Registered pipeline definitions.")},
    )
    def list(self, request: Request) -> Response:
        return Response(PipelineService().list_definitions())


class PipelineRunViewSet(ReadOnlyModelViewSet):
    serializer_class = PipelineRunSerializer
    filterset_fields = ("pipeline_key", "status", "trigger_type")
    ordering_fields = ("created_at",)
    required_permissions = {
        "list": "workflow.view",
        "retrieve": "workflow.view",
        "stats": "workflow.view",
        "pause": "workflow.control",
        "resume": "workflow.control",
        "cancel": "workflow.control",
        "retry": "workflow.control",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return PipelineRun.objects.none()
        user = self.request.user
        qs = PipelineRun.objects.prefetch_related("steps")
        if not user.is_superuser and user.tenant_id is not None:
            qs = qs.filter(tenant_id=user.tenant_id)
        return qs

    @extend_schema(
        tags=["workflow"],
        responses={200: OpenApiResponse(description="Aggregate run counts for the dashboard.")},
    )
    @action(detail=False, methods=["get"])
    def stats(self, request: Request) -> Response:
        # get_queryset() is already tenant-scoped; the stats read never
        # widens it. prefetch_related is dead weight for a count-only query,
        # so drop it before aggregating.
        return Response(PipelineService().stats(self.get_queryset().prefetch_related(None)))

    @action(detail=True, methods=["post"])
    def pause(self, request: Request, pk=None) -> Response:
        run = PipelineService().request_pause(self.get_object())
        return Response(PipelineRunSerializer(run).data)

    @action(detail=True, methods=["post"])
    def resume(self, request: Request, pk=None) -> Response:
        run = PipelineService().request_resume(self.get_object())
        return Response(PipelineRunSerializer(run).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request: Request, pk=None) -> Response:
        run = PipelineService().request_cancel(self.get_object())
        return Response(PipelineRunSerializer(run).data)

    @action(detail=True, methods=["post"])
    def retry(self, request: Request, pk=None) -> Response:
        run = PipelineService().request_retry(self.get_object())
        return Response(PipelineRunSerializer(run).data)
