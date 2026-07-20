from __future__ import annotations

from typing import Any

from shared.events import Events, publish
from shared.services import BaseService

from users.models import User


class UserService(BaseService):
    """User lifecycle operations, emitting platform events for subscribers."""

    def create_user(self, *, password: str | None = None, **fields: Any) -> User:
        user = User.objects.create_user(password=password, **fields)
        publish(Events.USER_CREATED, instance=user, actor=None)
        return user

    def update_user(self, user: User, changes: dict[str, Any]) -> User:
        before = {key: getattr(user, key) for key in changes}
        for key, value in changes.items():
            setattr(user, key, value)
        user.save()
        publish(Events.USER_UPDATED, instance=user, changes={"before": before, "after": changes})
        return user

    def deactivate(self, user: User) -> User:
        user.is_active = False
        user.status = "suspended"
        user.save(update_fields=["is_active", "status", "updated_at"])
        publish(Events.USER_UPDATED, instance=user, changes={"is_active": False})
        return user
