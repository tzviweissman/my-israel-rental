"""Resolve a user's WhatsApp number from the fields that actually hold it.

Why this exists
---------------
Two code paths disagreed about where a user's WhatsApp number lives, and the
disagreement was invisible because both halves looked correct on their own:

* ``PUT /auth/whatsapp`` (the dashboard Settings field) writes ``users.phone``
  — deliberately, so email signatures and chat contact info keep working off
  one column.
* ``GET /properties/{id}`` read ``users.whatsapp_number``, and so did the gig
  detail fallback.

Nothing in the codebase has ever written ``users.whatsapp_number``. The number
saved fine, showed up in Settings, and the WhatsApp button could never appear:
0 of 47 owners across all 204 production listings resolved to a number.

Centralised here so the read side can't drift from the write side again. If a
new place needs a user's WhatsApp number, call this rather than reaching for a
field name.

Privacy note
------------
``phone`` is also populated at signup and by the bulk user importer, so this
resolver exposes numbers that were not necessarily supplied for public
display. Surfacing them on public listings was an explicit product decision
(2026-07-30) rather than an oversight — the Settings copy was updated in the
same change to tell owners their number is shown to renters. If that decision
is ever revisited, this function is the single place to gate it.
"""
from __future__ import annotations

from typing import Any, Mapping

# Order matters: the dedicated field wins when something finally writes it,
# and `phone` is the column the Settings screen actually persists today.
_WHATSAPP_FIELDS = ("whatsapp_number", "phone")


def user_whatsapp(user: Mapping[str, Any] | None) -> str:
    """Best available WhatsApp number for ``user``.

    Returns a stripped string, or ``""`` when the user has no usable number.
    The empty string is meaningful to callers: it tells the frontend to fall
    back to the in-app chat instead of rendering a dead WhatsApp button.

    Formatting is deliberately left alone — the frontend's
    ``normalizeWhatsAppNumber`` owns turning human input ("050-123-4567",
    "+972 50 123 4567") into E.164, and duplicating that here would give two
    implementations to keep in sync.
    """
    if not user:
        return ""
    for field in _WHATSAPP_FIELDS:
        value = user.get(field)
        if value is None:
            continue
        cleaned = str(value).strip()
        if cleaned:
            return cleaned
    return ""


# Projection helper so callers fetch every field this resolver reads. Passing
# a narrower projection is what made the original bug possible.
WHATSAPP_PROJECTION: dict[str, int] = {field: 1 for field in _WHATSAPP_FIELDS}
