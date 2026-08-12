"""Contracts' deadline source: active contracts approaching their end date.

Registers with the platform Deadline Engine so contract renewals show up in the
one deadlines view alongside invoice due dates. The engine owns aggregation and
permission enforcement; this only maps a contract to a `Deadline`.
"""

from __future__ import annotations

from collections.abc import Iterable
from datetime import date, timedelta

from contracts.backend.models.contract import Contract, ContractStatus
from deadlines.registry import Deadline, DeadlineSource, register

KIND = "contract_expiry"


def _upcoming(tenant, within_days: int) -> Iterable[Deadline]:
    today = date.today()
    horizon = today + timedelta(days=within_days)
    qs = Contract.objects.filter(
        status=ContractStatus.ACTIVE,
        end_date__isnull=False,
        end_date__lte=horizon,
    )
    if tenant is not None:
        qs = qs.filter(tenant=tenant)
    for contract in qs.order_by("end_date"):
        days_remaining = (contract.end_date - today).days
        yield Deadline(
            kind=KIND,
            label=f"{contract.title} · {contract.counterparty}",
            due_date=contract.end_date,
            days_remaining=days_remaining,
            is_overdue=days_remaining < 0,
            url=f"/contracts/{contract.id}",
            object_id=str(contract.id),
            extra={"counterparty": contract.counterparty, "auto_renew": contract.auto_renew},
        )


def register_deadlines() -> None:
    register(
        DeadlineSource(
            kind=KIND,
            label="Contract expiry",
            permission="contracts.read",
            upcoming=_upcoming,
        )
    )
