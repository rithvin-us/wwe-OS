"""Registers assets as an automation-engine source: which tagged assets
qualify for a rule, and how to fetch one asset's stored file."""

from __future__ import annotations

from assets.backend.models import Asset
from assets.backend.reports import TAG_MODULE, TAG_OBJECT_TYPE
from automation.registry import CollectedFile, SourceAdapter, register_source


def _list_tagged(tenant, tag_ids: list[str]) -> list[dict[str, str]]:
    from tagging.services import TagService

    object_ids = TagService().object_ids_for_tags(
        tenant=tenant, module=TAG_MODULE, object_type=TAG_OBJECT_TYPE, tag_ids=tag_ids
    )
    assets = Asset.objects.filter(tenant=tenant, id__in=object_ids)
    return [{"object_id": str(a.id), "title": f"{a.name} ({a.asset_tag})"} for a in assets]


def _collect_file(object_id: str) -> CollectedFile | None:
    asset = Asset.objects.filter(id=object_id).select_related("file").first()
    if asset is None or asset.file is None:
        return None
    from storage.services import StorageService

    data = StorageService().open(asset.file)
    return CollectedFile(
        filename=asset.file.filename, content_type=asset.file.content_type, data=data
    )


def register_collectible() -> None:
    register_source(
        SourceAdapter(
            module=TAG_MODULE,
            label="Assets",
            permission="assets.read",
            object_type=TAG_OBJECT_TYPE,
            list_tagged=_list_tagged,
            collect_file=_collect_file,
        )
    )
