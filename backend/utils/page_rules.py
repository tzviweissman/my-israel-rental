"""The rules an AI-built page must pass, as a deterministic check. No AI.

docs/page-generation-rules.md is the rulebook in words; this is the part a
machine can check. Every rule id here appears there with the same name.

    check_composition(business, composition, lang) -> {
        passed, rules: [{id, passed, reason}], fix_first, content_gaps }
    check_options(business, [c1, c2, c3], lang)  -> the same per option,
                                                    plus whether they differ

Two kinds of failure, kept apart on purpose:

  * RULES are the generator's fault: an invented number, an unbacked
    claim, fake urgency, the wrong language, a block that can't do what
    the brief asked. An option that breaks one is thrown away and
    regenerated, never patched (docs/ai-page-builder-spec.md P1, P4a).

  * CONTENT GAPS are the business's data: no reviews yet, no prices, no
    service named in Hebrew. All three options would share them, so they
    never reject an option; they are what the owner is told to add
    (from utils/page_clarity.check_page).

Everything the generator writes is checked against what the OWNER wrote
(description, their note, their listing titles and descriptions) and the
facts we hold (founding year, licence, certificate, reviews). A claim is
allowed when the owner said it or the data proves it, never otherwise.
"""
from __future__ import annotations

import re
from typing import Any, Optional

from pydantic import ValidationError

from utils.page_clarity import check_page, years_in_business, _possible_actions, FOOD_CATEGORIES
from utils.page_composition import PageComposition

_HEBREW = re.compile(r"[֐-׿]")
_LATIN = re.compile(r"[A-Za-z]")
_NUMBER = re.compile(r"\d[\d,.]*")

# Blocks that frame the page rather than carry its content.
FRAME = {"hero", "cover", "rule"}
MAX_GENERATED_BLOCKS = 10
HERO_TITLE_MAX_WORDS = 10

# ---------------------------------------------------------------- claims
# A claim the page may make only when the proof exists or the owner said it
# in their own words. (terms, proof(business) -> bool, what's missing)
CLAIMS: list[tuple[str, tuple[str, ...], Any, str]] = [
    ("kosher", ("kosher", "hechsher", "כשר", "כשרות", "בד\"ץ", "בדץ"),
     lambda b: bool((b.get("kosher_certification") or {}).get("body")), "a kosher certificate"),
    ("licensed", ("licensed", "licence", "license", "certified", "מוסמך", "מוסמכת", "רישיון", "רשיון", "מורשה"),
     lambda b: bool(b.get("license_number")), "a licence number"),
    ("verified", ("verified", "מאומת", "מאומתת"), lambda b: bool(b.get("verified")), "verification"),
    ("reviews", ("review", "rated", "stars", "5-star", "five-star", "customers love", "ביקורות", "כוכבים", "מדורג", "לקוחות מרוצים"),
     lambda b: (b.get("rating_count") or 0) > 0, "reviews"),
    ("experience", ("years of experience", "since ", "established", "decades", "שנות ניסיון", "שנים של", "מאז", "משנת", "עשרות שנים"),
     lambda b: bool(years_in_business(b.get("founded_year"))), "a founding year"),
    ("english", ("english", "אנגלית"), lambda b: any(str(x).lower().startswith("en") for x in (b.get("languages") or [])),
     "English in their languages"),
    # No data field can prove these: only the owner's own words can.
    ("superlative", ("best", "#1", "number one", "top-rated", "top rated", "leading", "award", "awards", "award-winning",
                     "unbeatable", "cheapest", "the only",
                     "הטוב ביותר", "הטובה ביותר", "הכי טוב", "מספר 1", "מספר אחת", "המוביל", "המובילה", "פרס", "הזול ביותר"),
     None, "the owner saying it"),
    ("guarantee", ("guarantee", "guaranteed", "warranty", "money back", "אחריות", "מובטח", "מובטחת", "החזר כספי"), None, "the owner saying it"),
    ("insured", ("insured", "insurance", "background-checked", "background checked", "vetted", "מבוטח", "מבוטחת", "ביטוח"), None, "the owner saying it"),
    ("always_open", ("24/7", "24 hours", "emergency", "any time", "anytime", "24 שעות", "חירום", "בכל שעה"), None, "the owner saying it"),
    ("fresh", ("fresh daily", "baked daily", "every morning", "made today", "same day", "טרי כל יום", "כל בוקר", "באותו יום", "אפוי טרי"),
     None, "the owner saying it"),
    ("delivery", ("delivery", "delivered", "we deliver", "shipping", "משלוח", "משלוחים", "עד הבית"), None, "the owner saying it"),
    ("health", ("cure", "cures", "heal", "heals", "healing", "treatment for", "therapy for", "medical", "clinically", "weight loss",
                "lose weight", "מרפא", "ריפוי", "טיפול ב", "רפואי", "ירידה במשקל"), None, "the owner saying it"),
    ("audience_size", ("thousands of", "hundreds of", "trusted by", "families trust", "אלפי", "מאות", "סומכים עלינו"), None,
     "the owner saying it"),
]

# Never, for anyone: invented urgency and scarcity (ruling 8). Nothing the
# site holds is a real, current count, so there is no case that allows it.
# Patterns, not words: "open only on Fridays" is a fact, "only 3 left" is not.
URGENCY = (r"only \d+( \w+)? (left|remaining|spots?|places?)", r"\d+( \w+)? (left|remaining)\b", r"booked \d+ times",
           r"\bhurry\b", r"limited[- ]time", r"limited offer", r"last chance", r"today only", r"don'?t miss",
           r"\bact now\b", r"before it'?s gone", r"while stocks? last", r"selling fast", r"spots? left",
           r"almost (gone|full|sold out)", r"רק היום", r"מהרו", r"לזמן מוגבל", r"הזדמנות אחרונה", r"נשארו רק",
           r"אל תפספסו", r"עד גמר המלאי", r"נחטף", r"כמעט אזל")

# Filler that could describe any business, so it describes none. The rule
# is "specific over generic": a sentence has to be about THIS business.
GENERIC = ("welcome to", "look no further", "one-stop shop", "one stop shop", "second to none", "we are passionate",
           "passionate about", "your satisfaction", "customer satisfaction is", "quality you can trust",
           "we pride ourselves", "we strive", "state of the art", "state-of-the-art", "world-class", "world class",
           "unparalleled", "top-notch", "top notch", "your trusted partner", "exceed your expectations",
           "ברוכים הבאים", "שביעות רצונכם", "שביעות רצון הלקוח", "אנחנו גאים", "שירות ללא פשרות", "איכות ללא פשרות",
           "השותף שלכם", "מעבר לציפיות")

# ---------------------------------------------------------------- playbooks
# The machine-checkable part of each playbook in docs/page-generation-rules.md.
#   lead      which content block may come first, after the hero
#   needs     blocks the page must have
PLAYBOOKS: dict[str, dict[str, Any]] = {
    "shops-products": {"lead": {"services", "gallery"}, "needs": {"services"}},
    "personal-care": {"lead": {"services", "gallery"}, "needs": {"services"}},
    "home-services-repair": {"lead": {"services", "facts"}, "needs": {"services", "facts"}},
    "events-catering": {"lead": {"gallery", "services"}, "needs": {"services", "facts"}},
    "cleaning-services": {"lead": {"services", "facts"}, "needs": {"services", "facts"}},
    "health-fitness": {"lead": {"services", "gallery"}, "needs": {"services"}},
    "travel-tourism": {"lead": {"gallery", "services"}, "needs": {"services", "facts"}},
}
DEFAULT_PLAYBOOK = {"lead": {"services", "facts", "gallery"}, "needs": {"services"}}

# What each brief action needs on the page to be takeable.
ACTION_BLOCK = {"book": "services", "order": "services", "message": "contact", "visit": "facts"}


def _category(b: dict) -> Optional[str]:
    cats = [g.get("category") for g in b.get("listings") or [] if g] + list(b.get("categories") or [])
    cats = [c for c in cats if c]
    return max(set(cats), key=cats.count) if cats else None


def playbook_for(b: dict) -> dict:
    return PLAYBOOKS.get(_category(b) or "", DEFAULT_PLAYBOOK)


def owner_text(b: dict) -> str:
    """Everything the owner wrote themselves, lowercased. A claim found
    here is theirs, not the generator's."""
    parts = [b.get("name"), b.get("name_he"), b.get("description"), b.get("description_he"),
             (b.get("page_brief") or {}).get("note")]
    for g in b.get("listings") or []:
        g = g or {}
        parts += [g.get("title"), g.get("title_he"), g.get("title_en"), g.get("description"), g.get("description_he"),
                  g.get("description_en")]
        for i in (g.get("tiers") or []) + (g.get("products") or []):
            parts += [(i or {}).get("name"), (i or {}).get("description")]
    return " ".join(str(p) for p in parts if p).lower()


def known_numbers(b: dict) -> set[str]:
    """Every number the page may state: the ones in the owner's own words
    and in our facts about them."""
    nums = set(re.sub(r"[,.]$", "", n).replace(",", "") for n in _NUMBER.findall(owner_text(b)))
    y = years_in_business(b.get("founded_year"))
    for v in (b.get("founded_year"), y, b.get("rating_count"), b.get("rating_avg")):
        if v:
            nums.add(str(v))
    for g in b.get("listings") or []:
        for i in ((g or {}).get("tiers") or []) + ((g or {}).get("products") or []):
            if (i or {}).get("price"):
                p = (i or {}).get("price")
                nums.update({str(p), str(int(p)) if float(p).is_integer() else str(p)})
        if (g or {}).get("cheapest_price"):
            nums.add(str(int(g["cheapest_price"])) if float(g["cheapest_price"]).is_integer() else str(g["cheapest_price"]))
    return nums


def _texts(comp: dict, lang: str) -> list[tuple[str, str]]:
    """(where, text) for everything the generator wrote. A composition is
    in ONE language: the schema has no Hebrew twin for hero text yet, so a
    bilingual page is two compositions (docs/page-generation-rules.md, open
    decision 1)."""
    out = []
    for blk in comp.get("blocks") or []:
        p = blk.get("props") or {}
        for k in ("title", "accent_word", "lede", "heading"):
            if p.get(k):
                out.append((f"{blk.get('id')}.{k}", str(p[k])))
    return out


def _has(text: str, term: str) -> bool:
    """Whole words for English ("heal" is not in "health"), substring for
    Hebrew, where prefixes attach to the word (ה, ב, ל, ו...)."""
    t = term.lower()
    if _HEBREW.search(t):
        return t in text
    return re.search(rf"(?<![a-z0-9]){re.escape(t)}(?![a-z])", text) is not None


def _resolves(ref: Optional[str], b: dict) -> bool:
    if not ref:
        return True
    if ref == "cover":
        return bool(b.get("cover_url"))
    if ref == "logo":
        return bool(b.get("logo_url"))
    gid = ref.split(":", 1)[1]
    return any((g or {}).get("id") == gid for g in b.get("listings") or [])


def _photo_count(b: dict) -> int:
    n = int(bool(b.get("cover_url")))
    for g in b.get("listings") or []:
        g = g or {}
        n += len(g.get("gallery") or []) + sum(1 for i in (g.get("tiers") or []) + (g.get("products") or [])
                                              if (i or {}).get("images") or (i or {}).get("image"))
    return n


def _any_price(b: dict) -> bool:
    return any(((i or {}).get("price")) for g in b.get("listings") or []
               for i in ((g or {}).get("tiers") or []) + ((g or {}).get("products") or [])) \
        or any((g or {}).get("cheapest_price") for g in b.get("listings") or [])


# ---------------------------------------------------------------- the check

ORDER = ("schema", "language", "hero", "numbers", "claims", "urgency", "generic", "punctuation",
         "structure", "action", "images", "prices", "playbook")


def check_composition(business: dict, composition: dict, lang: str = "en") -> dict:
    b = business or {}
    out: dict[str, tuple[bool, str]] = {}

    try:
        comp = PageComposition(**(composition or {})).model_dump()
        out["schema"] = (True, "Valid composition.")
    except ValidationError as e:
        first = e.errors()[0]
        return _result(lang, {"schema": (False, f"Not a valid composition: {'.'.join(map(str, first['loc']))}: {first['msg']}.")}, b)

    blocks = comp["blocks"]
    theme = comp["theme"]
    texts = _texts(comp, lang)
    owner = owner_text(b)
    names = " ".join(str(x) for x in (b.get("name"), b.get("name_he")) if x).lower()

    # language: everything written is in the page's language. A Latin
    # business name inside a Hebrew line is fine; a line with no Hebrew is not.
    wrong = [w for w, t in texts if not (_HEBREW.search(t) if lang == "he" else _LATIN.search(t))
             and t.lower() not in names]
    out["language"] = (not wrong, "All text is in the page's language." if not wrong
                       else f"Not in {'Hebrew' if lang == 'he' else 'English'}: {', '.join(wrong)}.")

    # hero: says what they do, in words, and is not just their name again.
    heroes = [x for x in blocks if x["type"] == "hero"]
    hp = (heroes[0]["props"] if heroes else {})
    title, lede = (hp.get("title") or "").strip(), (hp.get("lede") or "").strip()
    problems = []
    if not heroes:
        problems.append("no hero: nothing says what they do before the catalogue")
    elif blocks[0]["type"] not in ("hero", "cover"):
        problems.append("the hero is not at the top")
    if heroes and not (title or lede):
        problems.append("the hero has no words")
    if title and title.lower() in names:
        problems.append("the headline is only the business name, which the page already shows")
    if len(title.split()) > HERO_TITLE_MAX_WORDS:
        problems.append(f"the headline is {len(title.split())} words; at most {HERO_TITLE_MAX_WORDS}")
    if len(heroes) > 1:
        problems.append("more than one hero")
    out["hero"] = (not problems, "The hero says what they do." if not problems else "; ".join(problems).capitalize() + ".")

    # numbers: every number written is one the owner wrote or we hold.
    known = known_numbers(b)
    stray = sorted({n.rstrip(".,").replace(",", "") for _, t in texts for n in _NUMBER.findall(t)} - known)
    out["numbers"] = (not stray, "Every number comes from their own data." if not stray
                      else f"Invented number(s): {', '.join(stray)}.")

    # claims: backed by data or said by the owner.
    unbacked = []
    for name, terms, proof, needs in CLAIMS:
        for w, t in texts:
            hit = next((term for term in terms if _has(t.lower(), term)), None)
            if not hit or _has(owner, hit) or (proof and proof(b)):
                continue
            unbacked.append(f"'{hit.strip()}' in {w} needs {needs}")
            break
    cert = (b.get("kosher_certification") or {}).get("body")
    if cert and _category(b) not in FOOD_CATEGORIES and any(_has(t.lower(), "kosher") or "כשר" in t for _, t in texts):
        unbacked.append("kosher is only said on a food business")
    out["claims"] = (not unbacked, "No claim without proof." if not unbacked else "Unbacked: " + "; ".join(unbacked) + ".")

    # urgency: never.
    urgent = [f"'{m.group(0)}' in {w}" for w, t in texts for pat in URGENCY if (m := re.search(pat, t.lower()))]
    out["urgency"] = (not urgent, "No invented urgency." if not urgent else "Invented urgency: " + ", ".join(urgent[:3]) + ".")

    # generic: specific to this business, unless the owner wrote it.
    filler = [f"'{term}' in {w}" for w, t in texts for term in GENERIC if _has(t.lower(), term) and not _has(owner, term)]
    out["generic"] = (not filler, "No filler." if not filler else "Filler that fits any business: " + ", ".join(filler[:3]) + ".")

    # punctuation: the site's copy rules. No exclamation marks, no long
    # dashes, no shouting in capitals (unless it's their name).
    bad = []
    for w, t in texts:
        if "!" in t:
            bad.append(f"'!' in {w}")
        if "—" in t or "–" in t:
            bad.append(f"long dash in {w}")
        caps = [x for x in re.findall(r"\b[A-Z]{4,}\b", t) if x.lower() not in names]
        if caps:
            bad.append(f"capitals '{caps[0]}' in {w}")
    out["punctuation"] = (not bad, "Clean punctuation." if not bad else "; ".join(bad).capitalize() + ".")

    # structure: short enough to take in, nothing doubled.
    issues = []
    if len(blocks) > MAX_GENERATED_BLOCKS:
        issues.append(f"{len(blocks)} blocks; a generated page has at most {MAX_GENERATED_BLOCKS}")
    for t in ("contact", "facts", "gallery"):
        if sum(x["type"] == t for x in blocks) > 1:
            issues.append(f"two {t} blocks")
    if any(a["type"] == "rule" and c["type"] == "rule" for a, c in zip(blocks, blocks[1:])):
        issues.append("two dividers in a row")
    if blocks[-1]["type"] == "rule":
        issues.append("ends on a divider")
    out["structure"] = (not issues, "Tidy structure." if not issues else "; ".join(issues).capitalize() + ".")

    # action: what the brief asks visitors to do has a block to do it in.
    act = (b.get("page_brief") or {}).get("action")
    possible = _possible_actions(b)
    if act in ACTION_BLOCK and possible.get(act, True):
        need = ACTION_BLOCK[act]
        ok = any(x["type"] == need for x in blocks)
        out["action"] = (ok, f"'{act}' is takeable here." if ok else f"The brief says '{act}', which needs a {need} block.")
    else:
        # No action chosen, or one this business can't offer: the owner's
        # brief, not the page. Reported as a content gap by check_page.
        out["action"] = (True, "Nothing for the page to add; see content gaps.")

    # images: their own photos, and a photo-led look only with photos.
    photos = _photo_count(b)
    img = []
    for x in blocks:
        refs = [x["props"].get("image")] + list(x["props"].get("images") or [])
        img += [f"{x['id']} points at '{r}', which they don't have" for r in refs if r and not _resolves(r, b)]
    if theme["imagery"] == "full-bleed" and not b.get("cover_url"):
        img.append("full-bleed imagery with no cover photo")
    gal = next((x for x in blocks if x["type"] == "gallery"), None)
    if gal and photos < 3:
        img.append(f"a gallery with {photos} photo(s); needs at least 3")
    out["images"] = (not img, "Images are theirs and there are enough." if not img else "; ".join(img).capitalize() + ".")

    # prices: loud only when there are prices, never on premium or quote.
    pricing = (b.get("page_brief") or {}).get("pricing")
    pp = theme["price_prominence"]
    pr = []
    if pp == "loud" and not _any_price(b):
        pr.append("loud prices with no prices")
    if pp == "loud" and pricing in ("premium", "quote"):
        pr.append(f"loud prices on a '{pricing}' brief")
    if pricing == "premium" and theme["density"] == "packed":
        pr.append("packed density on a premium brief")
    out["prices"] = (not pr, "Price treatment fits." if not pr else "; ".join(pr).capitalize() + ".")

    # playbook: the category's lead and its must-have blocks.
    pb = playbook_for(b)
    content = [x["type"] for x in blocks if x["type"] not in FRAME]
    miss = sorted(pb["needs"] - set(content))
    lead_ok = not content or content[0] in pb["lead"]
    if content and content[0] == "gallery" and photos < 3:
        lead_ok = False
    msg = []
    if miss:
        msg.append(f"missing {', '.join(miss)}")
    if not lead_ok:
        msg.append(f"leads with {content[0]}; this kind of business leads with {' or '.join(sorted(pb['lead']))}")
    out["playbook"] = (not msg, f"Follows the {_category(b) or 'default'} playbook." if not msg else "; ".join(msg).capitalize() + ".")

    return _result(lang, out, b, comp)


def _result(lang: str, out: dict, b: dict, comp: Optional[dict] = None) -> dict:
    rules = [{"id": k, "passed": out[k][0], "reason": out[k][1]} for k in ORDER if k in out]
    first = next((r for r in rules if not r["passed"]), None)
    clarity = check_page({**b, **({"page": comp} if comp else {})}, lang)
    gaps = [r for r in clarity["rules"] if not r["passed"] and r["id"] in ("offer", "proof", "action", "strengths", "where")]
    return {"lang": lang, "passed": first is None, "rules": rules,
            "fix_first": f"{first['id']}: {first['reason']}" if first else None,
            "content_gaps": [{"id": r["id"], "reason": r["reason"]} for r in gaps]}


def _signature(comp: dict) -> tuple:
    return tuple(x.get("type") for x in comp.get("blocks") or [])


def check_options(business: dict, options: list[dict], lang: str = "en") -> dict:
    """P7d: three options, each passing on its own, and actually different:
    every pair differs in at least two dials or in its block order, and no
    two share a headline. Three near-copies is one option shown three times."""
    results = [check_composition(business, o, lang) for o in options]
    same = []
    for i in range(len(options)):
        for j in range(i + 1, len(options)):
            a, c = options[i] or {}, options[j] or {}
            ta, tc = {**(a.get("theme") or {})}, {**(c.get("theme") or {})}
            dials = sum(ta.get(k) != tc.get(k) for k in set(ta) | set(tc))
            if dials < 2 and _signature(a) == _signature(c):
                same.append(f"options {i + 1} and {j + 1} differ in {dials} dial(s) and not in layout")
            ha = next(((x.get("props") or {}).get("title") for x in a.get("blocks") or [] if x.get("type") == "hero"), None)
            hc = next(((x.get("props") or {}).get("title") for x in c.get("blocks") or [] if x.get("type") == "hero"), None)
            if ha and ha == hc:
                same.append(f"options {i + 1} and {j + 1} share a headline")
    return {"lang": lang, "count_ok": len(options) == 3, "distinct": not same, "why_not_distinct": same,
            "options": results, "passed": len(options) == 3 and not same and all(r["passed"] for r in results)}
