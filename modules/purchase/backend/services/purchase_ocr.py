"""Purchase OCR Extraction Service using the platform AI Gateway (`platform/ai`).

Never calls third-party AI SDKs directly; uses `AIService` from the platform gateway.
Supports Gemini, OpenAI, Anthropic, or Mock seamlessly based on configured settings.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from ai.services import AIService

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a Principal OCR & Purchase Document Extraction Engine.
Analyze the provided receipt, purchase invoice, or bill document text/metadata.
Return ONLY a valid JSON object without any Markdown formatting code blocks.

The JSON object must contain EXACTLY the following keys:
- "vendor": String. Name of the selling company, store, or vendor.
- "invoice_number": String. Unique invoice/bill identifier. Return "" if not present.
- "invoice_date": String. Date formatted YYYY-MM-DD. Return transaction date if missing.
- "gst_number": String. Vendor's Tax Identification / GST / VAT ID if available, else "".
- "items": Array of Objects. Line items extracted. Each item object must have:
    - "item_name": String (e.g. "Steel Beams", "Office Supplies")
    - "quantity": Number (e.g. 10)
    - "unit_price": Number (e.g. 50.00)
    - "tax": Number (e.g. 9.00)
    - "total": Number (e.g. 500.00)
- "total_quantity": Number. Total quantity of items purchased.
- "tax_amount": Number. Total tax or GST amount in plain numbers.
- "grand_total": Number. Final payable total amount as a plain number (e.g. 150.00).
- "currency": String. 3-letter ISO 4217 currency code (e.g. INR, USD, EUR). Default "INR".
- "payment_method": String. E.g. "Credit Card", "Bank Transfer", "Cash", "UPI", "Unspecified".
- "confidence_score": Number between 0.00 and 1.00 indicating confidence level in extraction.
"""


class PurchaseOCRService:
    def extract_from_text(self, document_text: str, tenant=None) -> dict[str, Any]:
        """Call AI Gateway to extract structured purchase fields from text."""
        ai_service = AIService()
        user_prompt = (
            f"Extract structured purchase invoice data from the following text:\n\n{document_text}"
        )

        try:
            result = ai_service.generate(
                module="purchase",
                use_case="purchase-ocr",
                system=SYSTEM_PROMPT,
                user=user_prompt,
                tenant=tenant,
                max_tokens=2048,
                temperature=0.1,
            )
            raw_text = result.text.strip()
            return self._parse_json_result(raw_text)
        except Exception as exc:
            logger.warning("Purchase OCR gateway call failed or unparseable: %s", exc)
            return self._fallback_extraction()

    def parse_raw_or_extract(
        self, raw_extraction: dict | None, document_text: str = "", tenant=None
    ) -> dict[str, Any]:
        """Helper to process raw extraction or run gateway OCR extraction."""
        if document_text:
            return self.extract_from_text(document_text, tenant=tenant)

        if raw_extraction:
            # Normalize existing extraction if already passed by ingestion channel
            seller = (
                raw_extraction.get("vendor")
                or raw_extraction.get("seller_name")
                or "Unknown Vendor"
            )
            grand_total = (
                raw_extraction.get("grand_total") or raw_extraction.get("total_rate") or "0.00"
            )
            inv_date = raw_extraction.get("invoice_date") or raw_extraction.get("purchase_date")
            confidence = raw_extraction.get("confidence_score")
            try:
                confidence = float(confidence) if confidence is not None else 0.90
            except (ValueError, TypeError):
                confidence = 0.90

            return {
                "vendor": seller,
                "invoice_number": str(raw_extraction.get("invoice_number") or ""),
                "invoice_date": inv_date,
                "gst_number": str(raw_extraction.get("gst_number") or ""),
                "items": raw_extraction.get("items") or [],
                "total_quantity": float(raw_extraction.get("total_quantity") or 0.0),
                "tax_amount": float(raw_extraction.get("tax_amount") or 0.0),
                "grand_total": str(grand_total),
                "currency": (raw_extraction.get("currency") or "INR").upper(),
                "payment_method": raw_extraction.get("payment_method") or "Unspecified",
                "confidence_score": confidence,
            }

        return self._fallback_extraction()

    def _parse_json_result(self, raw_text: str) -> dict[str, Any]:
        """Strip markdown fences if present and parse JSON."""
        clean_text = raw_text
        if clean_text.startswith("```"):
            lines = clean_text.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            clean_text = "\n".join(lines).strip()

        try:
            data = json.loads(clean_text)
            if not isinstance(data, dict):
                return self._fallback_extraction()

            confidence = data.get("confidence_score")
            try:
                confidence = float(confidence) if confidence is not None else 0.85
            except (ValueError, TypeError):
                confidence = 0.85

            return {
                "vendor": str(data.get("vendor") or "Unknown Vendor"),
                "invoice_number": str(data.get("invoice_number") or ""),
                "invoice_date": data.get("invoice_date"),
                "gst_number": str(data.get("gst_number") or ""),
                "items": data.get("items") if isinstance(data.get("items"), list) else [],
                "total_quantity": float(data.get("total_quantity") or 0.0),
                "tax_amount": float(data.get("tax_amount") or 0.0),
                "grand_total": str(data.get("grand_total") or "0.00"),
                "currency": str(data.get("currency") or "INR").upper()[:3],
                "payment_method": str(data.get("payment_method") or "Unspecified"),
                "confidence_score": confidence,
            }
        except json.JSONDecodeError as err:
            logger.warning("OCR JSON decode error: %s. Raw: %s", err, raw_text[:200])
            return self._fallback_extraction()

    def _fallback_extraction(self) -> dict[str, Any]:
        return {
            "vendor": "Pending OCR Processing",
            "invoice_number": "",
            "invoice_date": None,
            "gst_number": "",
            "items": [],
            "total_quantity": 0.0,
            "tax_amount": 0.0,
            "grand_total": "0.00",
            "currency": "INR",
            "payment_method": "Unspecified",
            "confidence_score": 0.30,  # Low confidence triggers NEEDS_ATTENTION
        }
