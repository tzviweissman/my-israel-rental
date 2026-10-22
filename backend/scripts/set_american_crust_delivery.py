"""American Crust's delivery (Tzvi, 22 Oct 2026, from the owner: Ramat Eshkol and
surrounding areas 25 shekel; anything further depends on where). Sets only
order_settings.delivery_on and order_settings.delivery_fee on that business.
Dry run by default; --apply writes. Run from backend/ with railway run."""
import asyncio
import sys

sys.path.insert(0, '.')
from routes.deps import db  # noqa: E402

BIZ = "1d92c69d-89cb-42e7-b2bf-e1d076ed9e41"


async def main(apply: bool) -> None:
    biz = await db.businesses.find_one({"_id": BIZ}, {"name": 1, "order_settings": 1})
    if not biz or biz.get("name") != "American Crust":
        sys.exit("not American Crust")
    st = biz.get("order_settings") or {}
    print("now:", {k: st.get(k) for k in ("delivery_on", "delivery_fee", "area_fees")})
    print("set: delivery_on True, delivery_fee 25")
    if apply:
        r = await db.businesses.update_one({"_id": BIZ}, {"$set": {"order_settings.delivery_on": True, "order_settings.delivery_fee": 25}})
        print("written: modified", r.modified_count)
    else:
        print("dry run (add --apply)")

asyncio.run(main("--apply" in sys.argv))
