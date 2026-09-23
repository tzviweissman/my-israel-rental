"""Read-only clarity report (docs/ai-page-builder-spec.md, P4a).

Runs utils.page_clarity.check_page, in English and in Hebrew, on business
pages fetched from a site's PUBLIC API: exactly what any visitor's browser
loads, no database access, nothing written. `page_brief` is private, so the
"action" and "strengths" rules see no brief on any page read this way.

    python -m scripts.clarity_report https://myisraelrental.com <business id or slug> ...
    python -m scripts.clarity_report https://myisraelrental.com --pick   # pick five cases
"""
from __future__ import annotations

import collections
import json
import re
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from utils.page_clarity import check_page  # noqa: E402

HEB = re.compile(r"[֐-׿]")


def get(base: str, path: str):
    req = urllib.request.Request(f"{base}/api/{path}", headers={"User-Agent": "Mozilla/5.0 clarity-report"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def pick(base: str) -> list[tuple[str, str]]:
    """Five cases from the public services list: one service and no photos,
    the most services, a food business, the newest, and the most Hebrew."""
    gigs, page = [], 1
    while True:
        batch = get(base, f"marketplace/gigs?limit=200&page={page}&sort=newest")
        gigs += batch
        if len(batch) < 200:
            break
        page += 1
    by = collections.defaultdict(list)
    for g in gigs:
        if g.get("business_id"):
            by[g["business_id"]].append(g)
    photo = lambda g: g.get("gallery") or any((t or {}).get("images") or (t or {}).get("image")
                                             for t in (g.get("tiers") or []) + (g.get("products") or []))
    rows = [(bid, gs) for bid, gs in by.items()]
    chosen: list[tuple[str, str]] = []

    def add(label, cands):
        for bid, gs in cands:
            if bid not in [c[1] for c in chosen]:
                chosen.append((label, bid))
                return

    add("one service, no photos", [r for r in rows if len(r[1]) == 1 and not any(photo(g) for g in r[1])])
    add(f"most services ({max(len(r[1]) for r in rows)})", sorted(rows, key=lambda r: -len(r[1])))
    add("food business", [r for r in rows if {g.get("category") for g in r[1]} & {"shops-products", "events-catering"}])
    add("newest", sorted(rows, key=lambda r: min(g.get("created_at") or "" for g in r[1]), reverse=True))
    heb = sorted(rows, key=lambda r: -sum(bool(HEB.search(g.get("title") or "")) for g in r[1]))
    add("most Hebrew", heb)
    return chosen


def main() -> None:
    base = sys.argv[1].rstrip("/")
    targets = pick(base) if "--pick" in sys.argv else [("", x) for x in sys.argv[2:]]
    print(f"# Clarity report, read-only, from {base}\n")
    for label, ident in targets:
        biz = get(base, f"marketplace/business/{ident}")
        print(f"## {biz.get('name')} ({label or ident})\n")
        print(f"{len(biz.get('listings') or [])} services, {biz.get('rating_count') or 0} reviews, "
              f"verified: {bool(biz.get('verified'))}, founded: {biz.get('founded_year') or '-'}, "
              f"joined: {biz.get('member_since') or '-'}\n")
        for lang in ("en", "he"):
            r = check_page(biz, lang)
            print(f"**{'English' if lang == 'en' else 'Hebrew'}: {'PASS' if r['passed'] else 'FAIL'}**"
                  + (f", fix first: {r['fix_first']}" if r["fix_first"] else ""))
            for rule in r["rules"]:
                print(f"- {'pass' if rule['passed'] else 'FAIL'} {rule['id']}: {rule['reason']}")
            print()


if __name__ == "__main__":
    main()
