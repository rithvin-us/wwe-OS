from __future__ import annotations

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from shared import context
from users.serializers import UserSerializer

from auth.serializers import (
    ChangePasswordSerializer,
    EmailVerifySerializer,
    LoginSerializer,
    LogoutSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    TokenPairSerializer,
)
from auth.services import AuthService
from auth.throttles import LoginRateThrottle, PasswordResetRateThrottle


def _request_meta() -> tuple[str | None, str]:
    ctx = context.get_context()
    return ctx.ip_address, ctx.user_agent or ""


@extend_schema(tags=["auth"], request=RegisterSerializer, responses={201: UserSerializer})
class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        data = RegisterSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = AuthService().register(**data.validated_data)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["auth"], request=LoginSerializer, responses={200: TokenPairSerializer})
class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request: Request) -> Response:
        data = LoginSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        ip, ua = _request_meta()
        tokens = AuthService().login(
            email=data.validated_data["email"],
            password=data.validated_data["password"],
            remember_me=data.validated_data["remember_me"],
            ip=ip,
            user_agent=ua,
        )
        return Response(tokens)


@extend_schema(
    tags=["auth"],
    request=LogoutSerializer,
    responses={200: OpenApiResponse(description="Signed out.")},
)
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        data = LogoutSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        AuthService().logout(data.validated_data["refresh"])
        return Response({"detail": "Signed out."})


@extend_schema(
    tags=["auth"],
    request=None,
    responses={200: OpenApiResponse(description="Signed out on all devices.")},
)
class LogoutEverywhereView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        revoked = AuthService().logout_everywhere(request.user)
        return Response({"detail": "Signed out on all devices.", "revoked": revoked})


@extend_schema(
    tags=["auth"],
    request=PasswordResetRequestSerializer,
    responses={200: OpenApiResponse(description="Reset email sent if the account exists.")},
)
class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetRateThrottle]

    def post(self, request: Request) -> Response:
        data = PasswordResetRequestSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        AuthService().request_password_reset(data.validated_data["email"])
        # Always the same response — never reveal whether the email exists.
        return Response({"detail": "If that email exists, a reset link has been sent."})


@extend_schema(
    tags=["auth"],
    request=PasswordResetConfirmSerializer,
    responses={200: OpenApiResponse(description="Password updated.")},
)
class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        data = PasswordResetConfirmSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        AuthService().reset_password(**data.validated_data)
        return Response({"detail": "Password updated. Please sign in."})


@extend_schema(
    tags=["auth"],
    request=EmailVerifySerializer,
    responses={200: OpenApiResponse(description="Email verified.")},
)
class EmailVerifyView(APIView):
    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        data = EmailVerifySerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = AuthService().verify_email(**data.validated_data)
        return Response({"detail": "Email verified.", "user": UserSerializer(user).data})


@extend_schema(
    tags=["auth"],
    request=ChangePasswordSerializer,
    responses={200: OpenApiResponse(description="Password changed.")},
)
class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request) -> Response:
        data = ChangePasswordSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        AuthService().change_password(user=request.user, **data.validated_data)
        return Response({"detail": "Password changed. Please sign in again."})


@extend_schema(
    tags=["auth"],
    responses={
        200: OpenApiResponse(description="The current user and their effective permissions.")
    },
)
class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        from roles.services import RoleService

        return Response(
            {
                "user": UserSerializer(request.user).data,
                "permissions": sorted(RoleService().effective_permission_codes(request.user)),
            }
        )
