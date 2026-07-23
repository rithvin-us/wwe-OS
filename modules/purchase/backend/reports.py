"""Registers the purchase bill register and reconciliation reports into the
platform report catalog."""

from __future__ import annotations

from django.db.models import Q
from reporting.filtering import apply_date_range, apply_tag_filter
from reporting.registry import ReportDefinition, register_report

from purchase.backend.models import PurchaseBill
from purchase.backend.services.purchase_bill import PurchaseBillService

TAG_MODULE = "purchase"
TAG_OBJECT_TYPE = "PurchaseBill"


def _filtered_bills(tenant, filters: dict):
    bills = PurchaseBill.objects.filter(tenant=tenant).select_related("vendor")
    bills = apply_date_range(bills, filters, field="purchase_date")
    bills = apply_tag_filter(
        bills, filters, tenant=tenant, module=TAG_MODULE, object_type=TAG_OBJECT_TYPE
    )
    vendor = filters.get("vendor") or ""
    if vendor:
        bills = bills.filter(Q(vendor__name__icontains=vendor) | Q(seller_name__icontains=vendor))
    return bills


def _applied(filters: dict) -> dict:
    return {
        "date_from": filters.get("date_from"),
        "date_to": filters.get("date_to"),
        "vendor": filters.get("vendor") or "",
        "tag_ids": filters.get("tag_ids"),
    }


def _build_register(tenant, filters: dict):
    bills = _filtered_bills(tenant, filters)
    return PurchaseBillService().build_report_spec(bills=bills, filters=_applied(filters))


def _build_reconciliation(tenant, filters: dict):
    bills = _filtered_bills(tenant, filters)
    return PurchaseBillService().build_reconciliation_spec(bills=bills, filters=_applied(filters))


def register_reports() -> None:
    register_report(
        ReportDefinition(
            key="purchase-bills",
            label="Purchase bill register",
            module="purchase",
            permission="purchase.bill.read",
            description="Every purchase bill with vendor, date, amount, and status.",
            build_spec=_build_register,
        )
    )
    register_report(
        ReportDefinition(
            key="purchase-reconciliation",
            label="Purchase reconciliation",
            module="purchase",
            permission="purchase.bill.read",
            description="Unpaid bills and bills flagged for review, oldest first.",
            build_spec=_build_reconciliation,
        )
    )
