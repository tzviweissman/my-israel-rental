"""One-time backfill: translate every existing gig's English title +
description to Hebrew and cache the results on the gig document.

Why this exists:
    Before 2026-07-09 the gig-creation wizard asked providers to type
    the Hebrew translations by hand. Most providers skipped it. Once we
    dropped those inputs from the wizard the app started relying on
    stored ``title_he`` / ``description_he`` fields — but the pre-2026
    listings still have those fields empty, so Hebrew-locale renters
    see English text on old gigs. This script closes that gap in one
    pass and then never runs again.

Usage:
    # Dry-run — count what needs translating, don't call the LLM:
    python -m scripts.backfill_hebrew_gigs --dry-run

    # Actually translate + write (default limit 500 gigs per invocation):
    python -m scripts.backfill_hebrew_gigs

    # Custom limit / concurrency:
    python -m scripts.backfill_hebrew_gigs --limit 100 --concurrency 3

Guardrails:
    * Skips gigs where the target field is already populated — safe to
      re-run any number of times.
    * Rate-limits parallel LLM calls (default 3 concurrent) to keep the
      Emergent LLM key spend predictable.
    * Any LLM failure on a single gig is logged and skipped; the next
      run picks up where this one left off.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
import uuid
from pathlib import Path

# Ensure the backend/ dir is importable when this script is run as
# `python -m scripts.backfill_hebrew_gigs` from the repo root as well as
# directly. Same trick the test harness uses.
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Load .env before importing modules that read env vars at import time.
from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND_DIR / ".env")

from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402


EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


async def _translate_to_hebrew(text: str) -> str:
    """Marketing-copy translator (as opposed to the legal-contract prompt
    in ``utils/translate.py``). Keeps output punchy — no explanations,
    no quotation marks — so it drops straight into a card title."""
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=str(uuid.uuid4()),
        system_message=(
            "You translate short marketing copy for a services marketplace from "
            "English into modern, natural Hebrew. Preserve the tone (friendly, "
            "professional). Do NOT wrap the output in quotes and do NOT add "
            "explanations, notes, or transliteration — return only the Hebrew "
            "translation of the input."
        ),
    )
    chat.with_model("anthropic", "claude-sonnet-4-6")
    out = await chat.send_message(UserMessage(text=text))
    return (out or "").strip().strip('"').strip("'")


async def _process_one(gig: dict, db, sem: asyncio.Semaphore, dry_run: bool) -> str:
    """Translate whatever fields are missing on ``gig`` and update the
    document. Returns a status string for the run summary.
    """
    async with sem:
        updates: dict[str, str] = {}
        title = (gig.get("title") or "").strip()
        desc = (gig.get("description") or "").strip()
        needs_title = title and not (gig.get("title_he") or "").strip()
        needs_desc = desc and not (gig.get("description_he") or "").strip()

        if not (needs_title or needs_desc):
            return "skip:already-complete"

        if dry_run:
            missing = []
            if needs_title:
                missing.append("title_he")
            if needs_desc:
                missing.append("description_he")
            return "dry:" + ",".join(missing)

        try:
            if needs_title:
                updates["title_he"] = await _translate_to_hebrew(title)
            if needs_desc:
                updates["description_he"] = await _translate_to_hebrew(desc)
        except Exception as e:  # noqa: BLE001 — top-level try around a network call
            return f"error:{type(e).__name__}"

        if updates:
            # Some legacy gigs only have `_id`; newer ones have both
            # `_id` and a mirrored `id` field. Prefer `id` when present
            # so writes stay consistent with the rest of the codebase.
            filter_ = {"id": gig["id"]} if gig.get("id") else {"_id": gig["_id"]}
            await db.marketplace_gigs.update_one(filter_, {"$set": updates})
        return "wrote:" + ",".join(updates.keys())


async def _main(args) -> int:
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    # Gigs where either translation field is missing / empty. Uses a
    # single query so we can `.limit()` the batch to keep runs bounded.
    query = {
        "$or": [
            {"title_he": None},
            {"title_he": ""},
            {"title_he": {"$exists": False}},
            {"description_he": None},
            {"description_he": ""},
            {"description_he": {"$exists": False}},
        ]
    }
    cursor = db.marketplace_gigs.find(
        query,
        {"_id": 1, "id": 1, "title": 1, "description": 1, "title_he": 1, "description_he": 1},
    ).limit(args.limit)
    gigs = [g async for g in cursor]
    total = await db.marketplace_gigs.count_documents(query)

    print(f"Gigs needing translation: {total} (this run will process up to {len(gigs)})")
    if not gigs:
        print("Nothing to do — every gig already has Hebrew copy.")
        return 0

    sem = asyncio.Semaphore(args.concurrency)
    results = await asyncio.gather(*(_process_one(g, db, sem, args.dry_run) for g in gigs))

    # Bucketed summary — one line per outcome type. Useful when the LLM
    # rate-limits or returns garbage on a specific batch.
    summary: dict[str, int] = {}
    for r in results:
        bucket = r.split(":", 1)[0]
        summary[bucket] = summary.get(bucket, 0) + 1
    print("\n--- Run summary ---")
    for bucket, count in sorted(summary.items(), key=lambda kv: -kv[1]):
        print(f"  {bucket:20s} {count}")
    if args.dry_run:
        print("\n(dry-run — no writes made; drop --dry-run to actually translate.)")
    return 0


def _parse() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--dry-run", action="store_true", help="Count what would be translated, don't call the LLM or write.")
    p.add_argument("--limit", type=int, default=500, help="Max gigs to process this run (default 500).")
    p.add_argument("--concurrency", type=int, default=3, help="Parallel LLM calls (default 3).")
    return p.parse_args()


if __name__ == "__main__":
    sys.exit(asyncio.run(_main(_parse())))
