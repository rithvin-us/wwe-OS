"""Pure business-period path resolution — an in-memory registry lookup
plus string formatting. No django.db import, no BaseService, no network —
safe to call from anywhere with no side effects. See design §9a:
docs/superpowers/specs/2026-07-24-business-period-manager-design.md

The DB-touching side (period rows, manifest, lifecycle) lives in
periods.services.PeriodService, which consumes this module's output —
it never the other way around.
"""

from __future__ import annotations

import calendar
from dataclasses import dataclass, field
from datetime import date
from typing import Any

from periods.registry import get_document_type


@dataclass(frozen=True)
class DocumentContext:
    document_type: str
    document_name: str
    tenant_slug: str
    business_date: date | None = None
    source_channel: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ResolvedLocation:
    key: str
    period_year: int | None
    period_month: int | None
    is_library: bool


def resolve_location(context: DocumentContext) -> ResolvedLocation:
    definition = get_document_type(context.document_type)

    if definition.is_library:
        key = f"{context.tenant_slug}/Library/{definition.folder_segment}/{context.document_name}"
        return ResolvedLocation(key=key, period_year=None, period_month=None, is_library=True)

    if context.business_date is None:
        raise ValueError(
            f"document_type '{context.document_type}' is period-rotating and "
            "requires business_date."
        )
    year, month = context.business_date.year, context.business_date.month
    month_name = calendar.month_name[month]
    key = (
        f"{context.tenant_slug}/{year}/{month_name}/"
        f"{definition.folder_segment}/{context.document_name}"
    )
    return ResolvedLocation(key=key, period_year=year, period_month=month, is_library=False)
