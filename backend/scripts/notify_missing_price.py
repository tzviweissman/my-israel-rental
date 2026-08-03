"""Email listers whose listings are live with no price at all.

Why
---
Eight live listings carry no nightly price, no monthly price and no holiday
rate. Until now the property card rendered that as "0", which reads as a free
apartment rather than a missing field; it now says "Price on request". Either
way the listing can't do its job, and the only person who can fix it is the
lister.

Nobody is told. This script tells them.

Safety
------
Sending mail is irreversible and outward-facing, so this follows the same
shape as the other scripts here: **a dry run is the default**. Without
``--apply`` it connects, works out exactly who would be emailed and about
what, prints it, and sends nothing.

    python scripts/notify_missing_price.py              # dry run, sends nothing
    python scripts/notify_missing_price.py --apply      # actually sends

Check which database ``backend/.env`` points at before running with
``--apply`` — see CLAUDE.md. The dry run prints the database name first so
you can confirm it's the one you meant.

One email per lister, not one per listing: a manager with five unpriced
listings gets a single message listing all five. ``--limit`` caps how many
listers are contacted in one go, so a first real send can be tried on one or
two people before doing the rest.
"""
from __future__ import annotations

import argparse
import asyncio
import os
import pathlib
import sys

from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from utils.email import send_email  # noqa: E402

_env = dotenv_values(pathlib.Path(__file__).resolve().parent.parent / ".env")
MONGO_URL = os.environ.get("MONGO_URL") or _env.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME") or _env.get("DB_NAME")
SITE_URL = os.environ.get("FRONTEND_URL") or _env.get("FRONTEND_URL") or "https://myisraelrental.com"

if not MONGO_URL or not DB_NAME:
    raise SystemExit(
        "MONGO_URL and DB_NAME must be set (backend/.env or environment).\n"
        "Refusing to guess which database to read."
    )

# A listing is "unpriced" when none of these carries a usable number. Mongo
# stores missing fields as absent, null, 0 or "" depending on how the row was
# created (form, CSV import, admin quick-add), so test the value rather than
# the key's presence.
PRICE_FIELDS = ("nightly_price", "monthly_price", "holiday_lump_price")


def _has_price(prop: dict) -> bool:
    for f in PRICE_FIELDS:
        v = prop.get(f)
        try:
            if v is not None and float(v) > 0:
                return True
        except (TypeError, ValueError):
            continue
    return False


def _email_bodies(name: str, listings: list[dict]) -> tuple[str, str, str]:
    n = len(listings)
    noun = "listing" if n == 1 else "listings"
    subject = (
        f"Your {noun} on MyIsraelRental {'is' if n == 1 else 'are'} missing a price"
    )
    rows = "".join(
        f"<li style='margin-bottom:6px'><strong>{p.get('title') or 'Untitled listing'}</strong>"
        f"{' — ' + p['area'] if p.get('area') else ''}</li>"
        for p in listings
    )
    plain_rows = "\n".join(
        f"  • {p.get('title') or 'Untitled listing'}"
        f"{' — ' + p['area'] if p.get('area') else ''}"
        for p in listings
    )
    html = f"""
      <p>Hi {name},</p>
      <p>Renters browsing MyIsraelRental can see {'this' if n == 1 else 'these'}
         {noun}, but {'it has' if n == 1 else 'they have'} no price set, so
         {'it shows' if n == 1 else 'they show'} as
         &ldquo;Price on request&rdquo; instead of a rate:</p>
      <ul>{rows}</ul>
      <p>Listings with a visible price get materially more enquiries, so it's
         worth adding one. You can set a nightly rate, a monthly rate, or — if
         you only rent over the holidays — just a holiday rate on its own.</p>
      <p><a href="{SITE_URL}/dashboard"
            style="display:inline-block;padding:10px 18px;background:#1E6A6A;
                   color:#fff;border-radius:8px;text-decoration:none">
         Add a price</a></p>
      <p style="color:#666;font-size:13px">If you left the price off on
         purpose, you can ignore this — nothing will change on your listing.</p>
    """
    text = (
        f"Hi {name},\n\n"
        f"Renters can see {'this' if n == 1 else 'these'} {noun} on "
        f"MyIsraelRental, but {'it has' if n == 1 else 'they have'} no price "
        f"set, so {'it shows' if n == 1 else 'they show'} as "
        f'"Price on request" instead of a rate:\n\n'
        f"{plain_rows}\n\n"
        "Listings with a visible price get materially more enquiries. You can "
        "set a nightly rate, a monthly rate, or — if you only rent over the "
        "holidays — just a holiday rate on its own.\n\n"
        f"Add a price: {SITE_URL}/dashboard\n\n"
        "If you left the price off on purpose, you can ignore this — nothing "
        "will change on your listing.\n"
    )
    return subject, html, text


async def main(apply: bool, limit: int | None) -> None:
    client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=15000)
    db = client[DB_NAME]

    print(f"database : {DB_NAME}")
    print(f"action   : {'APPLY (will send real email)' if apply else 'DRY RUN (sends nothing)'}\n")

    props = await db.properties.find(
        {"is_hidden": {"$ne": True}},
        {"_id": 0, "id": 1, "title": 1, "area": 1, "owner_id": 1, **{f: 1 for f in PRICE_FIELDS}},
    ).to_list(5000)

    unpriced = [p for p in props if not _has_price(p)]
    print(f"live listings scanned : {len(props)}")
    print(f"with no price at all  : {len(unpriced)}\n")
    if not unpriced:
        print("Nothing to do.")
        client.close()
        return

    by_owner: dict[str, list[dict]] = {}
    orphans: list[dict] = []
    for p in unpriced:
        oid = p.get("owner_id")
        (by_owner.setdefault(oid, []) if oid else orphans).append(p)

    if orphans:
        print(f"!! {len(orphans)} unpriced listing(s) have NO owner_id — nobody to email.")
        for p in orphans:
            print(f"     {(p.get('title') or '')[:60]}")
        print("   These need fixing by an admin, not by a lister.\n")

    owners = await db.users.find(
        {"id": {"$in": list(by_owner)}}, {"_id": 0, "id": 1, "email": 1, "name": 1}
    ).to_list(1000)
    owner_by_id = {o["id"]: o for o in owners}

    plan = []
    for oid, listings in by_owner.items():
        owner = owner_by_id.get(oid)
        if not owner or not owner.get("email"):
            print(f"!! owner {oid} has no email on file — skipping {len(listings)} listing(s)")
            continue
        plan.append((owner, listings))

    plan.sort(key=lambda r: -len(r[1]))
    if limit is not None:
        if len(plan) > limit:
            print(f"(--limit {limit}: contacting {limit} of {len(plan)} listers this run)\n")
        plan = plan[:limit]

    print(f"listers to contact: {len(plan)}\n")
    for owner, listings in plan:
        print(f"  {owner.get('email')}  ({owner.get('name') or 'no name'}) — {len(listings)} listing(s)")
        for p in listings:
            print(f"       {(p.get('title') or '')[:64]}")

    if not apply:
        subject, _html, text = _email_bodies(
            (plan[0][0].get("name") or "there").split()[0], plan[0][1]
        ) if plan else ("", "", "")
        if plan:
            print("\n--- the email the first lister would receive ---")
            print(f"Subject: {subject}\n")
            print(text)
        print("DRY RUN — no email was sent. Re-run with --apply to send.")
        client.close()
        return

    sent = failed = 0
    for owner, listings in plan:
        first_name = (owner.get("name") or "there").split()[0]
        subject, html, text = _email_bodies(first_name, listings)
        try:
            ok = await send_email(
                owner["email"], subject, html, tag="missing-price", text_body=text
            )
        except Exception as e:  # noqa: BLE001 — one bad address must not stop the run
            print(f"  FAILED {owner['email']}: {type(e).__name__}")
            failed += 1
            continue
        if ok:
            sent += 1
            print(f"  sent   {owner['email']}")
        else:
            failed += 1
            print(f"  NOT SENT {owner['email']} (suppressed or rejected)")

    print(f"\nsent: {sent}   failed/skipped: {failed}")
    client.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true",
                    help="actually send the emails (default is a dry run)")
    ap.add_argument("--limit", type=int, default=None,
                    help="only contact this many listers (try 1 first)")
    asyncio.run(main(ap.parse_args().apply, ap.parse_args().limit))
