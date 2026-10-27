"""27 Oct 2026: six accounts were saved with capital letters in their email.
Sign-in lowercases what is typed, so those people could not sign in, and
imports / re-sign-ups made second accounts (RL Properties, Moshe Greenes).

DRY RUN by default. --apply writes a JSON backup to $BACKUP_DIR (default backups/) first, then:
  * RL Properties: moves the imported account's listings onto the original
    account and deletes the imported account;
  * Moshe Greenes: deletes the empty second account;
  * lowercases every remaining mixed-case email.
Run from backend/ with the live env (railway run).
"""
from __future__ import annotations

import json
import os
import sys
from datetime import UTC, datetime

from pymongo import MongoClient

db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
apply = "--apply" in sys.argv

RL_KEEP, RL_DROP = "bd1628d6-24d2-485d-85b8-50e21e6aab47", "54e9c155-a90a-4bd6-9014-9c8e0c398dca"
GREENES_DROP_PREFIX = "c7831320"
OWNER_REFS = [("properties", "owner_id"), ("businesses", "owner_user_id"),
              ("marketplace_providers", "user_id"), ("bookings", "owner_id"),
              ("bookings", "renter_id"), ("liked_properties", "user_id"),
              ("business_staff", "user_id"), ("short_links", "owner_user_id"), ("orders", "user_id")]


def refs(uid):
    return {f"{c}.{f}": db[c].count_documents({f: uid}) for c, f in OWNER_REFS if db[c].count_documents({f: uid})}


greenes = db.users.find_one({"id": {"$regex": f"^{GREENES_DROP_PREFIX}"}}, {"_id": 0})
rl_keep = db.users.find_one({"id": RL_KEEP}, {"_id": 0})
rl_drop = db.users.find_one({"id": RL_DROP}, {"_id": 0})
assert rl_keep and rl_drop and greenes, "an expected account is missing"
assert rl_keep["email"].lower() == rl_drop["email"].lower()
print("RL keep", refs(RL_KEEP), "| RL drop", refs(RL_DROP))
print("Greenes drop", greenes["email"].lower() == "greenesmoshe@gmail.com", refs(greenes["id"]))
assert set(refs(RL_DROP)) <= {"properties.owner_id"}, "RL second account owns more than listings"
assert not refs(greenes["id"]), "Greenes second account is not empty"
mixed = [u for u in db.users.find({}, {"_id": 0, "id": 1, "email": 1}) if u.get("email") and u["email"] != u["email"].strip().lower()]
print("mixed-case emails:", len(mixed))

if apply:
    # Holds personal details: keep it out of the repo (BACKUP_DIR).
    out = os.environ.get("BACKUP_DIR", "backups")
    os.makedirs(out, exist_ok=True)
    path = f"{out}/email_case_{datetime.now(UTC):%Y%m%d%H%M%S}.json"
    backup = {"users": list(db.users.find({"id": {"$in": [RL_KEEP, RL_DROP, greenes["id"]] + [u["id"] for u in mixed]}}, {"_id": 0})),
              "properties": list(db.properties.find({"owner_id": RL_DROP}, {"_id": 0}))}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(backup, f, default=str, ensure_ascii=False)
    print("backup:", path)
    r = db.properties.update_many({"owner_id": RL_DROP}, {"$set": {
        "owner_id": RL_KEEP, "owner_name": rl_keep.get("name"), "owner_email": rl_keep["email"].lower()}})
    print("RL listings moved:", r.modified_count)
    print("deleted:", db.users.delete_one({"id": RL_DROP}).deleted_count + db.users.delete_one({"id": greenes["id"]}).deleted_count)
    for u in db.users.find({}, {"_id": 0, "id": 1, "email": 1}):
        if u.get("email") and u["email"] != u["email"].strip().lower():
            db.users.update_one({"id": u["id"]}, {"$set": {"email": u["email"].strip().lower()}})
    left = [u for u in db.users.find({}, {"_id": 0, "email": 1}) if u.get("email") and u["email"] != u["email"].lower()]
    print("mixed-case emails left:", len(left))
