"""Content-based (magic-byte) validation for uploads.

A file's extension and its client-declared MIME type are both trivially
spoofable — a Windows executable renamed ``invoice.pdf`` and sent with
``content_type="application/pdf"`` sails past any check that trusts the
caller. This module inspects the *actual leading bytes* so the declared type
has to be backed by the content, and rejects executable payloads outright
regardless of what they claim to be.

Two independent gates, both applied by ``StorageService.store``:

1. ``looks_executable`` — a hard block on native executables / bytecode
   (ELF, PE/DOS, Mach-O, Java class). These are never legitimate business
   documents, so they are refused no matter what ``content_type`` says.
2. ``matches_declared_type`` — when the declared type is one we can positively
   fingerprint (PDF, PNG, JPEG, WebP, and the ZIP-container OOXML formats),
   the bytes must carry that signature. Types with no reliable signature
   (``text/*``, ``application/json``, ``application/xml``,
   ``application/octet-stream`` …) cannot be verified this way and are left to
   the size and allow-list gates — this function returns ``True`` for them
   rather than guessing.
"""

from __future__ import annotations

# Each entry maps a content type to a list of *patterns*. A pattern is a list
# of ``(offset, magic)`` pairs that must ALL be present; the type matches if
# ANY of its patterns matches. Kept small and offset-anchored on purpose:
# every signature here is unambiguous, so a false rejection means the file
# genuinely is not what it claims to be.
_ZIP_PATTERNS: list[list[tuple[int, bytes]]] = [
    [(0, b"PK\x03\x04")],  # normal archive
    [(0, b"PK\x05\x06")],  # empty archive
    [(0, b"PK\x07\x08")],  # spanned archive
]

_SIGNATURES: dict[str, list[list[tuple[int, bytes]]]] = {
    "application/pdf": [[(0, b"%PDF")]],
    "image/png": [[(0, b"\x89PNG\r\n\x1a\n")]],
    "image/jpeg": [[(0, b"\xff\xd8\xff")]],
    "image/gif": [[(0, b"GIF87a")], [(0, b"GIF89a")]],
    "image/webp": [[(0, b"RIFF"), (8, b"WEBP")]],
    # ZIP-container formats. Modern Office documents (.xlsx/.docx/.pptx) and
    # Google Earth .kmz are ZIP archives under the hood.
    "application/zip": _ZIP_PATTERNS,
    "application/vnd.google-earth.kmz": _ZIP_PATTERNS,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": _ZIP_PATTERNS,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": _ZIP_PATTERNS,
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": _ZIP_PATTERNS,
}

# Native executables / bytecode. Blocked regardless of declared type. `MZ` is
# handled separately (see `_looks_like_pe`) to avoid rejecting the rare text
# file that legitimately starts with those two bytes.
_EXECUTABLE_MAGICS: tuple[bytes, ...] = (
    b"\x7fELF",  # ELF — Linux/BSD executables and shared objects
    b"\xfe\xed\xfa\xce",  # Mach-O 32-bit
    b"\xfe\xed\xfa\xcf",  # Mach-O 64-bit
    b"\xce\xfa\xed\xfe",  # Mach-O 32-bit, byte-swapped
    b"\xcf\xfa\xed\xfe",  # Mach-O 64-bit, byte-swapped
    b"\xca\xfe\xba\xbe",  # Java class file / Mach-O universal ("fat") binary
)


def _looks_like_pe(data: bytes) -> bool:
    """True for a Windows PE executable (.exe/.dll/.sys).

    A bare ``MZ`` prefix is too weak on its own, so we follow the DOS header's
    ``e_lfanew`` pointer at offset 0x3C to the ``PE\\0\\0`` signature — the same
    check the loader does. This keeps the block precise instead of tripping on
    any content that happens to begin with the letters "MZ".
    """
    if not data.startswith(b"MZ") or len(data) < 0x40:
        return False
    e_lfanew = int.from_bytes(data[0x3C:0x40], "little")
    return 0 <= e_lfanew <= len(data) - 4 and data[e_lfanew : e_lfanew + 4] == b"PE\x00\x00"


def looks_executable(data: bytes) -> bool:
    """True if the bytes are a native executable or bytecode image."""
    if data[:4] in _EXECUTABLE_MAGICS:
        return True
    return _looks_like_pe(data)


def is_verifiable(content_type: str) -> bool:
    """True if we hold a magic-byte signature for this declared type."""
    return _normalize(content_type) in _SIGNATURES


def matches_declared_type(data: bytes, content_type: str) -> bool:
    """Verify bytes against the declared type.

    Returns ``True`` when the type is not one we can fingerprint (nothing to
    check) or when the bytes carry the expected signature; ``False`` only when
    we know the signature and the content fails it.
    """
    patterns = _SIGNATURES.get(_normalize(content_type))
    if patterns is None:
        return True
    return any(
        all(data[offset : offset + len(magic)] == magic for offset, magic in pattern)
        for pattern in patterns
    )


def _normalize(content_type: str) -> str:
    """Drop parameters and casing: ``"image/PNG; charset=..."`` -> ``"image/png"``."""
    return (content_type or "").split(";", 1)[0].strip().lower()
