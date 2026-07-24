"""resolve_location() — pure path resolution. No DB, no IO. The
zero-query test is the literal proof of that claim, not just a docstring."""

from __future__ import annotations

from datetime import date

import pytest
from periods.models import BusinessPeriod
from periods.registry import DocumentTypeDef, register_document_type
from periods.resolution import DocumentContext, resolve_location
from shared.exceptions import NotFoundError

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _register_test_types():
    register_document_type(
        DocumentTypeDef(
            key="test.rotating",
            label="Rotating",
            folder_segment="Invoices",
            is_library=False,
            module="test",
        )
    )
    register_document_type(
        DocumentTypeDef(
            key="test.library",
            label="Library",
            folder_segment="Insurance",
            is_library=True,
            module="test",
        )
    )


def test_rotating_context_builds_period_key():
    context = DocumentContext(
        document_type="test.rotating",
        document_name="invoice.pdf",
        tenant_slug="acme",
        business_date=date(2026, 7, 14),
    )
    resolved = resolve_location(context)

    assert resolved.key == "acme/2026/July/Invoices/invoice.pdf"
    assert resolved.period_year == 2026
    assert resolved.period_month == 7
    assert resolved.is_library is False


def test_library_context_builds_library_key():
    context = DocumentContext(
        document_type="test.library",
        document_name="policy.pdf",
        tenant_slug="acme",
    )
    resolved = resolve_location(context)

    assert resolved.key == "acme/Library/Insurance/policy.pdf"
    assert resolved.period_year is None
    assert resolved.period_month is None
    assert resolved.is_library is True


def test_rotating_context_without_business_date_raises():
    context = DocumentContext(
        document_type="test.rotating",
        document_name="invoice.pdf",
        tenant_slug="acme",
    )
    with pytest.raises(ValueError, match="business_date"):
        resolve_location(context)


def test_unknown_document_type_raises_not_found():
    context = DocumentContext(
        document_type="does.not.exist",
        document_name="x.pdf",
        tenant_slug="acme",
        business_date=date(2026, 7, 14),
    )
    with pytest.raises(NotFoundError):
        resolve_location(context)


def test_resolve_location_performs_zero_db_queries(django_assert_num_queries):
    context = DocumentContext(
        document_type="test.rotating",
        document_name="invoice.pdf",
        tenant_slug="acme",
        business_date=date(2026, 7, 14),
    )
    with django_assert_num_queries(0):
        resolve_location(context)


def test_resolve_location_creates_no_period_row(tenant):
    context = DocumentContext(
        document_type="test.rotating",
        document_name="invoice.pdf",
        tenant_slug="acme",
        business_date=date(2026, 7, 14),
    )
    resolve_location(context)

    assert BusinessPeriod.objects.filter(tenant=tenant, year=2026, month=7).count() == 0
