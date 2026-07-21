"""The Document — a stored business file with metadata, an AI summary, and an
optional approval.

The bytes live in platform storage (`storage.StoredFile`); this model is the
business record wrapped around them. Every heavy capability it uses —
storage, AI, workflow, search, audit, notifications — belongs to the
platform; this module only supplies meaning (title, category, lifecycle).
Cross-app FKs point only at platform apps (storage, users, workflow), never
at another business module.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from shared.models import TenantOwnedModel


class DocumentCategory(models.TextChoices):
    CONTRACT = "contract", "Contract"
    INVOICE = "invoice", "Invoice"
    POLICY = "policy", "Policy"
    REPORT = "report", "Report"
    CORRESPONDENCE = "correspondence", "Correspondence"
    OTHER = "other", "Other"


class DocumentStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    ARCHIVED = "archived", "Archived"


class SummaryStatus(models.TextChoices):
    NONE = "none", "Not generated"
    READY = "ready", "Ready"
    FAILED = "failed", "Failed"


class Document(TenantOwnedModel):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    category = models.CharField(
        max_length=20,
        choices=DocumentCategory.choices,
        default=DocumentCategory.OTHER,
        db_index=True,
    )
    status = models.CharField(
        max_length=20, choices=DocumentStatus.choices, default=DocumentStatus.ACTIVE, db_index=True
    )
    tags = models.JSONField(default=list, blank=True)

    file = models.ForeignKey(
        "storage.StoredFile",
        on_delete=models.PROTECT,
        related_name="documents",
    )

    ai_summary = models.TextField(blank=True, default="")
    summary_status = models.CharField(
        max_length=20, choices=SummaryStatus.choices, default=SummaryStatus.NONE
    )

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="documents",
    )

    class Meta(TenantOwnedModel.Meta):
        db_table = "documents_document"
        indexes = [
            models.Index(fields=["tenant", "status"]),
            models.Index(fields=["tenant", "category"]),
        ]

    def __str__(self) -> str:
        return self.title
