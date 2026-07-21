from django.apps import AppConfig
from django.db.models.signals import post_migrate


def _sync_permissions(sender, **kwargs) -> None:
    from contracts.backend.permissions.registry import CONTRACT_PERMISSIONS
    from permissions.models import Permission

    for definition in CONTRACT_PERMISSIONS:
        Permission.objects.update_or_create(
            code=definition.code,
            defaults={"name": definition.name, "category": definition.category},
        )


def _ensure_workflow(sender, **kwargs) -> None:
    from workflow.services import WorkflowService

    WorkflowService().ensure_definition(
        key="contract-approval",
        name="Contract approval",
        module="contracts",
        steps=[
            {
                "key": "review",
                "name": "Contract review",
                "required_permission": "contracts.approve",
            }
        ],
    )


class ContractsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "contracts.backend"
    label = "contracts"
    verbose_name = "Module · Contracts"

    def ready(self) -> None:
        post_migrate.connect(_sync_permissions, sender=self)
        post_migrate.connect(_ensure_workflow, sender=self)

        from contracts.backend.events.subscribers import register_subscribers
        from contracts.backend.prompts import register_prompts
        from contracts.backend.search.adapter import register_search

        register_prompts()
        register_search()
        register_subscribers()
