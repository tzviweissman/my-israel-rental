"""Signed JWT helpers for email deep-links + snooze links.

These are separate from the main `create_token` / `verify_token` in
`utils.auth` because email tokens live longer than session tokens (a
provider may open a match email 5 days after it arrives) and are scoped
to a specific action so a leaked deep-link can't be repurposed for a
different flow.

Every token carries:
  purpose: "job_deeplink" | "snooze"
  user_id: str
  extra:   dict (job_id for deep-links, category for snoozes)

Verification enforces that `purpose` matches what the endpoint expects
— a deep-link JWT is refused by the snooze endpoint and vice versa.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import jwt

from utils.auth import JWT_SECRET

DEEPLINK_TTL_DAYS = 7
SNOOZE_TTL_DAYS = 30


def _encode(payload: dict[str, Any]) -> str:
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def create_deeplink_token(user_id: str, job_id: str) -> str:
    """Short-lived token embedded in "View & Bid" email CTAs. Lets a
    provider land on the job post already authenticated (so they can
    apply without re-typing their password) for up to 7 days.
    """
    payload = {
        "purpose": "job_deeplink",
        "user_id": user_id,
        "job_id": job_id,
        "exp": datetime.now(UTC) + timedelta(days=DEEPLINK_TTL_DAYS),
    }
    return _encode(payload)


def create_snooze_token(user_id: str, category: str) -> str:
    """One-shot token for the "Snooze this category for 7 days" link
    in every notification email. Longer TTL (30 days) so a provider
    who buries the email in their inbox can still act on it later.
    """
    payload = {
        "purpose": "snooze",
        "user_id": user_id,
        "category": category,
        "exp": datetime.now(UTC) + timedelta(days=SNOOZE_TTL_DAYS),
    }
    return _encode(payload)


class NotificationTokenError(Exception):
    """Raised when a signed notification token fails validation. The
    router catches this and returns a friendly 400 — never a stack
    trace — so email recipients see a clean error page."""


def verify_notification_token(token: str, expected_purpose: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError as e:
        raise NotificationTokenError("This link has expired.") from e
    except jwt.InvalidTokenError as e:
        raise NotificationTokenError("This link is invalid.") from e
    if payload.get("purpose") != expected_purpose:
        raise NotificationTokenError("This link is invalid.")
    if not payload.get("user_id"):
        raise NotificationTokenError("This link is invalid.")
    return payload
