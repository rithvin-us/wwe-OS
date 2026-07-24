"""GST number format validation — pure, standalone."""

from __future__ import annotations

from rules.validators import validate_gst_number


def test_valid_gstin_passes():
    assert validate_gst_number("29ABCDE1234F1Z5") is True


def test_empty_value_is_not_a_format_error():
    assert validate_gst_number("") is True


def test_wrong_length_fails():
    assert validate_gst_number("29ABCDE1234F1Z") is False


def test_lowercase_fails():
    assert validate_gst_number("29abcde1234f1z5") is False


def test_missing_literal_z_fails():
    assert validate_gst_number("29ABCDE1234F1A5") is False
