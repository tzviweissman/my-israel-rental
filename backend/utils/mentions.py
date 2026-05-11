"""Detect @-mentions in chat messages.

The platform has two concrete role tokens that participants might address:
    @owner    — the property owner
    @renter   — the booking renter / tenant

Mentions are case-insensitive and must be word-boundary tokens (so
"@ownership" or "email@owner.com" do NOT count). Stored on each message
doc as ``mentions: ["owner"]`` so the inbox can flag unread mentions of
the current user without re-scanning text on every fetch.
"""
from __future__ import annotations

import re

# Word-boundary `@token` where token is one of the known role keywords.
# Matches "@owner" and "@OWNER" but NOT "@ownership", "email@owner.com",
# "foo@owner". The lookbehind ensures the @ isn't preceded by a word
# character (which would make it part of an email or longer handle).
_MENTION_RE = re.compile(r"(?<![A-Za-z0-9_])@(owner|renter|manager)\b", re.IGNORECASE)

KNOWN_ROLES = {"owner", "renter", "manager"}


def extract_mentions(text: str | None) -> list[str]:
    """Return de-duplicated lowercase role tokens mentioned in `text`."""
    if not text:
        return []
    seen: set[str] = set()
    out: list[str] = []
    for match in _MENTION_RE.finditer(text):
        role = match.group(1).lower()
        if role in KNOWN_ROLES and role not in seen:
            seen.add(role)
            out.append(role)
    return out


def current_user_role_in_property(
    user_id: str, property_doc: dict | None, sublease_doc: dict | None = None
) -> str | None:
    """Resolve which role the current user plays for a given property.

    Returns 'owner' if the user owns the property (or is the sublessor of the
    active sublease), 'renter' otherwise. Returns None if the property doc is
    missing — caller should treat that as 'unknown' (no mention highlight).
    """
    if not property_doc:
        return None
    if sublease_doc and sublease_doc.get("subleasor_id") == user_id:
        return "owner"  # treat sublessor as the owner for mention purposes
    if property_doc.get("owner_id") == user_id:
        return "owner"
    return "renter"
