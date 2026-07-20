"""Reusable model foundations shared by every platform capability.

- UUID primary keys everywhere.
- created_at / updated_at on every row.
- Soft delete by default (archive, never hard-delete) with an escape hatch.
- Tenant ownership for tenant-scoped data, transparently filtered.
"""

from __future__ import annotations

import uuid

from django.db import models
from django.utils import timezone

from shared import context


class SoftDeleteQuerySet(models.QuerySet):
    def delete(self):  # type: ignore[override]
        return super().update(is_deleted=True, deleted_at=timezone.now())

    def hard_delete(self):
        return super().delete()

    def alive(self):
        return self.filter(is_deleted=False)


class SoftDeleteManager(models.Manager):
    """Default manager — hides soft-deleted rows."""

    def get_queryset(self) -> SoftDeleteQuerySet:
        return SoftDeleteQuerySet(self.model, using=self._db).filter(is_deleted=False)


class AllObjectsManager(models.Manager):
    """Escape hatch — includes soft-deleted rows."""

    def get_queryset(self) -> SoftDeleteQuerySet:
        return SoftDeleteQuerySet(self.model, using=self._db)


class BaseModel(models.Model):
    """UUID PK, timestamps, soft delete. The root of every platform model."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteManager()
    all_objects = AllObjectsManager()

    class Meta:
        abstract = True
        ordering = ("-created_at",)

    def delete(self, using=None, keep_parents=False):  # type: ignore[override]
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(using=using, update_fields=["is_deleted", "deleted_at", "updated_at"])

    def hard_delete(self, using=None, keep_parents=False):
        return super().delete(using=using, keep_parents=keep_parents)

    def restore(self) -> None:
        self.is_deleted = False
        self.deleted_at = None
        self.save(update_fields=["is_deleted", "deleted_at", "updated_at"])


class TenantScopedQuerySet(SoftDeleteQuerySet):
    pass


class TenantManager(SoftDeleteManager):
    """Filters to the current tenant automatically when one is in context."""

    def get_queryset(self) -> TenantScopedQuerySet:
        qs = TenantScopedQuerySet(self.model, using=self._db).filter(is_deleted=False)
        tenant_id = context.current_tenant_id()
        if tenant_id is not None:
            qs = qs.filter(tenant_id=tenant_id)
        return qs


class TenantOwnedModel(BaseModel):
    """Base for tenant-owned data. Rows are isolated per tenant."""

    tenant = models.ForeignKey(
        "tenancy.Tenant",
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)s_set",
        db_index=True,
    )

    objects = TenantManager()
    all_objects = AllObjectsManager()

    class Meta(BaseModel.Meta):
        abstract = True

    def save(self, *args, **kwargs):
        # Stamp the current tenant when one is in context and none was set.
        if self.tenant_id is None:
            tenant_id = context.current_tenant_id()
            if tenant_id is not None:
                self.tenant_id = tenant_id
        super().save(*args, **kwargs)
