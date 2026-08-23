"""The WWE OS Assistant answers only from real records: it grounds on the
platform search index, returns the matching records as sources, and refuses to
answer when nothing matches (rather than inventing data). Uses the mock AI
provider, so we assert on grounding and sources, not on model prose.
"""

from __future__ import annotations

from datetime import date

import pytest
from ai.assistant import NO_DATA_ANSWER, AssistantService
from finance.backend.models.invoice import InvoiceType
from finance.backend.services.invoice import InvoiceService

pytestmark = pytest.mark.django_db


def _invoice(tenant, customer, line_items):
    return InvoiceService().generate(
        tenant=tenant,
        invoice_type=InvoiceType.SALES,
        invoice_date=date(2026, 7, 26),
        customer=customer,
        lines=line_items(),
    )


def test_answer_is_grounded_in_real_records(owner, tenant, customer, line_items):
    invoice = _invoice(tenant, customer, line_items)

    result = AssistantService().answer(user=owner, question=invoice.number)

    assert result["grounded"] is True
    urls = {s["url"] for s in result["sources"]}
    assert "/invoices" in urls
    # Mock provider echoes the grounded prompt — proving the record was passed in.
    assert invoice.number in result["answer"]


def test_unknown_question_is_refused_not_invented(owner, tenant):
    result = AssistantService().answer(user=owner, question="zzz-nonexistent-xyz")

    assert result["grounded"] is False
    assert result["sources"] == []
    assert result["answer"] == NO_DATA_ANSWER


def test_sources_are_permission_filtered(make_user, tenant, customer, line_items):
    _invoice(tenant, customer, line_items)
    stranger = make_user("stranger@acme.test", "stranger", tenant=tenant)

    result = AssistantService().answer(user=stranger, question="invoice")

    # A user without finance.invoice.read sees no invoice sources.
    assert all(s["index"] != "invoices" for s in result["sources"])


def test_endpoint_answers(auth_client, owner, tenant, customer, line_items):
    invoice = _invoice(tenant, customer, line_items)

    response = auth_client(owner).post(
        "/api/v1/ai/assistant/", {"question": invoice.number}, format="json"
    )

    assert response.status_code == 200, response.data
    body = response.data.get("data", response.data)
    assert body["grounded"] is True
    assert body["sources"]
