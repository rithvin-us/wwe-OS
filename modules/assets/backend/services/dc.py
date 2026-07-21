"""Delivery Challan (DC) generation service."""

from __future__ import annotations

import os
import subprocess
import tempfile

from assets.backend.models.dc import ChallanType, DeliveryChallan, Site
from docxtpl import DocxTemplate
from storage.services import StorageService


class DeliveryChallanService:
    def generate_dc(
        self,
        *,
        tenant,
        actor,
        site_id: str,
        dc_type: str,
        dc_number: str,
        date: str,
        deliver_to: str = "",
        items: list[dict],
    ) -> DeliveryChallan:
        if tenant is None and actor:
            tenant = getattr(actor, "tenant", None)
        if tenant is None:
            from tenancy.models import Tenant

            tenant = Tenant.objects.first()

        site = None
        if site_id:
            try:
                site = Site.objects.get(id=site_id, tenant=tenant)
                if not deliver_to:
                    deliver_to = f"{site.name}\n{site.address}"
                    if site.contact_person:
                        deliver_to += f"\nAttn: {site.contact_person} ({site.contact_phone})"
            except Exception:
                site = None

        rendered_items = []
        stored_items = []

        for req_item in items:
            item_id = str(req_item.get("id", req_item.get("description", "")))
            qty = req_item.get("qty", 1)
            unit = req_item.get("unit", "")
            qty_str = f"{qty} {unit}".strip() if unit else str(qty)

            # Treat all inputs as custom text items
            rendered_items.append({"description": item_id, "qty": qty_str})
            stored_items.append(
                {"id": None, "description": item_id, "qty": qty, "unit": unit or "Nos"}
            )

        dc_title = (
            "RETURNABLE DELIVERY CHALLAN"
            if dc_type == ChallanType.RETURNABLE
            else "NON RETURNABLE DELIVERY CHALLAN"
        )

        context = {
            "dc_title": dc_title,
            "dc_no": dc_number,
            "date": date,
            "deliver_to": deliver_to,
            "items": rendered_items,
        }

        # 1. Fill the Word template
        template_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "templates",
            "dc_template.docx",
        )

        doc = DocxTemplate(template_path)
        doc.render(context)

        # 2. Convert to PDF using LibreOffice headless
        with tempfile.TemporaryDirectory() as tmpdir:
            docx_path = os.path.join(tmpdir, "dc.docx")
            pdf_path = os.path.join(tmpdir, "dc.pdf")

            doc.save(docx_path)

            # This requires libreoffice to be installed in the docker container
            subprocess.run(
                ["libreoffice", "--headless", "--convert-to", "pdf", "--outdir", tmpdir, docx_path],
                check=True,
            )

            with open(pdf_path, "rb") as f:
                pdf_data = f.read()

        # 3. Store the PDF
        file_name = f"DC_{dc_number.replace('/', '_')}.pdf"
        stored_file = StorageService().store(
            data=pdf_data,
            filename=file_name,
            content_type="application/pdf",
            module="assets",
            tenant=tenant,
            uploaded_by=actor,
        )

        # 4. Create the DeliveryChallan record
        dc = DeliveryChallan.objects.create(
            tenant=tenant,
            dc_number=dc_number,
            dc_type=dc_type,
            site=site,
            file=stored_file,
            generated_by=actor,
            verification_hash=stored_file.sha256 if stored_file else "",
        )
        dc.items = stored_items
        dc.save()

        return dc
