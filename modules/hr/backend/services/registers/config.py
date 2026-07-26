"""Register-generation settings.

A deliberately thin stand-in for the legacy app's `app.config.get_settings()`,
exposing exactly the attribute names `generator.py` and `mapper.py` read. That
keeps those two files — the openpyxl logic that fills ten statutory forms —
copied across unchanged rather than rewritten (docs/specs/hr-migration.md § 3).

Everything is environment-driven, per the platform rule that configuration
comes from the environment only. The defaults are the values the legacy app
shipped with, so a deployment that sets nothing behaves exactly as before.

These are Indian-labour-law form fields (principal employer, ESIC/EPF codes),
not general company branding — that is why they belong to the HR module and not
to `tenancy.CompanyProfile`.
"""

from __future__ import annotations

import os
import tempfile
from functools import lru_cache
from pathlib import Path

REGISTERS_DIR = Path(__file__).resolve().parent


def _env(name: str, default: str) -> str:
    value = os.environ.get(name)
    return value if value not in (None, "") else default


class RegisterSettings:
    """Paths and company details the workbook generator needs."""

    # ---- Company details written into the form headers -------------------- #
    @property
    def CONTRACTOR_NAME(self) -> str:  # noqa: N802 — legacy attribute name
        return _env("HR_CONTRACTOR_NAME", "WATER WORKS ENGINEERING")

    @property
    def CONTRACTOR_ADDRESS(self) -> str:  # noqa: N802
        return _env(
            "HR_CONTRACTOR_ADDRESS",
            "#65-B, GURUSAMY NAGAR, THANNEERPANDAL, PEELAMEDU, COIMBATORE-641 004.",
        )

    @property
    def PRINCIPAL_EMPLOYER(self) -> str:  # noqa: N802
        return _env(
            "HR_PRINCIPAL_EMPLOYER",
            "Bosch Global Software Technologies Private Limited",
        )

    @property
    def WORK_LOCATION(self) -> str:  # noqa: N802
        return _env(
            "HR_WORK_LOCATION",
            "KGISL Infrastructure Private Limited - SEZ, Keeranatham, "
            "Saravanampatti, Coimbatore-641035",
        )

    @property
    def MAIN_CONTRACTOR(self) -> str:  # noqa: N802
        return _env(
            "HR_MAIN_CONTRACTOR",
            "CBRE Inc,Building, G/F, Press Trust Of India, 4, Sansad Marg, "
            "Sansad Marg Area, New Delhi, Delhi 110001",
        )

    @property
    def ESIC_CODE(self) -> str:  # noqa: N802
        return _env("HR_ESIC_CODE", "56001274280000999")

    @property
    def EPF_CODE(self) -> str:  # noqa: N802
        return _env("HR_EPF_CODE", "CBCBE3191011000")

    # ---- Paths ------------------------------------------------------------ #
    @property
    def template_full_path(self) -> Path:
        """The immutable company template.

        Committed with the module because it cannot be regenerated from code.
        The generator always works on a *copy* — this file is never written to.
        """
        return REGISTERS_DIR / "templates" / "HR details Template.xlsx"

    @property
    def mappings_full_path(self) -> Path:
        """Directory of per-form cell maps (`*.json`)."""
        return REGISTERS_DIR / "mappings"

    @property
    def generated_full_path(self) -> Path:
        """Scratch directory the workbook is built in.

        Not an archive: the finished workbook is handed to `platform/storage`,
        which owns durable storage, SHA-256 and integrity verification, and the
        working copy is deleted. Set HR_REGISTERS_WORK_DIR to control where the
        build happens (e.g. a mounted volume in a container).
        """
        path = Path(
            _env("HR_REGISTERS_WORK_DIR", str(Path(tempfile.gettempdir()) / "wwe-os-hr-registers"))
        )
        path.mkdir(parents=True, exist_ok=True)
        return path


@lru_cache(maxsize=1)
def get_settings() -> RegisterSettings:
    return RegisterSettings()
