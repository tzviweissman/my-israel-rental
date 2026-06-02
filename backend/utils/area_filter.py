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
  * matches longer suffixes (so ``Sanhedria`` keeps catching
    ``Sanhedria Murhevet``), BUT
  * never crosses city boundaries when a city prefix was selected, AND
  * never under-cuts onto a different neighborhood that merely *contains*
    the selected one (``Talpiot`` won't match ``East Talpiot``).
"""
from __future__ import annotations

import re


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
        # Match either "<City> - <Neighborhood...>" (prefix anchored, ignores
        # extra whitespace around the dash) or the bare "<Neighborhood...>"
        # legacy form. ``(?!\w)`` anchors so ``Talpiot`` won't match
        # ``Atalpiot`` / ``Talpiotxyz`` but still allows the neighborhood to be
        # the entire stored value or to be followed by a space/punctuation.
        pattern = (
            rf"^(?:{re.escape(city)}\s*-\s*)?{re.escape(neighborhood)}(?!\w)"
        )
    else:
        pattern = rf"^{re.escape(a)}(?!\w)"

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
