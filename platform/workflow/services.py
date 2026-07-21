"""Workflow engine business logic.

One service owns the whole lifecycle: declare definitions, start instances,
approve/reject/cancel, and answer "what is waiting for this user". Modules
call these methods and subscribe to `workflow.*` events; they never touch the
models directly.

Approver notification walks the tenant's active users and checks effective
permissions per user. That is O(users-in-tenant) role lookups — perfectly fine
for the single-operator deployment and small teams; when tenants grow past
that, swap `_users_with_permission` for a role-join query without touching any
caller.
"""

from __future__ import annotations

from typing import Any

from django.db import IntegrityError, models, transaction
from django.utils import timezone
from shared.events import Events, publish
from shared.exceptions import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)
from shared.services import BaseService

from workflow.models import (
    ActionType,
    InstanceStatus,
    WorkflowAction,
    WorkflowDefinition,
    WorkflowInstance,
    WorkflowStep,
)

StepSpec = dict[str, str]  # {"key", "name", "required_permission"}


class WorkflowService(BaseService):
    # ------------------------------------------------------------------ #
    # Definitions
    # ------------------------------------------------------------------ #
    def ensure_definition(
        self,
        *,
        key: str,
        name: str,
        module: str,
        steps: list[StepSpec],
        tenant=None,
        description: str = "",
    ) -> WorkflowDefinition:
        """Idempotently declare a workflow definition (safe in post_migrate).

        Steps are synced by key: new ones created, changed ones updated,
        removed ones soft-deleted (running instances keep their FK history).
        Any step change bumps the definition version.
        """
        if not steps:
            raise ValidationError(detail={"steps": ["At least one step is required."]})

        definition = WorkflowDefinition.all_objects.filter(tenant=tenant, key=key).first()
        created = definition is None
        if created:
            definition = WorkflowDefinition.objects.create(
                tenant=tenant, key=key, name=name, module=module, description=description
            )

        dirty: list[str] = []
        if definition.is_deleted:
            definition.restore()
        for field, value in {"name": name, "module": module, "description": description}.items():
            if getattr(definition, field) != value:
                setattr(definition, field, value)
                dirty.append(field)

        steps_changed = self._sync_steps(definition, steps)
        if steps_changed and not created:
            definition.version += 1
            dirty.append("version")
        if dirty:
            definition.save(update_fields=[*dirty, "updated_at"])
        return definition

    @staticmethod
    def _sync_steps(definition: WorkflowDefinition, steps: list[StepSpec]) -> bool:
        existing = {s.key: s for s in WorkflowStep.all_objects.filter(definition=definition)}
        wanted_keys = set()
        changed = False
        for order, spec in enumerate(steps, start=1):
            wanted_keys.add(spec["key"])
            step = existing.get(spec["key"])
            if step is None:
                WorkflowStep.objects.create(
                    definition=definition,
                    order=order,
                    key=spec["key"],
                    name=spec["name"],
                    required_permission=spec["required_permission"],
                )
                changed = True
                continue
            updates = {
                "order": order,
                "name": spec["name"],
                "required_permission": spec["required_permission"],
                "is_deleted": False,
                "deleted_at": None,
            }
            if any(getattr(step, field) != value for field, value in updates.items()):
                for field, value in updates.items():
                    setattr(step, field, value)
                step.save()
                changed = True
        for step_key, step in existing.items():
            if step_key not in wanted_keys and not step.is_deleted:
                step.delete()  # soft delete keeps history for running instances
                changed = True
        return changed

    # ------------------------------------------------------------------ #
    # Lifecycle
    # ------------------------------------------------------------------ #
    def start(
        self,
        *,
        definition_key: str,
        subject: models.Model,
        started_by=None,
        tenant=None,
        context: dict[str, Any] | None = None,
    ) -> WorkflowInstance:
        tenant_id = tenant.id if tenant is not None else getattr(subject, "tenant_id", None)
        if tenant_id is None:
            raise ConflictError("A tenant is required to start a workflow.")

        definition = (
            WorkflowDefinition.objects.filter(
                key=definition_key, is_active=True, tenant_id=tenant_id
            ).first()
            or WorkflowDefinition.objects.filter(
                key=definition_key, is_active=True, tenant__isnull=True
            ).first()
        )
        if definition is None:
            raise NotFoundError(f"Workflow definition '{definition_key}' not found.")
        first_step = definition.steps.order_by("order").first()
        if first_step is None:
            raise ConflictError(f"Workflow definition '{definition_key}' has no steps.")

        subject_type = subject._meta.label_lower
        subject_id = str(subject.pk)
        try:
            with transaction.atomic():
                if WorkflowInstance.objects.filter(
                    tenant_id=tenant_id,
                    subject_type=subject_type,
                    subject_id=subject_id,
                    status=InstanceStatus.RUNNING,
                ).exists():
                    raise ConflictError("An approval is already running for this object.")
                instance = WorkflowInstance.objects.create(
                    tenant_id=tenant_id,
                    definition=definition,
                    subject_type=subject_type,
                    subject_id=subject_id,
                    current_step=first_step,
                    started_by=started_by,
                    context=context or {},
                )
                WorkflowAction.objects.create(
                    instance=instance, step=first_step, actor=started_by, action=ActionType.STARTED
                )
        except IntegrityError as exc:  # concurrent start lost the race
            raise ConflictError("An approval is already running for this object.") from exc

        publish(Events.WORKFLOW_STARTED, instance=instance, actor=started_by)
        self._notify_approvers(instance)
        return instance

    def approve(self, *, instance: WorkflowInstance, actor, comment: str = "") -> WorkflowInstance:
        with transaction.atomic():
            locked = WorkflowInstance.objects.select_for_update().get(pk=instance.pk)
            self._guard_running(locked)
            step = locked.current_step
            if step is None:
                raise ConflictError("Workflow instance has no active step.")
            if not actor.has_platform_permission(step.required_permission):
                raise PermissionDeniedError("You cannot act on this workflow step.")

            WorkflowAction.objects.create(
                instance=locked, step=step, actor=actor, action=ActionType.APPROVED, comment=comment
            )
            next_step = (
                locked.definition.steps.filter(order__gt=step.order).order_by("order").first()
            )
            if next_step is not None:
                locked.current_step = next_step
                locked.save(update_fields=["current_step", "updated_at"])
            else:
                locked.status = InstanceStatus.APPROVED
                locked.current_step = None
                locked.completed_at = timezone.now()
                locked.save(update_fields=["status", "current_step", "completed_at", "updated_at"])

        if next_step is not None:
            publish(Events.WORKFLOW_STEP_APPROVED, instance=locked, actor=actor)
            self._notify_approvers(locked)
        else:
            publish(Events.WORKFLOW_COMPLETED, instance=locked, actor=actor)
        return locked

    def reject(self, *, instance: WorkflowInstance, actor, reason: str) -> WorkflowInstance:
        if not reason.strip():
            raise ValidationError(detail={"reason": ["A rejection reason is required."]})
        with transaction.atomic():
            locked = WorkflowInstance.objects.select_for_update().get(pk=instance.pk)
            self._guard_running(locked)
            step = locked.current_step
            if step is not None and not actor.has_platform_permission(step.required_permission):
                raise PermissionDeniedError("You cannot act on this workflow step.")
            WorkflowAction.objects.create(
                instance=locked,
                step=step,
                actor=actor,
                action=ActionType.REJECTED,
                comment=reason.strip(),
            )
            locked.status = InstanceStatus.REJECTED
            locked.current_step = None
            locked.completed_at = timezone.now()
            locked.save(update_fields=["status", "current_step", "completed_at", "updated_at"])
        publish(Events.WORKFLOW_REJECTED, instance=locked, actor=actor)
        return locked

    def cancel(
        self, *, instance: WorkflowInstance, actor=None, reason: str = ""
    ) -> WorkflowInstance:
        """Administrative stop — e.g. the subject was deleted. Permission is
        the API layer's concern (`workflow.manage`); modules may cancel
        programmatically."""
        with transaction.atomic():
            locked = WorkflowInstance.objects.select_for_update().get(pk=instance.pk)
            self._guard_running(locked)
            WorkflowAction.objects.create(
                instance=locked,
                step=locked.current_step,
                actor=actor,
                action=ActionType.CANCELLED,
                comment=reason,
            )
            locked.status = InstanceStatus.CANCELLED
            locked.current_step = None
            locked.completed_at = timezone.now()
            locked.save(update_fields=["status", "current_step", "completed_at", "updated_at"])
        publish(Events.WORKFLOW_CANCELLED, instance=locked, actor=actor)
        return locked

    # ------------------------------------------------------------------ #
    # Queries
    # ------------------------------------------------------------------ #
    def pending_for(self, user) -> models.QuerySet[WorkflowInstance]:
        """Running instances whose current step this user may act on."""
        qs = WorkflowInstance.objects.filter(status=InstanceStatus.RUNNING).select_related(
            "definition", "current_step"
        )
        if user.is_superuser:
            return qs
        if user.tenant_id is None:
            return qs.none()
        from roles.services import RoleService

        codes = RoleService().effective_permission_codes(user)
        return qs.filter(tenant_id=user.tenant_id, current_step__required_permission__in=codes)

    # ------------------------------------------------------------------ #
    # Internals
    # ------------------------------------------------------------------ #
    @staticmethod
    def _guard_running(instance: WorkflowInstance) -> None:
        if instance.status != InstanceStatus.RUNNING:
            raise ConflictError(f"Workflow is already {instance.status}.")

    def _notify_approvers(self, instance: WorkflowInstance) -> None:
        """Best-effort in-app notification to everyone who can act on the
        current step. Never blocks the workflow on notification failure."""
        step = instance.current_step
        if step is None:
            return
        from notifications.services import NotificationService
        from users.models import User, UserStatus

        notifier = NotificationService()
        recipients = User.objects.filter(tenant_id=instance.tenant_id, status=UserStatus.ACTIVE)
        for user in recipients:
            if not user.has_platform_permission(step.required_permission):
                continue
            notifier.create(
                recipient=user,
                tenant=instance.tenant,
                title=f"Approval needed: {instance.definition.name}",
                body=f"Step '{step.name}' is waiting for your decision.",
                category="workflow",
                data={
                    "instance_id": str(instance.id),
                    "definition_key": instance.definition.key,
                    "subject_type": instance.subject_type,
                    "subject_id": instance.subject_id,
                    "step": step.key,
                },
            )
