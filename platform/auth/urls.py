from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from auth.views import (
    ChangePasswordView,
    EmailVerifyView,
    LoginView,
    LogoutEverywhereView,
    LogoutView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RegisterView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", LoginView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("logout-everywhere/", LogoutEverywhereView.as_view(), name="logout-everywhere"),
    path("password/reset/", PasswordResetRequestView.as_view(), name="password-reset"),
    path(
        "password/reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"
    ),
    path("password/change/", ChangePasswordView.as_view(), name="password-change"),
    path("email/verify/", EmailVerifyView.as_view(), name="email-verify"),
    path("me/", MeView.as_view(), name="me"),
]
