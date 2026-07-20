from django.apps import AppConfig
from django.db.models.signals import post_migrate

# System roles shipped with the platform. Owner gets everything; the rest are
# sensible starting points a tenant can clone or adjust.
SYSTEM_ROLES = {
    "owner": {"name": "Owner", "permissions": "*"},
    "administrator": {
        "name": "Administrator",
        "permissions": [
            "users.read",
            "users.write",
            "users.invite",
            "roles.read",
            "roles.manage",
            "permissions.read",
            "audit.view",
            "notifications.read",
            "notifications.send",
            "settings.view",
            "settings.manage",
            "dashboard.view",
        ],
    },
    "member": {
        "name": "Member",
        "permissions": ["dashboard.view", "notifications.read", "settings.view"],
    },
}


def _seed_system_roles(sender, **kwargs) -> None:
    from permissions.models import Permission

    from roles.models import Role

    for slug, spec in SYSTEM_ROLES.items():
        role, _ = Role.objects.update_or_create(
            slug=slug,
            tenant=None,
            defaults={"name": spec["name"], "is_system": True},
        )
        if spec["permissions"] == "*":
            # Every permission that exists at this point — platform's own
            # plus every module's, whatever module apps are installed. This
            # runs after all module permission syncs (see the MODULE_APPS
            # ordering note in config/settings.py), so it stays current as
            # modules are added.
            role.permissions.set(Permission.objects.all())
        else:
            role.permissions.set(Permission.objects.filter(code__in=spec["permissions"]))


class RolesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "roles"
    verbose_name = "Platform · Roles"

    def ready(self) -> None:
        post_migrate.connect(_seed_system_roles, sender=self)
