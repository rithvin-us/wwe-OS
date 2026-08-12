"""Search adapter for billing customers.

Makes a customer reachable from the one command palette (Ctrl/⌘ K) and, from
there, straight into its Customer 360 page. Customers have no service layer of
their own (they are maintained directly through `CustomerViewSet`), so indexing
is driven by model signals wired in `finance.backend.apps` — the same platform
`search.registry`/`SearchService` contract every other index uses, just hung
off a different seam. A soft-deleted customer is removed from the index.
"""

from __future__ import annotations

from finance.backend.models.invoice import Customer
from search.registry import SearchAdapter, register

INDEX = "customers"


def to_document(customer: Customer) -> dict:
    body = " ".join(
        filter(None, [customer.facility, customer.gstin, customer.state, customer.address])
    )
    return {
        "doc_id": str(customer.id),
        "title": customer.name,
        "body": body,
        "extra": {
            "status": "active" if customer.is_active else "inactive",
            "state": customer.state,
            "is_sez": customer.is_sez,
        },
        "url": f"/customers/{customer.id}",
    }


def register_search() -> None:
    register(
        SearchAdapter(
            index=INDEX,
            label="Customers",
            permission="finance.invoice.read",
            to_document=to_document,
            queryset=lambda: Customer.objects.all(),
        )
    )


def index_customer(sender, instance: Customer, **kwargs) -> None:
    """post_save receiver: keep the customer's search document in step. A
    soft-deleted customer (is_deleted flipped through a normal save) is pulled
    from the index rather than left as a dangling hit."""
    from search.services import SearchService

    service = SearchService()
    if getattr(instance, "is_deleted", False):
        service.remove(index=INDEX, doc_id=str(instance.id), tenant=instance.tenant)
    else:
        service.upsert(index=INDEX, tenant=instance.tenant, **to_document(instance))


def remove_customer(sender, instance: Customer, **kwargs) -> None:
    """post_delete receiver: drop the document on a hard delete."""
    from search.services import SearchService

    SearchService().remove(index=INDEX, doc_id=str(instance.id), tenant=instance.tenant)
