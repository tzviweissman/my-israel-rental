"""Short links — `/p/{slug}` instead of a 36-character UUID (spec Q1).

The share URL was `/manager/e1134e55-f176-44e2-b64e-2abb26347c8c`. As a QR
payload that is dense enough to need printing large, and it fails at an
angle or in poor light; as something read off a sign and typed by hand it
is hopeless.

Two rules here are load-bearing, and both concern things that cannot be
undone once they leave the building:

  1. A slug is SHORT and therefore GUESSABLE. It may only ever point at
     content that is already public. Never mint one for a contract, a
     dashboard, or a chat thread — `_PUBLIC_TARGETS` is the entire list of
     what may be pointed at, and anything absent from it is refused.
  2. A slug is PERMANENT. Printed codes cannot be recalled, so a slug is
     minted once per target and reused forever. There is deliberately no
     endpoint that regenerates or deletes one.
"""
from __future__ import annotations

import secrets
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from routes.deps import db, verify_token

router = APIRouter()

# No 0/O, no 1/l/I. Someone reading a slug off a printed sign should not
# have to guess which character they are looking at.
_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
_SLUG_LEN = 7

# The only things a short link may point at. Every one is a page that is
# already public to anyone holding the URL, which is the entire security
# argument for allowing a guessable slug.
_PUBLIC_TARGETS = {
    "manager": "/manager/{id}",
    "property": "/properties/{id}",
    "business": "/business/{id}",
}


class ShortLinkIn(BaseModel):
    target_type: str
    target_id: str


def _canonical_path(target_type: str, target_id: str) -> str:
    return _PUBLIC_TARGETS[target_type].format(id=target_id)


async def _new_slug() -> str:
    """A slug not already taken. Collisions are vanishingly unlikely at
    57^7, but 'unlikely' is not 'handled' — and a collision would hand one
    owner's printed code to another owner's page."""
    for _ in range(12):
        slug = "".join(secrets.choice(_ALPHABET) for _ in range(_SLUG_LEN))
        if not await db.short_links.find_one({"slug": slug}, {"_id": 1}):
            return slug
    raise HTTPException(status_code=500, detail="Could not allocate a short link")


async def _assert_owns_target(target_type: str, target_id: str, user: dict[str, Any]) -> None:
    """Only mint a link for something the caller actually owns.

    Not a confidentiality control — these pages are public either way —
    but minting is a write, and letting anyone create rows keyed to another
    person's content is how a collection becomes a spam target.
    """
    uid = user["user_id"]
    if target_type == "manager":
        if target_id != uid:
            raise HTTPException(status_code=403, detail="Not your manager page")
    elif target_type == "property":
        prop = await db.properties.find_one({"id": target_id}) or await db.properties.find_one(
            {"_id": target_id},
        )
        if not prop:
            raise HTTPException(status_code=404, detail="Property not found")
        if prop.get("owner_id") != uid and user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Not your property")
    elif target_type == "business":
        biz = await db.businesses.find_one({"_id": target_id})
        if not biz:
            raise HTTPException(status_code=404, detail="Business not found")
        if biz.get("owner_user_id") != uid and user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Not your business")


async def ensure_short_link(target_type: str, target_id: str, owner_user_id: str) -> dict[str, Any]:
    """The link for this target, created on first ask and reused after.

    Lazily, per the spec: most listings are never shared, and minting a row
    for every one of them would leave a collection full of slugs nobody has
    ever seen.
    """
    if target_type not in _PUBLIC_TARGETS:
        raise HTTPException(status_code=400, detail=f"Unsupported target type: {target_type}")

    existing = await db.short_links.find_one({"target_type": target_type, "target_id": target_id})
    if existing:
        return existing

    slug = await _new_slug()
    doc = {
        "_id": slug,
        "slug": slug,
        "target_type": target_type,
        "target_id": target_id,
        "owner_user_id": owner_user_id,
        "created_at": datetime.now(UTC).isoformat(),
        "scan_count": 0,
        "last_scanned_at": None,
    }
    await db.short_links.insert_one(doc)
    return doc


def _public(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "slug": doc["slug"],
        "path": f"/p/{doc['slug']}",
        "target_type": doc["target_type"],
        "target_id": doc["target_id"],
        "canonical_path": _canonical_path(doc["target_type"], doc["target_id"]),
        # Q2: a real number or an explicit zero. Never an estimate, and
        # never omitted — the UI has to be able to say "not scanned yet"
        # rather than leave a blank where a number should be.
        "scan_count": doc.get("scan_count", 0),
        "last_scanned_at": doc.get("last_scanned_at"),
    }


@router.post("/short-links")
async def create_short_link(payload: ShortLinkIn, user=Depends(verify_token)):
    """Mint (or return) the link for a target the caller owns."""
    if payload.target_type not in _PUBLIC_TARGETS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported target type: {payload.target_type}",
        )
    await _assert_owns_target(payload.target_type, payload.target_id, user)
    doc = await ensure_short_link(payload.target_type, payload.target_id, user["user_id"])
    return _public(doc)


@router.get("/short-links/{slug}")
async def get_short_link(slug: str, user=Depends(verify_token)):
    """Read one back, for the dashboard's scan count."""
    doc = await db.short_links.find_one({"slug": slug})
    if not doc:
        raise HTTPException(status_code=404, detail="Unknown short link")
    if doc.get("owner_user_id") != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your link")
    return _public(doc)


@router.get("/short-links/{slug}/resolve")
async def resolve_short_link(slug: str):
    """Count the scan and hand back the destination.

    The count happens HERE, when the link is followed — not when the
    destination renders. A visitor who bounces, or a target that 404s,
    still represents someone who scanned the code, and that is the number
    an owner means when they ask whether the sign worked.

    Used by the front end's `/p/:slug` route: the brand domain resolves to
    the static frontend, which cannot itself issue a 302, so the browser
    performs the redirect after this call. The counting stays server-side
    and still happens on the follow.
    """
    doc = await db.short_links.find_one_and_update(
        {"slug": slug},
        {"$inc": {"scan_count": 1}, "$set": {"last_scanned_at": datetime.now(UTC).isoformat()}},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Unknown short link")
    # `src=qr` so existing analytics can separate scan traffic from a link
    # someone pasted into a chat.
    return {"target": f"{_canonical_path(doc['target_type'], doc['target_id'])}?src=qr"}
