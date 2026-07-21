from __future__ import annotations

from rest_framework import serializers

from tenancy.models import CompanyProfile, Subscription, Tenant


class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = (
            "id",
            "name",
            "slug",
            "status",
            "timezone",
            "currency",
            "locale",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = (
            "id",
            "tenant",
            "plan",
            "status",
            "seats",
            "started_at",
            "current_period_end",
        )
        read_only_fields = ("id",)


class TenantSettingsSerializer(serializers.ModelSerializer):
    """The company basics the operator may edit — never slug/status/is_active,
    which are lifecycle-controlled."""

    class Meta:
        model = Tenant
        fields = ("id", "name", "timezone", "currency", "locale", "status", "created_at")
        read_only_fields = ("id", "status", "created_at")


class CompanyProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyProfile
        fields = (
            "id",
            "tenant",
            "legal_name",
            "registration_number",
            "contact_email",
            "phone",
            "address_line1",
            "address_line2",
            "city",
            "state",
            "postal_code",
            "country",
            "branding",
        )
        # tenant is fixed by the view (the caller's own) — never reassignable
        # through the request body.
        read_only_fields = ("id", "tenant")
