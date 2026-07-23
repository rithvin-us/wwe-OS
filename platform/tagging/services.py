"""Tag business rules: create/rename/recolor/delete tags, attach/detach them
to any (module, object_type, object_id), and simple usage analytics.

Modules never get a Tag FK on their own models — they call this service with
their own opaque reference, the same way they call SearchService.upsert with
(index, doc_id). That is what lets one tag vocabulary and one tag-picker UI
work identically across every module.
"""

from __future__ import annotations

from django.db import transaction
from django.db.models import Count, QuerySet
from shared.events import Events, publish
from shared.exceptions import ConflictError, ValidationError
from shared.services import BaseService

from tagging.models import Tag, TagColor, TaggedItem


class TagService(BaseService):
    def list_tags(self, *, tenant, search: str = "") -> QuerySet[Tag]:
        qs = Tag.objects.filter(tenant=tenant)
        if search:
            qs = qs.filter(name__icontains=search)
        return qs.order_by("name")

    def create_tag(self, *, tenant, name: str, color: str = TagColor.BLUE, actor=None) -> Tag:
        name = name.strip()
        if not name:
            raise ValidationError(detail={"name": ["A tag name is required."]})
        if Tag.objects.filter(tenant=tenant, name__iexact=name).exists():
            raise ConflictError(f"A tag named '{name}' already exists.")
        tag = Tag.objects.create(tenant=tenant, name=name, color=color)
        publish(Events.TAG_CREATED, instance=tag, actor=actor)
        return tag

    def get_or_create_tag(self, *, tenant, name: str, color: str = TagColor.BLUE) -> Tag:
        name = name.strip()
        existing = Tag.objects.filter(tenant=tenant, name__iexact=name).first()
        return existing or Tag.objects.create(tenant=tenant, name=name, color=color)

    def update_tag(self, *, tag: Tag, name: str | None = None, color: str | None = None) -> Tag:
        fields: list[str] = []
        if name is not None:
            name = name.strip()
            if not name:
                raise ValidationError(detail={"name": ["A tag name is required."]})
            if Tag.objects.filter(tenant=tag.tenant, name__iexact=name).exclude(id=tag.id).exists():
                raise ConflictError(f"A tag named '{name}' already exists.")
            tag.name = name
            fields.append("name")
        if color is not None:
            tag.color = color
            fields.append("color")
        if fields:
            tag.save(update_fields=[*fields, "updated_at"])
        return tag

    def delete_tag(self, *, tag: Tag, actor=None) -> None:
        publish(Events.TAG_DELETED, instance=tag, actor=actor)
        # Hard delete, not the inherited soft delete: a stray soft-deleted
        # Tag would still occupy the (tenant, name) uniqueness constraint and
        # its TaggedItem rows (also soft-delete by default) would still match
        # reverse-relation joins, so removal has to be real on both sides.
        TaggedItem.all_objects.filter(tag=tag).hard_delete()
        tag.hard_delete()

    def tags_for_object(
        self, *, tenant, module: str, object_type: str, object_id: str
    ) -> QuerySet[Tag]:
        return Tag.objects.filter(
            tenant=tenant,
            tagged_items__module=module,
            tagged_items__object_type=object_type,
            tagged_items__object_id=str(object_id),
        ).order_by("name")

    def set_tags_for_object(
        self,
        *,
        tenant,
        module: str,
        object_type: str,
        object_id: str,
        tag_ids: list[str] | None = None,
        tag_names: list[str] | None = None,
        actor=None,
    ) -> list[Tag]:
        """Replaces the full set of tags on an object in one call — the tag
        picker's save action. Accepts existing tag ids (picker UI) and/or
        bare names (quick-create-on-type convenience, resolved via
        get-or-create so a first-time tag name needs no separate call)."""
        object_id = str(object_id)
        with transaction.atomic():
            resolved: list[Tag] = list(Tag.objects.filter(tenant=tenant, id__in=tag_ids or []))
            for name in tag_names or []:
                resolved.append(self.get_or_create_tag(tenant=tenant, name=name))

            resolved_ids = {tag.id for tag in resolved}
            current_qs = TaggedItem.objects.filter(
                tenant=tenant, module=module, object_type=object_type, object_id=object_id
            )
            removed_tag_ids = list(
                current_qs.exclude(tag_id__in=resolved_ids).values_list("tag_id", flat=True)
            )
            # Hard delete — a soft-deleted row would still satisfy the
            # reverse-relation join in tags_for_object() below.
            current_qs.exclude(tag_id__in=resolved_ids).hard_delete()
            existing_ids = set(current_qs.values_list("tag_id", flat=True))

            changes = {"module": module, "object_type": object_type, "object_id": object_id}
            for tag_id in removed_tag_ids:
                publish(
                    Events.TAG_DETACHED,
                    instance=None,
                    actor=actor,
                    changes={**changes, "tag_id": str(tag_id)},
                )
            for tag in resolved:
                if tag.id not in existing_ids:
                    TaggedItem.objects.create(
                        tenant=tenant,
                        tag=tag,
                        module=module,
                        object_type=object_type,
                        object_id=object_id,
                    )
                    publish(Events.TAG_ATTACHED, instance=tag, actor=actor, changes=changes)
        return sorted(resolved, key=lambda t: t.name)

    def items_for_tag(self, *, tenant, tag: Tag) -> QuerySet[TaggedItem]:
        return TaggedItem.objects.filter(tenant=tenant, tag=tag)

    def object_ids_for_tags(
        self, *, tenant, module: str, object_type: str, tag_ids: list[str]
    ) -> set[str]:
        """Object ids of `(module, object_type)` items carrying any of `tag_ids`
        — the tag-filter building block for report queries (see
        reporting/filtering.py)."""
        if not tag_ids:
            return set()
        return set(
            TaggedItem.objects.filter(
                tenant=tenant, module=module, object_type=object_type, tag_id__in=tag_ids
            ).values_list("object_id", flat=True)
        )

    def analytics(self, *, tenant) -> list[dict]:
        rows = (
            Tag.objects.filter(tenant=tenant)
            .annotate(usage_count=Count("tagged_items"))
            .order_by("-usage_count", "name")
            .values("id", "name", "color", "usage_count")
        )
        return list(rows)
