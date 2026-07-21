"""Asset data access — thin; the tenant-scoped soft-delete manager does the work."""

from __future__ import annotations

from assets.backend.models import Asset
from django.db import models


class AssetRepository:
    def for_tenant(self, tenant) -> models.QuerySet[Asset]:
        return Asset.objects.filter(tenant=tenant)

    def get(self, *, asset_id, tenant) -> Asset | None:
        return Asset.objects.filter(id=asset_id, tenant=tenant).first()
