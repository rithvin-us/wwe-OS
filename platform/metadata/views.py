"""Unified metadata read API — a single-object endpoint, no list route
(design §2c: bulk querying by facet is Search Platform's job, later)."""

from __future__ import annotations

from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from shared.exceptions import NotFoundError
from shared.permissions import HasPlatformPermission
from storage.models import StoredFile

from metadata.services import MetadataService


class StoredFileMetadataView(APIView):
    permission_classes = [IsAuthenticated, HasPlatformPermission]
    required_permissions = "metadata.view"

    def get(self, request: Request, file_id: str) -> Response:
        try:
            stored_file = StoredFile.objects.get(pk=file_id)
        except (StoredFile.DoesNotExist, ValueError, TypeError) as exc:
            raise NotFoundError("No such file.") from exc

        user = request.user
        tenant = stored_file.tenant if user.is_superuser else user.tenant
        if tenant is None:
            raise NotFoundError("No such file.")
        metadata = MetadataService().get_metadata(stored_file=stored_file, tenant=tenant)
        return Response(metadata)
