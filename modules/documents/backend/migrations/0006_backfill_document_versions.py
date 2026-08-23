"""Backfill a version-1 row for every document that predates versioning, from
its current file — so history starts complete rather than at the next upload."""

from __future__ import annotations

from django.db import migrations


def backfill(apps, schema_editor):
    Document = apps.get_model("documents", "Document")
    DocumentVersion = apps.get_model("documents", "DocumentVersion")

    rows = []
    for document in Document.objects.all():
        if DocumentVersion.objects.filter(document=document).exists():
            continue
        rows.append(
            DocumentVersion(
                tenant_id=document.tenant_id,
                document=document,
                version=1,
                file_id=document.file_id,
                is_current=True,
                note="Initial upload",
                uploaded_by_id=document.owner_id,
            )
        )
    DocumentVersion.objects.bulk_create(rows)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [("documents", "0005_documentversion")]

    operations = [migrations.RunPython(backfill, noop)]
