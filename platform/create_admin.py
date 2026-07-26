import os

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from roles.models import Role  # noqa: E402
from roles.services import RoleService  # noqa: E402
from tenancy.models import Tenant  # noqa: E402
from users.models import User  # noqa: E402


def main() -> None:
    tenant, _ = Tenant.objects.get_or_create(name="WWE OS", slug="wwe-os")
    user, _ = User.objects.get_or_create(
        email="admin@wwe.local",
        defaults={
            "username": "admin",
            "tenant": tenant,
            "status": "active",
            "is_email_verified": True,
        },
    )
    user.set_password("AdminPassword123!")
    user.status = "active"
    user.is_email_verified = True
    user.tenant = tenant
    user.save()

    owner_role = Role.objects.filter(slug="owner").first()
    if owner_role:
        RoleService().assign_role(user=user, role=owner_role)

    print(f"User {user.email} successfully updated/created with password AdminPassword123!")


if __name__ == "__main__":
    main()
