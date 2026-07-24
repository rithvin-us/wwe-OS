"""merge_pdfs — pure PDF merging over byte streams."""

from __future__ import annotations

import io

import pytest
from auditor.pdf import merge_pdfs
from pypdf import PdfReader, PdfWriter


def _one_page_pdf() -> bytes:
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def test_merge_combines_pages_from_every_input():
    merged = merge_pdfs([_one_page_pdf(), _one_page_pdf(), _one_page_pdf()])
    reader = PdfReader(io.BytesIO(merged))
    assert len(reader.pages) == 3


def test_merge_single_input_returns_that_pdfs_pages():
    merged = merge_pdfs([_one_page_pdf()])
    reader = PdfReader(io.BytesIO(merged))
    assert len(reader.pages) == 1


def test_merge_empty_list_raises():
    with pytest.raises(ValueError):
        merge_pdfs([])
