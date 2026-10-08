"""Server-side generation of strong temporary credentials.

Used when an administrator provisions an account: the password is generated
here and delivered by email (``backend/emailer.py``), never chosen by the
caller. Uses :mod:`secrets` (CSPRNG) and avoids visually ambiguous characters
(I O l o 0 1) so the emailed credential is easy to transcribe.
"""
from __future__ import annotations

import secrets

_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"
_LOWER = "abcdefghijkmnpqrstuvwxyz"
_DIGITS = "23456789"
_SYMBOLS = "!@#$%^&*()-_=+"
_ALL = _UPPER + _LOWER + _DIGITS + _SYMBOLS


def generate_password(length: int = 16) -> str:
    """Return a strong random password (clamped to 8–128, one of each class)."""
    size = max(8, min(128, length))
    chars = [
        secrets.choice(_UPPER),
        secrets.choice(_LOWER),
        secrets.choice(_DIGITS),
        secrets.choice(_SYMBOLS),
    ]
    chars += [secrets.choice(_ALL) for _ in range(size - 4)]
    # Fisher-Yates shuffle so the guaranteed classes are not positional.
    for i in range(len(chars) - 1, 0, -1):
        j = secrets.randbelow(i + 1)
        chars[i], chars[j] = chars[j], chars[i]
    return "".join(chars)


__all__ = ["generate_password"]
