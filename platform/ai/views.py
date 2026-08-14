"""AI gateway API — generate, usage analytics, prompt catalog, health."""

from __future__ import annotations

from django.db.models import Count, Sum
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from shared.permissions import HasPlatformPermission
from tenancy.services import TenancyService

from ai import prompts
from ai.assistant import AssistantService
from ai.models import AIUsage
from ai.services import AIService


class AssistantSerializer(serializers.Serializer):
    question = serializers.CharField(max_length=500)


class AssistantView(APIView):
    permission_classes = [IsAuthenticated, HasPlatformPermission]
    required_permissions = "ai.use"

    @extend_schema(
        tags=["ai"],
        request=AssistantSerializer,
        responses={200: OpenApiResponse(description="A grounded answer with source records.")},
    )
    def post(self, request: Request) -> Response:
        payload = AssistantSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        answer = AssistantService().answer(
            user=request.user, question=payload.validated_data["question"]
        )
        return Response(answer)


class GenerateSerializer(serializers.Serializer):
    prompt_key = serializers.CharField(required=False, allow_blank=True, default="")
    variables = serializers.DictField(child=serializers.CharField(), required=False, default=dict)
    system = serializers.CharField(required=False, allow_blank=True, default="", max_length=8000)
    user = serializers.CharField(required=False, allow_blank=True, default="", max_length=32000)
    model = serializers.CharField(required=False, allow_blank=True, default="")
    use_case = serializers.SlugField(required=False, allow_blank=True, default="")
    max_tokens = serializers.IntegerField(required=False, default=1024, min_value=1, max_value=8192)
    cache_ttl = serializers.IntegerField(required=False, default=0, min_value=0, max_value=86400)

    def validate(self, attrs):
        if not attrs.get("prompt_key") and not attrs.get("user"):
            raise serializers.ValidationError("Provide either prompt_key or user text.")
        return attrs


class GenerateView(APIView):
    permission_classes = [IsAuthenticated, HasPlatformPermission]
    required_permissions = "ai.use"

    @extend_schema(
        tags=["ai"],
        request=GenerateSerializer,
        responses={200: OpenApiResponse(description="Generated text with usage metadata.")},
    )
    def post(self, request: Request) -> Response:
        data = GenerateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        # A superuser created without a tenant (e.g. the bootstrap operator
        # account) has no `.tenant` to hand the gateway — single-operator
        # mode has exactly one company, so resolve it the same way
        # purchase ingestion does rather than failing every AI call.
        tenant = request.user.tenant or TenancyService().resolve_existing_default_tenant()
        result = AIService().generate(
            module="api",
            prompt_key=v["prompt_key"] or None,
            variables=v["variables"],
            system=v["system"],
            user=v["user"],
            model=v["model"] or None,
            use_case=v["use_case"],
            tenant=tenant,
            requested_by=request.user,
            max_tokens=v["max_tokens"],
            cache_ttl=v["cache_ttl"],
        )
        return Response(
            {
                "text": result.text,
                "model": result.model,
                "provider": result.provider,
                "cached": result.cached,
                "usage_id": str(result.usage_id),
            }
        )


class UsageView(APIView):
    permission_classes = [IsAuthenticated, HasPlatformPermission]
    required_permissions = "ai.manage"

    @extend_schema(
        tags=["ai"],
        responses={200: OpenApiResponse(description="Usage totals, by model, by module.")},
    )
    def get(self, request: Request) -> Response:
        qs = AIUsage.objects.all()
        if not request.user.is_superuser and request.user.tenant_id is not None:
            qs = qs.filter(tenant_id=request.user.tenant_id)
        totals = qs.aggregate(
            calls=Count("id"),
            input_tokens=Sum("input_tokens"),
            output_tokens=Sum("output_tokens"),
            cost_usd=Sum("cost_usd"),
        )
        by_model = list(
            qs.values("model")
            .annotate(calls=Count("id"), cost_usd=Sum("cost_usd"))
            .order_by("-calls")
        )
        by_module = list(
            qs.values("module")
            .annotate(calls=Count("id"), cost_usd=Sum("cost_usd"))
            .order_by("-calls")
        )
        return Response({"totals": totals, "by_model": by_model, "by_module": by_module})


class PromptListView(APIView):
    permission_classes = [IsAuthenticated, HasPlatformPermission]
    required_permissions = "ai.use"

    @extend_schema(
        tags=["ai"],
        responses={200: OpenApiResponse(description="Registered prompt catalog.")},
    )
    def get(self, request: Request) -> Response:
        return Response(
            [
                {
                    "key": p.key,
                    "version": p.version,
                    "category": p.category,
                    "description": p.description,
                    "variables": list(p.variables),
                    "model_hint": p.model_hint,
                }
                for p in prompts.all_prompts()
            ]
        )


class HealthView(APIView):
    permission_classes = [IsAuthenticated, HasPlatformPermission]
    required_permissions = "ai.manage"

    @extend_schema(
        tags=["ai"],
        responses={200: OpenApiResponse(description="Provider configuration status.")},
    )
    def get(self, request: Request) -> Response:
        return Response({"providers": AIService().provider_health()})
