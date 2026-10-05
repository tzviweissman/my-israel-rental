"""Provider notification preferences for the Jobs Board.

Providers pick one of three modes for match notifications:
  • instant  — email fires the moment a matching job is posted
  • digest   — one email per day at ~9am with all new matches grouped
               by category (safer default, avoids inbox overload)
  • both     — instant per-post pings AND the daily digest

Alongside the mode, providers can "Snooze <Category> for 7 days" from
any notification email. Snoozes are stored per-category and expire
automatically — no manual cleanup needed since we check `until_iso >
now` at send time.
"""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, Field

from routes.deps import db
from utils.auth import verify_token
from utils.notification_tokens import (
    NotificationTokenError,
    verify_notification_token,
)
from .shared import CATEGORIES

MODES = ("instant", "digest", "both")
DEFAULT_MODE = "digest"
SNOOZE_DAYS = 7

router = APIRouter(prefix="/marketplace/notification-preferences", tags=["notifications"])


class PreferenceOut(BaseModel):
    mode: Literal["instant", "digest", "both"] = DEFAULT_MODE
    snoozed_categories: list[dict[str, Any]] = Field(default_factory=list)


class PatchIn(BaseModel):
    mode: Literal["instant", "digest", "both"]


class SnoozeIn(BaseModel):
    category: str


class SnoozeConsumeIn(BaseModel):
    token: str


async def _fetch(user_id: str) -> dict[str, Any]:
    doc = await db.job_notification_preferences.find_one({"user_id": user_id})
    if not doc:
        return {"mode": DEFAULT_MODE, "snoozed_categories": []}
    # Purge expired snoozes before returning so the UI never shows a
    # stale "snoozed until 3 days ago" line.
    now_iso = datetime.now(UTC).isoformat()
    live = [
        s for s in (doc.get("snoozed_categories") or [])
        if (s.get("until") or "") > now_iso
    ]
    if len(live) != len(doc.get("snoozed_categories") or []):
        await db.job_notification_preferences.update_one(
            {"user_id": user_id},
            {"$set": {"snoozed_categories": live}},
        )
    return {"mode": doc.get("mode", DEFAULT_MODE), "snoozed_categories": live}


def _validate_category(category: str) -> None:
    if not any(c["slug"] == category for c in CATEGORIES):
        raise HTTPException(status_code=400, detail="Unknown category")


@router.get("", response_model=PreferenceOut)
async def get_preferences(user=Depends(verify_token)):
    data = await _fetch(user["user_id"])
    return PreferenceOut(**data)


@router.patch("", response_model=PreferenceOut)
async def patch_preferences(payload: PatchIn, user=Depends(verify_token)):
    # Pydantic's Literal already validates the mode — no manual check
    # needed. If a client sends anything else FastAPI returns 422.
    await db.job_notification_preferences.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"mode": payload.mode, "updated_at": datetime.now(UTC).isoformat()}},
        upsert=True,
    )
    data = await _fetch(user["user_id"])
    return PreferenceOut(**data)


async def _apply_snooze(user_id: str, category: str) -> dict[str, Any]:
    _validate_category(category)
    until_iso = (datetime.now(UTC) + timedelta(days=SNOOZE_DAYS)).isoformat()
    doc = await db.job_notification_preferences.find_one({"user_id": user_id}) or {}
    snoozed = [
        s for s in (doc.get("snoozed_categories") or [])
        if s.get("category") != category
    ]
    snoozed.append({"category": category, "until": until_iso})
    await db.job_notification_preferences.update_one(
        {"user_id": user_id},
        {"$set": {
            "snoozed_categories": snoozed,
            "mode": doc.get("mode", DEFAULT_MODE),
        }},
        upsert=True,
    )
    return {"category": category, "until": until_iso}


# On/off switches for the emails that promise a way to stop them, so turning
# one off is never a one-way door. Each is stored as the SAME flag its email
# already reads: `prefs` is job_notification_preferences (requests.py,
# routes/weekly_insights.py, jobs.py), `users` is the account row
# (availability_reminders.py, smart_pricing/insights.py). The last three
# were promised by their emails and had no switch anywhere (dead ends, 4 Oct).
EMAIL_SWITCHES = {
    "requests_emails": ("prefs", "requests_emails_off"),
    "insights_emails": ("prefs", "insights_emails_off"),
    "jobs_emails": ("prefs", "jobs_emails_off"),
    "availability_emails": ("users", "availability_reminders_optout"),
    "pricing_emails": ("users", "pricing_insights_optout"),
}


class EmailSwitchesIn(BaseModel):
    requests_emails: bool | None = None
    insights_emails: bool | None = None
    jobs_emails: bool | None = None
    availability_emails: bool | None = None
    pricing_emails: bool | None = None


async def _switches(user_id: str) -> dict[str, bool]:
    docs = {
        "prefs": await db.job_notification_preferences.find_one({"user_id": user_id}) or {},
        "users": await db.users.find_one({"id": user_id}, {"_id": 0, "availability_reminders_optout": 1,
                                                          "pricing_insights_optout": 1}) or {},
    }
    return {k: not docs[store].get(flag) for k, (store, flag) in EMAIL_SWITCHES.items()}


@router.get("/emails")
async def get_email_switches(user=Depends(verify_token)):
    return await _switches(user["user_id"])


@router.patch("/emails")
async def patch_email_switches(payload: EmailSwitchesIn, user=Depends(verify_token)):
    now = datetime.now(UTC).isoformat()
    by_store: dict[str, dict] = {"prefs": {}, "users": {}}
    for k, v in payload.model_dump().items():
        if v is not None:
            store, flag = EMAIL_SWITCHES[k]
            by_store[store][flag] = not v
    if by_store["prefs"]:
        await db.job_notification_preferences.update_one(
            {"user_id": user["user_id"]}, {"$set": {**by_store["prefs"], "updated_at": now}}, upsert=True,
        )
    if by_store["users"]:
        await db.users.update_one({"id": user["user_id"]}, {"$set": by_store["users"]})
    return await _switches(user["user_id"])


@router.post("/snooze")
async def snooze(payload: SnoozeIn, user=Depends(verify_token)):
    return await _apply_snooze(user["user_id"], payload.category)


@router.delete("/snooze/{category}")
async def clear_snooze(category: str, user=Depends(verify_token)):
    """Un-snooze a category before its 7-day natural expiry. Used by
    the X button on the "Currently snoozed" chip in the notification
    settings card so a provider who changed their mind doesn't have
    to wait a week."""
    _validate_category(category)
    doc = await db.job_notification_preferences.find_one({"user_id": user["user_id"]}) or {}
    remaining = [
        s for s in (doc.get("snoozed_categories") or [])
        if s.get("category") != category
    ]
    await db.job_notification_preferences.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"snoozed_categories": remaining}},
        upsert=True,
    )
    return {"ok": True, "category": category}


@router.post("/snooze-consume")
async def snooze_from_email(payload: SnoozeConsumeIn = Body(...)):
    """Public endpoint hit by the snooze link in notification emails.
    Auth is via the signed token itself — no bearer required — so a
    provider can act on the email without logging in."""
    try:
        claims = verify_notification_token(payload.token, "snooze")
    except NotificationTokenError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return await _apply_snooze(claims["user_id"], claims["category"])
