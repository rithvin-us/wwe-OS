"""Single-tenant resolution.

Single-operator mode has exactly one company. This is the one place that
rule is encoded — auth's registration bootstrap and purchase's ingestion
both resolve "the" tenant through here rather than each guessing.
"""

from __future__ import annotations

from django.utils.text import slugify
from shared.events import Events, publish
from shared.exceptions import ConflictError
from shared.services import BaseService

from tenancy.models import Tenant

DEFAULT_COMPANY_NAME = "My Company"


class TenancyService(BaseService):
    def resolve_existing_default_tenant(self) -> Tenant | None:
        """The one tenant, if it exists. Never creates one. `None` if the
        company hasn't been set up yet; raises if the "exactly one" premise
        is already violated (a state single-operator mode doesn't expect)."""
        count = Tenant.objects.count()
        if count == 0:
            return None
        if count > 1:
            raise ConflictError(
                "Multiple companies are configured; this action needs one specified explicitly."
            )
        return Tenant.objects.first()

    def get_or_bootstrap_default_tenant(self, *, company_name: str = "") -> Tenant:
        """The one tenant — created on first use if it doesn't exist yet.
        This is company setup, so it's the only place allowed to create a
        Tenant implicitly; every other caller only resolves an existing one.
        """
        existing = self.resolve_existing_default_tenant()
        if existing is not None:
            return existing

        name = company_name.strip() or DEFAULT_COMPANY_NAME
        tenant = Tenant.objects.create(name=name, slug=slugify(name) or "company")
        publish(Events.TENANT_CREATED, instance=tenant)
        return tenant
