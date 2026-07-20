"""The generic platform User — identity only, never an employee.

No payroll, no HR attributes. Business identity (employee, etc.) is a Stage 2
module concern that references this user, never the other way around.
"""

from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from shared.models import BaseModel

from users.managers import UserManager


class UserStatus(models.TextChoices):
    INVITED = "invited", "Invited"
    ACTIVE = "active", "Active"
    SUSPENDED = "suspended", "Suspended"


class User(AbstractBaseUser, PermissionsMixin, BaseModel):
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=40, blank=True)
    avatar_url = models.URLField(blank=True)

    status = models.CharField(max_length=20, choices=UserStatus.choices, default=UserStatus.INVITED)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)

    timezone = models.CharField(max_length=64, default="UTC")
    language = models.CharField(max_length=10, default="en-us")
    preferences = models.JSONField(default=dict, blank=True)

    tenant = models.ForeignKey(
        "tenancy.Tenant",
        on_delete=models.CASCADE,
        related_name="users",
        null=True,
        blank=True,
        db_index=True,
    )

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta(BaseModel.Meta):
        db_table = "users_user"
        indexes = [
            models.Index(fields=["tenant", "status"]),
        ]

    def __str__(self) -> str:
        return self.email

    def has_platform_permission(self, code: str) -> bool:
        """Effective permission check via assigned roles (with inheritance).

        Imported lazily to keep the users capability independent of roles at
        import time.
        """
        if self.is_superuser:
            return True
        from roles.services import RoleService

        return code in RoleService().effective_permission_codes(self)
