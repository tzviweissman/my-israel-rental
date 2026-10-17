"""Holiday and seasonal products (Tzvi, 17 Oct 2026, from Shopify's
pre-order and seasonal collections).

A product can carry the dates it is on sale: `available_from` and
`available_until` (YYYY-MM-DD, Israel time, both optional, both
inclusive). Round challah for Rosh Hashana, mishloach manot for Purim,
sufganiyot for Chanukah: set once, they appear and disappear by
themselves. `available_until` is the last day to order it.

Outside its dates a product is hidden from the public: the order form,
the listing page and the business page. The owner's own views
(/my-gigs, the editor, the owner's preview) always show it, so it can be
edited for next year.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from zoneinfo import ZoneInfo

IL = ZoneInfo("Asia/Jerusalem")


def today_il() -> str:
    return datetime.now(IL).date().isoformat()


def in_season(p: dict[str, Any], today: Optional[str] = None) -> bool:
    today = today or today_il()
    start, end = p.get("available_from"), p.get("available_until")
    return not ((start and today < start) or (end and today > end))


def public_products(products: Optional[list[dict[str, Any]]], today: Optional[str] = None) -> list[dict[str, Any]]:
    today = today or today_il()
    return [p for p in products or [] if in_season(p, today)]
