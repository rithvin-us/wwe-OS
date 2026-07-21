"""Search platform tests — indexing, ranking, permissions, isolation, API."""

from __future__ import annotations

import pytest
from search import registry
from search.models import SearchDocument
from search.registry import SearchAdapter
from search.services import SearchService
from shared.exceptions import NotFoundError

INDEX = "test-notes"


@pytest.fixture(autouse=True)
def _adapter():
    registry.register(
        SearchAdapter(
            index=INDEX,
            label="Test notes",
            permission="storage.read",  # any real platform permission works
            to_document=lambda obj: obj,  # rebuild test supplies ready dicts
            queryset=None,
        )
    )
    yield
    registry.unregister(INDEX)


@pytest.fixture
def owner(make_user, tenant, owner_role, grant):
    user = make_user(email="owner@acme.test", username="owner", tenant=tenant)
    grant(user, owner_role)
    return user


def _index(tenant, doc_id, title, body="", extra=None, index=INDEX):
    return SearchService().upsert(
        index=index,
        doc_id=doc_id,
        title=title,
        body=body,
        extra=extra or {},
        url=f"/notes/{doc_id}",
        tenant=tenant,
    )


def _search(user, query, **kwargs):
    return SearchService().search(user=user, query=query, **kwargs)


def test_search_matches_title_and_body(tenant, owner):
    _index(tenant, "1", "Quarterly steel order", body="From Vendor Inc, September delivery.")
    _index(tenant, "2", "Office rent", body="Monthly payment record.")

    by_title = _search(owner, "steel")
    assert [r["doc_id"] for r in by_title["results"]] == ["1"]

    by_body = _search(owner, "september")
    assert [r["doc_id"] for r in by_body["results"]] == ["1"]
    assert "September" in by_body["results"][0]["excerpt"]


def test_title_matches_rank_above_body_matches(tenant, owner):
    _index(tenant, "body-hit", "Unrelated title", body="mentions cement somewhere in the text")
    _index(tenant, "title-hit", "Cement invoice", body="")

    results = _search(owner, "cement")["results"]
    assert [r["doc_id"] for r in results] == ["title-hit", "body-hit"]


def test_upsert_replaces_instead_of_duplicating(tenant, owner):
    _index(tenant, "1", "Old title")
    _index(tenant, "1", "New title")

    assert SearchDocument.objects.filter(index=INDEX).count() == 1
    assert _search(owner, "new")["results"][0]["title"] == "New title"


def test_unregistered_index_rejected(tenant):
    with pytest.raises(NotFoundError):
        _index(tenant, "1", "Ghost", index="not-registered")


def test_tenant_isolation(tenant, other_tenant, owner, make_user, grant, owner_role):
    _index(tenant, "1", "Acme secret contract")
    outsider = make_user(email="owner@globex.test", username="globex", tenant=other_tenant)
    grant(outsider, owner_role)

    assert _search(outsider, "secret")["results"] == []
    assert _search(owner, "secret")["meta"]["count"] == 1


def test_permission_gates_index_visibility(tenant, owner, make_user, grant, make_role):
    _index(tenant, "1", "Restricted document")

    searcher = make_user(email="searcher@acme.test", username="searcher", tenant=tenant)
    grant(searcher, make_role(tenant, "searcher", ["search.use"]))  # no storage.read

    assert _search(searcher, "restricted")["results"] == []
    assert _search(owner, "restricted")["meta"]["count"] == 1


def test_filters_and_facets(tenant, owner):
    _index(tenant, "1", "Bill one", extra={"status": "confirmed"})
    _index(tenant, "2", "Bill two", extra={"status": "confirmed"})
    _index(tenant, "3", "Bill three", extra={"status": "rejected"})

    filtered = _search(owner, "bill", filters={"status": "confirmed"})
    assert filtered["meta"]["count"] == 2

    faceted = _search(owner, "bill", facets=["status"])
    counts = {row["value"]: row["count"] for row in faceted["facets"]["status"]}
    assert counts == {"confirmed": 2, "rejected": 1}


def test_pagination(tenant, owner):
    for i in range(5):
        _index(tenant, str(i), f"Paged item {i}")

    page_one = _search(owner, "paged", page=1, page_size=2)
    assert len(page_one["results"]) == 2
    assert page_one["meta"] == {"count": 5, "page": 1, "pages": 3}
    page_three = _search(owner, "paged", page=3, page_size=2)
    assert len(page_three["results"]) == 1


def test_autocomplete_prefix(tenant, owner):
    _index(tenant, "1", "Vendor Inc")
    _index(tenant, "2", "Vendor Two")
    _index(tenant, "3", "Other name")

    hits = SearchService().autocomplete(user=owner, prefix="vend")
    assert [h["title"] for h in hits] == ["Vendor Inc", "Vendor Two"]
    assert SearchService().autocomplete(user=owner, prefix="v") == []  # too short


def test_remove_deletes_document(tenant, owner):
    _index(tenant, "1", "Ephemeral")
    SearchService().remove(index=INDEX, doc_id="1", tenant=tenant)
    assert _search(owner, "ephemeral")["results"] == []


def test_rebuild_from_adapter_source(tenant, owner):
    class FakeNote:
        def __init__(self, tenant, note_id, title):
            self.tenant = tenant
            self.note_id = note_id
            self.title = title

    notes = [FakeNote(tenant, "r1", "Rebuilt alpha"), FakeNote(tenant, "r2", "Rebuilt beta")]
    registry.unregister(INDEX)
    registry.register(
        SearchAdapter(
            index=INDEX,
            label="Test notes",
            permission="storage.read",
            to_document=lambda n: {"doc_id": n.note_id, "title": n.title},
            queryset=lambda: notes,
        )
    )

    count = SearchService().rebuild(INDEX)
    assert count == 2
    assert _search(owner, "rebuilt")["meta"]["count"] == 2


def test_api_search_and_autocomplete(tenant, owner, make_user, auth_client):
    _index(tenant, "1", "Steel invoice", extra={"status": "confirmed"})
    client = auth_client(owner)

    response = client.get("/api/v1/search/?q=steel&facets=status")
    assert response.status_code == 200
    assert response.data["meta"]["count"] == 1
    assert response.data["facets"]["status"][0]["value"] == "confirmed"

    autocomplete = client.get("/api/v1/search/autocomplete/?q=ste")
    assert autocomplete.data[0]["title"] == "Steel invoice"

    nobody = make_user(email="nobody@acme.test", username="nobody", tenant=tenant)
    assert auth_client(nobody).get("/api/v1/search/?q=steel").status_code == 403
