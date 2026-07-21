"""Contract data access — thin; the tenant-scoped soft-delete manager does the
work. Names the expiry query the service and API need."""

from __future__ import annotations

from datetime import timedelta

from contracts.backend.models import Contract, ContractStatus
from django.db import models
from django.utils import timezone


class ContractRepository:
    def for_tenant(self, tenant) -> models.QuerySet[Contract]:
        return Contract.objects.filter(tenant=tenant)

    def get(self, *, contract_id, tenant) -> Contract | None:
        return Contract.objects.filter(id=contract_id, tenant=tenant).first()

    def expiring_within(self, tenant, days: int) -> models.QuerySet[Contract]:
        today = timezone.now().date()
        return self.for_tenant(tenant).filter(
            status=ContractStatus.ACTIVE,
            end_date__isnull=False,
            end_date__gte=today,
            end_date__lte=today + timedelta(days=days),
        )

    def past_due(self, tenant) -> models.QuerySet[Contract]:
        return self.for_tenant(tenant).filter(
            status=ContractStatus.ACTIVE,
            end_date__isnull=False,
            end_date__lt=timezone.now().date(),
        )
