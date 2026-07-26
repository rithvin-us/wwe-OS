"""
Unit tests for app.services.geofence — great-circle distance and the
site-fence check used by self-service attendance check-in.
"""

from hr.backend.services.geofence import haversine_m, within_site

SITE_LAT = 11.0785
SITE_LON = 77.0057


class TestHaversine:
    def test_zero_distance(self):
        assert haversine_m(SITE_LAT, SITE_LON, SITE_LAT, SITE_LON) == 0.0

    def test_one_degree_latitude_is_about_111km(self):
        # One degree of latitude is ~111.19 km anywhere on Earth.
        d = haversine_m(0.0, 0.0, 1.0, 0.0)
        assert abs(d - 111_195) < 500

    def test_symmetric(self):
        a = haversine_m(SITE_LAT, SITE_LON, 12.0, 77.5)
        b = haversine_m(12.0, 77.5, SITE_LAT, SITE_LON)
        assert abs(a - b) < 1e-6


class TestWithinSite:
    def test_at_site_is_inside(self):
        assert within_site(SITE_LAT, SITE_LON, SITE_LAT, SITE_LON, radius_m=250)

    def test_far_away_is_outside(self):
        # ~1 km north of the site, fence is 250 m.
        assert not within_site(SITE_LAT + 0.01, SITE_LON, SITE_LAT, SITE_LON, radius_m=250)

    def test_accuracy_allowance_extends_fence(self):
        # ~350 m north: outside a 250 m fence, but an imprecise fix (300 m
        # accuracy) is treated as plausibly inside.
        lat = SITE_LAT + 0.00315  # ~350 m
        assert not within_site(lat, SITE_LON, SITE_LAT, SITE_LON, radius_m=250)
        assert within_site(lat, SITE_LON, SITE_LAT, SITE_LON, radius_m=250, accuracy_m=300)
