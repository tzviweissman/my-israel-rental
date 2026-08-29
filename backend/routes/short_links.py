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
import html

from fastapi.responses import HTMLResponse, RedirectResponse
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
    # The site itself, for advertising it. `target_id` is a campaign label
    # rather than a record id, so one code can be printed on a flyer and
    # another used in an ad and each carries its OWN scan count — which is
    # the whole point of putting a code on an advert. "home" is the plain
    # one. The label never appears in the URL a scanner sees; it only
    # separates the counters.
    "site": "/",
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
    if target_type == "site":
        # The site belongs to whoever runs it. Anyone else minting these
        # would be attaching their own counters to the front page.
        if user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin only")
    elif target_type == "manager":
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


async def _preview_meta(target_type: str, target_id: str) -> dict[str, str]:
    """Title, description and image for a link-preview card.

    Real data only: whatever the record actually has. A business with no
    description gets its category and area, not an invented sentence.
    """
    site_img = f"{_SITE_ORIGIN}/brand-logo.png"
    if target_type == "business":
        # `previous_slugs` too, and this is the whole point of the route.
        #
        # A renamed business keeps serving its old links: the page lookup
        # (marketplace/businesses.py) falls back to the retired slug, so a
        # customer clicking a link shared months ago still lands on the
        # right page. This query did not, so the SAME url rendered the
        # correct page with a generic "MyIsraelRental" card — the exact
        # failure the preview route exists to fix, on the exact links most
        # likely to be re-shared.
        #
        # Ordering matters and mirrors the page lookup: a live slug always
        # beats a retired one. `$or` cannot express that, so the fallback
        # is a second query rather than another clause.
        fields = {"name": 1, "description": 1, "logo_url": 1, "cover_url": 1,
                  "categories": 1, "areas": 1, "_id": 1}
        biz = (
            await db.businesses.find_one({"_id": target_id}, fields)
            or await db.businesses.find_one({"slug": target_id}, fields)
            or await db.businesses.find_one({"previous_slugs": target_id}, fields)
        )
        if biz:
            desc = (biz.get("description") or "").strip()
            if not desc:
                bits = [(biz.get("categories") or [None])[0], ", ".join(biz.get("areas") or [])]
                desc = " · ".join(b for b in bits if b) or "On MyIsraelRental"
            # Cover FIRST. A share card is 1200x630; a logo on that is a
            # small mark on a large empty field, whereas the cover is a
            # photograph chosen to be the face of the business. Logo is the
            # fallback, not the preference.
            img = biz.get("cover_url") or biz.get("logo_url")
            if not img:
                gig = await db.marketplace_gigs.find_one(
                    {"business_id": biz["_id"], "status": "published", "gallery.0": {"$exists": True}},
                    {"gallery": 1},
                )
                img = (gig or {}).get("gallery", [None])[0]
            return {
                "title": biz.get("name") or "MyIsraelRental",
                "description": desc[:200],
                "image": img or site_img,
            }
    elif target_type == "property":
        prop = await db.properties.find_one(
            {"id": target_id}, {"title": 1, "area": 1, "images": 1, "_id": 0},
        )
        if prop:
            return {
                "title": prop.get("title") or "MyIsraelRental",
                "description": prop.get("area") or "On MyIsraelRental",
                "image": (prop.get("images") or [site_img])[0],
            }
    return {
        "title": "MyIsraelRental",
        "description": "Rentals and local businesses across Israel.",
        "image": site_img,
    }


def _preview_html(meta: dict[str, str], target: str, *, refresh: bool = True) -> str:
    """A tiny page whose only job is to carry OG tags to a crawler.

    Needed because the front end is a static CRA bundle: react-helmet
    writes its tags in the BROWSER, and no link-preview crawler runs
    JavaScript, so every business page was served the same generic
    index.html - same title, same logo, business name absent. Every
    business on the site shared one preview card.

    Only crawlers ever see this. People are still 302'd, so nothing about
    the human path changes. The meta refresh and the visible link are
    belt-and-braces for anything that renders the body instead.
    """
    e = html.escape
    # A refresh to the URL you are already on is a reload loop. Served from
    # /p/{slug} the target is elsewhere and the refresh is a useful
    # fallback; served AT the canonical page it must be left out.
    refresh_tag = (
        f'<meta http-equiv="refresh" content="0;url={e(target)}"/>' if refresh else ""
    )
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>{e(meta["title"])}</title>
<meta name="description" content="{e(meta["description"])}"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="MyIsraelRental"/>
<meta property="og:title" content="{e(meta["title"])}"/>
<meta property="og:description" content="{e(meta["description"])}"/>
<meta property="og:image" content="{e(meta["image"])}"/>
<meta property="og:url" content="{e(target)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="{e(meta["title"])}"/>
<meta name="twitter:description" content="{e(meta["description"])}"/>
<meta name="twitter:image" content="{e(meta["image"])}"/>
{refresh_tag}
</head>
<body><a href="{e(target)}">{e(meta["title"])}</a></body>
</html>"""


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

    # Crawlers get real OG tags instead of a redirect into a JS bundle
    # they will not execute. People still get the 302.
    if _is_preview_bot(request):
        meta = await _preview_meta(doc["target_type"], doc["target_id"])
        return HTMLResponse(content=_preview_html(meta, target))

    return RedirectResponse(url=target, status_code=302)


@router.get("/og/business/{slug_or_id}", response_class=HTMLResponse)
async def business_link_preview(slug_or_id: str):
    """OG tags for a business, for whatever is serving /business/{slug}.

    WHY THIS EXISTS SEPARATELY FROM /p/{slug}

    A short link works because it is a REDIRECT: a crawler asks the backend
    for /p/{slug}, and the backend can tell a crawler from a person and
    answer each differently. The raw /business/{slug} URL has no such hop.
    It is served by the static frontend, which hands every caller the same
    CRA index.html — and no link-preview crawler runs JavaScript, so
    react-helmet's tags never exist for them. Every business on the site
    shared one generic card, and the raw URL is the one owners actually
    paste, because it is the one they see in their address bar.

    The static host cannot vary on user-agent, so the decision is made by
    the small server in front of the build (`frontend/server.js`), which
    calls this for crawlers only. This endpoint holds no policy of its own:
    it renders the same metadata, from the same builder, as the short-link
    card, so the two can never disagree about how a business looks when
    shared.

    Public and cacheable. It exposes nothing that /business/{slug} does not
    already show to anyone holding the URL.
    """
    meta = await _preview_meta("business", slug_or_id)
    target = f"{_SITE_ORIGIN}/business/{slug_or_id}"
    return HTMLResponse(
        # No refresh: the crawler is already at the canonical URL, and a
        # refresh pointing back at it would loop for anything that renders
        # the page rather than just reading its head.
        content=_preview_html(meta, target, refresh=False),
        headers={
            # Crawlers refetch on every paste, and a business's name and
            # cover change rarely. Five minutes is short enough that an
            # owner who just set a cover photo sees it on their next share.
            "Cache-Control": "public, max-age=300",
        },
    )
