from rest_framework.settings import api_settings
from rest_framework.throttling import ScopedRateThrottle


class LoginRateThrottle(ScopedRateThrottle):
    scope = "login"


class PasswordResetRateThrottle(ScopedRateThrottle):
    scope = "password_reset"


class _OptionalScopedRateThrottle(ScopedRateThrottle):
    """A ScopedRateThrottle that treats an unconfigured scope as "no throttle"
    instead of a 500.

    Unlike `LoginRateThrottle`/`PasswordResetRateThrottle` above, these two
    views also set `throttle_scope` (see `auth.views.FaceEnrollView` /
    `FaceLoginView`), which is what `ScopedRateThrottle.allow_request` actually
    reads — so they, unlike those two, really do exercise `get_rate()`. Test
    settings blank `DEFAULT_THROTTLE_RATES` (`config.settings_test`), which
    would otherwise turn a missing rate into a 500 on a public endpoint.
    Mirrors `hr.backend.api.checkin_views.CheckInThrottle`.
    """

    def get_rate(self) -> str | None:  # type: ignore[override]
        return api_settings.DEFAULT_THROTTLE_RATES.get(self.scope)

    def allow_request(self, request, view):
        if not self.get_rate():
            return True
        return super().allow_request(request, view)


class FaceLoginRateThrottle(_OptionalScopedRateThrottle):
    scope = "face_login"


class FaceEnrollRateThrottle(_OptionalScopedRateThrottle):
    scope = "face_enroll"
