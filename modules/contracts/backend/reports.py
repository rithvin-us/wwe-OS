"""Registers the contract register into the platform report catalog."""

from __future__ import annotations

from contracts.backend.models import Contract
from contracts.backend.services.contract import ContractService
from reporting.registry import ReportDefinition, register_report


def register_reports() -> None:
    register_report(
        ReportDefinition(
            key="contracts-register",
            label="Contract register",
            module="contracts",
            permission="contracts.read",
            description="Every contract with counterparty, value, status, and end date.",
            build_spec=lambda tenant: ContractService().build_report_spec(
                contracts=Contract.objects.filter(tenant=tenant)
            ),
        )
    )
