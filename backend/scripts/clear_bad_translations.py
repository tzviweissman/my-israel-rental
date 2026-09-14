"""Find, and optionally clear, saved "translations" that are not translations.

WHY. translate_marketing used to save whatever the model returned. When the
model answered an input instead of translating it, the answer became the
post's other-language title or description (see
utils/translate.py::plausible_translation for the case that was found).
New writes are now checked; this finds the ones already saved.

Clearing a field is the safe repair: the UI falls back to the language the
post was written in, and the next edit to the post translates it again.
Nothing is re-translated here, so this spends no API credit.

    python scripts/clear_bad_translations.py            # report only
    python scripts/clear_bad_translations.py --apply    # clear, LOCAL only

Production needs --production as well as --apply, and must only be run with
Tzvi's explicit go-ahead (CLAUDE.md: confirm before writing to Atlas). The
report never prints the text of a post, only ids, fields and lengths.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from utils.translate import detect_lang, plausible_translation  # noqa: E402

# Every collection whose documents carry machine-translated copy.
COLLECTIONS = ("marketplace_gigs", "marketplace_jobs", "requests")
FIELDS = ("title", "description")
LANGS = ("he", "en")


def _is_local(url: str) -> bool:
    return bool(re.match(r"^mongodb://(localhost|127\.0\.0\.1)", url)) and "mongodb.net" not in url


async def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--apply", action="store_true", help="clear the bad fields (default: report only)")
    ap.add_argument("--production", action="store_true", help="allow --apply against a non-local database")
    args = ap.parse_args()

    url = os.environ.get("MONGO_URL", "")
    local = _is_local(url)
    if args.apply and not local and not args.production:
        print("Refusing: MONGO_URL is not local. Pass --production too, and only with explicit approval.")
        return 2
    db = AsyncIOMotorClient(url, serverSelectionTimeoutMS=8000)[os.environ["DB_NAME"]]
    print(f"database: {'local' if local else 'REMOTE'} / {os.environ['DB_NAME']}  mode: {'APPLY' if args.apply else 'report'}")

    existing = set(await db.list_collection_names())
    total = 0
    for coll in COLLECTIONS:
        if coll not in existing:
            continue
        bad_here = 0
        projection = {f: 1 for f in FIELDS} | {f"{f}_{l}": 1 for f in FIELDS for l in LANGS}
        async for doc in db[coll].find({}, projection):
            unset = {}
            for field in FIELDS:
                source = doc.get(field) or ""
                for lang in LANGS:
                    key = f"{field}_{lang}"
                    saved = doc.get(key)
                    if not isinstance(saved, str) or not saved.strip() or not source.strip():
                        continue
                    # An owner's own copy in the source language is not a
                    # translation to judge; only the machine side is checked.
                    if detect_lang(source) == lang:
                        continue
                    if plausible_translation(source, saved, lang):
                        continue
                    unset[key] = ""
                    print(f"  {coll} {doc['_id']} {key}: {len(saved)} chars from a {len(source)}-char source")
            if unset:
                bad_here += 1
                if args.apply:
                    await db[coll].update_one({"_id": doc["_id"]}, {"$unset": unset})
        print(f"{coll}: {bad_here} document(s) with a bad translation{' cleared' if args.apply and bad_here else ''}")
        total += bad_here
    print(f"total: {total}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
