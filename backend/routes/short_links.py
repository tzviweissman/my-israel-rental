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
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from routes.deps import db, verify_token

router = APIRouter()

# Where the public site lives. A printed QR encodes the WHOLE URL, domain
# included, so myisraelrental.com/p/... must keep resolving for as long as
# a single printed sign exists — this is a permanent commitment, recorded
# in docs/qr-and-short-links-spec.md, not an implementation detail.
import os
_SITE_ORIGIN = (os.environ.get("PUBLIC_SITE_ORIGIN") or "https://myisraelrental.com").rstrip("/")

# No 0/O, no 1/l/I. Someone reading a slug off a printed sign should not
# have to guess which character they are looking at.
_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
_SLUG_LEN = 7

# The only things a short link may point at. Every one is a page that is
# already public to anyone holding the URL, which is the entire security
# argument for allowing a guessable slug.
_PUBLIC_TARGETS = {
    "manager": "/manager/{id}",
    # Singular, and load-bearing: /property/{id} is the detail page;
    # /properties/{type} (plural) is the CATEGORY BROWSER, which would
    # treat a UUID as a rental type and show nothing. Caught before the
    # first property slug was minted — and slugs are permanent, so a wrong
    # path here would have been wrong on printed signs forever.
    "property": "/property/{id}",
    "business": "/business/{id}",
}


# Link-preview crawlers follow these redirects every time a /p/ link is
# pasted into a chat — WhatsApp alone fetches from several servers. A
# preview fetch is not a person, and "Scanned 34 times" must mean people
# (spec Q2: real numbers only). Redirect them, never count them.
_PREVIEW_BOTS = (
    "facebookexternalhit",  # Facebook, and WhatsApp link previews
    "whatsapp",
    "twitterbot",
    "telegrambot",
    "linkedinbot",
    "slackbot",
    "discordbot",
    "skypeuripreview",
    "pinterestbot",
)


def _is_preview_bot(request: Request) -> bool:
    ua = (request.headers.get("user-agent") or "").lower()
    return any(bot in ua for bot in _PREVIEW_BOTS)


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
        # The last 30 Israel-calendar days, zero-filled, oldest first — the
        # shape a bar chart wants, so the client never has to reason about
        # missing keys or timezones.
        "daily": _last_30_days(doc.get("daily") or {}),
    }


def _last_30_days(buckets: dict[str, int]) -> list[dict[str, int | str]]:
    today = datetime.now(_IL_TZ).date()
    out = []
    for i in range(29, -1, -1):
        day = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        out.append({"date": day, "count": int(buckets.get(day, 0))})
    return out


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
async def resolve_short_link(slug: str, request: Request):
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
    doc = await _counted_lookup(slug, request)
    if not doc:
        raise HTTPException(status_code=404, detail="Unknown short link")
    # `src=qr` so existing analytics can separate scan traffic from a link
    # someone pasted into a chat.
    return {"target": f"{_canonical_path(doc['target_type'], doc['target_id'])}?src=qr"}


# Scans are bucketed by ISRAEL's calendar day, not the server's. The owner
# taped the sign to a wall in Jerusalem; a scan at 23:30 their time must
# not appear under "tomorrow" because the server counts midnights in UTC.
_IL_TZ = ZoneInfo("Asia/Jerusalem")


def _today_bucket() -> str:
    return datetime.now(_IL_TZ).strftime("%Y-%m-%d")


async def _counted_lookup(slug: str, request: Request):
    """The link doc, with the scan counted — unless a preview bot asked.

    Alongside the total, each scan increments a per-day bucket
    (`daily.YYYY-MM-DD`) so the dashboard can draw scans over time. One key
    per active day — bounded, and no separate events collection to groom.
    Days before this shipped have no buckets; the chart starts at zero
    history rather than inventing any (real numbers only).
    """
    if _is_preview_bot(request):
        return await db.short_links.find_one({"slug": slug})
    return await db.short_links.find_one_and_update(
        {"slug": slug},
        {
            "$inc": {"scan_count": 1, f"daily.{_today_bucket()}": 1},
            "$set": {"last_scanned_at": datetime.now(UTC).isoformat()},
        },
    )


@router.get("/short-links/{slug}/follow")
async def follow_short_link(slug: str, request: Request):
    """Count the scan and 302 to the destination — the true redirect.

    In production, `serve` rewrites the brand domain's /p/{slug} straight
    here (frontend/public/serve.json), so the whole chain is real HTTP
    redirects and no interstitial ever renders: link-preview crawlers
    (WhatsApp, Facebook — none of which run JS) follow through to the
    canonical page, exactly as if the long URL had been shared. The
    /resolve endpoint above stays as the dev-server and belt-and-braces
    fallback behind the React /p/:slug route.

    302 and not 301, deliberately: a 301 gets cached by browsers and
    crawlers, and every hop a cache absorbs is a scan the owner never
    sees counted.
    """
    doc = await _counted_lookup(slug, request)
    if not doc:
        # A guessed or mistyped slug still lands somewhere sensible.
        return RedirectResponse(url=_SITE_ORIGIN, status_code=302)
    target = f"{_SITE_ORIGIN}{_canonical_path(doc['target_type'], doc['target_id'])}?src=qr"
    return RedirectResponse(url=target, status_code=302)
