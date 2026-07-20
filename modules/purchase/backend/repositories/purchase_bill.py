from __future__ import annotations

from shared.repositories import BaseRepository

from purchase.backend.models import PurchaseBill


class PurchaseBillRepository(BaseRepository[PurchaseBill]):
    model = PurchaseBill
