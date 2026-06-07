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
    NEIGHBORHOOD_ALIASES,
    NEIGHBORHOOD_INDEX,
)


def _aliases_for_neighborhood(neighborhood: str) -> list[str]:
    """Return every alias whose canonical neighborhood matches ``neighborhood``
    (case-insensitive). Used to widen the regex so picking ``Ramat Eshkol``
    also matches listings stored under ``Levi Eshkol`` etc."""
    target = neighborhood.strip().lower()
    return [alias for alias, canon in NEIGHBORHOOD_ALIASES.items() if canon == target]


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
    alias_canon = NEIGHBORHOOD_ALIASES.get(key)
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
