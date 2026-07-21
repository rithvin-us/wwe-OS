from django.urls import path
from rest_framework.routers import DefaultRouter

from users.views import MeProfileView, UserViewSet

router = DefaultRouter()
router.register("", UserViewSet, basename="user")

# Self-profile path is registered before the router so it isn't shadowed by
# the viewset's detail route.
urlpatterns = [
    path("me/profile/", MeProfileView.as_view(), name="user-me-profile"),
    *router.urls,
]
