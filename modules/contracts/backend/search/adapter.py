"""Search adapter registration for contracts."""

from __future__ import annotations

from contracts.backend.models import Contract
from search.registry import SearchAdapter, register

INDEX = "contracts"


def to_document(contract: Contract) -> dict:
    body = " ".join(
        filter(
            None,
            [
                contract.counterparty,
                contract.get_category_display(),
                contract.notes,
                contract.ai_summary,
            ],
        )
    )
    return {
        "doc_id": str(contract.id),
        "title": contract.title,
        "body": body,
        "extra": {"status": contract.status, "category": contract.category},
        "url": f"/contracts/{contract.id}",
    }


def register_search() -> None:
    register(
        SearchAdapter(
            index=INDEX,
            label="Contracts",
            permission="contracts.read",
            to_document=to_document,
            queryset=lambda: Contract.objects.all(),
        )
    )
