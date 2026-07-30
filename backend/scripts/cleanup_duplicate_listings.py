"""Preview and resolve duplicate property listings.

WHY A SCRIPT: the admin Duplicates tool works fine, but at ~28 clusters /
~111 redundant listings, clicking through each group by hand is slow and
error-prone. This gives you one reviewable plan up front, then executes it
in a single pass.

WHAT IT REUSES: nothing about the actual delete/merge logic is
reimplemented here. Grouping uses `utils.dedupe.dedupe_signature`, and
--apply calls the real `/admin/duplicates/resolve` handler
(`routes.admin.duplicates.resolve_duplicates`) directly. So this script
can't drift from what the admin UI does — it's the same code path, just
driven from the terminal with a preview step.

SAFETY:
  * DRY RUN by default. Prints the plan and changes nothing.
  * --apply writes a full JSON backup of every listing in every affected
    cluster BEFORE touching anything.
  * The resolver re-attaches bookings, chat messages, likes, nudges, admin
    blocks and subleases to the surviving listing, and merges photo/video
    URLs into it, before deleting the redundant rows. Nothing is orphaned.

Usage (from the `backend/` directory):

    # 1. Review the plan. Read-only.
    python scripts/cleanup_duplicate_listings.py

    # 2. Execute it, after you've read step 1.
    python scripts/cleanup_duplicate_listings.py --apply

    # Optional: --mode keep_oldest | keep_newest | keep_richest
    #   keep_richest (default) — survivor = most photos, then longest
    #     description. The resolver additionally PREFERS any twin that
    #     already has bookings or chat history, so a renter's saved link
    #     keeps working.
    #   keep_oldest  — survivor = earliest created.
    #   keep_newest  — survivor = most recently created.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

_env = dotenv_values(ROOT / ".env")
# The app modules read these at import time, so they must be set first.
for _k in ("MONGO_URL", "DB_NAME"):
    if not os.environ.get(_k) and _env.get(_k):
        os.environ[_k] = _env[_k]

if not os.environ.get("MONGO_URL") or not os.environ.get("DB_NAME"):
    sys.exit(
        "MONGO_URL and DB_NAME must be set (backend/.env or environment).\n"
        "Point them at the database you want to inspect."
    )

ACTIVE = ["active", "pending", "draft"]


async def build_plan(db):
    """Group live listings exactly the way the admin tool does."""
    from utils.dedupe import dedupe_signature

    rows = await db.properties.find(
        {"status": {"$in": ACTIVE}},
        {
            "_id": 0, "id": 1, "owner_id": 1, "address": 1, "rental_type": 1,
            "bedrooms": 1, "floor": 1, "area": 1, "title": 1, "created_at": 1,
            "images": 1, "videos": 1, "description": 1, "monthly_price": 1,
            "nightly_price": 1, "currency": 1, "status": 1,
        },
    ).to_list(20000)

    groups: dict[tuple, list[dict]] = defaultdict(list)
    unkeyed = 0
    for r in rows:
        sig = dedupe_signature(
            owner_id=r.get("owner_id"), address=r.get("address"),
            rental_type=r.get("rental_type"), bedrooms=r.get("bedrooms"),
            floor=r.get("floor"), area=r.get("area"), title=r.get("title"),
        )
        if sig is None:
            unkeyed += 1
            continue
        groups[sig].append(r)

    clusters = {k: v for k, v in groups.items() if len(v) > 1}
    return rows, clusters, unkeyed


async def activity_counts(db, prop_ids):
    """bookings + messages per property — the resolver biases the survivor
    toward listings that already have this history."""
    counts = {pid: {"bookings": 0, "messages": 0} for pid in prop_ids}
    if not prop_ids:
        return counts
    for coll, key in (("bookings", "bookings"), ("messages", "messages")):
        async for row in db[coll].aggregate([
            {"$match": {"property_id": {"$in": list(prop_ids)}}},
            {"$group": {"_id": "$property_id", "n": {"$sum": 1}}},
        ]):
            if row["_id"] in counts:
                counts[row["_id"]][key] = row["n"]
    return counts


def predict_survivor(props, mode, act):
    """Mirror of the resolver's choice, for preview purposes only.

    Source of truth: routes/admin/duplicates.py. If this ever disagrees
    with the resolver, the resolver wins — --apply calls it directly.
    """
    active = [p for p in props if (act[p["id"]]["bookings"] + act[p["id"]]["messages"]) > 0]
    candidates = active or props
    if mode == "keep_newest":
        return sorted(candidates, key=lambda p: p.get("created_at") or "")[-1]
    if mode == "keep_oldest":
        return sorted(candidates, key=lambda p: p.get("created_at") or "")[0]
    return sorted(
        candidates,
        key=lambda p: (len(p.get("images") or []), len(p.get("description") or ""),
                       p.get("created_at") or ""),
    )[-1]


async def main(apply: bool, mode: str) -> None:
    from routes.deps import db

    print(f"database : {os.environ['DB_NAME']}")
    print(f"mode     : {mode}")
    print(f"action   : {'APPLY (will delete)' if apply else 'DRY RUN (no changes)'}\n")

    rows, clusters, unkeyed = await build_plan(db)
    print(f"live listings              : {len(rows)}")
    print(f"  no signature (skipped)   : {unkeyed}")
    print(f"  duplicate clusters       : {len(clusters)}")
    redundant = sum(len(v) - 1 for v in clusters.values())
    print(f"  redundant listings       : {redundant}")
    print(f"  listings after cleanup   : {len(rows) - redundant}\n")

    if not clusters:
        print("Nothing to do.")
        return

    all_ids = [p["id"] for v in clusters.values() for p in v]
    act = await activity_counts(db, all_ids)

    print("=" * 78)
    print("PLAN — one line per listing.  KEEP = survives,  del = removed")
    print("=" * 78)
    total_photos_merged = 0
    for sig, props in sorted(clusters.items(), key=lambda kv: -len(kv[1])):
        survivor = predict_survivor(props, mode, act)
        head = props[0]
        price = head.get("monthly_price") or head.get("nightly_price") or "?"
        print(f"\n[{len(props)}x] {head.get('title')!r} | {head.get('area')} | "
              f"{head.get('currency') or ''}{price}")
        addr = head.get("address")
        print(f"       matched on: {'address' if addr else 'area + title'}"
              f"{'' if addr else '  (address blank)'}"
              f"   beds={head.get('bedrooms')} floor={head.get('floor')}")
        # Photos that only exist on the doomed copies get merged into the survivor.
        surv_imgs = set(survivor.get("images") or [])
        incoming = set()
        for p in props:
            if p["id"] != survivor["id"]:
                incoming |= {u for u in (p.get("images") or []) if u and u not in surv_imgs}
        total_photos_merged += len(incoming)
        for p in sorted(props, key=lambda x: x.get("created_at") or ""):
            a = act[p["id"]]
            flag = "KEEP" if p["id"] == survivor["id"] else " del"
            extra = []
            if a["bookings"]:
                extra.append(f"{a['bookings']} booking(s)")
            if a["messages"]:
                extra.append(f"{a['messages']} message(s)")
            print(f"   {flag}  {p['id']}  imgs={len(p.get('images') or []):<2} "
                  f"created={str(p.get('created_at'))[:10]}"
                  f"{('  ' + ', '.join(extra)) if extra else ''}")
        if incoming:
            print(f"         -> {len(incoming)} extra photo(s) merged into the survivor")

    print("\n" + "=" * 78)
    print(f"TOTAL: {redundant} listings removed, {len(clusters)} survivors kept, "
          f"{total_photos_merged} photos merged forward")
    print("Bookings, chats, likes and subleases on removed listings are")
    print("re-attached to the survivor first — nothing is orphaned.")
    print("=" * 78)

    if not apply:
        print("\nDRY RUN — nothing was changed.")
        print("Re-run with --apply to execute this plan.")
        return

    # --- backup, then delegate to the real resolver -----------------------
    stamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    backup = ROOT / "scripts" / f"duplicate_cleanup_backup_{stamp}.json"
    full = await db.properties.find(
        {"id": {"$in": all_ids}}, {"_id": 0}
    ).to_list(20000)
    backup.write_text(json.dumps(full, indent=2, default=str), encoding="utf-8")
    print(f"\nbackup written: {backup}")
    print(f"  ({len(full)} full listing documents, restorable)")

    from routes.admin.duplicates import DuplicateResolveRequest, resolve_duplicates

    req = DuplicateResolveRequest(mode=mode, keys=None, strict_only=False)
    result = await resolve_duplicates(req, payload={"role": "admin", "user_id": "cleanup-script"})

    print(f"\ndeleted        : {result.get('deleted')}")
    print(f"re-attached    : {result.get('reattached')}")
    remaining = await db.properties.count_documents({"status": {"$in": ACTIVE}})
    print(f"live listings  : {remaining}")
    print("\nDone. Refresh the site to see the result.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true",
                    help="execute the plan (default is a dry run)")
    ap.add_argument("--mode", default="keep_richest",
                    choices=["keep_richest", "keep_oldest", "keep_newest"])
    args = ap.parse_args()
    asyncio.run(main(args.apply, args.mode))
