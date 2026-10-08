"""Keep only restaurants whose own website names their hechsher.

    python -m scripts.check_kosher_websites --city Jerusalem --dry-run
    python -m scripts.check_kosher_websites --city Jerusalem
    python -m scripts.check_kosher_websites --city Jerusalem --recheck

Tzvi, 8 Oct 2026: "leave out anything doubtful and you can look at
restaurant websites to see their hechsher". A Google result for "kosher
pizza" is only a candidate: a random 25 from Jerusalem held a cafe in East
Jerusalem and a grill in Sheikh Jarrah.

For each place found by import_kosher_restaurants this asks Google for the
place's name and website (used here and not stored: Google's terms), reads
the restaurant's own home page and up to three of its pages whose link
mentions kashrut, and decides:

    certified       a certifier is named (on the site, or in the place's own
                    name)                          -> status "listed"
    kosher_unnamed  says kosher, names no certifier -> "hidden"
    says_not_kosher "not kosher" / "לא כשר"         -> "hidden"
    no_evidence     nothing, no website, or only a social page -> "hidden"

Hidden places stay in the database for the admin queue and for owners to
claim; nothing is deleted. What IS stored is ours: the certifier as read,
meat/dairy/pareve when the site says so, and when it was checked.
`verified` stays False either way: a website is the restaurant's claim, and
"Verified" is reserved for a person checking the certificate.

Cost: Place Details with websiteUri bills as Enterprise (1,000 free a month,
then paid). One call per place, never repeated unless --recheck.
"""
import argparse
import asyncio
import html
import os
import re
import sys
from collections import Counter
from datetime import UTC, datetime
from urllib.parse import urljoin, urlparse

import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routes.deps import db  # noqa: E402
from scripts.import_kosher_restaurants import CITIES, DETAILS_URL, Budget, Places  # noqa: E402

# Certifier -> how we write it. First match wins, so the specific forms
# (Rabbanut + Mehadrin) come before the general ones (Rabbanut).
CERTIFIERS = [
    (r'(העדה החרדית|עדה החרדית|eida|edah|eidah|edah\s*ha\s*charedis|badatz\s*eda)', "Badatz Eida HaChareidit"),
    (r'(בד"?״?ץ\s*בית יוסף|badatz\s*beit\s*yosef|beit\s*yosef)', "Badatz Beit Yosef"),
    (r'(רובין|rubin)', "Badatz Rav Rubin"),
    (r'(לנדא|landau)', "Rav Landau"),
    (r'(מחפוד|machpud|mahfud|יורה דעה|yoreh\s*deah)', "Badatz Yoreh Deah (Rav Machpud)"),
    (r'(חתם סופר|chatam\s*sofer|chasam\s*sofer)', "Badatz Chatam Sofer"),
    (r'(אגודת ישראל|agudat\s*yisrael|agudath\s*israel)', "Badatz Agudat Yisrael"),
    (r'(בעלז|belz)', "Badatz Belz"),
    (r'(שארית ישראל|she.?erit\s*yisrael)', "Badatz She'erit Yisrael"),
    # Whole word only: צהר is also the start of צהריים (lunch).
    (r'(\bצהר\b|tzohar)', "Tzohar"),
    (r'((?-i:\bOU\b)|orthodox\s*union)', "OU"),
    (r'((רבנות|rabbanut|rabbinate)[^.\n]{0,40}(מהדרין|mehadrin))|((מהדרין|mehadrin)[^.\n]{0,40}(רבנות|rabbanut|rabbinate))', "Rabbanut, Mehadrin"),
    (r'(רבנות|rabbanut|rabbinate|chief\s*rabbinate)', "Rabbanut"),
    (r'(בד"?״?ץ|badatz)', "Badatz (name not given)"),
]
NOT_KOSHER = r'(לא כשר|אינו כשר|not\s+kosher|non[-\s]?kosher)'
KOSHER = r'(כשר|כשרות|השגחה|kosher|kashrut|hashgacha|mehadrin|מהדרין)'
KASHRUT = [(r'(חלבי|dairy|halavi|chalavi)', "dairy"), (r'(בשרי|meat\s+restaurant|besari|fleishig)', "meat"),
           (r'(פרווה|parve|pareve)', "pareve")]
SOCIAL = ("facebook.com", "instagram.com", "linktr.ee", "wa.me", "whatsapp.com", "tiktok.com", "wolt.com", "10bis.co.il")
LINK_HINT = re.compile(r'(kashrut|kosher|kashrus|hechsher|כשרות|כשר|teuda|about|odot|אודות)', re.I)


def page_text(raw):
    """Visible text plus image alt text and file names (certificates are
    often only a picture called kashrut.jpg)."""
    raw = re.sub(r'(?is)<(script|style|noscript)[^>]*>.*?</\1>', ' ', raw)
    alts = ' '.join(re.findall(r'(?i)\balt=["\']([^"\']{0,200})', raw))
    srcs = ' '.join(re.findall(r'(?i)\bsrc=["\']([^"\']{0,300})', raw))
    text = re.sub(r'<[^>]+>', ' ', raw)
    return html.unescape(f"{text} {alts} {srcs}")


def classify(texts):
    """(verdict, certifier, kashrut, snippet) from the name and pages read."""
    blob = re.sub(r'\s+', ' ', ' '.join(t for t in texts if t))
    if re.search(NOT_KOSHER, blob, re.I):
        return "says_not_kosher", None, None, _around(blob, NOT_KOSHER)
    kashrut = next((k for pat, k in KASHRUT if re.search(pat, blob, re.I)), None)
    # A certifier only counts near the word kosher, so a street called
    # Rubin or a page about the Chief Rabbinate's history does not certify.
    for m in re.finditer(KOSHER, blob, re.I):
        window = blob[max(0, m.start() - 120): m.end() + 120]
        for pat, name in CERTIFIERS:
            if re.search(pat, window, re.I):
                return "certified", name, kashrut, window.strip()[:240]
    if re.search(KOSHER, blob, re.I):
        return "kosher_unnamed", None, kashrut, _around(blob, KOSHER)
    return "no_evidence", None, kashrut, None


def _around(blob, pat):
    m = re.search(pat, blob, re.I)
    return blob[max(0, m.start() - 80): m.end() + 80].strip() if m else None


HE = re.compile(r'[֐-׿]')
JUNK_TITLE = re.compile(r'^(home|homepage|main|בית|דף הבית|ראשי|welcome|ברוכים הבאים)$', re.I)
PHONE = re.compile(r'(?<![\d+])(?:\+?972[-\s]?|0)(?:5\d|[2-489]|7[2-9])[-\s]?\d{3}[-\s]?\d{4}(?!\d)|\*\d{4}(?!\d)|1[-\s]?(?:700|800|599)[-\s]?\d{3}[-\s]?\d{3}')


def _intl(num):
    """Digits for wa.me / tel: links, Israeli numbers in international form."""
    d = re.sub(r'\D', '', num)
    if d.startswith('0'):
        d = '972' + d[1:]
    return d


# Sites that list many restaurants. Their page may still name the place's
# hechsher, but its title and phone are the directory's, not the restaurant's.
DIRECTORIES = ("israelbusinessguide.com", "mishlohim.co.il", "gokosher.co.il", "b144.co.il", "orderz.mobi",
               "daber.ai", "rest.co.il", "easy.co.il", "tripadvisor.", "zap.co.il", "2eat.co.il", "foody.co.il",
               "google.com", "yelp.")
GENERIC_NAMES = re.compile(r'^(bakery|bakeries|מאפיות|מאפייה|restaurant|מסעדה|cafe|קפה|pizza|פיצה|menu|תפריט|order|הזמנות|delivery|משלוחים|mishlohim)$', re.I)


def clean_phone(raw):
    """A number someone can dial, as the site wrote it, or None. Judged on
    the digits: the strict pattern above is for finding numbers in prose,
    and threw away good ones written as 1-700-50-60-70 or +972 2 633 0646."""
    s = (raw or "").replace("%20", " ")
    s = re.sub(r'[^\d+*\-\s()]', '', s).strip(" -")
    d = re.sub(r'\D', '', s)
    ok = ((d.startswith("972") and 11 <= len(d) <= 12)
          or (d.startswith("0") and 9 <= len(d) <= 10)
          or (s.startswith("*") and len(d) == 4)
          or (d[:4] in ("1700", "1800", "1599") and len(d) == 10))
    return s if ok else None


def tidy_contact(c):
    """Drop what cannot be right: a directory's details, a malformed number,
    a generic word for a name. Returns the contact with `needs_review` set to
    the reasons a person should look, or [] when it is clean."""
    c = dict(c)
    reasons = []
    host = urlparse(c.get("website") or "").netloc.lower()
    if any(d in host for d in DIRECTORIES):
        c.update(website=None, name_en=None, name_he=None, phone=None, whatsapp=None)
        reasons.append("directory site, not their own")
    c["phone"] = clean_phone(c.get("phone"))
    wa = re.sub(r'\D', '', c.get("whatsapp") or "")
    if wa.startswith("9720"):
        wa = "972" + wa[4:]
    c["whatsapp"] = wa if re.fullmatch(r'972(5\d)\d{7}', wa) or (wa and not wa.startswith("972") and 10 <= len(wa) <= 15) else None
    for k in ("name_en", "name_he"):
        if c.get(k) and GENERIC_NAMES.match(c[k].strip()):
            c[k] = None
    if not (c.get("name_en") or c.get("name_he")):
        reasons.append("no name from their site")
    c["needs_review"] = reasons
    return c


def contact_from(raw, url):
    """What the restaurant's own home page says about reaching it. Ours to
    keep: it is their site, not Google's data (Tzvi, 8 Oct 2026)."""
    out = {"website": url}
    m = (re.search(r'(?is)<meta[^>]+property=["\']og:site_name["\'][^>]+content=["\']([^"\']+)', raw)
         or re.search(r'(?is)<title[^>]*>(.*?)</title>', raw))
    if m:
        parts = [p.strip() for p in re.split(r'\s[|\-–—•:]\s', html.unescape(m.group(1))) if p.strip()]
        parts = [p for p in parts if not JUNK_TITLE.match(p) and len(p) <= 60]
        he = next((p for p in parts if HE.search(p)), None)
        en = next((p for p in parts if not HE.search(p)), None)
        out["name_en"], out["name_he"] = en, he
    tel = re.search(r'(?i)href=["\']tel:([^"\']+)', raw)
    if tel:
        out["phone"] = tel.group(1).strip()
    else:
        found = PHONE.search(page_text(raw))
        out["phone"] = found.group(0).strip() if found else None
    wa = re.search(r'(?i)(?:wa\.me/|api\.whatsapp\.com/send\?phone=|whatsapp\.com/send\?phone=)\+?(\d{9,15})', raw)
    out["whatsapp"] = wa.group(1) if wa else None
    return out


async def read_site(http, url):
    """Home page plus up to three linked pages that look like kashrut/about.
    Returns (texts, contact)."""
    texts, contact = [], None
    try:
        r = await http.get(url)
        if r.status_code >= 400 or "html" not in r.headers.get("content-type", "html"):
            return texts, contact
        raw = r.text[:2_000_000]
        texts.append(page_text(raw))
        contact = contact_from(raw, str(r.url))
        base = str(r.url)
        host = urlparse(base).netloc
        links = []
        for href, label in re.findall(r'(?is)<a[^>]+href=["\']([^"\'#]+)["\'][^>]*>(.*?)</a>', raw):
            full = urljoin(base, href)
            if urlparse(full).netloc == host and LINK_HINT.search(href + " " + label) and full not in links:
                links.append(full)
        for link in links[:3]:
            try:
                p = await http.get(link)
                if p.status_code < 400:
                    texts.append(page_text(p.text[:2_000_000]))
            except httpx.HTTPError:
                pass
    except httpx.HTTPError:
        pass
    return texts, contact


async def check_one(client, http, doc):
    data = await client._post(DETAILS_URL.format(doc["place_id"]), None, "displayName,websiteUri", method="GET")
    name = (data.get("displayName") or {}).get("text", "")
    site = data.get("websiteUri") or ""
    texts = [name]
    source = "name"
    contact = None
    if site and not any(s in site for s in SOCIAL):
        pages, contact = await read_site(http, site)
        texts += pages
        source = "website"
    verdict, cert, kashrut, snippet = classify(texts)
    if verdict == "certified" and classify([name])[0] == "certified":
        source = "name"
    now = datetime.now(UTC).isoformat()
    await db.restaurants.update_one({"_id": doc["_id"]}, {"$set": {
        "kosher_check": {"verdict": verdict, "source": source if verdict != "no_evidence" else None,
                         "had_website": bool(site), "snippet": snippet, "checked_at": now},
        "kosher_certification": cert,
        "kashrut": kashrut,
        "status": "listed" if verdict == "certified" else "hidden",
        # From their own site (None when they have none we could read).
        "contact": {**tidy_contact(contact), "read_at": now} if contact else None,
    }})
    return verdict, cert, name, bool(site)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--city", action="append")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--recheck", action="store_true")
    ap.add_argument("--max-requests", type=int, default=1000)
    ap.add_argument("--only-cert", help="recheck only places read as this certifier")
    ap.add_argument("--only-listed", action="store_true", help="recheck only listed places (to read contacts)")
    a = ap.parse_args()
    cities = a.city or list(CITIES)
    q = {"city": {"$in": cities}}
    if a.only_listed:
        q["status"] = "listed"
    elif a.only_cert:
        q["kosher_certification"] = a.only_cert
    elif not a.recheck:
        q["kosher_check"] = {"$exists": False}
    docs = await db.restaurants.find(q, {"place_id": 1}).to_list(None)
    print(f"{len(docs)} place(s) to check in {', '.join(cities)}; one Google call each")
    if a.dry_run:
        print("dry run: nothing fetched")
        return
    key = os.environ.get("GOOGLE_PLACES_API_KEY", "")
    if not key:
        sys.exit("GOOGLE_PLACES_API_KEY is not set in backend/.env.")
    client = Places(key, a.max_requests)
    http = httpx.AsyncClient(timeout=12, follow_redirects=True, headers={
        "User-Agent": "Mozilla/5.0 (compatible; MyIsraelRental kashrut check; +https://myisraelrental.com)",
        "Accept-Language": "he,en;q=0.8"})
    tally, certs, rows = Counter(), Counter(), []
    sem = asyncio.Semaphore(6)

    async def one(d):
        async with sem:
            try:
                v, c, name, had = await check_one(client, http, d)
            except Budget:
                raise
            except Exception as e:  # one bad site never stops the run
                print("  skipped", d["place_id"], type(e).__name__)
                return
            tally[v] += 1
            if c:
                certs[c] += 1
            rows.append((v, c, name, had))
    try:
        await asyncio.gather(*(one(d) for d in docs))
    except Budget:
        print(f"Stopped at the budget of {client.max} calls; rerun to continue.")
    finally:
        await client.http.aclose()
        await http.aclose()
    print(f"\n{sum(tally.values())} checked, {client.calls} Google calls")
    for v in ("certified", "kosher_unnamed", "says_not_kosher", "no_evidence"):
        print(f"  {v:<16} {tally[v]}")
    print("\nCertifiers named:")
    for c, n in certs.most_common():
        print(f"  {c:<34} {n}")
    for v in ("certified", "kosher_unnamed", "says_not_kosher", "no_evidence"):
        print(f"\nSample, {v} (names from Google, not stored):")
        for vv, c, name, had in [r for r in rows if r[0] == v][:12]:
            print(f"  {name[:42]:<42} {c or ''}{'' if had else '  (no website)'}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    asyncio.run(main())
