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
from motor.motor_asyncio import AsyncIOMotorClient
import os

from utils.auth import verify_token
from utils.notification_tokens import (
    NotificationTokenError,
    verify_notification_token,
)
from .shared import CATEGORIES

MODES = ("instant", "digest", "both")
DEFAULT_MODE = "digest"
SNOOZE_DAYS = 7

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

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
    if payload.mode not in MODES:
        raise HTTPException(status_code=400, detail="Invalid mode")
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


@router.post("/snooze")
async def snooze(payload: SnoozeIn, user=Depends(verify_token)):
    return await _apply_snooze(user["user_id"], payload.category)


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
