"""Registers contracts as an automation-engine source: which tagged
contracts qualify for a rule, and how to fetch one contract's stored file."""

from __future__ import annotations

from automation.registry import CollectedFile, SourceAdapter, register_source
from contracts.backend.models import Contract
from contracts.backend.reports import TAG_MODULE, TAG_OBJECT_TYPE


def _list_tagged(tenant, tag_ids: list[str]) -> list[dict[str, str]]:
    from tagging.services import TagService

    object_ids = TagService().object_ids_for_tags(
        tenant=tenant, module=TAG_MODULE, object_type=TAG_OBJECT_TYPE, tag_ids=tag_ids
    )
    contracts = Contract.objects.filter(tenant=tenant, id__in=object_ids)
    return [{"object_id": str(c.id), "title": f"{c.title} — {c.counterparty}"} for c in contracts]


def _collect_file(object_id: str) -> CollectedFile | None:
    contract = Contract.objects.filter(id=object_id).select_related("file").first()
    if contract is None or contract.file is None:
        return None
    from storage.services import StorageService

    data = StorageService().open(contract.file)
    return CollectedFile(
        filename=contract.file.filename, content_type=contract.file.content_type, data=data
    )


def register_collectible() -> None:
    register_source(
        SourceAdapter(
            module=TAG_MODULE,
            label="Contracts",
            permission="contracts.read",
            object_type=TAG_OBJECT_TYPE,
            list_tagged=_list_tagged,
            collect_file=_collect_file,
        )
    )
