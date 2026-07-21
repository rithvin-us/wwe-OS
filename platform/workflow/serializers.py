"""Workflow API serializers."""

from __future__ import annotations

from rest_framework import serializers
from shared.serializers import BaseModelSerializer

from workflow.models import WorkflowAction, WorkflowDefinition, WorkflowInstance, WorkflowStep


class WorkflowStepSerializer(BaseModelSerializer):
    class Meta:
        model = WorkflowStep
        fields = ("id", "key", "name", "order", "required_permission")


class WorkflowDefinitionSerializer(BaseModelSerializer):
    steps = WorkflowStepSerializer(many=True, read_only=True)

    class Meta:
        model = WorkflowDefinition
        fields = (
            "id",
            "key",
            "name",
            "description",
            "module",
            "version",
            "is_active",
            "steps",
            "created_at",
        )


class WorkflowActionSerializer(BaseModelSerializer):
    actor_email = serializers.SerializerMethodField()
    step_key = serializers.SerializerMethodField()

    class Meta:
        model = WorkflowAction
        fields = ("id", "action", "comment", "actor_email", "step_key", "created_at")

    def get_actor_email(self, obj: WorkflowAction) -> str | None:
        return obj.actor.email if obj.actor else None

    def get_step_key(self, obj: WorkflowAction) -> str | None:
        return obj.step.key if obj.step else None


class WorkflowInstanceSerializer(BaseModelSerializer):
    definition_key = serializers.CharField(source="definition.key", read_only=True)
    definition_name = serializers.CharField(source="definition.name", read_only=True)
    current_step = WorkflowStepSerializer(read_only=True)
    actions = WorkflowActionSerializer(many=True, read_only=True)
    started_by_email = serializers.SerializerMethodField()

    class Meta:
        model = WorkflowInstance
        fields = (
            "id",
            "definition_key",
            "definition_name",
            "subject_type",
            "subject_id",
            "status",
            "current_step",
            "context",
            "started_by_email",
            "actions",
            "created_at",
            "completed_at",
        )

    def get_started_by_email(self, obj: WorkflowInstance) -> str | None:
        return obj.started_by.email if obj.started_by else None


class ApproveSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True, max_length=2000)


class RejectSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=2000)


class CancelSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True, max_length=2000)
