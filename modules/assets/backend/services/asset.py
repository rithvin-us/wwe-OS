"""Asset business logic — lifecycle transitions with guards.

Reuses platform storage (optional warranty/invoice file), search, reporting,
notifications, and audit. The lifecycle is a small state machine; each
transition validates the current state so an asset can't, say, be assigned
while it is in maintenance or disposed.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from assets.backend.events.registry import (
    ASSET_ASSIGNED,
    ASSET_CREATED,
    ASSET_DISPOSED,
    ASSET_RETURNED,
    ASSET_UPDATED,
    MAINTENANCE_COMPLETED,
    MAINTENANCE_STARTED,
)
from assets.backend.models import Asset, AssetStatus, MaintenanceRecord
from assets.backend.search.adapter import INDEX, to_document
from django.utils import timezone
from search.services import SearchService
from shared.events import publish
from shared.exceptions import ConflictError, ValidationError
from shared.services import BaseService
from storage.services import StorageService


class AssetService(BaseService):
    # ------------------------------------------------------------------ #
    # Create / update / attach
    # ------------------------------------------------------------------ #
    def create(self, *, tenant, actor, data: dict[str, Any]) -> Asset:
        from django.db import IntegrityError

        try:
            asset = Asset.objects.create(tenant=tenant, **data)
        except IntegrityError as exc:
            raise ConflictError("An asset with this tag already exists.") from exc
        publish(ASSET_CREATED, instance=asset, actor=actor)
        self._index(asset)
        return asset

    def update_metadata(self, *, asset: Asset, actor, data: dict[str, Any]) -> Asset:
        from django.db import IntegrityError

        if asset.status == AssetStatus.DISPOSED:
            raise ConflictError("A disposed asset cannot be edited.")
        # Lifecycle fields are moved only by their own transitions.
        for protected in ("status", "assigned_to", "assigned_at", "disposed_at"):
            data.pop(protected, None)
        fields: list[str] = []
        for field, value in data.items():
            if getattr(asset, field) != value:
                setattr(asset, field, value)
                fields.append(field)
        if fields:
            try:
                asset.save(update_fields=[*fields, "updated_at"])
            except IntegrityError as exc:
                raise ConflictError("An asset with this tag already exists.") from exc
            publish(ASSET_UPDATED, instance=asset, actor=actor)
            self._index(asset)
        return asset

    def attach_file(
        self, *, asset: Asset, data: bytes, filename: str, content_type: str, actor
    ) -> Asset:
        if asset.status == AssetStatus.DISPOSED:
            raise ConflictError("A disposed asset cannot be edited.")
        storage = StorageService()
        previous = asset.file
        stored = storage.store(
            data=data,
            filename=filename,
            content_type=content_type,
            module="assets",
            category="asset",
            tenant=asset.tenant,
            uploaded_by=actor,
            metadata={"asset_tag": asset.asset_tag},
        )
        asset.file = stored
        asset.save(update_fields=["file", "updated_at"])
        if previous is not None:
            storage.delete(previous, actor=actor)
        publish(ASSET_UPDATED, instance=asset, actor=actor)
        return asset

    # ------------------------------------------------------------------ #
    # Lifecycle
    # ------------------------------------------------------------------ #
    def assign(self, *, asset: Asset, actor, assigned_to: str) -> Asset:
        if asset.status != AssetStatus.IN_STOCK:
            raise ConflictError(
                f"Only an in-stock asset can be assigned (this one is {asset.status})."
            )
        if not assigned_to.strip():
            raise ValidationError(detail={"assigned_to": ["A name is required to assign."]})
        asset.status = AssetStatus.ASSIGNED
        asset.assigned_to = assigned_to.strip()
        asset.assigned_at = timezone.now()
        asset.save(update_fields=["status", "assigned_to", "assigned_at", "updated_at"])
        publish(ASSET_ASSIGNED, instance=asset, actor=actor)
        self._index(asset)
        return asset

    def return_asset(self, *, asset: Asset, actor) -> Asset:
        if asset.status != AssetStatus.ASSIGNED:
            raise ConflictError("Only an assigned asset can be returned.")
        asset.status = AssetStatus.IN_STOCK
        asset.assigned_to = ""
        asset.assigned_at = None
        asset.save(update_fields=["status", "assigned_to", "assigned_at", "updated_at"])
        publish(ASSET_RETURNED, instance=asset, actor=actor)
        self._index(asset)
        return asset

    def start_maintenance(self, *, asset: Asset, actor) -> Asset:
        if asset.status not in (AssetStatus.IN_STOCK, AssetStatus.ASSIGNED):
            raise ConflictError(f"A {asset.status} asset can't be sent to maintenance.")
        asset.status = AssetStatus.IN_MAINTENANCE
        asset.save(update_fields=["status", "updated_at"])
        publish(MAINTENANCE_STARTED, instance=asset, actor=actor)
        self._index(asset)
        return asset

    def complete_maintenance(
        self,
        *,
        asset: Asset,
        actor,
        description: str,
        cost=None,
        currency: str = "USD",
        vendor: str = "",
        performed_on: date | None = None,
    ) -> MaintenanceRecord:
        if asset.status != AssetStatus.IN_MAINTENANCE:
            raise ConflictError("This asset is not in maintenance.")
        if not description.strip():
            raise ValidationError(detail={"description": ["Describe what was done."]})
        record = MaintenanceRecord.objects.create(
            tenant=asset.tenant,
            asset=asset,
            performed_on=performed_on or timezone.now().date(),
            description=description.strip(),
            cost=cost,
            currency=currency,
            vendor=vendor.strip(),
            actor=actor,
        )
        asset.status = AssetStatus.IN_STOCK
        asset.save(update_fields=["status", "updated_at"])
        publish(MAINTENANCE_COMPLETED, instance=asset, actor=actor, record=record)
        self._index(asset)
        return record

    def dispose(self, *, asset: Asset, actor, reason: str, proceeds=None) -> Asset:
        if asset.status == AssetStatus.DISPOSED:
            raise ConflictError("This asset is already disposed.")
        if not reason.strip():
            raise ValidationError(detail={"reason": ["A disposal reason is required."]})
        asset.status = AssetStatus.DISPOSED
        asset.assigned_to = ""
        asset.assigned_at = None
        asset.disposed_at = timezone.now()
        asset.disposal_reason = reason.strip()
        asset.disposal_proceeds = proceeds
        asset.save(
            update_fields=[
                "status",
                "assigned_to",
                "assigned_at",
                "disposed_at",
                "disposal_reason",
                "disposal_proceeds",
                "updated_at",
            ]
        )
        publish(ASSET_DISPOSED, instance=asset, actor=actor)
        SearchService().remove(index=INDEX, doc_id=str(asset.id), tenant=asset.tenant)
        self._notify_owners(
            asset,
            "Asset disposed",
            f"{asset.name} ({asset.asset_tag}) was disposed: {reason.strip()}.",
        )
        return asset

    def delete(self, *, asset: Asset, actor) -> None:
        if asset.maintenance.exists():
            raise ConflictError(
                "This asset has maintenance history and cannot be deleted. Dispose it instead."
            )
        SearchService().remove(index=INDEX, doc_id=str(asset.id), tenant=asset.tenant)
        if asset.file is not None:
            StorageService().delete(asset.file, actor=actor)
        asset.delete()

    # ------------------------------------------------------------------ #
    # Reporting
    # ------------------------------------------------------------------ #
    def build_report_spec(self, *, assets, filters: dict | None = None) -> Any:
        from reporting.filtering import filters_summary
        from reporting.spec import ReportColumn, ReportSpec

        rows = [
            {
                "tag": asset.asset_tag,
                "name": asset.name,
                "category": asset.get_category_display(),
                "status": asset.get_status_display(),
                "assigned": asset.assigned_to or "—",
                "cost": (
                    f"{asset.currency} {asset.purchase_cost}"
                    if asset.purchase_cost is not None
                    else "—"
                ),
            }
            for asset in assets
        ]
        return ReportSpec(
            key="asset-register",
            title="Asset register",
            module="assets",
            columns=[
                ReportColumn("tag", "Tag"),
                ReportColumn("name", "Asset"),
                ReportColumn("category", "Category"),
                ReportColumn("status", "Status"),
                ReportColumn("assigned", "Assigned to"),
                ReportColumn("cost", "Cost", align="right"),
            ],
            rows=rows,
            filters=filters_summary(filters or {}),
        )

    # ------------------------------------------------------------------ #
    # Internals
    # ------------------------------------------------------------------ #
    def _index(self, asset: Asset) -> None:
        if asset.status == AssetStatus.DISPOSED:
            return
        SearchService().upsert(index=INDEX, tenant=asset.tenant, **to_document(asset))

    def _notify_owners(self, asset: Asset, title: str, body: str) -> None:
        from notifications.services import NotificationService
        from roles.models import Role
        from users.models import User

        owner_role = Role.objects.filter(tenant__isnull=True, slug="owner").first()
        if owner_role is None:
            return
        recipient_ids = owner_role.assignments.filter(user__tenant=asset.tenant).values_list(
            "user", flat=True
        )
        notifier = NotificationService()
        for user in User.objects.filter(id__in=recipient_ids):
            notifier.create(
                recipient=user,
                tenant=asset.tenant,
                title=title,
                body=body,
                category="assets",
                data={"asset_id": str(asset.id)},
            )
