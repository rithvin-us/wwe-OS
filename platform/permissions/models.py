from __future__ import annotations

from django.db import models
from shared.models import BaseModel


class Permission(BaseModel):
    """A single granular capability, e.g. ``users.write``. Platform-owned."""

    code = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=150)
    category = models.CharField(max_length=100, db_index=True)
    description = models.TextField(blank=True)

    class Meta(BaseModel.Meta):
        db_table = "permissions_permission"
        ordering = ("category", "code")

    def __str__(self) -> str:
        return self.code
