"""Generic data-access base. One place for CRUD so services stay thin."""

from __future__ import annotations

from typing import Any

from django.db import models

from shared.exceptions import NotFoundError


class BaseRepository[TModel: models.Model]:
    """Thin, typed repository over a Django model's default manager.

    The default manager already applies soft-delete and tenant scoping, so
    repositories inherit isolation for free.
    """

    model: type[TModel]

    def __init__(self, model: type[TModel] | None = None) -> None:
        if model is not None:
            self.model = model

    def query(self) -> models.QuerySet[TModel]:
        return self.model._default_manager.all()

    def all(self) -> models.QuerySet[TModel]:
        return self.query()

    def filter(self, **kwargs: Any) -> models.QuerySet[TModel]:
        return self.query().filter(**kwargs)

    def get(self, **kwargs: Any) -> TModel:
        try:
            return self.query().get(**kwargs)
        except self.model.DoesNotExist as exc:
            raise NotFoundError(f"{self.model.__name__} not found.") from exc

    def get_or_none(self, **kwargs: Any) -> TModel | None:
        return self.query().filter(**kwargs).first()

    def exists(self, **kwargs: Any) -> bool:
        return self.query().filter(**kwargs).exists()

    def create(self, **kwargs: Any) -> TModel:
        instance = self.model(**kwargs)
        instance.full_clean(exclude=self._clean_exclude())
        instance.save()
        return instance

    def update(self, instance: TModel, **kwargs: Any) -> TModel:
        for key, value in kwargs.items():
            setattr(instance, key, value)
        instance.full_clean(exclude=self._clean_exclude())
        instance.save()
        return instance

    def delete(self, instance: TModel) -> None:
        instance.delete()

    def _clean_exclude(self) -> list[str]:
        # UUID PKs and timestamps are machine-set; skip them in validation.
        return ["id", "created_at", "updated_at", "deleted_at"]
