"""Move Document.tags (a JSONField of bare strings) into the platform's
tagging app (Tag + TaggedItem) — see platform/tagging/models.py. Documents no
longer keeps its own ad hoc tag storage; it becomes just another module using
the cross-cutting tag vocabulary, the same way Purchase and Assets do.
"""

from __future__ import annotations

from django.db import migrations


def backfill_tags_forward(apps, schema_editor):
    Document = apps.get_model("documents", "Document")
    Tag = apps.get_model("tagging", "Tag")
    TaggedItem = apps.get_model("tagging", "TaggedItem")

    for document in Document.objects.all().iterator():
        for raw_name in document.tags or []:
            name = (raw_name or "").strip()
            if not name:
                continue
            tag = Tag.objects.filter(tenant_id=document.tenant_id, name__iexact=name).first()
            if tag is None:
                tag = Tag.objects.create(tenant_id=document.tenant_id, name=name, color="blue")
            TaggedItem.objects.get_or_create(
                tenant_id=document.tenant_id,
                tag=tag,
                module="documents",
                object_type="Document",
                object_id=str(document.id),
            )


def backfill_tags_reverse(apps, schema_editor):
    # Not reversible: the destination Tag rows may since be shared by other
    # objects, so unwinding them here could delete tags in active use
    # elsewhere. The schema change below (re-adding `tags`) is the part that
    # actually needs a reverse no-op; nothing to undo on the data side.
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("documents", "0002_remove_document_reviewed_at"),
        ("tagging", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(backfill_tags_forward, backfill_tags_reverse),
        migrations.RemoveField(
            model_name="document",
            name="tags",
        ),
    ]
