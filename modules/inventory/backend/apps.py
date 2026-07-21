from django.apps import AppConfig
from django.db.models.signals import post_migrate


def _sync_permissions(sender, **kwargs) -> None:
    from inventory.backend.permissions.registry import INVENTORY_PERMISSIONS
    from permissions.models import Permission

    for definition in INVENTORY_PERMISSIONS:
        Permission.objects.update_or_create(
            code=definition.code,
            defaults={"name": definition.name, "category": definition.category},
        )


class InventoryConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "inventory.backend"
    label = "inventory"
    verbose_name = "Module · Inventory"

    def ready(self) -> None:
        post_migrate.connect(_sync_permissions, sender=self)

        from inventory.backend.events.subscribers import register_subscribers
        from inventory.backend.reports import register_reports
        from inventory.backend.search.adapter import register_search

        register_search()
        register_reports()
        register_subscribers()
