"""Report specification — the entire contract between modules and reporting.

A module builds a `ReportSpec` (pure data: columns + row dicts + labels) and
hands it to `ReportService`. Rendering, branding, storage, and history are
platform concerns; the module never touches a renderer.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class ReportColumn:
    key: str
    label: str
    align: str = "left"  # left | right | center


@dataclass(frozen=True)
class ReportSpec:
    key: str  # stable identifier, e.g. "purchase-bills"
    title: str
    module: str  # owning module slug (attribution, not logic)
    columns: list[ReportColumn]
    rows: list[dict[str, Any]]
    subtitle: str = ""
    filters: dict[str, str] = field(default_factory=dict)  # echoed on the report
    watermark: str = ""  # e.g. "DRAFT" / "CONFIDENTIAL"

    def cell(self, row: dict[str, Any], column: ReportColumn) -> str:
        value = row.get(column.key, "")
        return "" if value is None else str(value)
