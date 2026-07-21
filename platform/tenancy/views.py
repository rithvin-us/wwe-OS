from __future__ import annotations

from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import IsAuthenticated
from shared.exceptions import NotFoundError
from shared.permissions import HasPlatformPermission

from tenancy.models import CompanyProfile
from tenancy.serializers import CompanyProfileSerializer, TenantSettingsSerializer


from rest_framework.permissions import AllowAny, IsAuthenticated

class CurrentTenantView(RetrieveUpdateAPIView):
    """Read or update the calling tenant's basics (name, timezone, currency, config)."""

    serializer_class = TenantSettingsSerializer
    permission_classes = [AllowAny]

    def get_object(self):
        user = getattr(self.request, "user", None)
        tenant = getattr(user, "tenant", None) if user and user.is_authenticated else None
        if tenant is None:
            from tenancy.models import Tenant

            tenant = Tenant.objects.first()
            if tenant is None:
                raise NotFoundError("No company is associated with this account.")
        return tenant


class CurrentCompanyProfileView(RetrieveUpdateAPIView):
    """Read or update the calling tenant's company profile."""

    serializer_class = CompanyProfileSerializer
    permission_classes = [IsAuthenticated, HasPlatformPermission]
    required_permissions = {"GET": "settings.view", "default": "settings.manage"}

    def get_object(self) -> CompanyProfile:
        tenant = getattr(self.request.user, "tenant", None)
        if tenant is None:
            raise NotFoundError("No tenant is associated with this account.")
        profile, _ = CompanyProfile.objects.get_or_create(tenant=tenant)
        return profile
