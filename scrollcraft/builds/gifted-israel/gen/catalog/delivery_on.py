"""Switch delivery on for Gifted Israel (Tzvi, 5 Nov 2026; their flyer says "We deliver"). No fee or areas set: the fee is confirmed on WhatsApp.
Run from backend/ under railway run. Only sets order_settings.delivery_on."""
import asyncio
import sys

sys.path.insert(0, '.')
from routes.deps import db  # noqa: E402

BIZ = "201af5a4-0049-4866-9d02-ac65d4d613a1"


async def main():
    biz = await db.businesses.find_one({"_id": BIZ})
    assert biz and biz.get("slug") == "gifted-israel", "wrong business"
    print("before:", (biz.get("order_settings") or {}).get("delivery_on", "never chosen"))
    r = await db.businesses.update_one({"_id": BIZ}, {"$set": {"order_settings.delivery_on": True}})
    print("written:", r.modified_count)


asyncio.run(main())
