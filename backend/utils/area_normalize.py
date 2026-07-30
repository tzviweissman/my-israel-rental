"""Canonicalise the ``area`` field **on write**.

Companion to ``utils/area_filter.py`` (which canonicalises on *read*, for
matching) and ``frontend/src/utils/areaNames.js`` (which canonicalises on
*render*, for display). This module is the third leg: it stops new spelling
drift from entering the database in the first place.

Why this exists
---------------
Production accumulated ~48 distinct ``area`` spellings for ~28 real
Jerusalem neighbourhoods — "Ramat Eshkol" / "Ramat Eshkol, Jerusalem" /
"Jerusalem - Ramat Eshkol" are one place. That mattered beyond cosmetics:
``utils/dedupe.py`` falls back to keying on ``area`` when a listing has no
street address, so three spellings of one neighbourhood meant three
non-colliding dedupe signatures and duplicate listings sailed through.

Canonical stored form
---------------------
``"<City> - <Neighborhood>"`` (e.g. ``"Jerusalem - Ramat Eshkol"``), with
the neighbourhood spelled exactly as it appears in
``utils/locations_catalog.LOCATION_OPTIONS``. Three reasons for that form:

  * it is already what the Add Property form's ``LocationPicker`` emits, so
    the dominant write path needs no change to agree with it;
  * it carries the city — this site is not Jerusalem-only (16 cities in the
    backend catalogue, 17 groups in the frontend one); and
  * ``area_filter.area_mongo_query`` makes the ``"<City> - "`` prefix
    *optional* when matching, so a filter sending the canonical form
    matches both the new canonical rows and every legacy bare row. No
    migration required, and no filter change required.

Matching rules — deliberately strict
------------------------------------
  * Lookup is **exact after normalisation** (trim, collapse internal
    whitespace, casefold). Never substring. "Sanhedria" and "Sanhedria
    Murchevet" are genuinely different neighbourhoods (Murhevet is the 1970
    northern *expansion*) and a substring match would merge them. Same
    reason ``area_filter`` anchors its regex and ``areaNames.js`` refuses
    substring lookups.
  * Unknown values are returned **completely unchanged** — same string
    object, not even trimmed. Hosts legitimately list somewhere the
    catalogue has never heard of, and silently blanking or "correcting"
    that would lose real data. This fallback is load-bearing.
  * Street-name aliases are **not** applied. ``locations_catalog``'s
    ``STATIC_NEIGHBORHOOD_ALIASES`` maps "Levi Eshkol" → "Ramat Eshkol",
    but that map exists to *widen a filter*, not to rewrite storage:
    folding a stored street name up into its neighbourhood throws away
    precision the lister typed on purpose. ``areaNames.js`` makes the same
    call, keeping "Levi Eshkol" / "Machal" / "Mishmar HaGvul" as their own
    display entries. Skipping aliases also keeps this module free of the
    DB-backed alias cache, so it stays pure and unit-testable.

Ambiguous bare neighbourhoods
-----------------------------
Several neighbourhood names exist in more than one city ("Old City" in
Jerusalem *and* Beersheba; "Ramat Eshkol", "Romema", "German Colony" and
"Kiryat Shmuel" in Jerusalem *and* Haifa; "City Center" almost everywhere).
For a bare input we cannot know which city was meant, so the default is to
leave it **unchanged** rather than guess a city and mis-file the listing.

The single exception is ``_AMBIGUOUS_DEFAULT_CITY`` below, which is
evidence-based rather than a guess — see the comment there. Every other
ambiguous name happens to have only ONE spelling in production, so leaving
those bare costs nothing: there is no drift to collapse.

Adding a neighbourhood
----------------------
Add it to ``locations_catalog.LOCATION_OPTIONS`` (and mirror it into
``frontend/src/constants/locations.js``). Only add a row to
``_SPELLING_VARIANTS`` when a *misspelling* of an existing catalogue entry
shows up in the wild.
"""
from __future__ import annotations

from utils.locations_catalog import LOCATION_OPTIONS

__all__ = ["normalize_area", "canonical_area_parts"]


def _fold(value: str) -> str:
    """Lookup form: trimmed, internal whitespace collapsed, casefolded.

    Punctuation is deliberately preserved — "Givat Hamivtar / Ramat Eshkol"
    must stay distinguishable from "Givat Hamivtar".
    """
    return " ".join(str(value).split()).casefold()


# ── Catalogue-derived indexes ──────────────────────────────────────────
# folded city name → catalogue spelling of that city
_CITIES: dict[str, str] = {}
# folded neighbourhood → catalogue spelling of that neighbourhood
_NEIGHBORHOOD_SPELLING: dict[str, str] = {}
# folded neighbourhood → cities (catalogue order) that contain it
_NEIGHBORHOOD_CITIES: dict[str, list[str]] = {}

for _group in LOCATION_OPTIONS:
    _city = _group["city"]
    _CITIES.setdefault(_fold(_city), _city)
    for _n in _group["neighborhoods"]:
        _key = _fold(_n)
        _NEIGHBORHOOD_SPELLING.setdefault(_key, _n)
        _NEIGHBORHOOD_CITIES.setdefault(_key, []).append(_city)


# ── Spelling variants seen in production ───────────────────────────────
# Misspellings / alternate transliterations of a catalogue neighbourhood,
# harvested from the stored values enumerated in
# ``frontend/src/utils/areaNames.js`` (AREA_CANONICALS). Keys are folded;
# values must be the exact catalogue spelling.
#
# NOTE on "Sanhedria Murhevet": areaNames.js uses "Sanhedria Murchevet" as
# the *display* label and treats "Murhevet" as the typo. The stored form
# has to go the other way — the catalogue, the LocationPicker dropdown and
# therefore every area filter all say "Murhevet", and storing "Murchevet"
# would produce rows the filter regex could not match. Display label and
# stored value are allowed to differ; that is exactly what areaNames.js is
# for.
_SPELLING_VARIANTS: dict[str, str] = {
    "arzei habirah": "Arzei HaBira",
    "sanhedria murchevet": "Sanhedria Murhevet",
    "shaarei chessed": "Shaare Hesed",
    "shaarei hesed": "Shaare Hesed",
    "mekor haim": "Mekor Chaim",
    "mekor hayim": "Mekor Chaim",
}

# Bare neighbourhood names that exist in several cities but which we still
# resolve, because the production data says which city is meant.
#
# "Ramat Eshkol" is in both Jerusalem and Haifa, but two of its three
# stored spellings name Jerusalem explicitly ("Ramat Eshkol, Jerusalem",
# "Jerusalem - Ramat Eshkol") and it is the single largest drift cluster on
# the site (~51 listings across three spellings). Leaving the bare form
# alone would leave that cluster split, which is the whole problem this
# module exists to fix.
#
# Everything else ambiguous ("Old City", "City Center", "Romema", "German
# Colony", "Kiryat Shmuel", "Ramot", …) has exactly one spelling in
# production, so it is left bare rather than guessed at.
_AMBIGUOUS_DEFAULT_CITY: dict[str, str] = {
    "ramat eshkol": "Jerusalem",
}


def _resolve_neighborhood(folded: str) -> str | None:
    """Catalogue spelling for a folded neighbourhood/variant, or None."""
    variant = _SPELLING_VARIANTS.get(folded)
    if variant is not None:
        return variant
    return _NEIGHBORHOOD_SPELLING.get(folded)


def _split_shape(cleaned: str) -> tuple[str | None, str]:
    """Pull an explicit city out of the three shapes seen in the data.

    ``"Jerusalem - Ramat Eshkol"`` → ("Jerusalem", "Ramat Eshkol")
    ``"Ramat Eshkol, Jerusalem"``  → ("Jerusalem", "Ramat Eshkol")
    ``"Ramat Eshkol"``             → (None, "Ramat Eshkol")

    A prefix/suffix is only treated as a city when it is a *known* city, so
    display-ish strings like "Machal St, Ramat Eshkol" are not mangled and
    a hyphenated neighbourhood name is not mistaken for "City - X".
    """
    if " - " in cleaned:
        head, tail = cleaned.split(" - ", 1)
        city = _CITIES.get(_fold(head))
        if city and tail.strip():
            return city, tail.strip()

    if "," in cleaned:
        head, tail = cleaned.rsplit(",", 1)
        city = _CITIES.get(_fold(tail))
        if city and head.strip():
            return city, head.strip()

    return None, cleaned


def canonical_area_parts(value: str | None) -> tuple[str, str] | None:
    """``(city, neighborhood)`` for a recognised area, else ``None``.

    Exposed separately so callers that need the pieces (or just want to ask
    "is this a known area?") don't have to re-split the joined string.
    """
    if value is None:
        return None
    cleaned = " ".join(str(value).split())
    if not cleaned:
        return None

    city, bare = _split_shape(cleaned)
    neighborhood = _resolve_neighborhood(_fold(bare))
    if neighborhood is None:
        return None

    key = _fold(neighborhood)
    cities = _NEIGHBORHOOD_CITIES.get(key, [])

    if city is not None:
        # An explicit city wins, but only if the catalogue agrees it has
        # this neighbourhood — otherwise we'd invent "Haifa - Rehavia".
        if city in cities:
            return city, neighborhood
        return None

    if len(cities) == 1:
        return cities[0], neighborhood

    default = _AMBIGUOUS_DEFAULT_CITY.get(key)
    if default and default in cities:
        return default, neighborhood

    # Ambiguous and no evidence — refuse to guess.
    return None


def normalize_area(value: str | None) -> str | None:
    """Fold a stored/user-supplied ``area`` onto its canonical form.

    Returns ``"<City> - <Neighborhood>"`` for a recognised area. Anything
    unrecognised — including ``None`` and blank strings — is returned
    **exactly as it came in**, so a brand-new neighbourhood is never
    dropped, blanked, or silently reassigned to the wrong place.

    >>> normalize_area("Ramat Eshkol, Jerusalem")
    'Jerusalem - Ramat Eshkol'
    >>> normalize_area("Sanhedria Murhevet")
    'Jerusalem - Sanhedria Murhevet'
    >>> normalize_area("Somewhere New")
    'Somewhere New'
    """
    parts = canonical_area_parts(value)
    if parts is None:
        return value
    city, neighborhood = parts
    return f"{city} - {neighborhood}"
