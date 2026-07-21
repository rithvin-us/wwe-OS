from assets.backend.models.dc import DeliveryChallan, Site
from assets.backend.serializers.dc import (
    DeliveryChallanSerializer,
    GenerateDCSerializer,
    SiteSerializer,
)
from assets.backend.services.dc import DeliveryChallanService
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from shared.views import BaseModelViewSet


class SiteViewSet(BaseModelViewSet):
    serializer_class = SiteSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    search_fields = ("name", "contact_person")
    ordering_fields = ("name",)
    required_permissions = {
        "list": "assets.read",
        "retrieve": "assets.read",
        "create": "assets.write",
        "partial_update": "assets.write",
        "destroy": "assets.manage",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Site.objects.none()
        user = self.request.user
        if user.is_superuser:
            return Site.objects.all()
        if user.tenant_id is None:
            return Site.objects.none()
        return Site.objects.filter(tenant_id=user.tenant_id)


class DeliveryChallanViewSet(BaseModelViewSet):
    serializer_class = DeliveryChallanSerializer
    http_method_names = ["get", "post", "head", "options"]
    search_fields = ("dc_number", "site__name")
    ordering_fields = ("created_at",)
    required_permissions = {
        "list": "assets.read",
        "retrieve": "assets.read",
        "create": "assets.write",
        "download": "assets.read",
    }

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return DeliveryChallan.objects.none()
        user = self.request.user
        if user.is_superuser:
            return DeliveryChallan.objects.select_related("site", "generated_by", "file").all()
        if user.tenant_id is None:
            return DeliveryChallan.objects.none()
        return DeliveryChallan.objects.select_related("site", "generated_by", "file").filter(
            tenant_id=user.tenant_id
        )

    def create(self, request: Request, *args, **kwargs) -> Response:
        data = GenerateDCSerializer(data=request.data)
        data.is_valid(raise_exception=True)

        dc = DeliveryChallanService().generate_dc(
            tenant=request.user.tenant, actor=request.user, **data.validated_data
        )
        return Response(DeliveryChallanSerializer(dc).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"])
    def download(self, request: Request, pk=None) -> HttpResponse:
        from shared.exceptions import NotFoundError
        from storage.services import StorageService

        dc = self.get_object()
        if dc.file is None:
            raise NotFoundError("This DC has no attached PDF file.")

        payload = StorageService().open(dc.file)
        response = HttpResponse(payload, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{dc.file.filename}"'
        return response
