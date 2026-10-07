"""Make my photos match: an owner puts an item photo on a plain background.

Cloudinary cuts the item out (`e_background_removal`) and fills behind it
with a colour the owner picks. The item itself is never redrawn, which is
why this is the plain-background version and not a generated scene (Tzvi,
7 Oct 2026, after comparing both on real photos: the scene version broke
collage photos and changes on every run).

Nothing is replaced here. A preview is a NEW Cloudinary asset; the editor
swaps it in only when the owner approves and saves the listing, and the
original URL is kept on the record so it can be put back.

Spend guards, all server-side:
  * off unless PHOTO_MATCH_ENABLED=1 and Cloudinary is configured, so the
    preview environment (no flag) never shows the button;
  * DAILY_CAP previews per business per Israel day;
  * off for the rest of the month once the Cloudinary plan's credits are
    MONTHLY_CEILING_PCT used ("free allowance only").
"""
from __future__ import annotations

import asyncio
import os
import re
import time
import uuid
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from routes.deps import db, logger, verify_token
from utils import cloud_storage

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

DAILY_CAP = 10
MONTHLY_CEILING_PCT = 90
DEFAULT_COLOR = "FFFFFF"
_IL_TZ = ZoneInfo("Asia/Jerusalem")
_HEX = re.compile(r"^[0-9A-Fa-f]{6}$")
# .../image/upload/<any transforms>/v123/<public id>.<ext>
_ASSET = re.compile(r"^https://res\.cloudinary\.com/([^/]+)/image/upload/(?:[^/]+/)*?(v\d+/.+)$")


def enabled() -> bool:
    return cloud_storage.CLOUDINARY_ENABLED and os.environ.get("PHOTO_MATCH_ENABLED", "").strip() == "1"


_usage_cache: dict = {"at": 0.0, "ok": True}


def _allowance_left() -> bool:
    """False once the month's Cloudinary credits are nearly used. Cached ten
    minutes; if Cloudinary can't say, refuse rather than risk a bill."""
    if time.monotonic() - _usage_cache["at"] < 600:
        return _usage_cache["ok"]
    try:
        import cloudinary.api
        pct = float((cloudinary.api.usage().get("credits") or {}).get("used_percent") or 0)
        ok = pct < MONTHLY_CEILING_PCT
    except Exception as e:  # noqa: BLE001
        logger.warning("photo-match: usage check failed: %s", type(e).__name__)
        ok = False
    _usage_cache.update(at=time.monotonic(), ok=ok)
    return ok


def _today() -> str:
    return datetime.now(_IL_TZ).date().isoformat()


def _gig_photos(gig: dict) -> set[str]:
    urls = set(gig.get("images") or [])
    for o in (gig.get("products") or []) + (gig.get("tiers") or []):
        urls.update(o.get("images") or [])
        if o.get("image"):
            urls.add(o["image"])
    return urls


def derived_url(url: str, color: str) -> str | None:
    """The Cloudinary URL for `url` cut out onto `color`, or None when `url`
    is not one of our own Cloudinary images."""
    m = _ASSET.match(url or "")
    if not m or m.group(1) != os.environ.get("CLOUDINARY_CLOUD_NAME", "").strip():
        return None
    return f"https://res.cloudinary.com/{m.group(1)}/image/upload/e_background_removal/b_rgb:{color}/f_jpg/{m.group(2)}"


async def _render(url: str) -> bytes:
    """Fetch the derived image. The first request for a cut-out answers 423
    while Cloudinary works on it, so keep asking for up to a minute."""
    async with httpx.AsyncClient(timeout=30) as c:
        for _ in range(12):
            r = await c.get(url)
            if r.status_code == 200 and r.content:
                return r.content
            if r.status_code != 423:
                break
            await asyncio.sleep(5)
    raise HTTPException(status_code=502, detail="We couldn't tidy this photo. Please try again later.")


async def _own_gig(gig_id: str, user: dict) -> dict:
    gig = await db.marketplace_gigs.find_one({"_id": gig_id})
    if not gig:
        raise HTTPException(status_code=404, detail="Gig not found")
    if gig["provider_user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your gig")
    return gig


def _business_key(gig: dict) -> str:
    return gig.get("business_id") or gig["provider_user_id"]


@router.get("/gigs/{gig_id}/photo-match")
async def photo_match_state(gig_id: str, user=Depends(verify_token)):
    """What the editor needs: whether the button shows, uses left today,
    the colour this business last used, and result -> original for every
    tidied photo so each one can be put back."""
    gig = await _own_gig(gig_id, user)
    if not enabled():
        return {"enabled": False}
    key = _business_key(gig)
    used = await db.photo_matches.count_documents({"business_key": key, "day": _today()})
    last = await db.photo_matches.find_one({"business_key": key}, sort=[("created_at", -1)])
    originals = {d["result"]: d["original"] async for d in db.photo_matches.find({"gig_id": gig_id}, {"result": 1, "original": 1})}
    return {
        "enabled": True,
        "left_today": max(0, DAILY_CAP - used),
        "color": (last or {}).get("color", DEFAULT_COLOR),
        "originals": originals,
    }


class PhotoMatchIn(BaseModel):
    url: str
    color: str = DEFAULT_COLOR


@router.post("/gigs/{gig_id}/photo-match")
async def photo_match_preview(gig_id: str, body: PhotoMatchIn, user=Depends(verify_token)):
    gig = await _own_gig(gig_id, user)
    if not enabled():
        raise HTTPException(status_code=404, detail="Not available")
    color = body.color.lstrip("#").upper()
    if not _HEX.match(color):
        raise HTTPException(status_code=400, detail="Pick a colour")
    # Only a photo already on this listing, and never a tidied one again
    # (cut out twice is no better, and it would cost twice).
    prior = await db.photo_matches.find_one({"gig_id": gig_id, "result": body.url})
    source = prior["original"] if prior else body.url
    if source not in _gig_photos(gig) and not prior:
        raise HTTPException(status_code=400, detail="That photo isn't on this listing")
    src = derived_url(source, color)
    if not src:
        raise HTTPException(status_code=400, detail="This photo can't be tidied. Upload it again and try once more.")
    key = _business_key(gig)
    day = _today()
    if await db.photo_matches.count_documents({"business_key": key, "day": day}) >= DAILY_CAP:
        raise HTTPException(status_code=429, detail=f"You've tidied {DAILY_CAP} photos today. You can do more tomorrow.")
    if not await asyncio.to_thread(_allowance_left):
        raise HTTPException(status_code=503, detail="Photo tidying is paused until next month.")
    content = await _render(src)
    up = await cloud_storage.upload_bytes_to_cloudinary(content, is_video=False, folder="myisraelrental/matched")
    await db.photo_matches.insert_one({
        "id": str(uuid.uuid4()), "gig_id": gig_id, "business_key": key, "user_id": user["user_id"],
        "original": source, "result": up["url"], "color": color, "day": day,
        "created_at": datetime.now(UTC).isoformat(),
    })
    return {"url": up["url"], "original": source, "color": color}
