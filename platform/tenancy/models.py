"""Multi-tenancy core: the tenant aggregate and its profile/subscription.

Every tenant-owned row in the platform points back to a Tenant (via
shared.models.TenantOwnedModel). Isolation is enforced by the tenant-scoped
manager plus the tenant middleware.
"""

from __future__ import annotations

from django.db import models
from shared.models import BaseModel


class TenantStatus(models.TextChoices):
    TRIAL = "trial", "Trial"
    ACTIVE = "active", "Active"
    SUSPENDED = "suspended", "Suspended"
    CLOSED = "closed", "Closed"


class Tenant(BaseModel):
    """An isolated customer/company workspace."""

    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=80, unique=True)
    status = models.CharField(
        max_length=20, choices=TenantStatus.choices, default=TenantStatus.TRIAL
    )
    timezone = models.CharField(max_length=64, default="UTC")
    currency = models.CharField(max_length=3, default="USD")
    locale = models.CharField(max_length=10, default="en-us")
    is_active = models.BooleanField(default=True)

    class Meta(BaseModel.Meta):
        db_table = "tenancy_tenant"
        indexes = [models.Index(fields=["status"])]

    def __str__(self) -> str:
        return self.name


class SubscriptionStatus(models.TextChoices):
    TRIALING = "trialing", "Trialing"
    ACTIVE = "active", "Active"
    PAST_DUE = "past_due", "Past due"
    CANCELED = "canceled", "Canceled"


class Subscription(BaseModel):
    """A tenant's plan and billing period (billing engine plugs in later)."""

    tenant = models.OneToOneField(Tenant, on_delete=models.CASCADE, related_name="subscription")
    plan = models.CharField(max_length=50, default="free")
    status = models.CharField(
        max_length=20, choices=SubscriptionStatus.choices, default=SubscriptionStatus.TRIALING
    )
    seats = models.PositiveIntegerField(default=5)
    started_at = models.DateTimeField(null=True, blank=True)
    current_period_end = models.DateTimeField(null=True, blank=True)

    class Meta(BaseModel.Meta):
        db_table = "tenancy_subscription"

    def __str__(self) -> str:
        return f"{self.tenant.name} · {self.plan}"


class CompanyProfile(BaseModel):
    """Company identity and branding for a tenant."""

    tenant = models.OneToOneField(Tenant, on_delete=models.CASCADE, related_name="company_profile")
    legal_name = models.CharField(max_length=200, blank=True)
    registration_number = models.CharField(max_length=100, blank=True)
    contact_email = models.EmailField(blank=True)
    phone = models.CharField(max_length=40, blank=True)
    address_line1 = models.CharField(max_length=200, blank=True)
    address_line2 = models.CharField(max_length=200, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=2, blank=True)
    branding = models.JSONField(default=dict, blank=True)

    class Meta(BaseModel.Meta):
        db_table = "tenancy_company_profile"

    def __str__(self) -> str:
        return self.legal_name or self.tenant.name
