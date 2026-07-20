from django.apps import AppConfig
from django.db.models.signals import post_migrate


def _sync_permissions(sender, **kwargs) -> None:
    """Idempotently upsert the permission registry into the database."""
    from permissions.models import Permission
    from permissions.registry import PLATFORM_PERMISSIONS

    for definition in PLATFORM_PERMISSIONS:
        Permission.objects.update_or_create(
            code=definition.code,
            defaults={"name": definition.name, "category": definition.category},
        )


class PermissionsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "permissions"
    verbose_name = "Platform · Permissions"

    def ready(self) -> None:
        post_migrate.connect(_sync_permissions, sender=self)
