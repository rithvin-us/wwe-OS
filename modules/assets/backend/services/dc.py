"""Delivery Challan (DC) generation service."""

from __future__ import annotations

import os
import subprocess
import tempfile

from assets.backend.models.dc import ChallanType, DeliveryChallan, Site
from django.core.files.base import ContentFile
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
        items: list[dict],
    ) -> DeliveryChallan:
        from inventory.backend.models import InventoryItem

        site = Site.objects.get(id=site_id, tenant=tenant)

        # 1. Fill the Word template
        template_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "templates",
            "dc_template.docx",
        )

        doc = DocxTemplate(template_path)

        deliver_to = f"{site.name}\n{site.address}"
        if site.contact_person:
            deliver_to += f"\nAttn: {site.contact_person} ({site.contact_phone})"

        rendered_items = []
        # Store items json to save in DB later
        stored_items = []

        # Find all referenced inventory items at once
        item_ids = [i["id"] for i in items]
        inventory_items = {
            str(item.id): item
            for item in InventoryItem.objects.filter(id__in=item_ids, tenant=tenant)
        }

        for req_item in items:
            item_id = str(req_item["id"])
            qty = req_item.get("qty", 1)
            if item_id in inventory_items:
                inv_item = inventory_items[item_id]
                description = f"{inv_item.name} ({inv_item.sku})"
                rendered_items.append({"description": description, "qty": qty})
                stored_items.append(
                    {"id": item_id, "description": description, "qty": qty, "unit": inv_item.unit}
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
            content=ContentFile(pdf_data, name=file_name),
            filename=file_name,
            mime_type="application/pdf",
            tenant=tenant,
            actor=actor,
        )

        # 4. Create the DeliveryChallan record
        dc = DeliveryChallan.objects.create(
            tenant=tenant,
            dc_number=dc_number,
            dc_type=dc_type,
            site=site,
            file=stored_file,
            generated_by=actor,
        )
        dc.items = stored_items
        dc.save()

        return dc
