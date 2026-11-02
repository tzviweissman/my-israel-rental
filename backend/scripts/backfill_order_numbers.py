"""Give every order that has no number its store's next one, oldest first
(order numbers began 2 Nov 2026, routes/marketplace/order_texts.py).

Uses the same counter as new orders, so a number is never reused and it is
safe to run again: a second run only numbers orders the first one missed
(for example orders placed by the old code during the deploy). Run it
BEFORE the deploy so a store's old orders take #1001 onwards and new
orders follow them.

DRY RUN by default: prints how many orders each store would number.
``--apply`` writes. Run from ``backend/``.
"""
from __future__ import annotations

import os
import sys
from collections import Counter

from pymongo import MongoClient, ReturnDocument

db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
apply = "--apply" in sys.argv

todo = list(db.store_orders.find({"order_no": {"$exists": False}}, {"_id": 1, "business_id": 1}).sort("created_at", 1))
per_store = Counter(o["business_id"] for o in todo)
print(f"{len(todo)} orders without a number, in {len(per_store)} stores")
for biz_id, n in per_store.most_common(10):
    c = db.counters.find_one({"_id": f"order_no:{biz_id}"}) or {}
    start = 1001 + c.get("n", 0)
    print(f"  {biz_id}: {n} orders -> #{start} to #{start + n - 1}")

if apply:
    for o in todo:
        c = db.counters.find_one_and_update(
            {"_id": f"order_no:{o['business_id']}"}, {"$inc": {"n": 1}},
            upsert=True, return_document=ReturnDocument.AFTER)
        db.store_orders.update_one({"_id": o["_id"], "order_no": {"$exists": False}}, {"$set": {"order_no": 1000 + c["n"]}})
    print(f"numbered {len(todo)} orders")
