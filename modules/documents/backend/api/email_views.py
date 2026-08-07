"""Email Ingestion View for incoming mails to waterworksengineering@gmail.com.

Ingests email payloads via ServiceTokenAuthentication.
- Attachments classified as Purchase Bills/Receipts -> routed to Purchase module.
- All other incoming mail attachments -> stored in Documents (DMS).
"""

from __future__ import annotations

import base64
import logging

from documents.backend.models import DocumentCategory
from documents.backend.services.document import DocumentService
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from shared.ingest import IngestKind, get_ingest_handler
from shared.service_auth import ServiceTokenAuthentication
from tenancy.models import Tenant

logger = logging.getLogger(__name__)


class EmailIngestView(APIView):
    authentication_classes = [ServiceTokenAuthentication]
    permission_classes = []

    def post(self, request: Request) -> Response:
        payload = request.data
        sender = payload.get("sender", "").strip().lower()
        subject = payload.get("subject", "").strip()
        body = payload.get("body", "").strip()
        attachments = payload.get("attachments", [])

        tenant = Tenant.objects.first()
        if tenant is None:
            tenant, _ = Tenant.objects.get_or_create(name="WWE OS", slug="wwe-os")

        created_docs = []

        tags = payload.get("tags") or payload.get("labels") or []
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(",") if t.strip()]

        for idx, att in enumerate(attachments):
            filename = (
                att.get("file_name") or att.get("filename") or f"incoming-attachment-{idx + 1}.pdf"
            )
            content_type = att.get("content_type", "application/pdf")
            content_b64 = att.get("content_b64") or att.get("content", "")

            try:
                data = base64.b64decode(content_b64) if content_b64 else b""
            except Exception:
                data = b""

            if not data:
                continue

            low_filename = filename.lower()
            low_subject = subject.lower()

            # Classification: Purchase Bill vs External Document
            is_purchase_bill = any(
                kw in low_filename or kw in low_subject
                for kw in ("purchase", "vendor", "receipt", "bill_rec", "p_order")
            )

            if is_purchase_bill:
                # Route to the Purchase module through the platform ingest port
                # (shared.ingest) — never by importing PurchaseBillService here.
                # If Purchase has no handler registered, or ingestion raises,
                # fall back to filing the attachment as a Document so nothing
                # is ever silently lost — but log the fall-through instead of
                # swallowing it.
                handler = get_ingest_handler(IngestKind.PURCHASE_BILL)
                if handler is not None:
                    try:
                        bill = handler(
                            tenant=tenant,
                            file_data=data,
                            filename=filename,
                            content_type=content_type,
                            channel="email",
                        )
                        created_docs.append(
                            {
                                "type": "purchase_bill",
                                "id": str(bill.id),
                                "filename": filename,
                                "tags": tags,
                            }
                        )
                        continue
                    except Exception:
                        logger.exception(
                            "Purchase ingest failed for %s; filing it as a Document instead.",
                            filename,
                        )
                else:
                    logger.warning(
                        "No purchase ingest handler registered; filing %s as a Document.",
                        filename,
                    )

            # Determine category for External Document
            if any(kw in low_filename or kw in low_subject for kw in ("inv", "invoice")):
                category = DocumentCategory.INVOICE
            elif any(kw in low_filename or kw in low_subject for kw in ("contract", "agreement")):
                category = DocumentCategory.CONTRACT
            elif any(kw in low_filename or kw in low_subject for kw in ("policy", "terms")):
                category = DocumentCategory.POLICY
            else:
                category = DocumentCategory.CORRESPONDENCE

            doc = DocumentService().create(
                tenant=tenant,
                owner=None,
                title=f"Mail Attachment: {filename} ({subject or 'No Subject'})",
                category=category,
                data=data,
                filename=filename,
                content_type=content_type,
                description=(
                    f"Received via email from {sender}. Subject: {subject}\n"
                    f"Tags: {', '.join(tags)}\n{body[:300]}"
                ),
                summarize=True,
            )
            created_docs.append(
                {
                    "type": "document",
                    "id": str(doc.id),
                    "filename": filename,
                    "category": category,
                    "tags": tags,
                }
            )

        sender_email = sender or "waterworksengineering@gmail.com"
        msg = f"Processed {len(created_docs)} attachment(s) from {sender_email}."
        return Response(
            {
                "success": True,
                "message": msg,
                "processed": created_docs,
            },
            status=status.HTTP_201_CREATED if created_docs else status.HTTP_200_OK,
        )
