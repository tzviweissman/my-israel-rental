"""Importing a business's own Google reviews (Business Profile APIs).

All or nothing: every review of every location the owner maps comes in,
and the owner cannot pick. Imported text and ratings are never edited
here; the daily sync overwrites them with what Google has.

TODO(legal): confirm the Google Business Profile API terms allow showing
these reviews on a third-party site, and what attribution they require.
The cards say "From Google" and link back; that may not be enough.

TODO(legal): Google's API Services User Data Policy on data the owner
revokes. On disconnect we hide every imported review at once and revoke
the token (Tzvi, 23 Sep 2026); check whether the stored copies must also
be deleted within a set time.

The HTTP calls go through `http`, an httpx.AsyncClient-like object, so the
tests pass a fake and never reach Google.
"""
from __future__ import annotations

import os
from typing import Any
from urllib.parse import urlencode

from cryptography.fernet import Fernet, InvalidToken

from utils.reviews import audit, clean_text, now_iso, remove_review

SCOPE = "https://www.googleapis.com/auth/business.manage"
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
REVOKE_URL = "https://oauth2.googleapis.com/revoke"
ACCOUNTS_URL = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts"
LOCATIONS_URL = "https://mybusinessbusinessinformation.googleapis.com/v1/{account}/locations"
REVIEWS_URL = "https://mybusiness.googleapis.com/v4/{location}/reviews"

STARS = {"ONE": 1, "TWO": 2, "THREE": 3, "FOUR": 4, "FIVE": 5}


class GoogleError(Exception):
    pass


# ---------------------------------------------------------------- config

def configured() -> bool:
    return all(os.environ.get(k) for k in ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "REVIEWS_TOKEN_ENCRYPTION_KEY"))


def redirect_uri() -> str:
    base = (os.environ.get("PLATFORM_PUBLIC_URL") or "https://myisraelrental.com").rstrip("/")
    return os.environ.get("GOOGLE_REVIEWS_REDIRECT_URI") or f"{base}/api/reviews/google/callback"


def _fernet() -> Fernet:
    return Fernet(os.environ["REVIEWS_TOKEN_ENCRYPTION_KEY"].encode())


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken as e:
        raise GoogleError("stored token can't be decrypted (key changed?)") from e


def auth_url(state: str) -> str:
    return AUTH_URL + "?" + urlencode({
        "client_id": os.environ["GOOGLE_CLIENT_ID"], "redirect_uri": redirect_uri(),
        "response_type": "code", "scope": SCOPE, "access_type": "offline",
        "prompt": "consent", "include_granted_scopes": "true", "state": state,
    })


# ---------------------------------------------------------------- OAuth

async def exchange_code(http, code: str) -> dict:
    r = await http.post(TOKEN_URL, data={
        "code": code, "client_id": os.environ["GOOGLE_CLIENT_ID"],
        "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
        "redirect_uri": redirect_uri(), "grant_type": "authorization_code",
    })
    if r.status_code != 200:
        raise GoogleError(f"code exchange failed ({r.status_code})")
    return r.json()


async def access_token(http, refresh_token: str) -> str:
    r = await http.post(TOKEN_URL, data={
        "refresh_token": refresh_token, "client_id": os.environ["GOOGLE_CLIENT_ID"],
        "client_secret": os.environ["GOOGLE_CLIENT_SECRET"], "grant_type": "refresh_token",
    })
    if r.status_code != 200:
        raise GoogleError(f"token refresh failed ({r.status_code})")
    return r.json()["access_token"]


async def revoke(http, refresh_token: str) -> None:
    try:
        await http.post(REVOKE_URL, data={"token": refresh_token})
    except Exception:  # noqa: BLE001 - disconnecting must not depend on Google answering
        pass


async def _get(http, url: str, token: str, params: dict | None = None) -> dict:
    r = await http.get(url, headers={"Authorization": f"Bearer {token}"}, params=params or {})
    if r.status_code != 200:
        raise GoogleError(f"GET {url.split('?')[0]} -> {r.status_code}")
    return r.json()


async def list_locations(http, token: str) -> list[dict]:
    """Every location the owner can manage: [{name, title, address, maps_uri}],
    with `name` in the accounts/{a}/locations/{l} form the reviews API wants."""
    out: list[dict] = []
    accounts: list[dict] = []
    page = None
    while True:
        data = await _get(http, ACCOUNTS_URL, token, {"pageToken": page} if page else None)
        accounts += data.get("accounts") or []
        page = data.get("nextPageToken")
        if not page:
            break
    for acc in accounts:
        page = None
        while True:
            params = {"readMask": "name,title,storefrontAddress,metadata", "pageSize": 100}
            if page:
                params["pageToken"] = page
            data = await _get(http, LOCATIONS_URL.format(account=acc["name"]), token, params)
            for loc in data.get("locations") or []:
                addr = loc.get("storefrontAddress") or {}
                out.append({
                    "name": f"{acc['name']}/{loc['name']}",
                    "title": loc.get("title") or "",
                    "address": ", ".join([*(addr.get("addressLines") or []), addr.get("locality") or ""]).strip(", "),
                    "maps_uri": (loc.get("metadata") or {}).get("mapsUri"),
                })
            page = data.get("nextPageToken")
            if not page:
                break
    return out


async def fetch_all_reviews(http, token: str, location: str) -> list[dict]:
    """Every review of one location, following pageToken to the end."""
    out: list[dict] = []
    page = None
    while True:
        params = {"pageSize": 50}
        if page:
            params["pageToken"] = page
        data = await _get(http, REVIEWS_URL.format(location=location), token, params)
        out += data.get("reviews") or []
        page = data.get("nextPageToken")
        if not page:
            return out


# ---------------------------------------------------------------- sync

def map_review(g: dict) -> dict:
    """Google's review resource -> our fields. Only these are ever written
    from Google; nothing on our side edits them."""
    reply = g.get("reviewReply") or None
    reviewer = g.get("reviewer") or {}
    return {
        "external_id": g["name"],
        "author_display_name": "Google user" if reviewer.get("isAnonymous") else (reviewer.get("displayName") or "Google user"),
        "rating": STARS.get(g.get("starRating"), 0),
        "text": clean_text(g.get("comment") or ""),
        "source_created_at": g.get("createTime"),
        "source_updated_at": g.get("updateTime") or g.get("createTime"),
        "owner_response": {"text": clean_text(reply.get("comment")), "created_at": reply.get("updateTime"),
                           "updated_at": reply.get("updateTime")} if reply and reply.get("comment") else None,
    }


async def sync_location(db, http, token: str, mapping: dict, owner_user_id: str) -> dict:
    """Upsert every review of one mapped location. Idempotent: keyed on
    (source="google", external_id=review.name), so running twice changes
    nothing. A review we hold that Google no longer returns is removed as
    deleted_at_source, but only after the whole fetch succeeded: a failed
    page must never read as "everything was deleted"."""
    fetched = await fetch_all_reviews(http, token, mapping["location"])
    target = {"listing_id": mapping.get("listing_id"), "listing_kind": mapping.get("listing_kind"),
              "business_id": mapping.get("business_id")}
    seen: set[str] = set()
    added = updated = 0
    for g in fetched:
        if STARS.get(g.get("starRating")) is None:
            continue  # STAR_RATING_UNSPECIFIED: nothing to show
        m = map_review(g)
        seen.add(m["external_id"])
        existing = await db.reviews.find_one({"source": "google", "external_id": m["external_id"]})
        now = now_iso()
        if not existing:
            await db.reviews.insert_one({
                "_id": os.urandom(16).hex(), **target, **m, "owner_user_ids": [owner_user_id],
                "google_location": mapping["location"], "source": "google", "verified": False,
                "booking_id": None, "booking_kind": None, "author_user_id": None, "sub_ratings": None,
                "stay_start": None, "stay_end": None, "external_url": mapping.get("maps_uri"),
                "status": "published", "removal_reason": None, "incentivized": False,
                "source_connected": True, "created_at": now, "updated_at": now,
            })
            added += 1
            continue
        patch = {**target, **m, "external_url": mapping.get("maps_uri"), "google_location": mapping["location"],
                 "owner_user_ids": [owner_user_id], "source_connected": True}
        if existing.get("status") == "removed" and existing.get("removal_reason") == "deleted_at_source":
            patch.update(status="published", removal_reason=None)  # back on Google
        if any(existing.get(k) != v for k, v in patch.items()):
            patch["updated_at"] = now
            await db.reviews.update_one({"_id": existing["_id"]}, {"$set": patch})
            if existing.get("status") != patch.get("status", existing.get("status")):
                await audit(db, existing["_id"], "restore_at_source", None, existing, {**existing, **patch})
            updated += 1
    removed = 0
    async for gone in db.reviews.find({"source": "google", "google_location": mapping["location"],
                                       "external_id": {"$nin": list(seen)}, "status": {"$ne": "removed"}}):
        await remove_review(db, gone["_id"], None, "deleted_at_source", system=True)
        removed += 1
    return {"fetched": len(fetched), "added": added, "updated": updated, "removed": removed}


async def sync_connection(db, http, conn: dict) -> dict:
    token = await access_token(http, decrypt(conn["refresh_token_enc"]))
    totals = {"fetched": 0, "added": 0, "updated": 0, "removed": 0}
    for mapping in conn.get("mappings") or []:
        res = await sync_location(db, http, token, mapping, conn["user_id"])
        for k in totals:
            totals[k] += res[k]
    # A location the owner un-mapped: its reviews come off the page with it.
    await db.reviews.update_many(
        {"source": "google", "owner_user_ids": conn["user_id"],
         "google_location": {"$nin": [m["location"] for m in conn.get("mappings") or []]}},
        {"$set": {"source_connected": False, "updated_at": now_iso()}})
    await db.google_review_connections.update_one({"_id": conn["_id"]}, {"$set": {"last_synced_at": now_iso(), "last_error": None}})
    return totals


async def set_connected(db, owner_user_id: str, connected: bool, actor_id: str | None) -> int:
    """Disconnect hides every imported review of this owner at once; a
    reconnect's first sync shows them again. Status is left alone, so a
    moderation decision survives a disconnect."""
    n = 0
    async for r in db.reviews.find({"source": "google", "owner_user_ids": owner_user_id,
                                    "source_connected": {"$ne": connected}}):
        await db.reviews.update_one({"_id": r["_id"]}, {"$set": {"source_connected": connected, "updated_at": now_iso()}})
        await audit(db, r["_id"], "connect" if connected else "disconnect", actor_id, r, {**r, "source_connected": connected})
        n += 1
    return n


def listing_target(kind: str, target_id: str, business_id: Any = None) -> dict[str, Any]:
    if kind == "business":
        return {"listing_id": None, "listing_kind": None, "business_id": target_id}
    return {"listing_id": target_id, "listing_kind": kind, "business_id": business_id}
