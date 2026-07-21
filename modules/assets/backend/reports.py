"""Registers the asset register into the platform report catalog."""

from __future__ import annotations

from assets.backend.models import Asset
from assets.backend.services.asset import AssetService
from reporting.registry import ReportDefinition, register_report


def register_reports() -> None:
    register_report(
        ReportDefinition(
            key="asset-register",
            label="Asset register",
            module="assets",
            permission="assets.read",
            description="Every asset with category, status, assignee, and cost.",
            build_spec=lambda tenant: AssetService().build_report_spec(
                assets=Asset.objects.filter(tenant=tenant)
            ),
        )
    )
