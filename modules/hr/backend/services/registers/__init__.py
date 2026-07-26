"""Statutory register generation.

`generator.py`, `mapper.py` and `writer.py` are the legacy app's openpyxl code,
copied across with only their imports repointed — the Indian statutory form
layout is verified, working logic and must not be rewritten
(docs/specs/hr-migration.md § 3). `config.py` is the settings shim that made
that possible.

The generator is pure: it takes pre-loaded model instances and returns a
filename. All data loading, storage, hashing and period locking live in
`hr.backend.services.register_service`.
"""

from hr.backend.services.registers.generator import ExcelGenerator

__all__ = ["ExcelGenerator"]
