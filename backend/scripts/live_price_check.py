"""Check the LIVE site's listing prices for anything a customer would misread.

Why this exists (18 Sep 2026): a Sukkot list sent to customers said a flat
was "$154 / Sukkot" when the owner had said $154 a night. Months of nightly
audits had read the code and never looked at a real listing; one pass over
the live data found that bug's whole family in minutes. This is that pass,
run every night by the site audit (.claude/skills/site-audit/SKILL.md).

It reads ONLY the public list the /stays page itself loads
(GET /api/properties). No login, no database, no secrets, nothing written to
the site, and that list does not count as anyone viewing a listing.

Each finding is either a CODE problem (the site shows a price wrongly - fix
the code) or a DATA problem (an owner probably typed something wrong - a
person should look or call). The price shown is computed with the site's own
rule, utils/listing_price.shown_price, the same one the website and the
Smart List use, so this check sees what customers see.

    python3 backend/scripts/live_price_check.py                 # live site
    python3 backend/scripts/live_price_check.py --base http://localhost:8001
    python3 backend/scripts/live_price_check.py --out docs/audits/2026-09-19-price-check.md

Standard library only, so it runs anywhere Python does.
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from utils.listing_price import shown_price  # noqa: E402  (pure, no DB)

# Rough, and only for "does this look like a typo". Never shown to anyone.
USD_ILS = 3.7
NIGHT_TOO_HIGH_ILS = 4000        # a nightly price above this reads like a month
MONTH_TOO_LOW_ILS = 1500         # a monthly rent below this reads like a night
WHOLE_HOLIDAY_TOO_LOW_ILS = 1500 # a whole-holiday price below this reads like a night
HOLIDAY_NIGHT_TOO_HIGH_ILS = 4000


def ils(amount, currency) -> float:
    return float(amount) * USD_ILS if (currency or "ILS").upper() == "USD" else float(amount)


def money(amount, currency) -> str:
    sym = "$" if (currency or "ILS").upper() == "USD" else "₪"
    return f"{sym}{float(amount):,.0f}"


def check(rows: list[dict], site: str, today: date) -> dict[str, list[str]]:
    f: dict[str, list[str]] = {k: [] for k in (
        "no_price", "night_looks_like_month", "month_looks_like_night",
        "whole_holiday_looks_like_night", "holiday_night_looks_like_whole",
        "holiday_tag_without_price", "holiday_price_without_tag",
        "short_term_priced_by_night", "holiday_currency_differs", "availability_date_passed",
    )}
    for p in rows:
        link = f"{site}/property/{p.get('id')}"
        beds = p.get("bedrooms")
        beds = f"{beds:g}" if isinstance(beds, (int, float)) else "?"
        where = f"{(p.get('area') or 'no area')[:40]}, {beds} bedrooms"
        cur = p.get("currency") or "ILS"
        rt = p.get("rental_type")
        nightly, monthly = p.get("nightly_price") or 0, p.get("monthly_price") or 0
        lump = p.get("holiday_lump_price") or 0
        lcur = p.get("holiday_lump_currency") or cur
        tags = [t for t in (p.get("holiday_tags") or []) if t in ("sukkot", "pesach")]
        line = lambda what: f"{what} - {where} - {link}"  # noqa: E731

        if shown_price(p) is None:
            f["no_price"].append(line(f"{rt}, no price of any kind"))
        if nightly and ils(nightly, cur) >= NIGHT_TOO_HIGH_ILS:
            f["night_looks_like_month"].append(line(f"{money(nightly, cur)} a night ({rt})"))
        if rt != "vacation" and monthly and ils(monthly, cur) < MONTH_TOO_LOW_ILS:
            f["month_looks_like_night"].append(line(f"{money(monthly, cur)} a month ({rt})"))
        if lump:
            if p.get("holiday_lump_is_per_night"):
                if ils(lump, lcur) >= HOLIDAY_NIGHT_TOO_HIGH_ILS:
                    f["holiday_night_looks_like_whole"].append(line(f"{money(lump, lcur)} a night for {'/'.join(tags) or 'the holiday'}"))
            elif ils(lump, lcur) < WHOLE_HOLIDAY_TOO_LOW_ILS:
                f["whole_holiday_looks_like_night"].append(line(f"{money(lump, lcur)} for the whole of {'/'.join(tags) or 'the holiday'}"))
            if not tags:
                f["holiday_price_without_tag"].append(line(f"holiday price {money(lump, lcur)} but no holiday ticked"))
            if (p.get("holiday_lump_currency") or cur).upper() != cur.upper():
                f["holiday_currency_differs"].append(line(f"holiday price in {lcur}, listing in {cur}"))
        elif tags and rt == "vacation" and not nightly:
            f["holiday_tag_without_price"].append(line(f"offered for {'/'.join(tags)} with no price"))
        if rt == "short-term" and nightly and not monthly:
            f["short_term_priced_by_night"].append(line(f"{money(nightly, cur)} a night, no monthly rent"))
        d = p.get("available_from") if rt != "long-term" else p.get("starting_date")
        if d and str(d)[:10] < today.isoformat():
            f["availability_date_passed"].append(line(f"available from {str(d)[:10]}"))
    return f


TITLES = {
    "no_price": ("DATA", "Listings with no price at all", "Customers see \"Price on request\". Worth a call to the owner, or hiding the listing."),
    "night_looks_like_month": ("DATA", "Nightly price that reads like a monthly rent", "Probably a monthly or whole-stay price typed into the nightly box."),
    "month_looks_like_night": ("DATA", "Monthly rent that reads like a nightly price", "Probably a nightly price typed into the monthly box."),
    "whole_holiday_looks_like_night": ("DATA", "Whole-holiday price that reads like a nightly price", "The owner may have forgotten to tick \"per night\"."),
    "holiday_night_looks_like_whole": ("DATA", "Per-night holiday price that reads like a whole-holiday price", "The owner may have ticked \"per night\" by mistake."),
    "holiday_tag_without_price": ("DATA", "Offered for a holiday, but with no holiday price", "Shows in holiday lists without a price."),
    "holiday_price_without_tag": ("DATA", "Holiday price set, but no holiday ticked", "The price never shows in a Sukkot or Pesach list."),
    "short_term_priced_by_night": ("INFO", "Short-term listings priced by the night only", "Shown as \"per night\". Short-term is usually monthly here; check the figure is really nightly."),
    "holiday_currency_differs": ("INFO", "Holiday price in a different currency from the listing", "Usually deliberate; listed so it is a choice, not an accident."),
    "availability_date_passed": ("INFO", "Availability date already passed", "The site reads these as \"Available now\". Listed in case the listing is actually taken."),
}


def report(findings: dict[str, list[str]], total: int, site: str) -> str:
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    flagged = sum(len(v) for k, v in findings.items() if TITLES[k][0] == "DATA")
    out = [f"# Live price check, {today}", "",
           f"{total} live listings on {site}, read from the public list the /stays page loads. "
           f"**{flagged} look like owner typos** worth a look; info items below are for awareness.", ""]
    for k, rows in findings.items():
        kind, title, why = TITLES[k]
        out.append(f"## [{kind}] {title}: {len(rows)}")
        if rows:
            out.append(why)
            out.append("")
            out += [f"- {r}" for r in rows[:40]]
            if len(rows) > 40:
                out.append(f"- ...and {len(rows) - 40} more")
        out.append("")
    out.append("A CODE problem - the site showing a price wrongly - would show up as a listing "
               "whose price here disagrees with its card on /stays. The price rule itself is "
               "tested nightly by backend/tests/test_listing_price_parity.py.")
    return "\n".join(out) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--base", default="https://myisraelrental.com")
    ap.add_argument("--out", help="write the markdown report here as well as printing it")
    args = ap.parse_args()
    base = args.base.rstrip("/")
    try:
        req = urllib.request.Request(f"{base}/api/properties?limit=1000",
                                     headers={"User-Agent": "MyIsraelRental-price-check-bot"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.load(r)
    except Exception as e:  # noqa: BLE001
        # Say so. A check that could not run must never read as "all clear".
        print(f"PRICE CHECK DID NOT RUN: could not read {base}/api/properties ({e})")
        return 2
    rows = data if isinstance(data, list) else data.get("properties") or []
    text = report(check(rows, base, date.today()), len(rows), base)
    print(text)
    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
