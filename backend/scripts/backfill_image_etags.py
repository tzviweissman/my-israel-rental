"""Fill ``image_etags`` (md5 of each photo file, = Cloudinary's etag) on existing listings,
so the import's photo-duplicate check (``_background_mirror_properties``)
also compares against listings imported before 27 Oct 2026.

DRY RUN by default: prints listings that share a photo file. ``--apply``
writes the etags; it never hides anything. Run from ``backend/``.
"""
from __future__ import annotations

import os
import sys
from collections import defaultdict

from concurrent.futures import ThreadPoolExecutor

from pymongo import MongoClient

from utils.cloud_storage import file_md5, public_id_from_url

db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
apply = "--apply" in sys.argv

props = list(db.properties.find({}, {"_id": 0, "id": 1, "title": 1, "images": 1, "is_hidden": 1, "owner_id": 1, "rental_type": 1, "bedrooms": 1}))
pid_to_props: dict[str, list[str]] = defaultdict(list)
pid_url: dict[str, str] = {}
for p in props:
    for u in p.get("images") or []:
        pid, is_video = public_id_from_url(u)
        if pid and not is_video:
            pid_to_props[pid].append(p["id"])
            # Original file, no transformation, so the bytes are the stored ones.
            head, tail = u.split("/upload/", 1)
            pid_url[pid] = f"{head}/upload/{tail.split('/', 1)[1] if tail.startswith('f_') else tail}"

ids = list(pid_to_props)
with ThreadPoolExecutor(16) as pool:
    etag_of = {pid: e for pid, e in zip(ids, pool.map(lambda pid: file_md5(pid_url[pid]), ids)) if e}
print(f"{len(props)} listings, {len(ids)} photos, {len(etag_of)} etags found")

by_prop: dict[str, set[str]] = defaultdict(set)
for pid, pids in pid_to_props.items():
    if pid in etag_of:
        for prop_id in pids:
            by_prop[prop_id].add(etag_of[pid])

# Same rule as the import check: same rental type and bedrooms, and at least half of one
# listing's photos are on the other.
info = {p["id"]: p for p in props}
for a, b in sorted({tuple(sorted((x, y))) for x in by_prop for y in by_prop if x != y and by_prop[x] & by_prop[y]}):
    pa, pb = info[a], info[b]
    small = min(len(by_prop[a]), len(by_prop[b]))
    if pa.get("rental_type") == pb.get("rental_type") and pa.get("bedrooms") == pb.get("bedrooms") and 2 * len(by_prop[a] & by_prop[b]) >= small:
        state = lambda p: "hidden" if p.get("is_hidden") else "visible"
        print("COPY:", pa.get("rental_type"), [(p["id"][:8], (p.get("title") or "")[:30], state(p)) for p in (pa, pb)])

if apply:
    for prop_id, etags in by_prop.items():
        db.properties.update_one({"id": prop_id}, {"$set": {"image_etags": sorted(etags)}})
    print(f"wrote image_etags on {len(by_prop)} listings")
