"""Page builder v3: the versions of a business's page an owner chooses from
(Tzvi, 6 Oct 2026: "owners pick from three versions, from the start").

A version is one design brief and where it stands:

    candidate  generated, shown to the owner, not checked
    checking   the owner picked it; the visual check is rendering it
    failed     the check found problems; the page that was live stays live
    live       what visitors see (the business record holds the same brief)
    archived   live once; can be restored, which checks it again

Rules only, no I/O, so every rule is testable without a server. The routes
are routes/marketplace/page_versions.py; the check that decides between
"failed" and "live" is the page-check service (plan step 8), or an admin
running scripts/check-page-v3.mjs.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta
from typing import Optional

from utils.design_brief import build_brief, effects_seed
from utils.page_effects import check_effect_unique, effect_fingerprint

STATUSES = ("candidate", "checking", "failed", "live", "archived")
CANDIDATES = 3
# A preview link lives long enough for the check to render the page at every
# size, and no longer: it shows a page that is not live yet.
PREVIEW_TTL = timedelta(minutes=30)
# A version checking for longer than this was dropped by the check (a
# restart, a crash); it may be published again.
CHECK_TIMEOUT = timedelta(minutes=10)
PUBLISHABLE = ("candidate", "failed", "archived")


TOO_CLOSE = ("too much like another page that went live since it was made "
             "(too close to a recent live page)")


def too_close(brief: dict, recent: list[dict]) -> bool:
    """Fails "not too similar" against the recent live pages of its category
    (page_effects.MIN_AXES of seven axes against each of the newest ten)."""
    fp = effect_fingerprint(brief.get("effects") or [], brief.get("showstopper") or "hero")
    others = [effect_fingerprint(r.get("effects") or [], r.get("showstopper") or "hero") for r in recent]
    return not check_effect_unique(fp, others)["passed"]


def candidates(record: dict, logo: Optional[bytes], photos: list[dict], recent: list[dict],
               generation: int) -> list[dict]:
    """Up to three briefs for the owner to choose from. Each has a different
    bold moment, or the choice would be between near-identical pages; beyond
    that they may share touches. Each passes "not too similar" against the
    recent live pages of the category: the picker keeps its nearest miss
    when nothing passes, and an owner is never offered a page that would be
    refused at publish. A business with fewer bold moments, or a crowded
    category, gets fewer versions."""
    out, shown = [], set()
    for n in range(CANDIDATES * 3):
        if len(out) == CANDIDATES:
            break
        brief = build_brief(record, logo, photos, recent=recent,
                            seed=effects_seed(record, generation * CANDIDATES * 3 + n), avoid_peaks=shown)
        if brief.showstopper in shown:
            break   # no bold moment left that is not already offered
        if too_close(brief.model_dump(), recent):
            continue
        shown.add(brief.showstopper)
        out.append(brief.model_dump())
    return out


def can_publish(version: dict, now: datetime) -> Optional[str]:
    """Why this version cannot be published now, or None if it can."""
    status = version.get("status")
    if status == "checking":
        since = version.get("checking_since")
        if since and now - datetime.fromisoformat(since) > CHECK_TIMEOUT:
            return None
        return "This version is being checked"
    if status == "live":
        return "This version is already live"
    if status not in PUBLISHABLE:
        return f"A {status} version cannot be published"
    return None


def new_preview_token(now: datetime) -> tuple[str, dict]:
    """A preview link token, and what is stored for it: only its hash, so a
    leaked database cannot be turned into preview links."""
    token = secrets.token_urlsafe(32)
    return token, {"hash": token_hash(token), "expires": (now + PREVIEW_TTL).isoformat()}


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def preview_ok(version: dict, token: str, now: datetime) -> bool:
    """The token opens this version, and only until it expires."""
    stored = version.get("preview") or {}
    if not token or not stored.get("hash") or not stored.get("expires"):
        return False
    if now >= datetime.fromisoformat(stored["expires"]):
        return False
    return hmac.compare_digest(stored["hash"], token_hash(token))


def owners_may_choose() -> bool:
    """OWNER_PAGE_VERSIONS_ENABLED, off by default (Tzvi, 8 Oct 2026: "i dont
    want owners to be able to build pages with ai yet i want to fine tune the
    ai page builder rules"). Off: only an admin makes, publishes or restores
    versions, and an owner's editor shows nothing. Read per call, like
    PAGE_BUILDER_V3_ENABLED, so turning it on needs no code change."""
    return os.environ.get("OWNER_PAGE_VERSIONS_ENABLED", "").strip().lower() in ("1", "true", "yes")


def check_secret_ok(given: Optional[str]) -> bool:
    """The page-check service's shared secret, compared in constant time.
    No secret configured means the service path is off, never open."""
    expected = os.environ.get("PAGE_CHECK_SECRET", "")
    return bool(expected) and bool(given) and hmac.compare_digest(expected.encode(), given.encode())
