"""Reading an already-issued invoice back off its own scan.

This is the *outgoing* side of OCR: the documents are the company's own AMC and
Sales invoices, raised before the register went live and now being back-filled.
So the fields it reaches for are the ones the register keeps — our printed
number, the consignee we billed, the tax split we applied — not a vendor's.

Like every AI call in the platform, it goes through `platform/ai` (`AIService`)
and never touches a provider directly (CLAUDE.md rule 3). It lives in `finance`
rather than reusing `purchase`'s extractor because modules never import each
other; the shared machinery is the gateway underneath, not the prompt.

Extraction only — image/text in, a normalized dict out. Turning that dict into a
draft invoice and matching a customer is the import service's job, so this stays
a pure, testable transform.
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

# The register's own vocabulary, handed to the model so it labels fields the way
# finance stores them. Deliberately explicit about *our* role (issuer/seller) so
# the model doesn't swap buyer and seller — the commonest failure on an invoice
# where both parties are printed side by side.
SYSTEM_PROMPT = """You are a Principal OCR & Invoice Extraction Engine reading a
company's OWN outgoing tax invoice (an AMC or Sales invoice it issued to a
customer). The company is the SELLER/ISSUER; extract the details of the invoice
it raised, NOT the seller's own registration.

Return ONLY a valid JSON object, no Markdown fences. Keys, EXACTLY:
- "number": String. The invoice's own printed serial (e.g. "G/M/12/2026-27"). "" if absent.
- "invoice_date": String. Date as YYYY-MM-DD.
- "invoice_type": String. "amc" if it bills a maintenance period/AMC (look for a
  billed month or "Annual Maintenance"), else "sales".
- "consignee_name": String. The CUSTOMER being billed (Bill To / Consignee / Buyer).
- "consignee_address": String. That customer's address.
- "gstin": String. The CUSTOMER's GSTIN (15 alphanumerics), else "".
- "is_sez": Boolean. true only if the invoice states supply to an SEZ unit / "SEZ".
- "gst_rate": Number. The GST rate percent applied (e.g. 18). 0 if not shown.
- "period_month": Number 1-12 or null. AMC only: the calendar month billed.
- "period_year": Number or null. AMC only: the calendar year billed.
- "lines": Array. Each: {"description": String, "hsn": String, "quantity": Number,
  "uom": String, "rate": Number}. One entry per printed line item.
- "subtotal": Number. Taxable value before GST. 0 if unclear.
- "cgst_amount": Number. 0 if not present.
- "sgst_amount": Number. 0 if not present.
- "igst_amount": Number. 0 if not present.
- "round_off": Number. Rounding adjustment, may be negative. 0 if none.
- "total": Number. Grand total payable.
- "amount_in_words": String. The total in words, "" if absent.
- "currency": String. 3-letter ISO, default "INR".
- "confidence_score": Number 0.00-1.00.
"""

VISION_SYSTEM_PROMPT = (
    SYSTEM_PROMPT
    + """
YOU ARE READING THE DOCUMENT IMAGE DIRECTLY. Transcribe before you interpret.

Reading rules:
- Read every region: header, Bill-To/Consignee block, the line-item table, the
  tax summary, totals, and any handwriting or stamp. A handwritten amendment
  over a printed figure is authoritative.
- Indian invoice conventions apply. Lakh/crore grouping (1,23,456.78) normalises
  to a plain number (123456.78). A trailing "/-" marks the end of an amount.
- The number series is usually PREFIX/serial/FY like "G/M/12/2026-27". Read the
  serial and the financial year exactly; a misread serial back-fills the wrong
  number. Distinguish 0/O, 1/7/I, 5/S, 6/8, 2/Z and re-read any digit of the
  number or a total before committing.
- CGST+SGST means a local supply; a single IGST line means inter-state or SEZ.
  Report the amounts you actually see; do not compute the split yourself.
- Treat arithmetic as a checksum: line values should sum toward the total. If
  they do not reconcile, re-read the digits that break it.

Honesty rules — these outrank completeness:
- NEVER invent a value. Illegible, cropped or absent -> "" for strings, 0 for
  numbers, null for period_month/period_year.
- Set "confidence_score" to what you could actually read; lower it for
  handwriting, glare, blur, skew or a cropped page.
- List every field you could not resolve in "unreadable_fields".

Also return:
- "document_type": String. One of "printed", "handwritten", "mixed".
- "unreadable_fields": Array of Strings.
"""
)


class InvoiceOCRService:
    def extract_from_image(
        self,
        image_bytes: bytes,
        *,
        mime_type: str = "image/jpeg",
        tenant=None,
        document_text: str = "",
    ) -> dict[str, Any]:
        """Read one invoice scan into a normalized field dict.

        Deterministic (temperature 0) and given the OCR timeout budget, not the
        chat one — a dense multi-page invoice needs the seconds. On any failure
        it degrades to a low-confidence blank so the item lands in review rather
        than crashing the batch.
        """
        parts = ["Extract the invoice's details from this document image."]
        if document_text.strip():
            parts.append(
                "A separate OCR pass produced the transcript below. Treat it as a "
                "hint only - the image is authoritative wherever they disagree.\n\n"
                f"{document_text.strip()}"
            )
        try:
            result = AIService().generate(
                module="finance",
                use_case="invoice-import-ocr-vision",
                system=VISION_SYSTEM_PROMPT,
                user="\n\n".join(parts),
                tenant=tenant,
                model=settings.AI_OCR_MODEL,
                max_tokens=settings.AI_OCR_MAX_TOKENS,
                temperature=0.0,
                timeout=settings.AI_OCR_TIMEOUT_SECONDS,
                images=[AIImage(data=base64.b64encode(image_bytes).decode(), mime_type=mime_type)],
            )
            return self._parse_json_result(result.text.strip())
        except Exception as exc:  # noqa: BLE001 - degrade, never crash the batch
            logger.warning("Invoice OCR vision call failed or unparseable: %s", exc)
            return self._fallback_extraction()

    def _parse_json_result(self, raw_text: str) -> dict[str, Any]:
        clean = raw_text
        if clean.startswith("```"):
            lines = clean.splitlines()
            if lines and lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            clean = "\n".join(lines).strip()

        try:
            data = json.loads(clean)
        except json.JSONDecodeError as err:
            logger.warning("Invoice OCR JSON decode error: %s. Raw: %s", err, raw_text[:200])
            return self._fallback_extraction()
        if not isinstance(data, dict):
            return self._fallback_extraction()
        return self._normalize(data)

    def _normalize(self, data: dict[str, Any]) -> dict[str, Any]:
        invoice_type = str(data.get("invoice_type") or "sales").strip().lower()
        if invoice_type not in {"amc", "sales"}:
            invoice_type = "sales"

        lines = []
        for row in data.get("lines") or []:
            if not isinstance(row, dict):
                continue
            description = str(row.get("description") or "").strip()
            if not description:
                continue
            lines.append(
                {
                    "description": description[:500],
                    "hsn": str(row.get("hsn") or "").strip()[:20],
                    "quantity": _num_str(row.get("quantity"), default="1"),
                    "uom": str(row.get("uom") or "Nos").strip()[:20] or "Nos",
                    "rate": _num_str(row.get("rate"), default="0"),
                }
            )

        return {
            "number": str(data.get("number") or "").strip(),
            "invoice_date": (
                str(data.get("invoice_date")).strip() if data.get("invoice_date") else None
            ),
            "invoice_type": invoice_type,
            "consignee_name": str(data.get("consignee_name") or "").strip()[:200],
            "consignee_address": str(data.get("consignee_address") or "").strip(),
            "gstin": str(data.get("gstin") or "").strip()[:20],
            "is_sez": bool(data.get("is_sez")),
            "gst_rate": _num_str(data.get("gst_rate"), default="0"),
            "period_month": _int_or_none(data.get("period_month")),
            "period_year": _int_or_none(data.get("period_year")),
            "lines": lines,
            "subtotal": _num_str(data.get("subtotal"), default="0"),
            "cgst_amount": _num_str(data.get("cgst_amount"), default="0"),
            "sgst_amount": _num_str(data.get("sgst_amount"), default="0"),
            "igst_amount": _num_str(data.get("igst_amount"), default="0"),
            "round_off": _num_str(data.get("round_off"), default="0"),
            "total": _num_str(data.get("total"), default="0"),
            "amount_in_words": str(data.get("amount_in_words") or "").strip()[:400],
            "currency": str(data.get("currency") or "INR").upper()[:3],
            "confidence_score": _confidence(data.get("confidence_score")),
            "document_type": str(data.get("document_type") or "printed").strip().lower(),
            "unreadable_fields": [
                str(field) for field in (data.get("unreadable_fields") or []) if field
            ],
        }

    def _fallback_extraction(self) -> dict[str, Any]:
        """A blank, low-confidence result — routes the item to manual review
        rather than committing a guessed invoice."""
        return {
            "number": "",
            "invoice_date": None,
            "invoice_type": "sales",
            "consignee_name": "",
            "consignee_address": "",
            "gstin": "",
            "is_sez": False,
            "gst_rate": "0",
            "period_month": None,
            "period_year": None,
            "lines": [],
            "subtotal": "0",
            "cgst_amount": "0",
            "sgst_amount": "0",
            "igst_amount": "0",
            "round_off": "0",
            "total": "0",
            "amount_in_words": "",
            "currency": "INR",
            "confidence_score": 0.0,
            "document_type": "printed",
            "unreadable_fields": [],
        }


def _num_str(value: Any, *, default: str) -> str:
    """Normalize an OCR number to a plain decimal string (keeps Decimal exact
    downstream). Tolerates "1,23,456.78/-", "₹1,200", "" and stray text."""
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return str(value)
    text = str(value).strip()
    if not text:
        return default
    cleaned = text.replace(",", "").replace("₹", "").replace("/-", "").replace("Rs", "").strip()
    negative = cleaned.startswith("-")
    digits = "".join(ch for ch in cleaned if ch.isdigit() or ch == ".")
    if not digits or digits == ".":
        return default
    return f"-{digits}" if negative else digits


def _int_or_none(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(float(str(value)))
    except (ValueError, TypeError):
        return None


def _confidence(value: Any) -> float:
    try:
        score = float(value) if value is not None else 0.0
    except (ValueError, TypeError):
        return 0.0
    return max(0.0, min(1.0, score))
