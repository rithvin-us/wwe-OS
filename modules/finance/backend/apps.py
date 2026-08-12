from django.apps import AppConfig
from django.db.models.signals import post_delete, post_migrate, post_save


def _sync_permissions(sender, **kwargs) -> None:
    """Idempotently upsert this module's permissions into the shared registry.

    Same pattern as purchase/assets — see platform/permissions/apps.py. Must
    run before `roles` seeds the Owner role (guaranteed by the MODULE_APPS
    placement in config/settings.py).
    """
    from finance.backend.permissions.registry import FINANCE_PERMISSIONS
    from permissions.models import Permission

    for definition in FINANCE_PERMISSIONS:
        Permission.objects.update_or_create(
            code=definition.code,
            defaults={"name": definition.name, "category": definition.category},
        )


class FinanceConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "finance.backend"
    label = "finance"
    verbose_name = "Module · Finance"

    def ready(self) -> None:
        post_migrate.connect(_sync_permissions, sender=self)

        # In-memory registrations (safe at import; no DB access).
        from finance.backend.demo_reset import register_demo_reset
        from finance.backend.document_types import register_document_types
        from finance.backend.models.invoice import Customer
        from finance.backend.search import customer as customer_search
        from finance.backend.search.adapter import register_search

        register_document_types()
        register_demo_reset()
        register_search()

        # Customers have no service layer, so index them off model signals.
        customer_search.register_search()
        post_save.connect(customer_search.index_customer, sender=Customer)
        post_delete.connect(customer_search.remove_customer, sender=Customer)
