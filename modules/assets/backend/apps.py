from django.apps import AppConfig
from django.db.models.signals import post_migrate


def _sync_permissions(sender, **kwargs) -> None:
    from assets.backend.permissions.registry import ASSET_PERMISSIONS
    from permissions.models import Permission

    for definition in ASSET_PERMISSIONS:
        Permission.objects.update_or_create(
            code=definition.code,
            defaults={"name": definition.name, "category": definition.category},
        )


class AssetsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "assets.backend"
    label = "assets"
    verbose_name = "Module · Assets"

    def ready(self) -> None:
        post_migrate.connect(_sync_permissions, sender=self)

        from assets.backend.collectible import register_collectible
        from assets.backend.events.subscribers import register_subscribers
        from assets.backend.reports import register_reports
        from assets.backend.search.adapter import register_search

        register_search()
        register_reports()
        register_collectible()
        register_subscribers()
