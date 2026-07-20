"""Immutable audit trail. Append-only: records are created, optionally
archived, and never updated in content or deleted.
"""

from __future__ import annotations

from django.conf import settings
from django.db import models
from shared.models import BaseModel

_MUTABLE_FIELDS = {"archived", "updated_at"}


class AuditLog(BaseModel):
    tenant = models.ForeignKey(
        "tenancy.Tenant",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
        db_index=True,
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_events",
    )
    action = models.CharField(max_length=100, db_index=True)
    module = models.CharField(max_length=100, db_index=True)
    object_type = models.CharField(max_length=100, blank=True)
    object_id = models.CharField(max_length=100, blank=True, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=512, blank=True)
    changes = models.JSONField(default=dict, blank=True)
    archived = models.BooleanField(default=False, db_index=True)

    class Meta(BaseModel.Meta):
        db_table = "audit_log"
        indexes = [models.Index(fields=["module", "action", "created_at"])]

    def save(self, *args, **kwargs):
        if not self._state.adding:
            update_fields = set(kwargs.get("update_fields") or [])
            if not update_fields or not update_fields.issubset(_MUTABLE_FIELDS):
                raise ValueError("Audit records are immutable; only archiving is permitted.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("Audit records cannot be deleted; archive them instead.")

    def hard_delete(self, *args, **kwargs):
        raise ValueError("Audit records cannot be deleted.")

    def archive(self) -> None:
        self.archived = True
        self.save(update_fields=["archived", "updated_at"])
