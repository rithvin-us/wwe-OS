"""Tagging API — one tag vocabulary and one attach/detach surface every
module's frontend reuses, instead of a bespoke tag implementation per module.
"""

from __future__ import annotations

from django.db.models import Count
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from shared.permissions import HasPlatformPermission
from shared.views import BaseModelViewSet

from tagging.models import Tag
from tagging.serializers import (
    ObjectTagsQuerySerializer,
    SetObjectTagsSerializer,
    TagSerializer,
    TagWriteSerializer,
)
from tagging.services import TagService


class TagViewSet(BaseModelViewSet):
    serializer_class = TagSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    search_fields = ("name",)
    ordering_fields = ("name", "created_at")
    required_permissions = {
        "list": "tags.read",
        "retrieve": "tags.read",
        "analytics": "tags.read",
        "create": "tags.manage",
        "partial_update": "tags.manage",
        "destroy": "tags.manage",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Tag.objects.none()
        user = self.request.user
        qs = Tag.objects.annotate(usage_count=Count("tagged_items")).order_by("name")
        if not user.is_superuser and user.tenant_id is not None:
            qs = qs.filter(tenant_id=user.tenant_id)
        search = self.request.query_params.get("q", "")
        if search:
            qs = qs.filter(name__icontains=search)
        return qs

    def create(self, request: Request, *args, **kwargs) -> Response:
        data = TagWriteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        tag = TagService().create_tag(
            tenant=request.user.tenant,
            name=data.validated_data["name"],
            color=data.validated_data.get("color", "blue"),
            actor=request.user,
        )
        return Response(TagSerializer(tag).data, status=201)

    def partial_update(self, request: Request, *args, **kwargs) -> Response:
        tag = self.get_object()
        data = TagWriteSerializer(data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        tag = TagService().update_tag(
            tag=tag,
            name=data.validated_data.get("name"),
            color=data.validated_data.get("color"),
        )
        return Response(TagSerializer(tag).data)

    def destroy(self, request: Request, *args, **kwargs) -> Response:
        tag = self.get_object()
        TagService().delete_tag(tag=tag, actor=request.user)
        return Response(status=204)

    @action(detail=False, methods=["get"])
    def analytics(self, request: Request) -> Response:
        return Response(TagService().analytics(tenant=request.user.tenant))


class ObjectTagsView(APIView):
    """Tags currently on one object, or replace the full set — the tag
    picker's read+save surface, reused by every module's frontend."""

    permission_classes = [IsAuthenticated, HasPlatformPermission]
    required_permissions = {"GET": "tags.read", "PUT": "tags.manage"}

    @extend_schema(
        tags=["tags"],
        parameters=[ObjectTagsQuerySerializer],
        responses={200: TagSerializer(many=True)},
    )
    def get(self, request: Request) -> Response:
        query = ObjectTagsQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        tags = TagService().tags_for_object(tenant=request.user.tenant, **query.validated_data)
        return Response(TagSerializer(tags, many=True).data)

    @extend_schema(
        tags=["tags"],
        request=SetObjectTagsSerializer,
        responses={200: OpenApiResponse(response=TagSerializer(many=True))},
    )
    def put(self, request: Request) -> Response:
        data = SetObjectTagsSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        tags = TagService().set_tags_for_object(
            tenant=request.user.tenant,
            module=data.validated_data["module"],
            object_type=data.validated_data["object_type"],
            object_id=data.validated_data["object_id"],
            tag_ids=[str(i) for i in data.validated_data.get("tag_ids", [])],
            tag_names=data.validated_data.get("tag_names", []),
            actor=request.user,
        )
        return Response(TagSerializer(tags, many=True).data)
