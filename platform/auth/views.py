from __future__ import annotations

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from shared import context
from users.serializers import UserSerializer

from auth.serializers import (
    ChangePasswordSerializer,
    EmailVerifySerializer,
    FaceEnrollRequestSerializer,
    FaceLoginRequestSerializer,
    FaceStatusSerializer,
    LoginSerializer,
    LogoutSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    TokenPairSerializer,
)
from auth.services import AuthService
from auth.throttles import (
    FaceEnrollRateThrottle,
    FaceLoginRateThrottle,
    LoginRateThrottle,
    PasswordResetRateThrottle,
)


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


@extend_schema(
    tags=["auth"],
    responses={200: FaceStatusSerializer},
)
class FaceStatusView(APIView):
    """GET /api/v1/auth/face/ — list enrolled face profiles for the current user."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        credentials = AuthService().face_status(user=request.user)
        latest = credentials[0] if credentials else None
        return Response(
            FaceStatusSerializer(
                {
                    "enrolled": len(credentials) > 0,
                    "count": len(credentials),
                    "credentials": [
                        {"id": str(c.id), "label": c.label, "enrolled_at": c.enrolled_at}
                        for c in credentials
                    ],
                    "enrolled_at": latest.enrolled_at if latest else None,
                }
            ).data
        )


@extend_schema(
    tags=["auth"], request=FaceEnrollRequestSerializer, responses={200: FaceStatusSerializer}
)
class FaceEnrollView(APIView):
    """POST/DELETE /api/v1/auth/face/enroll/ — register or remove face templates for the caller."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [FaceEnrollRateThrottle]
    throttle_scope = "face_enroll"

    def post(self, request: Request) -> Response:
        data = FaceEnrollRequestSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        credential = AuthService().enroll_face(
            user=request.user,
            image_bytes=data.validated_data["file"].read(),
            label=data.validated_data.get("label") or "Face Profile",
        )
        credentials = AuthService().face_status(user=request.user)
        return Response(
            FaceStatusSerializer(
                {
                    "enrolled": True,
                    "count": len(credentials),
                    "credentials": [
                        {"id": str(c.id), "label": c.label, "enrolled_at": c.enrolled_at}
                        for c in credentials
                    ],
                    "enrolled_at": credential.enrolled_at,
                }
            ).data
        )

    def delete(self, request: Request) -> Response:
        credential_id = request.query_params.get("id") or request.data.get("id")
        AuthService().revoke_face(user=request.user, credential_id=credential_id)
        return Response({"detail": "Face profile removed."})


@extend_schema(
    tags=["auth"],
    request=FaceLoginRequestSerializer,
    responses={200: TokenPairSerializer},
)
class FaceLoginView(APIView):
    """POST /api/v1/auth/face/login/ — touchless 1:N face login (no email/password).

    Public by construction (there is no claimed identity to authenticate
    against up front — the match IS the identity), so it leans on its own
    throttle scope plus a per-IP lockout in AuthService.login_face.
    """

    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [FaceLoginRateThrottle]
    throttle_scope = "face_login"

    def post(self, request: Request) -> Response:
        data = FaceLoginRequestSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        selfie = data.validated_data["file"]
        frames = [frame.read() for frame in data.validated_data.get("frames") or []]
        ip, ua = _request_meta()
        tokens = AuthService().login_face(
            image_bytes=selfie.read(), extra_frames=frames, ip=ip, user_agent=ua
        )
        return Response(tokens)
