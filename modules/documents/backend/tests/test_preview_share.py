"""Documents can be previewed inline and shared via a short-lived signed URL —
no permanent public URL, no exposed storage credentials.
"""

from __future__ import annotations

import time

import pytest
from documents.backend.services.document import DocumentService

pytestmark = pytest.mark.django_db

BASE = "/api/v1/documents/documents"
PDF = b"%PDF-1.4 minimal"


def _create(tenant, owner, **overrides):
    defaults = {
        "tenant": tenant,
        "owner": owner,
        "title": "Manual",
        "category": "policy",
        "data": PDF,
        "filename": "manual.pdf",
        "content_type": "application/pdf",
        "summarize": False,
    }
    defaults.update(overrides)
    return DocumentService().create(**defaults)


def test_preview_streams_pdf_inline(tenant, owner, auth_client):
    document = _create(tenant, owner)

    response = auth_client(owner).get(f"{BASE}/{document.id}/preview/")

    assert response.status_code == 200
    assert response["Content-Type"] == "application/pdf"
    assert response["Content-Disposition"].startswith("inline")
    assert response["X-Content-Type-Options"] == "nosniff"


def test_preview_falls_back_to_attachment_for_unsafe_types(tenant, owner, auth_client):
    document = _create(
        tenant,
        owner,
        data=b"PK\x03\x04zip-ish",
        filename="sheet.xlsx",
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )

    response = auth_client(owner).get(f"{BASE}/{document.id}/preview/")

    assert response.status_code == 200
    assert response["Content-Disposition"].startswith("attachment")


def test_share_returns_a_short_lived_signed_url(tenant, owner, auth_client):
    document = _create(tenant, owner)

    response = auth_client(owner).get(f"{BASE}/{document.id}/share/?expires=120")

    assert response.status_code == 200
    body = response.data.get("data", response.data)
    assert body["expires_in"] == 120
    assert "token=" in body["url"]
    # The signed URL resolves to the file without credentials …
    fetched = auth_client(owner).get(body["url"])
    assert fetched.status_code == 200
    assert fetched.content == PDF


def test_share_url_expires(tenant, owner, auth_client, monkeypatch):
    document = _create(tenant, owner)
    response = auth_client(owner).get(f"{BASE}/{document.id}/share/?expires=60")
    url = (response.data.get("data", response.data))["url"]

    # Fast-forward the clock the token-check reads — an expired token is refused.
    future = time.time() + 3600
    monkeypatch.setattr("storage.views.time.time", lambda: future)
    assert auth_client(owner).get(url).status_code == 403


def test_share_is_permission_gated(tenant, owner, make_user, auth_client):
    document = _create(tenant, owner)
    stranger = make_user("stranger@acme.test", "stranger", tenant=tenant)

    response = auth_client(stranger).get(f"{BASE}/{document.id}/share/")

    assert response.status_code == 403
