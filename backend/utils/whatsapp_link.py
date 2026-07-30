"""Server-side twin of ``frontend/src/utils/whatsappLink.js``.

Kept deliberately in lockstep with the JS module — same MIN/MAX digit
bounds, same ``00`` handling, same leading-zero rule. If you change one,
change the other and update ``tests/test_whatsapp_link.py``, which pins the
shared cases.

Why a second implementation at all: the tracked-contact redirect
(``GET /marketplace/gigs/{id}/contact``) must build the ``wa.me`` URL on the
server. Accepting a client-supplied URL and redirecting to it would turn the
endpoint into an open redirect, so the server has to normalise the number
itself.

Note on the leading zero: Israelis overwhelmingly type national format
("050-123-4567"), and ``wa.me`` only accepts full international format. The
trunk ``0`` is dropped when the country code is prepended, so ``0501234567``
becomes ``972501234567`` and NOT ``9720501234567`` — that extra zero produces
a link that silently goes nowhere.
"""
from __future__ import annotations

from typing import Optional
from urllib.parse import quote

# Below this it isn't a dialable number — almost certainly a partially typed
# value or junk pasted into the field.
MIN_DIGITS = 8
# Longest possible E.164 number.
MAX_DIGITS = 15

ISRAEL_CC = "972"


def normalize_whatsapp_number(raw: object) -> Optional[str]:
    """Bare E.164 digits (no ``+``, no spaces), or ``None`` when unusable.

    ``None`` is meaningful to callers: it means "no WhatsApp", not "try
    anyway". ``https://wa.me/`` with no digits is a live URL that goes
    nowhere, so a truthiness check on the raw string is not enough.
    """
    if raw is None:
        return None
    text = str(raw)
    digits = "".join(ch for ch in text if ch.isdigit())
    if not digits:
        return None

    # Did the user actually tell us the country? A leading `+` or a `00`
    # prefix is an explicit statement; a bare string of digits is not, and
    # guessing is what sent renters abroad.
    explicit_intl = text.lstrip(" \t‎‏‪‫‬‭‮(").startswith("+") \
        or digits.startswith("00")

    if explicit_intl:
        # Honour it as given — we have no basis to "fix" a foreign number.
        normalized = digits[2:] if digits.startswith("00") else digits
    elif digits.startswith("0"):
        # Israeli national format: the trunk 0 is REPLACED by the country
        # code, never kept alongside it.
        normalized = ISRAEL_CC + digits.lstrip("0")
    elif digits.startswith(ISRAEL_CC) and len(digits) == 12:
        # Already a full Israeli number, just without the +.
        normalized = digits
    elif len(digits) == 9 and digits.startswith("5"):
        # Israeli mobile with both the + and the trunk 0 missing. 9 digits
        # starting with 5 is unambiguous: an Israeli mobile is exactly 9
        # digits after the 0.
        normalized = ISRAEL_CC + digits
    else:
        # Ambiguous bare digits. This used to fall through as "assume it
        # already carries a country code", which dialled a New Jersey number
        # as +7 Russia and an Israeli mobile as +55 Brazil. Sending someone
        # to a stranger abroad is worse than showing no button.
        return None

    if not MIN_DIGITS <= len(normalized) <= MAX_DIGITS:
        return None
    return normalized


def build_whatsapp_link(raw: object, message: str = "") -> Optional[str]:
    """``https://wa.me/<digits>[?text=…]``, or ``None`` when unusable.

    The message is URL-encoded here — callers pass plain text.
    """
    digits = normalize_whatsapp_number(raw)
    if not digits:
        return None
    base = f"https://wa.me/{digits}"
    text = (message or "").strip()
    if not text:
        return base
    return f"{base}?text={quote(text)}"
