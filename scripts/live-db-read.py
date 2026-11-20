"""Read the LIVE database, never write it (Tzvi, 15 Nov 2026: "you always have my ok to read the live database").

    backend/.venv/Scripts/python scripts/live-db-read.py <collection> '<json filter>' [limit] [sort_field]
    backend/.venv/Scripts/python scripts/live-db-read.py gigs '{"title": {"$regex": "board", "$options": "i"}}' 5 -created_at
    backend/.venv/Scripts/python scripts/live-db-read.py --collections

Only find() is ever called. The connection address comes from Railway and is never printed; password, token
and secret fields are dropped from every row.
"""
import json
import re
import shutil
import subprocess
import sys

from pymongo import MongoClient

HIDE = re.compile(r"password|token|secret|otp|hash|api_key", re.I)
# People's contact details print as [hidden], so reading the live database never puts a customer's phone,
# email or address into a session (Tzvi, 20 Nov 2026). The field still shows, so you can see it is set.
PRIVATE = re.compile(r"phone|e164|email|address|street|apartment|floor|entrance|lat$|lng$|lon$", re.I)


def _railway_var(name: str) -> str:
    # shutil.which finds railway.cmd on Windows; shell=True with a list ran only "railway" on Mac and Linux (code review 18 Nov 2026).
    out = subprocess.run([shutil.which("railway") or "railway", "variables", "--service", "my-israel-rental Backend", "--kv"],
                         capture_output=True, text=True).stdout
    return next((ln.split("=", 1)[1] for ln in out.splitlines() if ln.startswith(name + "=")), "")


def _clean(x):
    if isinstance(x, dict):
        return {k: ("[hidden]" if PRIVATE.search(k) and isinstance(v, (str, int, float, dict, list)) and v not in ("", None) and not isinstance(v, bool) else _clean(v))
                for k, v in x.items() if not HIDE.search(k)}
    if isinstance(x, list):
        return [_clean(v) for v in x]
    return x


def main() -> None:
    # Hebrew in a row crashed the print on Windows and the run showed nothing at all (18 Nov 2026).
    sys.stdout.reconfigure(encoding="utf-8")
    url, name = _railway_var("MONGO_URL"), _railway_var("DB_NAME")
    if not url or not name:
        sys.exit("Could not get the live database address from Railway (railway login?).")
    db = MongoClient(url, serverSelectionTimeoutMS=15000)[name]
    if sys.argv[1:2] == ["--collections"]:
        print("\n".join(sorted(db.list_collection_names())))
        return
    coll, flt = sys.argv[1], json.loads(sys.argv[2] if len(sys.argv) > 2 else "{}")
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else 10
    # _id kept: other collections point at it (marketplace_gigs.business_id is a business's _id).
    cur = db[coll].find(flt).limit(limit)
    if len(sys.argv) > 4:
        cur = cur.sort(sys.argv[4].lstrip("-"), -1 if sys.argv[4].startswith("-") else 1)
    for row in cur:
        print(json.dumps(_clean(row), ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
