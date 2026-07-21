"""Report catalog + run tests — the cross-module reporting surface.

The four business modules register their reports at app-ready, so the catalog
is populated in tests without extra setup.
"""

from __future__ import annotations

import pytest
from reporting.models import ReportExport
from reporting.registry import all_reports, get_report
from reporting.services import ReportService
from shared.exceptions import NotFoundError

pytestmark = pytest.mark.django_db

CATALOG_URL = "/api/v1/reporting/catalog/"
RUN_URL = "/api/v1/reporting/run/"


def test_modules_register_their_reports():
    keys = {d.key for d in all_reports()}
    assert {"documents-register", "contracts-register", "inventory-stock", "asset-register"} <= keys


def test_unknown_report_key_raises():
    with pytest.raises(NotFoundError):
        get_report("nope")


def test_run_builds_and_exports(tenant, make_user, owner_role, grant):
    user = make_user(email="op@acme.test", username="op", tenant=tenant)
    grant(user, owner_role)
    export = ReportService().run(key="asset-register", format="csv", tenant=tenant, actor=user)
    assert isinstance(export, ReportExport)
    assert export.module == "assets"
    assert export.file is not None


# --------------------------------------------------------------------------- #
# API
# --------------------------------------------------------------------------- #


def test_api_catalog_is_permission_filtered(tenant, make_user, make_role, grant, auth_client):
    # A user who can only read inventory sees only the inventory report.
    user = make_user(email="stock@acme.test", username="stock", tenant=tenant)
    codes = ["reporting.view", "reporting.export", "inventory.read"]
    grant(user, make_role(tenant, "stock", codes))

    catalog = auth_client(user).get(CATALOG_URL)
    assert catalog.status_code == 200
    keys = {row["key"] for row in catalog.data}
    assert keys == {"inventory-stock"}


def test_api_run_returns_download_url(tenant, make_user, owner_role, grant, auth_client):
    user = make_user(email="owner@acme.test", username="owner", tenant=tenant)
    grant(user, owner_role)

    response = auth_client(user).post(
        RUN_URL, {"key": "documents-register", "format": "csv"}, format="json"
    )
    assert response.status_code == 200
    # A signed download URL was returned (local provider signs a token URL; an
    # S3/R2 provider would sign an absolute one — both are non-empty).
    assert response.data["download_url"]
    assert response.data["filename"].endswith(".csv")


def test_api_run_requires_module_permission(tenant, make_user, make_role, grant, auth_client):
    # Has reporting.export but NOT assets.read → cannot run the asset register.
    user = make_user(email="limited@acme.test", username="limited", tenant=tenant)
    codes = ["reporting.view", "reporting.export", "inventory.read"]
    grant(user, make_role(tenant, "limited", codes))

    denied = auth_client(user).post(RUN_URL, {"key": "asset-register"}, format="json")
    assert denied.status_code == 403


def test_api_catalog_requires_permission(tenant, make_user, auth_client):
    nobody = make_user(email="nobody@acme.test", username="nobody", tenant=tenant)
    assert auth_client(nobody).get(CATALOG_URL).status_code == 403
