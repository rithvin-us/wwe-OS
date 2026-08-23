"""Purchase OCR Extraction Service using the platform AI Gateway (`platform/ai`).

Never calls third-party AI SDKs directly; uses `AIService` from the platform gateway.
Supports Gemini, OpenAI, Anthropic, or Mock seamlessly based on configured settings.
"""

from __future__ import annotations

import base64
import json
import logging
from typing import Any

from ai.providers import AIImage
from ai.services import AIService
from django.conf import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a Principal OCR & Purchase Document Extraction Engine.
Analyze the provided receipt, purchase invoice, or bill document text/metadata.
Return ONLY a valid JSON object without any Markdown formatting code blocks.

The JSON object must contain EXACTLY the following keys:
- "vendor": String. Name of the selling company, store, or vendor.
- "invoice_number": String. Unique invoice/bill ID. Return "" if not present.
- "invoice_date": String. Date formatted YYYY-MM-DD.
- "gst_number": String. Vendor's Tax Identification / GST / VAT ID, else "".
- "items": Array of Objects. Line items extracted. Each item object must have:
    - "item_name": String (e.g. "Steel Beams", "Office Supplies")
    - "quantity": Number (e.g. 10)
    - "unit_price": Number (e.g. 50.00)
    - "tax": Number (e.g. 9.00)
    - "total": Number (e.g. 500.00)
- "total_quantity": Number. Total quantity of items purchased.
- "tax_amount": Number. Total tax or GST amount in plain numbers.
- "grand_total": Number. Final payable total amount as a number (e.g. 150.00).
- "currency": String. 3-letter ISO code (e.g. INR, USD, EUR). Default "INR".
- "payment_method": String. E.g. "Credit Card", "Bank Transfer", "Cash", "UPI".
- "confidence_score": Number between 0.00 and 1.00 for confidence level.
"""


# Vision prompt. Kept separate from SYSTEM_PROMPT because reading pixels is a
# different job from parsing an already-transcribed string, and the failure
# modes worth naming (handwriting, faded thermal paper, stamps over digits)
# only exist on the image path.
VISION_SYSTEM_PROMPT = (
    SYSTEM_PROMPT
    + """
YOU ARE READING THE DOCUMENT IMAGE DIRECTLY. Transcribe before you interpret.

Reading rules:
- Read EVERY region: header, body table, stamps, margin notes, and anything
  handwritten. A handwritten amendment usually overrides the printed value —
  a struck-through printed figure with a handwritten one beside it means the
  handwritten figure is authoritative.
- Indian invoice conventions apply. Digits may be grouped lakh/crore style
  (1,23,456.78) — normalise to a plain number (123456.78). Read a trailing
  "/-" as an end-of-amount marker, not a digit.
- Distinguish carefully: 0/O, 1/7/I, 5/S, 6/8, 2/Z. Re-read the digits of any
  total before committing. If an amount appears in both words and figures and
  they disagree, trust the words.
- A GSTIN is exactly 15 alphanumeric characters. If what you read is not 15
  characters, re-read it rather than emitting a malformed value.
- Treat arithmetic as a checksum, not a guess: line totals should sum toward
  the grand total. If they do not reconcile, re-read the digits that break it.

Honesty rules — these outrank completeness:
- NEVER invent a value to fill a field. If something is illegible, cropped, or
  absent, return "" for strings and 0 for numbers.
- Set "confidence_score" to what you could actually read. Lower it for
  handwriting, glare, blur, skew, or a cropped page. Do not report high
  confidence on a document you struggled with.
- List anything you could not resolve in "unreadable_fields".

In addition to the keys above, also return:
- "document_type": String. One of "printed", "handwritten", "mixed".
- "unreadable_fields": Array of Strings. Field names you could not read.
"""
)


class PurchaseOCRService:
    def extract_from_image(
        self,
        image_bytes: bytes,
        *,
        mime_type: str = "image/jpeg",
        tenant=None,
        document_text: str = "",
    ) -> dict[str, Any]:
        """Extract structured purchase fields straight from a page image.

        Preferred over `extract_from_text` whenever the original scan exists:
        handing the model only an upstream OCR transcript throws away layout,
        and layout is what disambiguates which number on a bill is the grand
        total. A transcript, when present, is passed alongside the image as a
        hint rather than a replacement, and the image wins on conflict.
        """
        ai_service = AIService()
        parts = ["Extract structured purchase invoice data from this document image."]
        if document_text.strip():
            parts.append(
                "A separate OCR pass produced the transcript below. Treat it as a hint "
                "only - the image is authoritative wherever they disagree.\n\n"
                f"{document_text.strip()}"
            )
        try:
            result = ai_service.generate(
                module="purchase",
                use_case="purchase-ocr-vision",
                system=VISION_SYSTEM_PROMPT,
                user="\n\n".join(parts),
                tenant=tenant,
                model=settings.AI_OCR_MODEL,
                max_tokens=settings.AI_OCR_MAX_TOKENS,
                # Deterministic on purpose: transcription has exactly one right
                # answer, and sampling variance on a digit is a wrong number in
                # the ledger.
                temperature=0.0,
                images=[AIImage(data=base64.b64encode(image_bytes).decode(), mime_type=mime_type)],
            )
            return self._parse_json_result(result.text.strip())
        except Exception as exc:
            logger.warning("Purchase OCR vision call failed or unparseable: %s", exc)
            if document_text.strip():
                return self.extract_from_text(document_text, tenant=tenant)
            return self._fallback_extraction()

    def extract_from_text(self, document_text: str, tenant=None) -> dict[str, Any]:
        """Call AI Gateway to extract structured purchase fields from text."""
        ai_service = AIService()
        user_prompt = f"Extract structured purchase invoice data from text:\n\n{document_text}"

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
