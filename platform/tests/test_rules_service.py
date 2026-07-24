"""RulesEngine.evaluate_purchase_bill — deterministic, facts-in, no DB/AI
access inside the engine itself."""

from __future__ import annotations

from decimal import Decimal

from periods.models import PeriodStatus
from rules.services import RuleOutcome, RulesEngine


def test_clean_bill_is_approved_with_no_reasons():
    result = RulesEngine().evaluate_purchase_bill(
        confidence=Decimal("0.95"),
        seller_name="Vendor Inc.",
    )
    assert result.outcome == RuleOutcome.APPROVED
    assert result.reasons == []


def test_low_confidence_needs_attention():
    result = RulesEngine().evaluate_purchase_bill(
        confidence=Decimal("0.40"),
        seller_name="Vendor Inc.",
    )
    assert result.outcome == RuleOutcome.NEEDS_ATTENTION
    assert "low_confidence" in result.reasons


def test_unidentified_vendor_needs_attention():
    result = RulesEngine().evaluate_purchase_bill(
        confidence=Decimal("0.95"),
        seller_name="Pending OCR Processing",
    )
    assert result.outcome == RuleOutcome.NEEDS_ATTENTION
    assert "vendor_unidentified" in result.reasons


def test_duplicate_flag_needs_attention():
    result = RulesEngine().evaluate_purchase_bill(
        confidence=Decimal("0.95"),
        seller_name="Vendor Inc.",
        is_duplicate=True,
    )
    assert result.outcome == RuleOutcome.NEEDS_ATTENTION
    assert "duplicate_invoice" in result.reasons


def test_malformed_gst_needs_attention():
    result = RulesEngine().evaluate_purchase_bill(
        confidence=Decimal("0.95"),
        seller_name="Vendor Inc.",
        gst_number="not-a-gst",
    )
    assert result.outcome == RuleOutcome.NEEDS_ATTENTION
    assert "invalid_gst_format" in result.reasons


def test_valid_gst_does_not_block_approval():
    result = RulesEngine().evaluate_purchase_bill(
        confidence=Decimal("0.95"),
        seller_name="Vendor Inc.",
        gst_number="29ABCDE1234F1Z5",
    )
    assert result.outcome == RuleOutcome.APPROVED


def test_closed_period_needs_attention():
    result = RulesEngine().evaluate_purchase_bill(
        confidence=Decimal("0.95"),
        seller_name="Vendor Inc.",
        period_status=PeriodStatus.CLOSED,
    )
    assert result.outcome == RuleOutcome.NEEDS_ATTENTION
    assert "period_closed" in result.reasons


def test_open_period_does_not_block_approval():
    result = RulesEngine().evaluate_purchase_bill(
        confidence=Decimal("0.95"),
        seller_name="Vendor Inc.",
        period_status=PeriodStatus.OPEN,
    )
    assert result.outcome == RuleOutcome.APPROVED


def test_multiple_failures_all_appear_in_reasons():
    result = RulesEngine().evaluate_purchase_bill(
        confidence=Decimal("0.10"),
        seller_name="Pending OCR Processing",
        is_duplicate=True,
    )
    assert result.outcome == RuleOutcome.NEEDS_ATTENTION
    assert set(result.reasons) == {"low_confidence", "vendor_unidentified", "duplicate_invoice"}
