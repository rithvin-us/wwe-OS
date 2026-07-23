"""Registers the contract register into the platform report catalog."""

from __future__ import annotations

from contracts.backend.models import Contract
from contracts.backend.services.contract import ContractService
from reporting.filtering import apply_date_range, apply_tag_filter
from reporting.registry import ReportDefinition, register_report

TAG_MODULE = "contracts"
TAG_OBJECT_TYPE = "Contract"


def _build(tenant, filters: dict):
    contracts = Contract.objects.filter(tenant=tenant)
    contracts = apply_date_range(contracts, filters, field="end_date")
    contracts = apply_tag_filter(
        contracts, filters, tenant=tenant, module=TAG_MODULE, object_type=TAG_OBJECT_TYPE
    )
    vendor = filters.get("vendor") or ""
    if vendor:
        contracts = contracts.filter(counterparty__icontains=vendor)
    applied = {
        "date_from": filters.get("date_from"),
        "date_to": filters.get("date_to"),
        "vendor": vendor,
        "tag_ids": filters.get("tag_ids"),
    }
    return ContractService().build_report_spec(contracts=contracts, filters=applied)


def register_reports() -> None:
    register_report(
        ReportDefinition(
            key="contracts-register",
            label="Contract register",
            module="contracts",
            permission="contracts.read",
            description="Every contract with counterparty, value, status, and end date.",
            build_spec=_build,
        )
    )
