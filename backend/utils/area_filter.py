"""Helpers for area / neighborhood filtering.

The area dropdown sends values shaped like ``"<City> - <Neighborhood>"`` (e.g.
``"Jerusalem - Sanhedria"``), but the DB sometimes stores legacy bare
neighborhood names (``"Sanhedria"``) or transliteration variants such as
``"Sanhedria Murhevet"`` / ``"Sanhedria Murchevet"``.

A naive case-insensitive substring match collapses across cities — a user
picking ``"Jerusalem - Old City"`` would also match ``"Beersheba - Old City"``
or ``"Tel Aviv - City Center"`` would match every city's "City Center".

`area_mongo_query` builds an anchored regex that:
  * accepts the canonical ``"<City> - <Neighborhood>"`` form, OR
  * accepts a bare neighborhood (legacy data), AND
  * accepts known street-name / colloquial **aliases** (``Levi Eshkol`` →
    ``Ramat Eshkol``) from ``utils.locations_catalog.NEIGHBORHOOD_ALIASES``,
    AND
  * matches longer suffixes (so ``Sanhedria`` keeps catching
    ``Sanhedria Murhevet``), BUT
  * never crosses city boundaries when a city prefix was selected, AND
  * never under-cuts onto a different neighborhood that merely *contains*
    the selected one (``Talpiot`` won't match ``East Talpiot``).
"""
from __future__ import annotations

import re

from utils.locations_catalog import (
    HEBREW_TO_KEY,
    NEIGHBORHOOD_BY_CITY,
    NEIGHBORHOOD_INDEX,
    STATIC_NEIGHBORHOOD_ALIASES,
)

# Runtime alias cache — admins add/remove via the dashboard at any time
# (see ``routes/admin_area_aliases.py``). Reads are sync because regex
# building is sync; the cache is refreshed by route handlers that have DB
# access (admin mutations always invalidate; other routes piggy-back on the
# TTL refresh helper).
_DB_ALIASES: dict[str, str] = {}
_DB_ALIASES_LOADED_AT: float = 0.0
DB_ALIASES_TTL_SECONDS: float = 60.0


def all_aliases() -> dict[str, str]:
    """Merged alias map (static seed + DB overrides), lower-cased on both
    sides — the DB layer enforces this on write."""
    return {**STATIC_NEIGHBORHOOD_ALIASES, **_DB_ALIASES}


async def refresh_db_aliases(db, *, force: bool = False) -> dict[str, str]:
    """Pull aliases from ``db.area_aliases`` if the cache is stale (or
    ``force=True``). Returns the merged dict for convenience."""
    import time as _time

    global _DB_ALIASES_LOADED_AT
    now = _time.time()
    if not force and (now - _DB_ALIASES_LOADED_AT) < DB_ALIASES_TTL_SECONDS:
        return all_aliases()
    docs = await db.area_aliases.find({}, {"_id": 0}).to_list(500)
    _DB_ALIASES.clear()
    for d in docs:
        alias = (d.get("alias") or "").strip().lower()
        canon = (d.get("canonical") or "").strip().lower()
        if alias and canon:
            _DB_ALIASES[alias] = canon
    _DB_ALIASES_LOADED_AT = now
    return all_aliases()


def invalidate_db_aliases() -> None:
    """Force the next ``refresh_db_aliases`` to hit the DB."""
    global _DB_ALIASES_LOADED_AT
    _DB_ALIASES_LOADED_AT = 0.0


def _aliases_for_neighborhood(neighborhood: str) -> list[str]:
    """Return every alias whose canonical neighborhood matches ``neighborhood``
    (case-insensitive). Used to widen the regex so picking ``Ramat Eshkol``
    also matches listings stored under ``Levi Eshkol`` etc."""
    target = neighborhood.strip().lower()
    return [alias for alias, canon in all_aliases().items() if canon == target]


def canonicalize_area(area: str | None) -> str | None:
    """Return the canonical ``"<City> - <Neighborhood>"`` form for any
    user-typed value when we can confidently identify it.

    * Bare neighborhood ``"Sanhedria"`` → ``"Jerusalem - Sanhedria"``.
    * Known alias ``"Levi Eshkol"`` → ``"Jerusalem - Ramat Eshkol"``.
    * Already-canonical input is returned unchanged.
    * Unknown freeform values are returned as ``None`` so the caller can keep
      them as-is rather than guess.
    """
    if not area:
        return None
    a = area.strip()
    if not a:
        return None

    # Strip an explicit city prefix if present.
    bare = a.split(" - ", 1)[1].strip() if " - " in a else a
    key = bare.lower()

    # Direct hit on a known neighborhood.
    hit = NEIGHBORHOOD_INDEX.get(key)
    if hit:
        city, neighborhood = hit
        return f"{city} - {neighborhood}"

    # Alias hit (e.g. "Levi Eshkol" → "Ramat Eshkol").
    alias_canon = all_aliases().get(key)
    if alias_canon:
        hit = NEIGHBORHOOD_INDEX.get(alias_canon)
        if hit:
            city, neighborhood = hit
            return f"{city} - {neighborhood}"

    return None


def area_mongo_query(area: str | None) -> dict | None:
    """Return a Mongo query fragment for the ``area`` field, or ``None`` if no
    filter should be applied."""
    if not area:
        return None
    a = area.strip()
    if not a:
        return None

    if " - " in a:
        city, neighborhood = a.split(" - ", 1)
        city = city.strip()
        neighborhood = neighborhood.strip()
        if not neighborhood:
            return None
        # Build a list of acceptable "neighborhood-shaped" tokens — the
        # neighborhood itself plus any known aliases — so picking
        # "Jerusalem - Ramat Eshkol" also matches listings stored as
        # bare "Ramat Eshkol" or as the alias "Levi Eshkol".
        tokens = [neighborhood] + _aliases_for_neighborhood(neighborhood)
        token_group = "|".join(re.escape(t) for t in tokens)
        pattern = (
            rf"^(?:{re.escape(city)}\s*-\s*)?(?:{token_group})(?!\w)"
        )
    else:
        tokens = [a] + _aliases_for_neighborhood(a)
        token_group = "|".join(re.escape(t) for t in tokens)
        pattern = rf"^(?:{token_group})(?!\w)"

    return {"$regex": pattern, "$options": "i"}


def area_matches(prop_area: str | None, selected_area: str | None) -> bool:
    """Python-side equivalent of :func:`area_mongo_query`, used by saved-search
    matching where the comparison happens in memory."""
    if not selected_area:
        return True
    q = area_mongo_query(selected_area)
    if q is None:
        return True
    return bool(re.search(q["$regex"], prop_area or "", flags=re.IGNORECASE))

# ── Canonical area ids (spec 2.2) ─────────────────────────────────────
#
# One id per place, whatever anyone typed. "Ramat Eshkol", "רמת אשכול",
# "ramat-eshkol" and "Jerusalem - Ramat Eshkol" all resolve to
# ``jerusalem-ramat-eshkol``, and THAT is what search matches on.
#
# The old behaviour was a case-insensitive $regex on the raw text, which
# matches none of the above against each other. It is what made a Hebrew
# post unfindable by an English search — the highest-value item in the
# spec, and the reason this exists.
#
# Unknown places still work. resolve_area_id returns None and callers keep
# the free-text match they had, so posting about a village we have never
# heard of behaves exactly as it did before.

_PUNCT_TO_SPACE = frozenset("-_/.,'()\"" + chr(0x5F3) + chr(0x5F4) + chr(92))

def _strip_punct(value: str) -> str:
    """Fold the things people vary without meaning to.

    Hyphens against spaces ("ramat-eshkol"), the Hebrew geresh, quotes,
    and doubled whitespace. Not accents — Hebrew has none and the English
    names here are transliterations without them.
    """
    out = []
    for ch in value:
        if ch in _PUNCT_TO_SPACE:
            out.append(" ")
        else:
            out.append(ch)
    return " ".join("".join(out).split())


def area_slug(city: str, neighborhood: str | None = None) -> str:
    """'Jerusalem', 'Ramat Eshkol' -> 'jerusalem-ramat-eshkol'."""
    parts = [p for p in (city, neighborhood) if p]
    joined = " ".join(parts).lower()
    return "-".join(_strip_punct(joined).split())


def resolve_area_id(area: str | None) -> str | None:
    """A stable id for any spelling of a place, or None if unrecognised.

    Handles, in one pass: English, Hebrew, hyphens-for-spaces, extra
    whitespace, the "<City> - <Neighborhood>" form, bare neighbourhoods,
    bare cities, and the street-name aliases the catalogue already carried.

    City scoping is not decoration. "Ramat Eshkol" exists in BOTH Jerusalem
    and Haifa, and the flat neighbourhood index keeps whichever was
    registered first — so "Haifa - Ramat Eshkol" would silently resolve to
    Jerusalem and file a Haifa post under the wrong city. When a city is
    named it wins.

    Unknown places return None on purpose; the caller keeps its free-text
    match, so a village we have never heard of behaves as it always did.
    """
    if not area:
        return None
    raw = str(area).strip()
    if not raw:
        return None

    # Split on the canonical separator BEFORE folding punctuation — the
    # fold turns "-" into a space, so splitting after it never finds the
    # separator and the whole "<City> - <Neighborhood>" form silently fell
    # through to None.
    segments = [seg.strip() for seg in raw.split(" - ") if seg.strip()]

    def _key(value: str) -> str:
        """Fold to the canonical lowercase English key, via Hebrew if needed."""
        folded = _strip_punct(value).lower()
        return (HEBREW_TO_KEY.get(value.strip())
                or HEBREW_TO_KEY.get(_strip_punct(value).strip())
                or folded)

    # A named city scopes everything after it.
    city_name = None
    if len(segments) > 1:
        candidate_city = _key(segments[0])
        for _city, _n in NEIGHBORHOOD_INDEX.values():
            if candidate_city == _city.lower():
                city_name = _city
                break

    candidates = list(reversed(segments)) if segments else []
    candidates.append(_strip_punct(raw))

    for cand in candidates:
        low = _key(cand)
        if not low:
            continue

        if city_name:
            # Only accept a neighbourhood that belongs to the named city.
            bucket = NEIGHBORHOOD_BY_CITY.get(city_name.lower(), {})
            if low in bucket:
                return area_slug(city_name, bucket[low])
            alias = all_aliases().get(low)
            if alias and alias in bucket:
                return area_slug(city_name, bucket[alias])

        hit = NEIGHBORHOOD_INDEX.get(low)
        if hit and not city_name:
            return area_slug(hit[0], hit[1])

        alias = all_aliases().get(low)
        if alias and not city_name:
            hit = NEIGHBORHOOD_INDEX.get(alias)
            if hit:
                return area_slug(hit[0], hit[1])

        for _city in {c for c, _n in NEIGHBORHOOD_INDEX.values()}:
            if low == _city.lower():
                return area_slug(_city)

    # A recognised city with an unrecognised neighbourhood is still better
    # than nothing — it keeps every post in that city findable together.
    if city_name:
        return area_slug(city_name)
    return None
