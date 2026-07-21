import sys

sys.path.append("/app")
import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django

django.setup()

from assets.backend.models.dc import Site
from rest_framework.test import APIClient
from tenancy.models import Tenant
from users.models import User

user = User.objects.first()
tenant = Tenant.objects.first()
site = Site.objects.filter(tenant=tenant).first()

client = APIClient(SERVER_NAME="localhost")
client.force_authenticate(user=user)

payload = {
    "dc_number": "28/2026-27",
    "dc_type": "returnable",
    "site_id": str(site.id) if site else "dummy",
    "date": "2026-07-21",
    "items": [{"id": "Tools", "qty": 1}],
}

resp = client.post("/api/v1/assets/dcs/", payload, format="json")
print("STATUS:", resp.status_code)
print("RESPONSE:", resp.json())
