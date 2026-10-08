"""Page builder v3: owners choose their page from three versions (Tzvi,
6 Oct 2026). The rules are utils/page_versions.py; this is the storage and
the HTTP surface.

Only for a business an admin has switched to v3 (Tzvi's per-business switch
stays): its owner, or an admin, can generate three versions, see them and
the earlier ones, publish one, and restore an earlier one. Publishing does
not put a page live. It starts the visual check, and only a pass makes the
version live; a fail leaves the page that was live as it was.

Versions live in their own collection, off the business document (16MB
limit, and history grows). The business record keeps `design_brief`,
`design_brief_at` and `page_check` as the live pointer, so rendering and
the gate read exactly what they read before.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from routes.deps import db, optional_user, verify_token

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

KEEP_ARCHIVED = 10


async def _business(business_id: str) -> dict:
    from utils.design_brief import v3_enabled
    biz = await db.businesses.find_one({"_id": business_id})
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    if not (v3_enabled() and biz.get("page_v3")):
        raise HTTPException(status_code=409, detail="The new page builder is not on for this business yet")
    return biz


async def _owned_v3(business_id: str, user: dict) -> dict:
    from utils.page_versions import owners_may_choose
    biz = await _business(business_id)
    if user.get("role") == "admin":
        return biz
    if biz.get("owner_user_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your business")
    if not owners_may_choose():
        # While the rules are being tuned, the page is made by an admin.
        raise HTTPException(status_code=403, detail="Not available yet")
    return biz


def _view(v: dict, admin: bool) -> dict:
    """A version as the owner sees it. The preview token is never sent: its
    hash is all that is stored, and the check service gets the token once."""
    out = {k: v.get(k) for k in ("status", "brief", "created_at", "published_at", "checking_since",
                                 "checked_at", "failures", "showstopper")}
    out["id"] = v["_id"]
    if admin:
        out["created_by"] = v.get("created_by")
    return out


async def ensure_version_indexes() -> None:
    await db.business_page_versions.create_index([("business_id", 1), ("created_at", -1)], background=True)
    await db.business_page_versions.create_index("preview.hash", sparse=True, background=True)


@router.get("/businesses/{business_id}/page-versions")
async def list_versions(business_id: str, user=Depends(verify_token)):
    await _owned_v3(business_id, user)
    cur = db.business_page_versions.find({"business_id": business_id}).sort("created_at", -1).limit(40)
    admin = user.get("role") == "admin"
    return {"versions": [_view(v, admin) async for v in cur]}


@router.post("/businesses/{business_id}/page-versions")
async def generate_versions(business_id: str, user=Depends(verify_token)):
    """Three new versions to choose from. Earlier unpicked candidates are
    replaced; live, archived and failed versions are kept."""
    from routes.marketplace.businesses import _brief_category, brief_inputs, recent_briefs
    from utils.page_versions import candidates
    biz = await _owned_v3(business_id, user)
    record, logo, photos = await brief_inputs(biz)
    generation = int(biz.get("page_generation") or 0) + 1
    try:
        recent = await recent_briefs(_brief_category(record), business_id)
        briefs = candidates(record, logo, photos, recent, generation)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=f"Design brief refused: {e}") from e
    now = datetime.now(UTC).isoformat()
    docs = [{"_id": uuid.uuid4().hex, "business_id": business_id, "status": "candidate", "brief": b,
             "showstopper": b["showstopper"], "generation": generation, "created_at": now,
             "created_by": user["user_id"]} for b in briefs]
    await db.business_page_versions.delete_many({"business_id": business_id, "status": "candidate"})
    if docs:
        await db.business_page_versions.insert_many(docs)
    await db.businesses.update_one({"_id": business_id}, {"$set": {"page_generation": generation}})
    return {"versions": [_view(d, user.get("role") == "admin") for d in docs]}


@router.post("/businesses/{business_id}/page-versions/{version_id}/publish")
async def publish_version(business_id: str, version_id: str, user=Depends(verify_token)):
    """Start the visual check on this version (restoring an archived one is
    the same: it is checked again, since effects may have changed since).
    The page that is live stays live until the check passes."""
    from utils.page_versions import can_publish, new_preview_token
    biz = await _owned_v3(business_id, user)
    v = await db.business_page_versions.find_one({"_id": version_id, "business_id": business_id})
    if not v:
        raise HTTPException(status_code=404, detail="Version not found")
    now = datetime.now(UTC)
    why = can_publish(v, now)
    if why:
        raise HTTPException(status_code=409, detail=why)
    # One version under check at a time, or two passes could race to be live.
    async for other in db.business_page_versions.find(
            {"business_id": business_id, "status": "checking", "_id": {"$ne": version_id}}):
        if can_publish(other, now):   # still within its check window
            raise HTTPException(status_code=409, detail="Another version is being checked")
    # Another page in the category may have gone live since this one was
    # made; a version that is now too close to it is not checked at all.
    from routes.marketplace.businesses import _brief_category, recent_briefs
    from utils.page_versions import TOO_CLOSE, too_close
    if too_close(v["brief"], await recent_briefs(_brief_category(biz), business_id)):
        raise HTTPException(status_code=409, detail=f"This version is {TOO_CLOSE.split(' (')[0]}. Make new versions to choose from.")
    token, preview = new_preview_token(now)
    await db.business_page_versions.update_one({"_id": version_id}, {"$set": {
        "status": "checking", "checking_since": now.isoformat(), "preview": preview, "failures": [],
    }})
    from utils.page_check_client import request_check
    sent = await request_check(biz, version_id, token)
    out: dict[str, Any] = {"id": version_id, "status": "checking", "check_requested": sent}
    if not sent and user.get("role") == "admin":
        # No check service configured: the admin runs the check locally
        # (scripts/check-page-v3.mjs) against ?pv=<token> and records it.
        out["preview_token"] = token
    return out


class VersionCheckIn(BaseModel):
    passed: bool
    failures: list[str] = Field(default_factory=list, max_length=60)


@router.post("/businesses/{business_id}/page-versions/{version_id}/check")
async def record_version_check(
    business_id: str, version_id: str, payload: VersionCheckIn,
    x_page_check_secret: Optional[str] = Header(default=None),
    viewer=Depends(optional_user),
):
    """The visual check's verdict on a version being checked: from the
    page-check service (its shared secret), or an admin. A pass makes the
    version live and archives the one before; a fail keeps the live page and
    tells the owner why."""
    from utils.page_versions import check_secret_ok
    service = check_secret_ok(x_page_check_secret)
    if not service and (viewer or {}).get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only the page check can record this")
    biz = await _business(business_id)
    v = await db.business_page_versions.find_one({"_id": version_id, "business_id": business_id})
    if not v:
        raise HTTPException(status_code=404, detail="Version not found")
    if v.get("status") != "checking":
        raise HTTPException(status_code=409, detail="This version is not being checked")
    now = datetime.now(UTC).isoformat()
    passed = payload.passed and not payload.failures
    by = "page-check" if service else (viewer or {}).get("user_id")
    done = {"checked_at": now, "failures": payload.failures, "checking_since": None, "preview": None}
    failures = list(payload.failures)
    if passed:
        # Checked again at the moment it would go live: another page in the
        # category may have gone live while this one was being rendered.
        from routes.marketplace.businesses import _brief_category, recent_briefs
        from utils.page_versions import TOO_CLOSE, too_close
        if too_close(v["brief"], await recent_briefs(_brief_category(biz), business_id)):
            passed, failures = False, [f"This version is {TOO_CLOSE}"]
    if not passed:
        await db.business_page_versions.update_one(
            {"_id": version_id}, {"$set": {**done, "failures": failures, "status": "failed"}})
        return {"id": version_id, "status": "failed", "failures": failures}

    history = ([biz["design_brief"]] if biz.get("design_brief") else []) + list(biz.get("design_brief_history") or [])
    await db.businesses.update_one({"_id": business_id}, {"$set": {
        "design_brief": v["brief"], "design_brief_at": now, "design_brief_history": history[:5],
        "page_check": {"brief_at": now, "passed": True, "failures": [], "checked_at": now, "by": by},
        "updated_at": now,
    }})
    await db.business_page_versions.update_many(
        {"business_id": business_id, "status": "live"}, {"$set": {"status": "archived"}})
    await db.business_page_versions.update_one(
        {"_id": version_id}, {"$set": {**done, "status": "live", "published_at": now}})
    # Archived versions beyond the last few are dropped: restoring a page
    # from long ago is not a promise worth unbounded storage.
    old = db.business_page_versions.find(
        {"business_id": business_id, "status": "archived"}, {"_id": 1}).sort("created_at", -1).skip(KEEP_ARCHIVED)
    stale = [d["_id"] async for d in old]
    if stale:
        await db.business_page_versions.delete_many({"_id": {"$in": stale}})
    return {"id": version_id, "status": "live"}
