"""View bases wiring the platform conventions into DRF viewsets."""

from __future__ import annotations

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from shared.permissions import HasPlatformPermission


class BaseModelViewSet(viewsets.ModelViewSet):
    """ModelViewSet with platform permission enforcement.

    Subclasses set `required_permissions` (see HasPlatformPermission) and a
    queryset; tenant scoping and soft delete come from the model's manager.
    """

    permission_classes = [IsAuthenticated, HasPlatformPermission]


class ReadOnlyModelViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated, HasPlatformPermission]
