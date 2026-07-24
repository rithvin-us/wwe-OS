"""RulesEngine — the single deterministic seam between what AI/lookups
found and what state a record is allowed to enter. Takes already-known
facts; makes no DB/AI calls itself. See design §2a:
docs/superpowers/specs/2026-07-25-rules-engine-design.md
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from enum import StrEnum

from periods.models import PeriodStatus
from shared.services import BaseService

from rules.validators import validate_gst_number

CONFIDENCE_THRESHOLD = Decimal("0.80")
UNIDENTIFIED_VENDOR_LABEL = "Pending OCR Processing"


class RuleOutcome(StrEnum):
    APPROVED = "approved"
    NEEDS_ATTENTION = "needs_attention"


@dataclass(frozen=True)
class RuleEvaluation:
    outcome: str
    reasons: list[str] = field(default_factory=list)


class RulesEngine(BaseService):
    def evaluate_purchase_bill(
        self,
        *,
        confidence: Decimal,
        seller_name: str,
        gst_number: str = "",
        is_duplicate: bool = False,
        period_status: str | None = None,
    ) -> RuleEvaluation:
        reasons: list[str] = []

        if confidence < CONFIDENCE_THRESHOLD:
            reasons.append("low_confidence")
        if seller_name == UNIDENTIFIED_VENDOR_LABEL:
            reasons.append("vendor_unidentified")
        if not validate_gst_number(gst_number):
            reasons.append("invalid_gst_format")
        if is_duplicate:
            reasons.append("duplicate_invoice")
        if period_status == PeriodStatus.CLOSED:
            reasons.append("period_closed")

        outcome = RuleOutcome.NEEDS_ATTENTION if reasons else RuleOutcome.APPROVED
        return RuleEvaluation(outcome=outcome, reasons=reasons)
