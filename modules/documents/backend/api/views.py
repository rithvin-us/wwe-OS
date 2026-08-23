"""Document API.

One JWT-authenticated viewset for the operator: upload (multipart), browse,
edit metadata, (re)summarize via the AI gateway, submit for approval, archive,
delete, and export through the reporting engine. Authorization is the platform
RBAC mechanism (`HasPlatformPermission`); tenant scoping comes from the model
manager and is re-asserted here defensively.
"""

from __future__ import annotations

from django.http import HttpResponse
from documents.backend.models import Document
from documents.backend.serializers.document import (
    DocumentSerializer,
    DocumentVersionSerializer,
    ExportDocumentsSerializer,
    UpdateDocumentSerializer,
    UploadDocumentSerializer,
    UploadVersionSerializer,
)
from documents.backend.services.document import DocumentService, validate_tags
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response
from shared.exceptions import PermissionDeniedError
from shared.views import BaseModelViewSet


class DocumentViewSet(BaseModelViewSet):
    serializer_class = DocumentSerializer
    # Multipart for uploads; JSON for the metadata/action endpoints (submit,
    # export, …) that carry no file.
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    filterset_fields = ("status", "category")
    search_fields = ("title", "description")
    ordering_fields = ("created_at", "title", "status")
    required_permissions = {
        "list": "documents.read",
        "retrieve": "documents.read",
        "download": "documents.read",
        "preview": "documents.read",
        "share": "documents.read",
        "export": "documents.read",
        "versions": "documents.read",
        "restore_version": "documents.write",
        "create": "documents.write",
        "partial_update": "documents.write",
        "summarize": "documents.write",
        "archive": "documents.manage",
        "destroy": "documents.manage",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Document.objects.none()
        user = self.request.user
        qs = Document.objects.select_related("file", "owner")
        if user and user.is_authenticated and not user.is_superuser and user.tenant_id is not None:
            qs = qs.filter(tenant_id=user.tenant_id)
        return qs

    def create(self, request: Request, *args, **kwargs) -> Response:
        req_data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        if hasattr(request.data, "getlist"):
            tags_list = request.data.getlist("tags")
            if tags_list:
                req_data.setlist("tags", tags_list)
        data = UploadDocumentSerializer(data=req_data)
        data.is_valid(raise_exception=True)
        upload = data.validated_data["file"]
        user = request.user if request.user and request.user.is_authenticated else None
        tenant = getattr(user, "tenant", None) if user else None
        if tenant is None:
            from tenancy.models import Tenant

            tenant = Tenant.objects.first()
        if user is None:
            from users.models import User

            user = User.objects.filter(tenant=tenant).first()

        document = DocumentService().create(
            tenant=tenant,
            owner=user,
            title=data.validated_data["title"],
            category=data.validated_data["category"],
            description=data.validated_data.get("description", ""),
            tags=validate_tags(data.validated_data.get("tags", [])),
            data=upload.read(),
            filename=upload.name,
            content_type=upload.content_type or "application/octet-stream",
            summarize=data.validated_data.get("summarize", True),
        )
        return Response(DocumentSerializer(document).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request: Request, *args, **kwargs) -> Response:
        document = self.get_object()
        req_data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        if hasattr(request.data, "getlist"):
            tags_list = request.data.getlist("tags")
            if tags_list:
                req_data.setlist("tags", tags_list)
        data = UpdateDocumentSerializer(data=req_data, partial=True)
        data.is_valid(raise_exception=True)
        tags = data.validated_data.get("tags")
        document = DocumentService().update_metadata(
            document=document,
            actor=request.user,
            title=data.validated_data.get("title"),
            category=data.validated_data.get("category"),
            description=data.validated_data.get("description"),
            tags=validate_tags(tags) if tags is not None else None,
        )
        return Response(DocumentSerializer(document).data)

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        DocumentService().delete(document=self.get_object(), actor=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def summarize(self, request: Request, pk=None) -> Response:
        document = DocumentService().generate_summary(self.get_object())
        return Response(DocumentSerializer(document).data)

    @action(detail=True, methods=["post"])
    def archive(self, request: Request, pk=None) -> Response:
        document = DocumentService().archive(document=self.get_object(), actor=request.user)
        return Response(DocumentSerializer(document).data)

    @action(detail=True, methods=["get"])
    def download(self, request: Request, pk=None) -> HttpResponse:
        from storage.services import StorageService

        document = self.get_object()
        payload = StorageService().open(document.file)
        response = HttpResponse(payload, content_type=document.file.content_type)
        disposition = "inline" if request.query_params.get("inline") else "attachment"
        response["Content-Disposition"] = f'{disposition}; filename="{document.file.filename}"'
        return response

    # Content types safe to render inline in a browser tab; everything else is
    # served as a download so the browser never tries to execute it.
    _INLINE_TYPES = frozenset(
        {"application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp", "text/plain"}
    )

    @action(detail=True, methods=["get"])
    def preview(self, request: Request, pk=None) -> HttpResponse:
        """Stream the current file for in-browser viewing (inline) when its type
        is safe to render; otherwise fall back to an attachment."""
        from storage.services import StorageService

        document = self.get_object()
        payload = StorageService().open(document.file)
        content_type = document.file.content_type
        disposition = "inline" if content_type in self._INLINE_TYPES else "attachment"
        response = HttpResponse(payload, content_type=content_type)
        response["Content-Disposition"] = f'{disposition}; filename="{document.file.filename}"'
        response["X-Content-Type-Options"] = "nosniff"
        return response

    @action(detail=True, methods=["get"])
    def share(self, request: Request, pk=None) -> Response:
        """A short-lived signed URL to the current file — for controlled sharing
        without exposing storage credentials or a permanent public URL."""
        from storage.services import StorageService

        document = self.get_object()
        expires = min(max(int(request.query_params.get("expires", 3600) or 3600), 60), 86400)
        return Response(
            {
                "url": StorageService().signed_url(document.file, expires_seconds=expires),
                "expires_in": expires,
                "filename": document.file.filename,
            }
        )

    @action(detail=True, methods=["get", "post"])
    def versions(self, request: Request, pk=None) -> Response:
        """GET the document's version history; POST a new file (multipart) as a
        new current version. History is append-only — nothing is overwritten."""
        document = self.get_object()
        if request.method == "POST":
            if not request.user.has_platform_permission("documents.write"):
                raise PermissionDeniedError("You do not have permission to add a version.")
            data = UploadVersionSerializer(data=request.data)
            data.is_valid(raise_exception=True)
            upload = data.validated_data["file"]
            DocumentService().add_version(
                document=document,
                data=upload.read(),
                filename=upload.name,
                content_type=upload.content_type or "application/octet-stream",
                actor=request.user,
                note=data.validated_data.get("note", ""),
            )
        versions = document.versions.select_related("file", "uploaded_by").all()
        return Response(DocumentVersionSerializer(versions, many=True).data)

    @action(detail=True, methods=["post"], url_path=r"versions/(?P<version>\d+)/restore")
    def restore_version(self, request: Request, pk=None, version=None) -> Response:
        document = self.get_object()
        DocumentService().restore_version(
            document=document, version=int(version), actor=request.user
        )
        return Response(DocumentSerializer(document).data)

    @extend_schema(
        request=ExportDocumentsSerializer,
        responses={200: OpenApiResponse(description="A rendered document-register report.")},
    )
    @action(detail=False, methods=["post"])
    def export(self, request: Request) -> HttpResponse:
        data = ExportDocumentsSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        service = DocumentService()
        spec = service.build_report_spec(documents=self.filter_queryset(self.get_queryset()))
        from reporting.services import ReportService

        payload, content_type, filename = ReportService().render(
            spec, data.validated_data["format"], tenant=request.user.tenant, actor=request.user
        )
        response = HttpResponse(payload, content_type=content_type)
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
