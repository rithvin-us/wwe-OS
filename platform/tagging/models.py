"""Tagging — a cross-cutting label system any module attaches to its own
business objects, without a Tag/TaggedItem FK ever living on that module's
own models.

Mirrors search's opaque-reference shape (platform/search/models.py:
SearchDocument's `index`/`doc_id`): modules refer to their objects by
`(module, object_type, object_id)`, never by a direct foreign key, so one tag
vocabulary and one tag-picker UI work identically across Purchase, Documents,
Assets, Contracts, and anything added later — no per-module tag field.
"""

from __future__ import annotations

from django.db import models
from shared.models import TenantOwnedModel


class TagColor(models.TextChoices):
    """Fixed 5-swatch palette — the same categorical colors as the chart
    palette (packages/design-system/src/tokens.css: --chart-1..5). Tags never
    take free-form hex; see docs/design/design-bible.md's Tags section."""

    BLUE = "blue", "Blue"
    GREEN = "green", "Green"
    AMBER = "amber", "Amber"
    VIOLET = "violet", "Violet"
    ROSE = "rose", "Rose"


class Tag(TenantOwnedModel):
    name = models.CharField(max_length=50)
    color = models.CharField(max_length=20, choices=TagColor.choices, default=TagColor.BLUE)

    class Meta(TenantOwnedModel.Meta):
        db_table = "tagging_tag"
        constraints = [
            models.UniqueConstraint(fields=["tenant", "name"], name="uniq_tag_name_per_tenant"),
        ]
        indexes = [models.Index(fields=["tenant", "name"])]

    def __str__(self) -> str:
        return self.name


class TaggedItem(TenantOwnedModel):
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE, related_name="tagged_items")
    module = models.CharField(max_length=50)
    object_type = models.CharField(max_length=100)
    object_id = models.CharField(max_length=64)

    class Meta(TenantOwnedModel.Meta):
        db_table = "tagging_tagged_item"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "tag", "module", "object_type", "object_id"],
                name="uniq_tagged_item",
            ),
        ]
        indexes = [
            models.Index(fields=["tenant", "module", "object_type", "object_id"]),
            models.Index(fields=["tenant", "tag"]),
        ]

    def __str__(self) -> str:
        return f"{self.tag.name} → {self.module}:{self.object_type}:{self.object_id}"
