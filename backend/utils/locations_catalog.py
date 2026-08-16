"""Backend mirror of ``frontend/src/constants/locations.js``.

Used by the Smart Lists locations endpoint and area canonicalisation. The
canonical area string format is ``"<City> - <Neighborhood>"`` (e.g.
``"Jerusalem - Rehavia"``).

If you add neighborhoods to the frontend file, mirror them here.

Aliases
-------
``NEIGHBORHOOD_ALIASES`` maps **street-name / colloquial / typo** variants
to their canonical ``Neighborhood`` value, lowercased. This is how
"Levi Eshkol" (a major street in Ramat Eshkol) gets matched to the
``Ramat Eshkol`` neighborhood without polluting the dropdown.
"""
from __future__ import annotations

LOCATION_OPTIONS: list[dict] = [
    {
        "city": "Jerusalem",
        "neighborhoods": [
            "Abu Tor", "American Colony", "Arnona", "Arzei HaBira", "Baka",
            "Bayit VeGan", "Beit HaKerem", "Beit Yisrael", "Bukharan Quarter",
            "East Talpiot", "Ein Kerem", "French Hill", "Geula",
            "German Colony", "Gilo", "Givat HaMivtar", "Givat Massuah",
            "Givat Mordechai", "Givat Ram", "Givat Shaul", "Greek Colony",
            "Har Nof", "Holyland", "Jewish Quarter", "Katamon",
            "Kerem Avraham", "Kiryat HaYovel", "Kiryat Menachem",
            "Kiryat Moshe", "Kiryat Shmuel", "Maalot Dafna", "Mahane Yehuda",
            "Malha", "Mamilla", "Mea Shearim", "Mekor Baruch", "Mekor Chaim",
            "Mishkenot Shaananim", "Musrara", "Nachlaot", "Neve Yaakov",
            "Old City", "Pat", "Pisgat Zeev", "Ramat Beit HaKerem",
            "Ramat Denya", "Ramat Eshkol", "Ramat Shlomo", "Ramot", "Rassco",
            "Rehavia", "Romema", "Sanhedria", "Sanhedria Murhevet",
            "Shaare Hesed", "Shmuel HaNavi", "Talbiya", "Talpiot",
            "Yemin Moshe",
        ],
    },
    {"city": "Tel Aviv", "neighborhoods": ["Afeka", "Bavli", "City Center (Lev Ha'Ir)", "Florentin", "HaTikva", "Jaffa (Yafo)", "Kerem HaTeimanim", "Kikar HaMedina", "Kiryat Shalom", "Lev Ha'Ir", "Nahalat Binyamin", "Neve Ofer", "Neve Sha'anan", "Neve Tzedek", "New North", "Nordau", "Old North", "Old Jaffa", "Park Tzameret", "Ramat Aviv", "Ramat HaHayal", "Ramat HaTayasim", "Sarona", "Shapira", "Tel Baruch", "White City", "Yad Eliyahu"]},
    {"city": "Haifa", "neighborhoods": ["Ahuza", "Bat Galim", "Carmel Center", "Carmeliya", "Denia", "French Carmel", "German Colony", "Hadar HaCarmel", "Halisa", "Kababir", "Kiryat Eliezer", "Kiryat Haim", "Kiryat Shmuel", "Neve David", "Neve Sha'anan", "Ramat Almogi", "Ramat Eshkol", "Romema", "Stella Maris", "Wadi Nisnas", "Western Carmel"]},
    {"city": "Beersheba", "neighborhoods": ["City Center", "Dalet", "Gimmel", "Hey", "Nahal Beka", "Neve Menachem", "Neve Noy", "Neve Zeev", "Old City", "Ramot", "Ramot Bet", "Tet", "Vav"]},
    {"city": "Netanya", "neighborhoods": ["City Center", "Galei Yam", "HaAgamim", "Ir Yamim", "Kiryat Hasharon", "Kiryat Nordau", "Neve Itamar", "Neve Oz", "North Netanya", "Poleg", "Ramat Chen", "Ramat Herzl", "South Netanya", "Umm Khalid"]},
    {"city": "Ashdod", "neighborhoods": ["Alef", "Bet", "City Center", "Dalet", "Gimmel", "Hey", "Marina", "Tet", "Vav", "Yud", "Yud Alef", "Yud Bet", "Yud Zayin", "Zayin"]},
    {"city": "Ashkelon", "neighborhoods": ["Afridar", "Barnea", "City Center", "HaGiborim", "Migdalei HaYam", "Neve Dekalim", "Neve Ilan", "Samson Quarter", "Shimshon", "South Beach", "Zion Hills"]},
    {"city": "Petah Tikva", "neighborhoods": ["Am Israel Hai", "City Center", "Ein Ganim", "Hadar Ganim", "Kfar Avraham", "Kfar Ganim", "Kiryat Aryeh", "Kiryat Matalon", "Neve Oz", "Ramat Siv", "Yad Labanim"]},
    {"city": "Rishon LeZion", "neighborhoods": ["City Center", "HaHadasha", "HaMizrah", "Kiryat Rishon", "Maarav", "Nahalat Yehuda", "Neve Dekalim", "Neve Hof", "Neve Ilan", "Old Rishon", "Ramat Eliyahu", "Ramat Ilan", "Superland Area"]},
    {"city": "Ramat Gan", "neighborhoods": ["City Center", "Diamond Exchange", "Givat Geula", "Kiryat Borochov", "Kiryat Krinitzi", "Neve Yehoshua", "Ramat Chen", "Ramat Efal", "Ramat Shikma", "Tel Binyamin"]},
    {"city": "Herzliya", "neighborhoods": ["City Center", "Herzliya HaTzeira", "Herzliya Pituah", "Neve Amal", "Neve Oved", "Nof Yam", "Ramat HaSharon"]},
    {"city": "Raanana", "neighborhoods": ["City Center", "Neve Zemer", "North Raanana", "Ramat Raanana", "South Raanana", "West Raanana"]},
    {"city": "Kfar Saba", "neighborhoods": ["City Center", "Green Kfar Saba", "Neve Issar", "North Kfar Saba", "Old Kfar Saba", "South Kfar Saba", "Yoseftal"]},
    {"city": "Modiin", "neighborhoods": ["Avnei Hen", "Buchman", "City Center", "Hahashmonaim", "Moriah", "Neve Ilan", "Reut"]},
    {"city": "Beit Shemesh", "neighborhoods": ["City Center", "Givat Sharett", "Nofei HaShemesh", "Old Beit Shemesh", "Ramat Beit Shemesh Alef", "Ramat Beit Shemesh Bet", "Ramat Beit Shemesh Gimmel", "Sheinfeld"]},
    {"city": "Eilat", "neighborhoods": ["Arava", "City Center", "HaDekel", "HaSharon", "North Beach", "North Eilat", "Shahamon", "South Eilat", "Tourist Center"]},
]

# Flat list of canonical "<City> - <Neighborhood>" strings.
ALL_AREA_VALUES: list[str] = [
    f"{g['city']} - {n}" for g in LOCATION_OPTIONS for n in g["neighborhoods"]
]

# Map of canonical lower-cased neighborhood names → (city, neighborhood).
# Lets us reverse-look-up "ramat eshkol" → "Jerusalem - Ramat Eshkol".
NEIGHBORHOOD_INDEX: dict[str, tuple[str, str]] = {}
for _g in LOCATION_OPTIONS:
    for _n in _g["neighborhoods"]:
        NEIGHBORHOOD_INDEX.setdefault(_n.strip().lower(), (_g["city"], _n))

# Neighbourhoods keyed BY CITY. NEIGHBORHOOD_INDEX above is flat and uses
# setdefault, so a name shared by two cities — "Ramat Eshkol" is in both
# Jerusalem and Haifa, "German Colony" in both Jerusalem and Haifa, "City
# Center" in half of them — only ever resolves to whichever city was
# registered first. That is fine for a best-guess lookup and wrong when the
# city is stated, so scoped lookups use this instead.
NEIGHBORHOOD_BY_CITY: dict[str, dict[str, str]] = {}
for _g in LOCATION_OPTIONS:
    _bucket = NEIGHBORHOOD_BY_CITY.setdefault(_g["city"].lower(), {})
    for _n in _g["neighborhoods"]:
        _bucket.setdefault(_n.strip().lower(), _n)

# Street-name / colloquial / typo aliases → canonical neighborhood (lowercase).
# Seed values shipped with the code — runtime additions live in the
# ``area_aliases`` Mongo collection (see ``routes/admin_area_aliases.py``)
# and are merged in at request time via ``area_filter.all_aliases()``.
STATIC_NEIGHBORHOOD_ALIASES: dict[str, str] = {
    # Levi Eshkol Blvd runs through the Ramat Eshkol neighborhood — owners
    # frequently list the street name instead of the neighborhood.
    "levi eshkol": "ramat eshkol",
    "levi eshkol blvd": "ramat eshkol",
    "levi eshkol boulevard": "ramat eshkol",
}

# Backwards-compat alias: existing callers import ``NEIGHBORHOOD_ALIASES``.
# Kept as a reference to the static seed so tests can still pin it.
NEIGHBORHOOD_ALIASES = STATIC_NEIGHBORHOOD_ALIASES

# ── Hebrew names, and one stable id per area (spec 2.2) ───────────────
#
# The catalogue was English-only, so "רמת אשכול" and "Ramat Eshkol" were
# two unrelated strings and a Hebrew post was invisible to an English
# search. That is the single thing this table fixes.
#
# Deliberately NOT machine-translated at runtime: place names are exactly
# where a translator invents plausible nonsense, and an area is a join key
# — one wrong rendering silently splits a neighbourhood in two. These are
# written down once, by hand, and reviewed.
#
# Coverage is the cities and Jerusalem neighbourhoods that actually carry
# listings and posts today, plus the big-city names. An area not in the
# table still works: it falls back to the text as typed, exactly as before.
HEBREW_AREA_NAMES: dict[str, str] = {
    # Cities
    "jerusalem": "ירושלים",
    "tel aviv": "תל אביב",
    "haifa": "חיפה",
    "beersheba": "באר שבע",
    "netanya": "נתניה",
    "ashdod": "אשדוד",
    "ashkelon": "אשקלון",
    "petah tikva": "פתח תקווה",
    "ramat gan": "רמת גן",
    "herzliya": "הרצליה",
    "raanana": "רעננה",
    "kfar saba": "כפר סבא",
    "modiin": "מודיעין",
    "beit shemesh": "בית שמש",
    "eilat": "אילת",
    "rishon lezion": "ראשון לציון",
    # Jerusalem neighbourhoods — where the board's posts actually are
    "ramat eshkol": "רמת אשכול",
    "geula": "גאולה",
    "nachlaot": "נחלאות",
    "rehavia": "רחביה",
    "baka": "בקעה",
    "old city": "העיר העתיקה",
    "romema": "רוממה",
    "sanhedria": "סנהדריה",
    "sanhedria murhevet": "סנהדריה המורחבת",
    "french hill": "גבעה צרפתית",
    "givat hamivtar": "גבעת המבתר",
    "maalot dafna": "מעלות דפנה",
    "ramat shlomo": "רמת שלמה",
    "har nof": "הר נוף",
    "talbiya": "טלביה",
    "german colony": "המושבה הגרמנית",
    "mekor baruch": "מקור ברוך",
    "mea shearim": "מאה שערים",
    "katamon": "קטמון",
    "arzei habira": "ארזי הבירה",
    "kiryat moshe": "קרית משה",
    "givat shaul": "גבעת שאול",
    "pisgat zeev": "פסגת זאב",
    "gilo": "גילה",
    "ramot": "רמות",
    "talpiot": "תלפיות",
    "mamilla": "ממילא",
    "city center": "מרכז העיר",
}

# Hebrew -> the canonical lowercase English key. Built by inverting the
# table above so the two can never drift apart.
HEBREW_TO_KEY: dict[str, str] = {he: en for en, he in HEBREW_AREA_NAMES.items()}

