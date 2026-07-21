"""Storage API.

Authenticated file management for the operator plus a token-based download
endpoint. The download token is a Django-signed, expiring credential minted
by `StorageService.signed_url` — possession of an unexpired token IS the
authorization (it is how browsers, the Telegram bot, and emailed links fetch
files without a JWT). Tokens are unguessable, time-boxed, and scoped to one
object key.
"""

from __future__ import annotations

import time
from urllib.parse import unquote

from django.core import signing
from django.http import HttpRequest, HttpResponse
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from shared.exceptions import NotFoundError
from shared.views import BaseModelViewSet

from storage.models import StoredFile
from storage.providers import DOWNLOAD_TOKEN_SALT
from storage.serializers import StoredFileSerializer, UploadSerializer
from storage.services import StorageService


class StoredFileViewSet(BaseModelViewSet):
    serializer_class = StoredFileSerializer
    http_method_names = ["get", "post", "delete", "head", "options"]
    filterset_fields = ("module", "category", "content_type", "scan_status")
    search_fields = ("filename",)
    ordering_fields = ("created_at", "size_bytes", "filename")
    required_permissions = {
        "list": "storage.read",
        "retrieve": "storage.read",
        "download": "storage.read",
        "url": "storage.read",
        "create": "storage.write",
        "destroy": "storage.manage",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return StoredFile.objects.none()
        user = self.request.user
        qs = StoredFile.objects.all()
        if not user.is_superuser and user.tenant_id is not None:
            qs = qs.filter(tenant_id=user.tenant_id)
        return qs

    def create(self, request: Request, *args, **kwargs) -> Response:
        data = UploadSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        upload = data.validated_data["file"]
        stored = StorageService().store(
            data=upload.read(),
            filename=upload.name,
            content_type=upload.content_type or "application/octet-stream",
            module=data.validated_data["module"],
            category=data.validated_data.get("category", ""),
            metadata=data.validated_data.get("metadata") or {},
            tenant=request.user.tenant,
            uploaded_by=request.user,
        )
        return Response(StoredFileSerializer(stored).data, status=status.HTTP_201_CREATED)

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        stored = self.get_object()
        StorageService().delete(stored, actor=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"])
    def download(self, request: Request, pk=None) -> HttpResponse:
        stored = self.get_object()
        payload = StorageService().open(stored)
        response = HttpResponse(payload, content_type=stored.content_type)
        response["Content-Disposition"] = f'attachment; filename="{stored.filename}"'
        return response

    @action(detail=True, methods=["get"])
    def url(self, request: Request, pk=None) -> Response:
        stored = self.get_object()
        expires = min(int(request.query_params.get("expires", 600)), 86400)
        return Response(
            {
                "url": StorageService().signed_url(stored, expires_seconds=expires),
                "expires_in": expires,
            }
        )


def signed_download(request: HttpRequest) -> HttpResponse:
    """Anonymous, token-authorized download (local provider's signed URLs)."""
    token = unquote(request.GET.get("token", ""))
    try:
        payload = signing.loads(token, salt=DOWNLOAD_TOKEN_SALT)
    except signing.BadSignature:
        return HttpResponse(status=403)
    if payload.get("exp", 0) <= time.time():
        return HttpResponse(status=403)

    stored = StoredFile.objects.filter(key=payload.get("key", "")).first()
    if stored is None:
        return HttpResponse(status=404)
    try:
        data = StorageService().open(stored)
    except NotFoundError:
        return HttpResponse(status=404)
    response = HttpResponse(data, content_type=stored.content_type)
    response["Content-Disposition"] = f'attachment; filename="{stored.filename}"'
    return response
