from django.apps import AppConfig
from django.db.models.signals import post_migrate


def _sync_permissions(sender, **kwargs) -> None:
    """Upsert this module's permissions into the shared registry (same pattern
    as purchase). Runs before `roles` seeds the Owner role — see the
    MODULE_APPS placement note in config/settings.py."""
    from documents.backend.permissions.registry import DOCUMENT_PERMISSIONS
    from permissions.models import Permission

    for definition in DOCUMENT_PERMISSIONS:
        Permission.objects.update_or_create(
            code=definition.code,
            defaults={"name": definition.name, "category": definition.category},
        )


class DocumentsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "documents.backend"
    label = "documents"
    verbose_name = "Module · Documents"

    def ready(self) -> None:
        post_migrate.connect(_sync_permissions, sender=self)

        # In-memory registrations (safe at import; no DB access).
        from documents.backend.events.subscribers import register_subscribers
        from documents.backend.prompts import register_prompts
        from documents.backend.reports import register_reports
        from documents.backend.search.adapter import register_search

        register_prompts()
        register_search()
        register_reports()
        register_subscribers()
