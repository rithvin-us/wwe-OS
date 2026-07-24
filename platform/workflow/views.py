"""Pipeline run API — read access plus the pause/resume/cancel/retry
control-plane actions."""

from __future__ import annotations

from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from shared.views import ReadOnlyModelViewSet

from workflow.models import PipelineRun
from workflow.serializers import PipelineRunSerializer
from workflow.services import PipelineService


class PipelineRunViewSet(ReadOnlyModelViewSet):
    serializer_class = PipelineRunSerializer
    filterset_fields = ("pipeline_key", "status", "trigger_type")
    ordering_fields = ("created_at",)
    required_permissions = {
        "list": "workflow.view",
        "retrieve": "workflow.view",
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
