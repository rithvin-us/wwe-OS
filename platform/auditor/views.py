"""Manual-trigger API for the auditor package pipeline. Read access to the
run is already covered by the existing workflow.views.PipelineRunViewSet
(GET /api/v1/workflow/runs/{id}/) — no second run-representation here."""

from __future__ import annotations

from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from shared.exceptions import ValidationError
from shared.permissions import HasPlatformPermission
from workflow.serializers import PipelineRunSerializer

from auditor.services import AuditorService


class _GeneratePackageSerializer(serializers.Serializer):
    year = serializers.IntegerField(min_value=2000, max_value=2100)
    month = serializers.IntegerField(min_value=1, max_value=12)


class GenerateAuditorPackageView(APIView):
    permission_classes = [IsAuthenticated, HasPlatformPermission]
    required_permissions = "auditor.generate"

    def post(self, request: Request) -> Response:
        serializer = _GeneratePackageSerializer(data=request.data)
        if not serializer.is_valid():
            raise ValidationError(detail=serializer.errors)

        user = request.user
        tenant = user.tenant
        if tenant is None:
            raise ValidationError(detail={"tenant": ["No tenant for this user."]})

        run = AuditorService().generate_package(
            tenant=tenant,
            year=serializer.validated_data["year"],
            month=serializer.validated_data["month"],
            actor=user,
        )
        return Response(PipelineRunSerializer(run).data, status=201)
