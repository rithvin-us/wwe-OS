"""PDF merging — the one genuinely new capability this subsystem needs.
Pure I/O over byte streams, no DB. See design §1:
docs/superpowers/specs/2026-07-25-auditor-package-generator-design.md
"""

from __future__ import annotations

import io


def merge_pdfs(streams: list[bytes]) -> bytes:
    if not streams:
        raise ValueError("merge_pdfs requires at least one PDF.")

    try:
        from pypdf import PdfReader, PdfWriter
    except ImportError:
        try:
            from PyPDF2 import PdfReader, PdfWriter
        except ImportError as err:
            raise RuntimeError("Neither pypdf nor PyPDF2 is installed for PDF merging.") from err

    writer = PdfWriter()
    for data in streams:
        reader = PdfReader(io.BytesIO(data))
        for page in reader.pages:
            writer.add_page(page)

    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()
