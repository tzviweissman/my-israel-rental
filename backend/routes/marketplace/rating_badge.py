"""The rating badge a business puts on its own website (Tzvi, 22 Oct 2026,
from GoHighLevel's "website review widgets").

GET /marketplace/business/{slug}/rating-badge.svg?lang=en|he&theme=light|dark

A picture, not a script: it works anywhere an image does (Wix, WordPress,
a link-in-bio page, an email signature), runs no code on their site, and
is wrapped in a link to their page by the code we hand them. It is drawn
live from the same numbers the page shows (businesses.business_rating),
so it can never claim more than the page does:

  * 3 or more reviews: the stars, the average and the count.
  * 1 or 2 reviews: the count only. Two reviews are not an average
    (utils/reviews.MIN_FOR_AVERAGE, the same floor as everywhere else).
  * none: "Find us on MyIsraelRental".

Same size family and logo mark as the static "Find us" badges in
frontend/public/badge. Cached for an hour; a new review shows within that.
"""
from __future__ import annotations

import html
import math
from typing import Literal

from fastapi import APIRouter, HTTPException, Response

from .businesses import _resolve, business_rating

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

W, H = 260, 64
STAR = "#F5B301"
FONT_EN = "Manrope, 'Segoe UI', Helvetica, Arial, sans-serif"
FONT_HE = "Assistant, 'Segoe UI', Arial, sans-serif"
THEMES = {
    "light": {"bg": "#FFFFFF", "edge": "#D1D5DB", "ink": "#111827", "soft": "#4B5563", "empty": "#E5E7EB"},
    "dark": {"bg": "#000000", "edge": "#000000", "ink": "#FFFFFF", "soft": "#D1D5DB", "empty": "#4B5563"},
}


def _mark(x: int) -> str:
    return (f'<g transform="translate({x} 12) scale(0.3333333333333333)">'
            '<rect x="4" y="4" width="112" height="112" rx="30" fill="#143C5A"/>'
            '<rect x="33" y="60" width="14" height="30" rx="6" fill="#7CA8C8"/>'
            '<rect x="53" y="44" width="14" height="46" rx="6" fill="#FFFFFF"/>'
            '<rect x="73" y="30" width="14" height="60" rx="6" fill="#C9A227"/></g>')


def _star(cx: float, cy: float, r: float = 6.5) -> str:
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.45
        pts.append(f"{cx + rr * math.cos(a):.2f},{cy + rr * math.sin(a):.2f}")
    return " ".join(pts)


def _stars(x0: float, y: float, avg: float, rtl: bool, empty: str) -> str:
    """Five stars from x0 (their left edge), filled to `avg` from the
    reading start: the left in English, the right in Hebrew."""
    step, size = 15, 13
    stars = "".join(f'<polygon points="{_star(x0 + 6.5 + i * step, y)}"/>' for i in range(5))
    total = 4 * step + size
    fill = total * max(0.0, min(avg, 5.0)) / 5
    cx = x0 + total - fill if rtl else x0
    return (f'<defs><clipPath id="f"><rect x="{cx:.2f}" y="{y - 8}" width="{fill:.2f}" height="16"/></clipPath></defs>'
            f'<g fill="{empty}">{stars}</g><g fill="{STAR}" clip-path="url(#f)">{stars}</g>')


def badge_svg(avg: float | None, count: int, lang: str = "en", theme: str = "light") -> str:
    """Pure, for tests."""
    c = THEMES.get(theme, THEMES["light"])
    he = lang == "he"
    font = FONT_HE if he else FONT_EN
    if he:
        mark, tx, anchor, d = _mark(208), 196, "start", ' direction="rtl" unicode-bidi="embed"'
    else:
        mark, tx, anchor, d = _mark(12), 64, "start", ""
    # Chrome ignores direction="rtl" in an SVG shown as an <img>, so a
    # Hebrew line with a number or a Latin name came out in the wrong order
    # ("MyIsraelRental-23 ..."). Explicit right-to-left embedding marks fix
    # the order in every renderer.
    rl = (lambda x: "\u202b" + x + "\u202c") if he else (lambda x: x)
    name_text = (f'<text x="{tx}" y="47" text-anchor="{"end" if he else "start"}" font-family="{FONT_EN}" '
                 f'font-size="17" font-weight="700" fill="{c["ink"]}">MyIsraelRental</text>')
    if avg is not None and count:
        label = (f"{count} ביקורות ב-MyIsraelRental" if he else f"{count} reviews on MyIsraelRental")
        x_stars = tx - 73 if he else tx
        num_x = x_stars - 8 if he else tx + 81
        body = (_stars(x_stars, 25, avg, he, c["empty"])
                + f'<text x="{num_x}" y="30" text-anchor="{"end" if he else "start"}" font-family="{FONT_EN}" '
                  f'font-size="15" font-weight="700" fill="{c["ink"]}">{avg:.1f}</text>'
                + f'<text x="{tx}" y="48" text-anchor="{anchor}" font-family="{font}" font-size="12" '
                  f'fill="{c["soft"]}"{d}>{html.escape(rl(label))}</text>')
    else:
        if count == 1:
            top = "ביקורת אחת ב-" if he else "1 review on"
        elif count:
            top = f"{count} ביקורות ב-" if he else f"{count} reviews on"
        else:
            top = "מצאו אותנו ב-" if he else "Find us on"
        label = f"{top} MyIsraelRental"
        body = (f'<text x="{tx}" y="28" text-anchor="{anchor}" font-family="{font}" font-size="12" '
                f'fill="{c["soft"]}"{d}>{html.escape(rl(top))}</text>' + name_text)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" '
            f'aria-label="{html.escape(label)}"><title>{html.escape(label)}</title>'
            f'<rect x="0.5" y="0.5" width="{W - 1}" height="{H - 1}" rx="14" fill="{c["bg"]}" stroke="{c["edge"]}"/>'
            f'{mark}{body}</svg>')


@router.get("/business/{slug_or_id}/rating-badge.svg")
async def rating_badge(slug_or_id: str, lang: Literal["en", "he"] = "en", theme: Literal["light", "dark"] = "light"):
    biz = await _resolve(slug_or_id)
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    r = await business_rating(biz["_id"])
    return Response(content=badge_svg(r["rating_avg"], r["rating_count"], lang, theme), media_type="image/svg+xml",
                    headers={"Cache-Control": "public, max-age=3600",
                             # Shown on other people's sites by design.
                             "Cross-Origin-Resource-Policy": "cross-origin",
                             "Access-Control-Allow-Origin": "*"})
