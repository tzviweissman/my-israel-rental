"""Replace every sublease contract's sign_token with a fresh one.

Why (20 Sep 2026, security scan F1): the public sublease reads returned
sign_token, the only credential on /contracts/sign/{token}, so every token
issued before that fix has been public. Unsigned contracts only need this;
signed ones are rotated too so the old link stops serving the file.

Dry run by default. Prints counts and ids, never a token.

    python scripts/rotate_sublease_sign_tokens.py            # dry run
    python scripts/rotate_sublease_sign_tokens.py --apply
"""
import os
import sys
import uuid

from pymongo import MongoClient

apply = "--apply" in sys.argv
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
subs = list(db.subleases.find({"sign_token": {"$nin": [None, ""]}}, {"id": 1, "contract_id": 1, "sign_token": 1}))
print(f"database: {db.name} | subleases with a token: {len(subs)} | {'APPLYING' if apply else 'dry run'}")
for s in subs:
    new = str(uuid.uuid4())
    c = db.contracts.count_documents({"sign_token": s["sign_token"]})
    print(f"  sublease {s['id']}: contract rows on the old token: {c}")
    if apply:
        db.contracts.update_many({"sign_token": s["sign_token"]}, {"$set": {"sign_token": new}})
        db.subleases.update_one({"_id": s["_id"]}, {"$set": {"sign_token": new}})
print("done" if apply else "nothing written")
