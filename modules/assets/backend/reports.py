"""Registers the asset register into the platform report catalog."""

from __future__ import annotations

from assets.backend.models import Asset
from assets.backend.services.asset import AssetService
from reporting.filtering import apply_date_range, apply_tag_filter
from reporting.registry import ReportDefinition, register_report

TAG_MODULE = "assets"
TAG_OBJECT_TYPE = "Asset"


def _build(tenant, filters: dict):
    assets = Asset.objects.filter(tenant=tenant)
    assets = apply_date_range(assets, filters, field="purchase_date")
    assets = apply_tag_filter(
        assets, filters, tenant=tenant, module=TAG_MODULE, object_type=TAG_OBJECT_TYPE
    )
    # Assets have no vendor concept — only echo the filters actually applied,
    # so a stray "vendor" typed for a different report never appears here.
    applied = {k: filters.get(k) for k in ("date_from", "date_to", "tag_ids")}
    return AssetService().build_report_spec(assets=assets, filters=applied)


def register_reports() -> None:
    register_report(
        ReportDefinition(
            key="asset-register",
            label="Asset register",
            module="assets",
            permission="assets.read",
            description="Every asset with category, status, assignee, and cost.",
            build_spec=_build,
        )
    )
