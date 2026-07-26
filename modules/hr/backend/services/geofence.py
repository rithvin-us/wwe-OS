"""
Geofence — distance checks for self-service attendance.

Browser geolocation is a *soft* signal: it is spoofable and weak indoors, so
being inside the fence is treated as one input to the check-in decision, not
proof of presence. See app.api.attendance /punch.
"""

import math

EARTH_RADIUS_M = 6_371_000.0


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two lat/lon points, in metres."""
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def within_site(
    lat: float,
    lon: float,
    site_lat: float,
    site_lon: float,
    radius_m: float,
    accuracy_m: float | None = None,
) -> bool:
    """Whether (lat, lon) is inside the site fence.

    The device's reported accuracy radius is added to the fence so a fix that
    is imprecise but plausibly inside still passes — geolocation is a soft
    signal and we do not want to reject honest employees on GPS jitter.
    """
    distance = haversine_m(lat, lon, site_lat, site_lon)
    allowance = radius_m + (accuracy_m or 0.0)
    return distance <= allowance
