from __future__ import annotations

from rest_framework import serializers

from roles.models import Role, UserRole


class RoleSerializer(serializers.ModelSerializer):
    permission_codes = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = (
            "id",
            "tenant",
            "name",
            "slug",
            "description",
            "is_system",
            "parent",
            "permission_codes",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "is_system", "permission_codes", "created_at", "updated_at")

    def get_permission_codes(self, obj: Role) -> list[str]:
        return sorted(obj.permission_codes())


class SetPermissionsSerializer(serializers.Serializer):
    permission_codes = serializers.ListField(child=serializers.CharField())


class AssignRoleSerializer(serializers.Serializer):
    user_id = serializers.UUIDField()


class UserRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserRole
        fields = ("id", "user", "role", "assigned_by", "created_at")
        read_only_fields = fields
