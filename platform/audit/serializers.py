from rest_framework import serializers

from audit.models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = (
            "id",
            "tenant",
            "actor",
            "action",
            "module",
            "object_type",
            "object_id",
            "ip_address",
            "user_agent",
            "changes",
            "archived",
            "created_at",
        )
        read_only_fields = fields
