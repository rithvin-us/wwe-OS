from django.apps import AppConfig
from django.db.models.signals import post_migrate


def _sync_permissions(sender, **kwargs) -> None:
    """Idempotently upsert this module's permissions into the shared registry.

    Reuses the platform's Permission model and sync pattern — see
    platform/permissions/apps.py. The platform owns the mechanism; the module
    owns its own vocabulary. Must run before `roles` seeds the Owner role
    (see the MODULE_APPS placement note in config/settings.py) so Owner picks
    these up automatically.
    """
    from permissions.models import Permission

    from purchase.backend.permissions.registry import PURCHASE_PERMISSIONS

    for definition in PURCHASE_PERMISSIONS:
        Permission.objects.update_or_create(
            code=definition.code,
            defaults={"name": definition.name, "category": definition.category},
        )


class PurchaseConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "purchase.backend"
    label = "purchase"
    verbose_name = "Module · Purchase"

    def ready(self) -> None:
        post_migrate.connect(_sync_permissions, sender=self)

        # Subscribe to this module's own events. Modules may import platform
        # capabilities (audit, notifications) — never the reverse, and never
        # another module directly. This keeps platform/ fully generic.
        from purchase.backend.events import subscribers  # noqa: F401
