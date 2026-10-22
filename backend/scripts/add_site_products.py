"""Add the products (and service tiers) a business site shows but its live
listing lacks, so an order saved from the site names real products (page
rules 3k, "Every order is saved before WhatsApp opens"; Tzvi, 22 Oct 2026).

Reads site_products_plan.json next to this file. Only ever ADDS: an existing
product or tier (same name, any case) is left alone, never changed or deleted,
so running it twice adds nothing the second time.

    railway run --service "my-israel-rental Backend" <python> scripts/add_site_products.py                 dry run (default)
    ... add_site_products.py --apply                      write the products and tiers
    ... add_site_products.py --apply --convert-to-store   also set gig_type "store" on plan entries marked
                                                          convert_to_store (a separate decision: the order form
                                                          404s on any other listing type, and a store takes no bookings)

Run from backend/. Every write is logged to scripts/site_products_log.jsonl.
"""
import asyncio
import json
import sys
import uuid
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, '.')
from routes.deps import db  # noqa: E402

HERE = Path(__file__).parent
PLAN = HERE / "site_products_plan.json"
LOG = HERE / "site_products_log.jsonl"


def key(name: str) -> str:
    return " ".join((name or "").lower().split())


def tier_images(gig: dict, tier_name: str) -> list[str]:
    t = next((t for t in gig.get("tiers") or [] if key(t.get("name")) == key(tier_name)), None)
    return list((t or {}).get("images") or [])


def new_product(gig: dict, p: dict) -> dict:
    imgs = tier_images(gig, p["images_from_tier"]) if p.get("images_from_tier") else []
    return {
        # stable id from the listing and the name, so a re-run makes the same one
        "id": uuid.uuid5(uuid.NAMESPACE_URL, f"site-products/{gig['_id']}/{key(p['name'])}").hex[:12],
        "name": p["name"], "price": float(p["price"]), "price_to": None, "currency": p.get("currency") or "ILS",
        "description": p.get("description") or "", "image": None, "images": imgs, "in_stock": True,
        "group": p.get("group"), "serves": None, "width_cm": None, "length_cm": None,
    }


def new_tier(t: dict) -> dict:
    return {"name": t["name"], "price": float(t["price"]), "currency": t.get("currency") or "ILS",
            "description": t.get("description") or "", "features": [], "images": []}


async def main(apply: bool, convert: bool) -> None:
    plan = json.loads(PLAN.read_text(encoding="utf-8"))["listings"]
    for item in plan:
        gig = await db.marketplace_gigs.find_one({"_id": item["gig_id"]})
        assert gig and gig.get("business_id") == item["business_id"], f"wrong listing for {item['label']}"
        biz = await db.businesses.find_one({"_id": item["business_id"]}, {"name": 1})
        gtype = gig.get("gig_type") or "deliverable"
        print(f"\n{item['label']}  [{biz.get('name')}]  gig {gig['_id']}  type={gtype}")
        have_p = {key(p.get("name")): p for p in gig.get("products") or []}
        have_t = {key(t.get("name")) for t in gig.get("tiers") or []}
        add_p, add_t = [], []
        for p in item.get("products") or []:
            ex = have_p.get(key(p["name"]))
            if ex:
                note = "exists" if float(ex.get("price") or 0) == float(p["price"]) else f"EXISTS WITH A DIFFERENT PRICE ({ex.get('price')}), left alone"
                print(f"  product  {p['name']:<34} {p['price']:g} {p.get('currency', 'ILS')}  skip: {note}")
            else:
                np_ = new_product(gig, p)
                add_p.append(np_)
                print(f"  product  {p['name']:<34} {p['price']:g} {np_['currency']}  ADD  id {np_['id']}  photos {len(np_['images'])}")
        for t in item.get("tiers") or []:
            if key(t["name"]) in have_t:
                print(f"  tier     {t['name']:<34} {t['price']:g} {t.get('currency', 'ILS')}  skip: exists")
            else:
                add_t.append(new_tier(t))
                print(f"  tier     {t['name']:<34} {t['price']:g} {t.get('currency', 'ILS')}  ADD")
        flip = bool(item.get("convert_to_store")) and gtype != "store"
        if flip:
            print(f"  gig type {gtype} -> store: {'WILL SET (--convert-to-store)' if convert else 'NOT set (needs --convert-to-store); the order form 404s until it is'}")
        if not apply:
            continue
        upd: dict = {}
        if add_p:
            upd.setdefault("$push", {})["products"] = {"$each": add_p}
        if add_t:
            upd.setdefault("$push", {})["tiers"] = {"$each": add_t}
        sets = {}
        if flip and convert:
            sets["gig_type"] = "store"
        if upd or sets:
            sets["updated_at"] = datetime.now(UTC).isoformat()
            upd["$set"] = sets
            r = await db.marketplace_gigs.update_one({"_id": gig["_id"]}, upd)
            with LOG.open("a", encoding="utf-8") as f:
                f.write(json.dumps({"at": sets["updated_at"], "gig_id": gig["_id"], "label": item["label"], "products": [p["id"] for p in add_p],
                                    "tiers": [t["name"] for t in add_t], "gig_type": sets.get("gig_type"), "modified": r.modified_count}, ensure_ascii=False) + "\n")
            print(f"  written: modified={r.modified_count}")
    if not apply:
        print("\ndry run: nothing written (add --apply)")


asyncio.run(main("--apply" in sys.argv, "--convert-to-store" in sys.argv))
