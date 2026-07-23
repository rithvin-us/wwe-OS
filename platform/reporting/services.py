"""Reporting engine.

Modules supply data (a ReportSpec); the platform renders, brands, stores,
and remembers. `render` returns bytes for streaming responses; `export`
additionally persists the file (through StorageService — reporting never
touches a storage provider) and records history + audit.
"""

from __future__ import annotations

from django.utils import timezone
from shared import context
from shared.events import Events, publish
from shared.exceptions import ConflictError, ValidationError
from shared.services import BaseService

from reporting import renderers
from reporting.models import ExportFormat, ReportExport
from reporting.spec import ReportSpec

FORMATS = {
    ExportFormat.CSV: (renderers.render_csv, "text/csv", "csv"),
    ExportFormat.XLSX: (
        renderers.render_xlsx,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xlsx",
    ),
    ExportFormat.HTML: (renderers.render_html, "text/html", "html"),
    ExportFormat.PDF: (renderers.render_pdf, "application/pdf", "pdf"),
}


class ReportService(BaseService):
    def render(
        self, spec: ReportSpec, format: str, *, tenant=None, actor=None
    ) -> tuple[bytes, str, str]:
        """Returns (bytes, content_type, filename)."""
        if format not in FORMATS:
            raise ValidationError(detail={"format": [f"Unknown format '{format}'."]})
        tenant = tenant or context.current_tenant()
        if tenant is None:
            raise ConflictError("A tenant is required to render reports.")

        renderer, content_type, extension = FORMATS[format]
        branding = {
            "company": tenant.name,
            "generated_by": getattr(actor, "email", "") or "system",
            "generated_at": timezone.now().strftime("%Y-%m-%d %H:%M UTC"),
        }
        payload = renderer(spec, branding)
        stamp = timezone.now().strftime("%Y%m%d-%H%M%S")
        return payload, content_type, f"{spec.key}-{stamp}.{extension}"

    def export(self, spec: ReportSpec, format: str, *, tenant=None, actor=None) -> ReportExport:
        tenant = tenant or context.current_tenant()
        payload, content_type, filename = self.render(spec, format, tenant=tenant, actor=actor)

        from storage.services import StorageService

        stored = StorageService().store(
            data=payload,
            filename=filename,
            content_type=content_type,
            module=spec.module,
            category="report",
            tenant=tenant,
            uploaded_by=actor,
            metadata={"report_key": spec.key, "format": format},
        )
        export = ReportExport.objects.create(
            tenant=tenant,
            report_key=spec.key,
            title=spec.title,
            module=spec.module,
            format=format,
            file=stored,
            row_count=len(spec.rows),
            params=spec.filters,
            generated_by=actor,
        )
        publish(Events.REPORT_EXPORTED, instance=export, actor=actor)
        return export

    def run(
        self, *, key: str, format: str, filters: dict | None = None, tenant=None, actor=None
    ) -> ReportExport:
        """Run a registered report by key: build its spec through the owning
        module's callable, then export. The Reports catalog uses this so no
        module has to expose its own run endpoint."""
        from reporting.registry import get_report

        tenant = tenant or context.current_tenant()
        if tenant is None:
            raise ConflictError("A tenant is required to run reports.")
        definition = get_report(key)
        spec = definition.build_spec(tenant, filters or {})
        return self.export(spec, format, tenant=tenant, actor=actor)
