"""'What you get' highlights on an item: the ONE list (storefront phase 3).

An owner picks up to four per item from a fixed list for its kind, never
free text. Labels live in the frontend's en.js / he.js under
`highlights.<id>`; the icon is a lucide-react name the frontend maps.

Food-only highlights (kosher and the like) are offered, accepted and shown
only for a food business, judged the way the kosher block judges it
(frontend/src/utils/businessProof.js): the business's own categories plus
those of its listings, any of them a food category. A highlight that no
longer fits (the business changed category) is kept but not shown.
"""
from __future__ import annotations

from typing import Any

MAX_PER_ITEM = 4
FOOD_CATEGORIES = {"events-catering", "shops-products"}

# kind -> ordered options. Food-only options are offered to either kind
# (a caterer is a service, a bakery is a shop) when the business is food.
HIGHLIGHTS: dict[str, list[dict[str, Any]]] = {
    "services": [
        {"id": "same_day", "icon": "Zap"},
        {"id": "own_equipment", "icon": "Wrench"},
        {"id": "free_quote", "icon": "FileText"},
        {"id": "weekends", "icon": "CalendarDays"},
        {"id": "evenings", "icon": "Moon"},
        {"id": "comes_to_you", "icon": "MapPin"},
        {"id": "online", "icon": "Video"},
    ],
    "products": [
        {"id": "handmade", "icon": "Hand"},
        {"id": "delivery", "icon": "Truck"},
        {"id": "pickup", "icon": "Store"},
        {"id": "gift_wrapped", "icon": "Gift"},
        {"id": "made_to_order", "icon": "PenLine"},
    ],
    "food": [
        {"id": "kosher", "icon": "BadgeCheck"},
        {"id": "vegan", "icon": "Leaf"},
        {"id": "gluten_free", "icon": "WheatOff"},
    ],
}


def kind_of(gig: dict) -> str:
    return "products" if (gig.get("gig_type") or "deliverable") == "store" else "services"


def is_food(categories) -> bool:
    return any(str(c or "").lower() in FOOD_CATEGORIES for c in (categories or []))


def options(kind: str, food: bool) -> list[dict[str, Any]]:
    return [*HIGHLIGHTS.get(kind, []), *(HIGHLIGHTS["food"] if food else [])]


def clean(ids, kind: str, food: bool) -> list[str]:
    """The owner's choice as saved, or ValueError naming what is wrong."""
    allowed = {o["id"] for o in options(kind, food)}
    out: list[str] = []
    for i in ids or []:
        if not isinstance(i, str) or i not in allowed:
            raise ValueError(f"'{i}' is not a highlight this item can have")
        if i not in out:
            out.append(i)
    if len(out) > MAX_PER_ITEM:
        raise ValueError(f"Pick at most {MAX_PER_ITEM} highlights")
    return out


def visible(ids, kind: str, food: bool) -> list[dict[str, Any]]:
    """What a visitor sees: the saved ids still allowed, with their icons."""
    by_id = {o["id"]: o for o in options(kind, food)}
    return [{"id": i, "icon": by_id[i]["icon"]} for i in (ids or []) if i in by_id][:MAX_PER_ITEM]


async def business_is_food(db, business_id: str | None) -> bool:
    if not business_id:
        return False
    biz = await db.businesses.find_one({"_id": business_id}, {"categories": 1}) or {}
    cats = list(biz.get("categories") or [])
    cats += await db.marketplace_gigs.distinct("category", {"business_id": business_id})
    return is_food(cats)


if __name__ == "__main__":
    assert clean(["same_day", "same_day", "weekends"], "services", False) == ["same_day", "weekends"]
    for bad in (["kosher"], ["handmade"], ["x"], ["same_day", "free_quote", "weekends", "evenings", "online"]):
        try:
            clean(bad, "services", False)
            raise SystemExit(f"accepted {bad}")
        except ValueError:
            pass
    assert clean(["kosher", "delivery"], "products", True) == ["kosher", "delivery"]
    assert visible(["kosher", "delivery"], "products", False) == [{"id": "delivery", "icon": "Truck"}]
    print("highlights ok")
