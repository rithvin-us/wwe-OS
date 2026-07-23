"""Common filter application for report `build_spec` callables.

Every registered report receives the same `filters` dict (date_from, date_to,
vendor, tag_ids) from `RunReportView`; a module applies whichever of these
its own data supports. These helpers cover the two pieces every module needs
identically — a date-range filter on one field, and the tag filter, which is
always resolved through the platform tagging capability — so five modules
don't each re-implement the same `TaggedItem` lookup.
"""

from __future__ import annotations

from typing import Any

from django.db.models import QuerySet


def apply_date_range(qs: QuerySet, filters: dict[str, Any], *, field: str) -> QuerySet:
    date_from = filters.get("date_from")
    date_to = filters.get("date_to")
    if date_from:
        qs = qs.filter(**{f"{field}__gte": date_from})
    if date_to:
        qs = qs.filter(**{f"{field}__lte": date_to})
    return qs


def apply_tag_filter(
    qs: QuerySet, filters: dict[str, Any], *, tenant, module: str, object_type: str
) -> QuerySet:
    tag_ids = filters.get("tag_ids") or []
    if not tag_ids:
        return qs
    from tagging.services import TagService

    object_ids = TagService().object_ids_for_tags(
        tenant=tenant, module=module, object_type=object_type, tag_ids=tag_ids
    )
    return qs.filter(id__in=object_ids)


def filters_summary(filters: dict[str, Any], *, vendor_label: str = "Vendor") -> dict[str, str]:
    """Human-readable filters, echoed on the rendered report (ReportSpec.filters)."""
    summary: dict[str, str] = {}
    date_from, date_to = filters.get("date_from"), filters.get("date_to")
    if date_from or date_to:
        summary["Date range"] = f"{date_from or '…'} – {date_to or '…'}"
    vendor = filters.get("vendor")
    if vendor:
        summary[vendor_label] = vendor
    tag_ids = filters.get("tag_ids") or []
    if tag_ids:
        summary["Tags"] = f"{len(tag_ids)} selected"
    return summary
