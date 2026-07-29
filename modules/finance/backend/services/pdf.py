"""The PDF an invoice is sent out as.

Two engines, chosen by `INVOICE_PDF_ENGINE`:

* **`reportlab`** (default) — draws the invoice from its own data, in pure
  Python. Works everywhere the backend runs, including Render's native Python
  runtime, which has no LibreOffice and no way to install one (`render.yaml`
  declares `env: python`). It is a faithful *redraw* of the company format,
  not a pixel copy of the workbook: same blocks, same order, same figures,
  laid out by reportlab. The company block — name, address, GST number, bank
  details, terms, declaration — is read back out of the master template by
  `renderer.read_letterhead()`, so those details are still edited in exactly
  one place: the workbook.

* **`libreoffice`** — converts the generated workbook itself, so the PDF is
  the workbook, exactly. Requires the binary (`INVOICE_LIBREOFFICE_BIN`) on
  the host; `platform/Dockerfile` installs it, a native Render deploy does
  not. Opt in only where you know it is there.

The `.xlsx` remains the master in both cases. The PDF is the copy that leaves
the building.
"""

from __future__ import annotations

import io
import subprocess
import tempfile
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from finance.backend.models.invoice import TaxMode
from finance.backend.services import renderer
from finance.backend.services.computation import ComputedLine, ComputedTotals, tax_labels

CONTENT_TYPE = "application/pdf"

ENGINE_REPORTLAB = "reportlab"
ENGINE_LIBREOFFICE = "libreoffice"


class InvoicePdfError(RuntimeError):
    """The PDF could not be produced."""


def _inr(value: Decimal | str) -> str:
    """Indian digit grouping — 12,34,567.00, not 1,234,567.00."""
    amount = Decimal(str(value)).quantize(Decimal("0.01"))
    sign = "-" if amount < 0 else ""
    whole, _, fraction = f"{abs(amount):.2f}".partition(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        whole = ",".join([*groups, tail])
    return f"{sign}{whole}.{fraction}"


def build_invoice_pdf(*, xlsx_bytes: bytes | None = None, **fields) -> bytes:
    """Produces the invoice PDF using the configured engine."""
    engine = settings.INVOICE_PDF_ENGINE
    if engine == ENGINE_LIBREOFFICE:
        if xlsx_bytes is None:
            raise InvoicePdfError("The libreoffice engine needs the generated workbook.")
        return convert_workbook(xlsx_bytes)
    if engine != ENGINE_REPORTLAB:
        raise InvoicePdfError(
            f"Unknown INVOICE_PDF_ENGINE '{engine}'. Use 'reportlab' or 'libreoffice'."
        )
    return render_invoice_pdf(**fields)


def convert_workbook(xlsx_bytes: bytes) -> bytes:
    """Hands the workbook to LibreOffice and returns the PDF it produces."""
    binary = settings.INVOICE_LIBREOFFICE_BIN
    with tempfile.TemporaryDirectory() as workdir:
        source = Path(workdir) / "invoice.xlsx"
        source.write_bytes(xlsx_bytes)
        try:
            subprocess.run(
                [binary, "--headless", "--convert-to", "pdf", "--outdir", workdir, str(source)],
                check=True,
                capture_output=True,
                timeout=settings.INVOICE_LIBREOFFICE_TIMEOUT,
            )
        except FileNotFoundError as exc:
            raise InvoicePdfError(
                f"'{binary}' is not installed on this host. Set INVOICE_PDF_ENGINE=reportlab, "
                "or install LibreOffice."
            ) from exc
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
            raise InvoicePdfError(f"LibreOffice could not convert the invoice: {exc}") from exc

        produced = Path(workdir) / "invoice.pdf"
        if not produced.is_file():
            raise InvoicePdfError("LibreOffice produced no PDF.")
        return produced.read_bytes()


def render_invoice_pdf(
    *,
    number: str,
    invoice_date,
    consignee_name: str,
    consignee_address: str,
    facility: str,
    gstin: str = "",
    lines: list[ComputedLine],
    totals: ComputedTotals,
    tax_mode: str,
    gst_rate: Decimal,
    amount_in_words: str,
    period_text: str = "",
    watermark: str = "",
) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        KeepTogether,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    letterhead = renderer.read_letterhead()
    base = getSampleStyleSheet()
    small = ParagraphStyle("small", parent=base["Normal"], fontSize=7.5, leading=9.5)
    small_bold = ParagraphStyle("smallBold", parent=small, fontName="Helvetica-Bold")
    title = ParagraphStyle(
        "invoiceTitle", parent=base["Title"], fontSize=13, leading=16, spaceAfter=2
    )

    def cell(text: str, style=small) -> Paragraph:
        return Paragraph(str(text or "").replace("\n", "<br/>"), style)

    buffer = io.BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
        title=f"{letterhead.title} {number}",
        author=letterhead.company,
    )
    width = document.width

    def _watermark(canvas, _doc) -> None:
        if not watermark:
            return
        canvas.saveState()
        canvas.setFont("Helvetica-Bold", 64)
        canvas.setFillColorRGB(0.9, 0.9, 0.9)
        canvas.translate(105 * mm, 148 * mm)
        canvas.rotate(45)
        canvas.drawCentredString(0, 0, watermark)
        canvas.restoreState()

    grid = colors.HexColor("#334155")
    story: list = [cell(letterhead.title, title)]

    # --- Seller / buyer header ------------------------------------------- #
    left = [
        cell(letterhead.company, small_bold),
        cell(letterhead.address),
        cell(letterhead.seller_gst, small_bold),
        Spacer(1, 3 * mm),
        cell("Consignee :", small_bold),
        cell(consignee_name, small_bold),
        cell(consignee_address),
        cell(f"GSTIN : {gstin}" if gstin else ""),
    ]
    right = [
        cell(f"<b>Invoice No.:</b> {number}"),
        cell(f"<b>Date :</b> {invoice_date.strftime(renderer.DATE_FORMAT)}"),
        Spacer(1, 2 * mm),
        cell("<b>Buyer Order No. &amp; Date :</b>"),
        cell(f"<b>Facility:</b> {facility}" if facility else "<b>Facility:</b>"),
        cell("<b>Mode of Transport:</b>"),
    ]
    header = Table([[left, right]], colWidths=[width * 0.55, width * 0.45])
    header.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.6, grid),
                ("INNERGRID", (0, 0), (-1, -1), 0.6, grid),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story += [header, Spacer(1, 0)]

    # --- Items ------------------------------------------------------------ #
    columns = [12 * mm, width - 126 * mm, 18 * mm, 18 * mm, 15 * mm, 22 * mm, 26 * mm]
    rows: list[list] = [
        [
            cell("S.No.", small_bold),
            cell("Description", small_bold),
            cell("HSN", small_bold),
            cell("Quantity", small_bold),
            cell("UOM", small_bold),
            cell("Rate", small_bold),
            cell("Value", small_bold),
        ]
    ]
    style_commands = [
        ("BOX", (0, 0), (-1, -1), 0.6, grid),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, grid),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]

    if period_text:
        rows.append(
            [
                cell(""),
                cell(period_text, small_bold),
                cell(""),
                cell(""),
                cell(""),
                cell(""),
                cell(""),
            ]
        )
        style_commands.append(("SPAN", (1, 1), (6, 1)))

    rows.extend(
        [
            cell(line.position),
            cell(line.description),
            cell(line.hsn),
            cell(_trim_quantity(line.quantity)),
            cell(line.uom),
            cell(_inr(line.rate)),
            cell(_inr(line.amount)),
        ]
        for line in lines
    )

    primary_label, secondary_label = tax_labels(tax_mode=tax_mode, gst_rate=gst_rate)
    tax_rows = [
        (primary_label, totals.igst_amount if tax_mode == TaxMode.IGST else totals.sgst_amount)
    ]
    if secondary_label:
        tax_rows.append((secondary_label, totals.cgst_amount))

    def figure_row(label: str, value, bold: bool = False) -> list:
        style = small_bold if bold else small
        return [
            cell(""),
            cell(""),
            cell(""),
            cell(""),
            cell(""),
            cell(label, style),
            cell(_inr(value), style),
        ]

    for label, value in tax_rows:
        rows.append(figure_row(label, value))
    rows.append(figure_row("Total", totals.gross))
    rows.append(figure_row("R/OFF", totals.round_off))
    rows.append(figure_row("NET TOTAL :", totals.total, bold=True))

    items = Table(rows, colWidths=columns, repeatRows=1)
    items.setStyle(TableStyle(style_commands))
    story.append(items)

    # --- Words, bank, terms ------------------------------------------------ #
    words = Table([[cell("( In Words )", small_bold)], [cell(amount_in_words)]], colWidths=[width])
    words.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.6, grid),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, grid),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    story.append(words)

    bank_lines = [cell(letterhead.bank_heading, small_bold)]
    bank_lines += [cell(f"{label} {value}") for label, value in letterhead.bank]
    terms_lines = [cell(letterhead.terms_heading, small_bold)]
    terms_lines += [cell(term) for term in letterhead.terms]

    footer = Table(
        [
            [bank_lines, terms_lines],
            [
                [cell("Declaration:", small_bold), cell(letterhead.declaration)],
                [
                    cell(letterhead.signature_for, small_bold),
                    Spacer(1, 14 * mm),
                    cell(letterhead.signatory),
                ],
            ],
        ],
        colWidths=[width * 0.55, width * 0.45],
    )
    footer.setStyle(
        TableStyle(
            [
                ("BOX", (0, 0), (-1, -1), 0.6, grid),
                ("INNERGRID", (0, 0), (-1, -1), 0.6, grid),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(KeepTogether(footer))

    document.build(story, onFirstPage=_watermark, onLaterPages=_watermark)
    return buffer.getvalue()


def _trim_quantity(quantity: Decimal) -> str:
    """`2.000` prints as `2`, `2.500` as `2.5` — the way a person writes it."""
    normalised = Decimal(str(quantity)).normalize()
    return format(normalised, "f")
