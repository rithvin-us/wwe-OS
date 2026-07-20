from rest_framework.throttling import ScopedRateThrottle


class LoginRateThrottle(ScopedRateThrottle):
    scope = "login"


class PasswordResetRateThrottle(ScopedRateThrottle):
    scope = "password_reset"
