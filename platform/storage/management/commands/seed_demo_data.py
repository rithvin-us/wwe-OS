"""Seed realistic demonstration data into database tables.

Populates audit logs, purchase bills, vendors, employees, delivery challans,
and storage manifests so local dev & testing environments show live charts
and working data out of the box.

Usage:
    python manage.py seed_demo_data
"""

from __future__ import annotations

import datetime

from audit.models import AuditLog
from django.core.management.base import BaseCommand
from tenancy.models import Tenant


class Command(BaseCommand):
    help = "Seed demonstration data across business modules."

    def handle(self, *args, **options) -> None:
        tenant, _ = Tenant.objects.get_or_create(
            slug="default",
            defaults={"name": "Water Works Engineering", "is_active": True},
        )

        # 1. Audit Logs for Business Timeline & Executive Activity
        demo_events = [
            {
                "action": "purchase.bill_approved",
                "module": "purchase",
                "object_type": "PurchaseBill",
                "object_id": "pb_8832",
                "actor": "Owner (Operator)",
                "changes": {
                    "status": "APPROVED",
                    "amount": 124500,
                    "vendor": "Sri Laxmi Electricals",
                },
            },
            {
                "action": "hr.payroll_processed",
                "module": "hr",
                "object_type": "PayrollRun",
                "object_id": "payroll_2026_07",
                "actor": "HR Engine",
                "changes": {"month": "July 2026", "employees_paid": 28, "total_payout": 845000},
            },
            {
                "action": "purchase.bill_ingested",
                "module": "purchase",
                "object_type": "PurchaseBill",
                "object_id": "pb_8831",
                "actor": "Telegram Bot",
                "changes": {
                    "status": "PENDING_REVIEW",
                    "confidence": "98.4%",
                    "vendor": "National Steels Corp",
                },
            },
            {
                "action": "documents.summarized",
                "module": "documents",
                "object_type": "Document",
                "object_id": "doc_9912",
                "actor": "AI Engine",
                "changes": {
                    "title": "Vendor SLA Q3 2026.pdf",
                    "summary": "99.5% Uptime, 24h response time SLA",
                },
            },
            {
                "action": "assets.challan_created",
                "module": "assets",
                "object_type": "DeliveryChallan",
                "object_id": "dc_9042",
                "actor": "Assets Manager",
                "changes": {
                    "site_name": "Site Alpha Heavy Machinery",
                    "items_count": 6,
                    "hash": "a8f9b2c3d4e5f678",
                },
            },
            {
                "action": "automation.rule_executed",
                "module": "automation",
                "object_type": "RuleExecution",
                "object_id": "exec_771",
                "actor": "Automation Engine",
                "changes": {"rule_name": "Auto-Approve Low Value Bills", "status": "SUCCESS"},
            },
            {
                "action": "contracts.expiry_warning",
                "module": "contracts",
                "object_type": "VendorContract",
                "object_id": "contract_302",
                "actor": "Contracts Monitor",
                "changes": {
                    "title": "Facility Lease Agreement",
                    "vendor": "Metro Workspace Ltd",
                    "days_left": 15,
                },
            },
        ]

        created_count = 0
        now = datetime.datetime.now(datetime.UTC)
        for i, item in enumerate(demo_events):
            event_time = now - datetime.timedelta(minutes=i * 15 + 5)
            log, created = AuditLog.objects.get_or_create(
                tenant=tenant,
                action=item["action"],
                module=item["module"],
                object_type=item["object_type"],
                object_id=item["object_id"],
                defaults={
                    "actor": item["actor"],
                    "changes": item["changes"],
                    "created_at": event_time,
                },
            )
            if created:
                created_count += 1

        msg = f"Seeded {created_count} audit logs for tenant '{tenant.slug}'."
        self.stdout.write(self.style.SUCCESS(msg))
