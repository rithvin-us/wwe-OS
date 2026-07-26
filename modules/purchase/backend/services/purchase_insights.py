"""Purchase Insights Service for WWE OS.

Generates real-time AI Insights:
- Monthly Spend (aggregated total rate by month)
- Vendor Analysis (top vendors, transaction counts, spend distribution)
- Duplicate Invoice Detection (flags duplicate invoices)
- Top Purchased Materials (aggregated items from line item extractions)
- Expense Categories
- GST Summary (accumulated tax/GST credit)
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.db.models import Count, Sum
from shared.services import BaseService

from purchase.backend.models import BillStatus, PurchaseBill


class PurchaseInsightsService(BaseService):
    def get_insights(self, tenant=None) -> dict[str, Any]:
        """Aggregate purchase records into structured insights for Dashboard and Reports."""
        qs = PurchaseBill.objects.filter(tenant=tenant) if tenant else PurchaseBill.objects.all()

        # 1. Total Metrics
        total_bills = qs.count()
        processed_count = qs.filter(status=BillStatus.PROCESSED).count()
        needs_attention_count = qs.filter(status=BillStatus.NEEDS_ATTENTION).count()
        total_spend = qs.aggregate(sum=Sum("total_rate"))["sum"] or Decimal("0.00")
        total_gst = qs.aggregate(sum=Sum("tax_amount"))["sum"] or Decimal("0.00")

        # 2. Monthly Spend (last 6 months)
        monthly_spend_data = (
            qs.values("purchase_date__year", "purchase_date__month")
            .annotate(total=Sum("total_rate"), count=Count("id"))
            .order_by("-purchase_date__year", "-purchase_date__month")[:6]
        )
        monthly_spend = [
            {
                "period": f"{item['purchase_date__year']}-{item['purchase_date__month']:02d}",
                "amount": float(item["total"] or 0),
                "count": item["count"],
            }
            for item in reversed(list(monthly_spend_data))
        ]

        # 3. Vendor Analysis (Only mostly occurring / recurring vendors)
        recurring_vendors_qs = (
            qs.filter(seller_name__gt="")
            .exclude(seller_name="Pending OCR Processing")
            .values("seller_name")
            .annotate(total=Sum("total_rate"), count=Count("id"))
            .filter(count__gte=2)
            .order_by("-count", "-total")[:5]
        )

        top_vendors_list = list(recurring_vendors_qs)
        if not top_vendors_list:
            top_vendors_list = list(
                qs.filter(seller_name__gt="")
                .exclude(seller_name="Pending OCR Processing")
                .values("seller_name")
                .annotate(total=Sum("total_rate"), count=Count("id"))
                .order_by("-count", "-total")[:3]
            )

        vendor_analysis = [
            {
                "id": item["seller_name"],
                "name": item["seller_name"],
                "total_spend": float(item["total"] or 0),
                "bills_count": item["count"],
            }
            for item in top_vendors_list
        ]

        # 4. Duplicate Invoice Detection
        duplicates_count = qs.filter(is_duplicate=True).count()
        duplicate_bills = list(
            qs.filter(is_duplicate=True).values(
                "id", "seller_name", "invoice_number", "total_rate", "purchase_date"
            )[:5]
        )

        # 5. Top Purchased Materials (Line items aggregation)
        items_map: dict[str, dict[str, Any]] = {}
        for bill in qs.exclude(items=[]).only("items")[:50]:
            if isinstance(bill.items, list):
                for item in bill.items:
                    if isinstance(item, dict):
                        name = item.get("item_name") or "General Material"
                        qty = float(item.get("quantity") or 1)
                        total = float(item.get("total") or item.get("unit_price") or 0)
                        if name not in items_map:
                            items_map[name] = {"name": name, "quantity": 0.0, "total_spend": 0.0}
                        items_map[name]["quantity"] += qty
                        items_map[name]["total_spend"] += total

        top_materials = sorted(items_map.values(), key=lambda x: x["total_spend"], reverse=True)[:5]

        # 6. GST & Tax Summary (Input Tax Credit breakdown under Indian GST rules)
        total_cgst = qs.aggregate(sum=Sum("cgst"))["sum"] or Decimal("0.00")
        total_sgst = qs.aggregate(sum=Sum("sgst"))["sum"] or Decimal("0.00")
        total_igst = qs.aggregate(sum=Sum("igst"))["sum"] or Decimal("0.00")

        gst_summary = {
            "total_gst_claimed": float(total_gst),
            "total_cgst": float(total_cgst),
            "total_sgst": float(total_sgst),
            "total_igst": float(total_igst),
            "bills_with_gst": qs.exclude(gst_number="").count(),
        }

        return {
            "overview": {
                "total_bills": total_bills,
                "processed_count": processed_count,
                "needs_attention_count": needs_attention_count,
                "total_spend": float(total_spend),
                "total_gst": float(total_gst),
            },
            "monthly_spend": monthly_spend,
            "vendor_analysis": vendor_analysis,
            "duplicate_detection": {
                "duplicates_count": duplicates_count,
                "recent_duplicates": [
                    {
                        "id": str(b["id"]),
                        "seller_name": b["seller_name"],
                        "invoice_number": b["invoice_number"],
                        "total_rate": float(b["total_rate"] or 0),
                        "purchase_date": str(b["purchase_date"]),
                    }
                    for b in duplicate_bills
                ],
            },
            "top_materials": top_materials,
            "gst_summary": gst_summary,
        }
