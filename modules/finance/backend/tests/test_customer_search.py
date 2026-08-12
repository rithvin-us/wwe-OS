"""Customers are indexed into the one platform search index off model signals,
so they surface in the command palette and link to their Customer 360 page.
"""

from __future__ import annotations

import pytest
from finance.backend.models.invoice import Customer
from search.models import SearchDocument
from search.services import SearchService

pytestmark = pytest.mark.django_db

INDEX = "customers"


def test_saving_a_customer_indexes_it(tenant):
    customer = Customer.objects.create(tenant=tenant, name="Coimbatore Metals", state="Tamil Nadu")

    doc = SearchDocument.objects.get(index=INDEX, doc_id=str(customer.id))
    assert doc.title == "Coimbatore Metals"
    assert doc.url == f"/customers/{customer.id}"
    assert doc.extra["status"] == "active"


def test_search_finds_a_customer_by_name(tenant, owner):
    customer = Customer.objects.create(tenant=tenant, name="Nilgiris Water Board")

    result = SearchService().search(user=owner, query="Nilgiris", indexes=[INDEX])

    assert str(customer.id) in {row["doc_id"] for row in result["results"]}


def test_soft_deleting_a_customer_removes_it_from_the_index(tenant):
    customer = Customer.objects.create(tenant=tenant, name="Erode Filters")
    assert SearchDocument.objects.filter(index=INDEX, doc_id=str(customer.id)).exists()

    customer.delete()  # TenantOwnedModel soft-delete → post_save with is_deleted

    assert not SearchDocument.objects.filter(index=INDEX, doc_id=str(customer.id)).exists()
