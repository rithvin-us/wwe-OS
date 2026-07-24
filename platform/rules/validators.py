"""Standalone, pure format validators — reusable independently of any one
rule evaluation. See design §2b:
docs/superpowers/specs/2026-07-25-rules-engine-design.md
"""

from __future__ import annotations

import re

_GSTIN_RE = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")


def validate_gst_number(value: str) -> bool:
    """True for a well-formed 15-character GSTIN, or an empty value —
    absence is not a format error; callers decide what absence means."""
    if not value:
        return True
    return bool(_GSTIN_RE.match(value))
