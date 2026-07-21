"""Contract business logic.

Orchestrates platform capabilities, owns none: storage (optional signed file),
AI (summary via the gateway), workflow (approval), search (re-index), reporting
(register export), notifications (renewal/expiry reminders), audit (events).

Expiry handling is synchronous and pull-based by design — `run_expiry_scan`
is invoked by the `contracts_expiry_scan` management command (and can be by a
future scheduler). No background worker or queue is introduced here.
"""

from __future__ import annotations

from typing import Any

from contracts.backend.events.registry import (
    CONTRACT_ACTIVATED,
    CONTRACT_CREATED,
    CONTRACT_EXPIRED,
    CONTRACT_EXPIRING,
    CONTRACT_SUBMITTED,
    CONTRACT_SUMMARIZED,
    CONTRACT_TERMINATED,
    CONTRACT_UPDATED,
)
from contracts.backend.models import Contract, ContractStatus, SummaryStatus
from contracts.backend.repositories.contract import ContractRepository
from contracts.backend.search.adapter import INDEX, to_document
from django.utils import timezone
from search.services import SearchService
from shared.events import publish
from shared.exceptions import ConflictError, ValidationError
from shared.services import BaseService
from storage.services import StorageService

WORKFLOW_KEY = "contract-approval"
TEXT_CONTENT_TYPES = ("text/plain", "text/csv", "text/html", "application/json")
SUMMARY_INPUT_LIMIT = 6000


class ContractService(BaseService):
    def __init__(self) -> None:
        super().__init__()
        self.repo = ContractRepository()

    # ------------------------------------------------------------------ #
    # Create / update / attach
    # ------------------------------------------------------------------ #
    def create(self, *, tenant, owner, data: dict[str, Any]) -> Contract:
        contract = Contract.objects.create(tenant=tenant, owner=owner, **data)
        publish(CONTRACT_CREATED, instance=contract, actor=owner)
        self._index(contract)
        return contract

    def update_metadata(self, *, contract: Contract, actor, data: dict[str, Any]) -> Contract:
        if contract.status in (ContractStatus.TERMINATED, ContractStatus.EXPIRED):
            raise ConflictError(f"A {contract.status} contract cannot be edited.")
        fields: list[str] = []
        for field, value in data.items():
            if getattr(contract, field) != value:
                setattr(contract, field, value)
                fields.append(field)
        if fields:
            contract.save(update_fields=[*fields, "updated_at"])
            publish(CONTRACT_UPDATED, instance=contract, actor=actor)
            self._index(contract)
        return contract

    def attach_file(
        self, *, contract: Contract, data: bytes, filename: str, content_type: str, actor
    ) -> Contract:
        """Store (or replace) the signed document via platform storage."""
        storage = StorageService()
        previous = contract.file
        stored = storage.store(
            data=data,
            filename=filename,
            content_type=content_type,
            module="contracts",
            category="contract",
            tenant=contract.tenant,
            uploaded_by=actor,
            metadata={"title": contract.title},
        )
        contract.file = stored
        contract.save(update_fields=["file", "updated_at"])
        if previous is not None:
            storage.delete(previous, actor=actor)
        publish(CONTRACT_UPDATED, instance=contract, actor=actor)
        return contract

    # ------------------------------------------------------------------ #
    # AI summary (platform gateway)
    # ------------------------------------------------------------------ #
    def generate_summary(self, contract: Contract) -> Contract:
        from ai.services import AIService

        try:
            result = AIService().generate(
                module="contracts",
                prompt_key="contracts-summary",
                variables={"title": contract.title, "content": self._summary_input(contract)},
                tenant=contract.tenant,
                requested_by=contract.owner,
                use_case="contracts-summary",
            )
            contract.ai_summary = result.text
            contract.summary_status = SummaryStatus.READY
        except Exception:  # noqa: BLE001 - summary optional, never fatal
            contract.summary_status = SummaryStatus.FAILED
            self.logger.exception("Contract summary failed for %s", contract.id)
        contract.save(update_fields=["ai_summary", "summary_status", "updated_at"])
        if contract.summary_status == SummaryStatus.READY:
            publish(CONTRACT_SUMMARIZED, instance=contract, actor=contract.owner)
            self._index(contract)
        return contract

    def _summary_input(self, contract: Contract) -> str:
        if contract.file is not None and contract.file.content_type in TEXT_CONTENT_TYPES:
            try:
                text = StorageService().open(contract.file).decode("utf-8", errors="ignore")
                if text.strip():
                    return text[:SUMMARY_INPUT_LIMIT]
            except Exception:  # noqa: BLE001 - fall back to metadata
                self.logger.warning("Could not read contract file %s for summary", contract.id)
        meta = (
            f"Counterparty: {contract.counterparty}. Category: {contract.get_category_display()}. "
            f"Value: {contract.currency} {contract.value or '—'}. "
            f"Term: {contract.start_date or '—'} to {contract.end_date or '—'}.\n{contract.notes}"
        )
        return meta[:SUMMARY_INPUT_LIMIT]

    # ------------------------------------------------------------------ #
    # Approval lifecycle (platform workflow engine)
    # ------------------------------------------------------------------ #
    def submit_for_approval(self, *, contract: Contract, actor) -> Contract:
        from workflow.services import WorkflowService

        if contract.status != ContractStatus.DRAFT:
            raise ConflictError(f"Only a draft can be submitted (this one is {contract.status}).")
        instance = WorkflowService().start(
            definition_key=WORKFLOW_KEY,
            subject=contract,
            started_by=actor,
            tenant=contract.tenant,
        )
        contract.status = ContractStatus.IN_REVIEW
        contract.approval = instance
        contract.save(update_fields=["status", "approval", "updated_at"])
        publish(CONTRACT_SUBMITTED, instance=contract, actor=actor)
        self._index(contract)
        return contract

    def mark_active(self, contract: Contract) -> Contract:
        """Called by the workflow-completion subscriber."""
        contract.status = ContractStatus.ACTIVE
        contract.reviewed_at = timezone.now()
        contract.save(update_fields=["status", "reviewed_at", "updated_at"])
        publish(CONTRACT_ACTIVATED, instance=contract, actor=None)
        self._index(contract)
        return contract

    def mark_rejected(self, contract: Contract) -> Contract:
        contract.status = ContractStatus.DRAFT
        contract.approval = None
        contract.reviewed_at = timezone.now()
        contract.save(update_fields=["status", "approval", "reviewed_at", "updated_at"])
        self._index(contract)
        return contract

    def terminate(self, *, contract: Contract, actor, reason: str) -> Contract:
        if contract.status not in (ContractStatus.ACTIVE, ContractStatus.IN_REVIEW):
            raise ConflictError(f"A {contract.status} contract cannot be terminated.")
        if not reason.strip():
            raise ValidationError(detail={"reason": ["A termination reason is required."]})
        contract.status = ContractStatus.TERMINATED
        contract.terminated_at = timezone.now()
        contract.termination_reason = reason.strip()
        contract.save(update_fields=["status", "terminated_at", "termination_reason", "updated_at"])
        publish(CONTRACT_TERMINATED, instance=contract, actor=actor)
        SearchService().remove(index=INDEX, doc_id=str(contract.id), tenant=contract.tenant)
        return contract

    def delete(self, *, contract: Contract, actor) -> None:
        SearchService().remove(index=INDEX, doc_id=str(contract.id), tenant=contract.tenant)
        if contract.file is not None:
            StorageService().delete(contract.file, actor=actor)
        contract.delete()

    # ------------------------------------------------------------------ #
    # Expiry / renewal (pull-based; run by management command)
    # ------------------------------------------------------------------ #
    def run_expiry_scan(self, *, tenant, actor=None) -> dict[str, int]:
        """Expire past-due contracts and remind owners of ones nearing renewal.
        Returns counts. Idempotent enough to run daily."""
        expired = 0
        for contract in self.repo.past_due(tenant):
            contract.status = ContractStatus.EXPIRED
            contract.save(update_fields=["status", "updated_at"])
            publish(CONTRACT_EXPIRED, instance=contract, actor=actor)
            SearchService().remove(index=INDEX, doc_id=str(contract.id), tenant=contract.tenant)
            self._notify_owner(
                contract, "Contract expired", f"'{contract.title}' has passed its end date."
            )
            expired += 1

        reminded = 0
        for contract in self.repo.expiring_within(tenant, days=contract_notice_window(tenant)):
            if not contract.is_expiring_soon:
                continue
            publish(CONTRACT_EXPIRING, instance=contract, actor=actor)
            self._notify_owner(
                contract,
                "Contract renewal due soon",
                f"'{contract.title}' with {contract.counterparty} ends on {contract.end_date}.",
            )
            reminded += 1
        return {"expired": expired, "reminded": reminded}

    def _notify_owner(self, contract: Contract, title: str, body: str) -> None:
        if contract.owner is None:
            return
        from notifications.services import NotificationService

        NotificationService().create(
            recipient=contract.owner,
            tenant=contract.tenant,
            title=title,
            body=body,
            category="contracts",
            data={"contract_id": str(contract.id)},
        )

    # ------------------------------------------------------------------ #
    # Reporting
    # ------------------------------------------------------------------ #
    def build_report_spec(self, *, contracts) -> Any:
        from reporting.spec import ReportColumn, ReportSpec

        rows = [
            {
                "title": c.title,
                "counterparty": c.counterparty,
                "category": c.get_category_display(),
                "status": c.get_status_display(),
                "value": f"{c.currency} {c.value}" if c.value is not None else "—",
                "ends": c.end_date.strftime("%Y-%m-%d") if c.end_date else "—",
            }
            for c in contracts
        ]
        return ReportSpec(
            key="contracts-register",
            title="Contract register",
            module="contracts",
            columns=[
                ReportColumn("title", "Title"),
                ReportColumn("counterparty", "Counterparty"),
                ReportColumn("category", "Category"),
                ReportColumn("status", "Status"),
                ReportColumn("value", "Value", align="right"),
                ReportColumn("ends", "Ends", align="right"),
            ],
            rows=rows,
        )

    # ------------------------------------------------------------------ #
    # Internals
    # ------------------------------------------------------------------ #
    def _index(self, contract: Contract) -> None:
        if contract.status in (ContractStatus.TERMINATED, ContractStatus.EXPIRED):
            return
        SearchService().upsert(index=INDEX, tenant=contract.tenant, **to_document(contract))


def contract_notice_window(tenant) -> int:
    """Largest renewal-notice window to scan. Per-contract `renewal_notice_days`
    still gates the actual reminder via `is_expiring_soon`; this only bounds the
    query. Kept generous so no contract is missed."""
    return 90
