"""Pipeline run API serializers."""

from __future__ import annotations

from shared.serializers import BaseModelSerializer

from workflow.models import PipelineRun, PipelineStepRun


class PipelineStepRunSerializer(BaseModelSerializer):
    class Meta:
        model = PipelineStepRun
        fields = (
            "id",
            "step_index",
            "step_key",
            "status",
            "attempt",
            "started_at",
            "finished_at",
            "output",
            "error_message",
        )
        read_only_fields = fields


class PipelineRunSerializer(BaseModelSerializer):
    steps = PipelineStepRunSerializer(many=True, read_only=True)

    class Meta:
        model = PipelineRun
        fields = (
            "id",
            "pipeline_key",
            "pipeline_version",
            "status",
            "termination_reason",
            "current_step_index",
            "trigger_type",
            "source_module",
            "source_object_type",
            "source_object_id",
            "queued_at",
            "started_at",
            "finished_at",
            "error_message",
            "steps",
            "created_at",
        )
        read_only_fields = fields
