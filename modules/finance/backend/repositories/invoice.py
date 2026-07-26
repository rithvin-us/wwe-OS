"""Data access for the bill register. Views and services ask here for
querysets rather than assembling `select_related` chains themselves."""

from __future__ import annotations

from finance.backend.models.invoice import Customer, Invoice


class InvoiceRepository:
    def for_tenant(self, tenant_id):
        queryset = Invoice.objects.select_related(
            "customer", "generated_by", "file"
        ).prefetch_related("lines")
        return queryset if tenant_id is None else queryset.filter(tenant_id=tenant_id)


class CustomerRepository:
    def for_tenant(self, tenant_id):
        queryset = Customer.objects.all()
        return queryset if tenant_id is None else queryset.filter(tenant_id=tenant_id)
