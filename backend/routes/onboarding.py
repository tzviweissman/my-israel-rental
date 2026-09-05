"""Onboarding state: the setup checklist, and what the owner has dismissed.

Specs: `docs/onboarding-tutorial-spec.md` T1 (checklist), T2 (contextual
tips), T7 (making the help findable).

WHY ONE ENDPOINT
----------------
The same discipline as `/dashboard/summary`: the checklist, the tips and the
"Show me around" offers all have to agree about what this owner has already
done and already dismissed. Two endpoints would let a checklist that says
"add a photo" sit under a tip congratulating them for adding one.

EVERY ITEM IS COMPUTED FROM RECORDS
-----------------------------------
Never from "the user saw this screen". The spec is explicit and it is the
whole point: a checklist that ticks itself off because a page rendered is
lying, and an owner who spots it lying once will not read it again.

Consequence worth stating: an item can un-tick. Delete every photo and "add
photos" comes back. That is correct — it reflects the page a visitor would
actually see, which is what the list is about.

ENDOWED PROGRESS, AND WHERE THE SPEC WAS WRONG
-----------------------------------------------
The spec says "name, category and area come from signup and count toward the
total, so nobody starts at zero". Against this codebase that is not true:
`POST /auth/register` stores name, email, password, role, phone and nothing
else (backend/routes/auth.py), and the dashboard's "Add a business" form
posts only `{name}`, so a fresh business has empty `categories` and `areas`.
Counting a category nobody was asked for would be inventing progress, which
is the same sin as inventing a statistic.

What IS honestly already done at the moment the list first appears:

  * a business owner has NAMED their business — `name` is required by
    `BusinessIn` and the create form collects it
  * a property lister has PUBLISHED a listing — title, area and price are
    all required by the add-property wizard

So each list carries exactly one endowed item, marked `endowed`, genuinely
satisfied, drawn from a record. Nobody starts at zero and nothing is made up.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from routes.deps import db, verify_token
from utils.user_contact import user_whatsapp

router = APIRouter(tags=["onboarding"])

# After this long the checklist stops being help and starts being furniture.
# Someone who has run a listing for two months is not a new user, and a
# permanent setup panel trains people to skim past the dashboard.
CHECKLIST_MAX_AGE_DAYS = 60

# Every id a client may dismiss. A closed set rather than free text: this is
# written straight into the user's record, and an endpoint that accepts any
# string is an invitation to fill the document with junk.
DISMISSIBLE_IDS: frozenset[str] = frozenset({
    # T2 — contextual tips, one per surface.
    "tip.share",
    "tip.chat",
    "tip.availability",
    # T7 — the inline "Show me around" offers. The header control is
    # permanent and deliberately absent from this list.
    "offer.firstLogin",
    "offer.checklist",
    "offer.complete",
    # T1 — the checklist itself, once complete and collapsed.
    "checklist.collapsed",
})


class DismissIn(BaseModel):
    id: str = Field(..., min_length=1, max_length=64)


def _account_age_days(user_doc: dict[str, Any]) -> int | None:
    """Whole days since the account was created, or None if unknowable.

    None rather than 0 when `created_at` is missing or unparseable: a user
    imported before that field existed is not a brand-new signup, and
    defaulting to 0 would re-open the checklist for the oldest accounts on
    the site.
    """
    raw = user_doc.get("created_at")
    if not raw:
        return None
    try:
        created = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    if created.tzinfo is None:
        created = created.replace(tzinfo=UTC)
    return max(0, (datetime.now(UTC) - created).days)


async def _business_items(uid: str) -> list[dict[str, Any]]:
    """The business owner's list, from their businesses and their services.

    Read across ALL of this person's businesses rather than one: the
    dashboard-level list answers "is my presence on this site finished",
    and a second business with no hours does not make the first one
    incomplete. `BusinessCompleteness` still answers the per-business
    question inside each card, and both read the same fields so they cannot
    contradict each other.
    """
    businesses = [
        b async for b in db.businesses.find(
            {"owner_user_id": uid},
            {"_id": 1, "name": 1, "description": 1, "logo_url": 1, "cover_url": 1,
             "areas": 1, "hours": 1},
        )
    ]
    any_of = lambda f: any(f(b) for b in businesses)  # noqa: E731

    # A service with a price. Priced, not merely present: "add your first
    # service and its price" is one outcome, and a service nobody can see a
    # price for does not finish the job.
    priced_service = await db.marketplace_gigs.find_one(
        {
            "provider_user_id": uid,
            "status": "published",
            "$or": [
                {"price": {"$gt": 0}},
                {"tiers.price": {"$gt": 0}},
                {"price_from": {"$gt": 0}},
            ],
        },
        {"_id": 1},
    )

    return [
        {
            "id": "biz.named",
            # Endowed: required to create the business at all, so it is
            # already true the first time this list is rendered.
            "endowed": True,
            "done": any_of(lambda b: bool((b.get("name") or "").strip())),
            "href": "/dashboard?tab=my-businesses",
        },
        {
# `&details=1` on the four items the Business details form satisfies: the
# dashboard opens that form on arrival instead of landing on the card and
# leaving the owner to find a small "Business details" link at its foot.
# An owner wrote in that he could not find where to change his hours; he
# had set them from this very list a week earlier.
            "id": "biz.logo",
            "endowed": False,
            "done": any_of(lambda b: bool(b.get("logo_url") or b.get("cover_url"))),
            "href": "/dashboard?tab=my-businesses&details=1",
        },
        {
            "id": "biz.about",
            "endowed": False,
            "done": any_of(lambda b: bool((b.get("description") or "").strip())),
            "href": "/dashboard?tab=my-businesses&details=1",
        },
        {
            "id": "biz.service",
            "endowed": False,
            "done": bool(priced_service),
            "href": "/businesses/add",
        },
        {
            "id": "biz.areas",
            "endowed": False,
            "done": any_of(lambda b: bool(b.get("areas"))),
            "href": "/dashboard?tab=my-businesses&details=1",
        },
        {
            "id": "biz.hours",
            "endowed": False,
            "done": any_of(lambda b: bool((b.get("hours") or "").strip())),
            "href": "/dashboard?tab=my-businesses&details=1",
        },
    ]


async def _property_items(uid: str, user_doc: dict[str, Any]) -> list[dict[str, Any]]:
    """The property lister's list."""
    props = [
        p async for p in db.properties.find(
            {"owner_id": uid},
            {"id": 1, "images": 1, "available_from": 1, "ical_url": 1},
        )
    ]
    any_of = lambda f: any(f(p) for p in props)  # noqa: E731

    # Shared at least once. `short_links` rows are minted lazily — only when
    # somebody asks for the link — so the existence of one is a real record
    # that this owner opened the share panel, not an assumption.
    shared = await db.short_links.find_one({"owner_user_id": uid}, {"_id": 1})

    return [
        {
            "id": "prop.listed",
            # Endowed: title, area and price are all required by the
            # add-property wizard, so a lister with a listing has already
            # supplied them.
            "endowed": True,
            "done": len(props) > 0,
            "href": "/dashboard?tab=properties",
        },
        {
            "id": "prop.photos",
            "endowed": False,
            "done": any_of(lambda p: bool(p.get("images"))),
            "href": "/dashboard?tab=properties",
        },
        {
            "id": "prop.availability",
            "endowed": False,
            "done": any_of(lambda p: bool(p.get("available_from") or p.get("ical_url"))),
            "href": "/dashboard?tab=properties",
        },
        {
            "id": "prop.contact",
            # `user_whatsapp` is the single resolver for this — reading the
            # field directly is what once made the WhatsApp button
            # unreachable for every owner on the site.
            "endowed": False,
            "done": bool(user_whatsapp(user_doc)),
            "href": "/dashboard?tab=settings",
        },
        {
            "id": "prop.share",
            "endowed": False,
            "done": bool(shared),
            "href": "/dashboard?tab=properties",
        },
    ]


# The tour's lifecycle, as recorded. `step_viewed` and `step_skipped` carry
# a step id; the rest are whole-run events.
#
# Drop-off PER STEP is the point, not started/completed/skipped. Knowing
# that 40% abandon the tour tells you nothing you can act on; knowing they
# all leave on the same step tells you which step to rewrite.
TOUR_EVENTS: frozenset[str] = frozenset({
    "started", "step_viewed", "step_skipped", "exited", "completed",
})


class TourEventIn(BaseModel):
    event: str = Field(..., min_length=1, max_length=32)
    step_id: Optional[str] = Field(None, max_length=64)
    role: Optional[str] = Field(None, max_length=32)


@router.post("/onboarding/tour")
async def onboarding_tour_event(
    payload_in: TourEventIn, payload: dict = Depends(verify_token),
) -> dict[str, Any]:
    """Record one tour event, and keep the resume point up to date.

    Server-side, because `localStorage` re-offers a finished tour on every
    new device — and because "which step lost people" is a question about
    everyone, not about one browser.

    Fire-and-forget from the client's side: it never blocks the tour and a
    failure here must never strand somebody mid-walkthrough.
    """
    event = payload_in.event.strip()
    if event not in TOUR_EVENTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown tour event. Accepted: {', '.join(sorted(TOUR_EVENTS))}",
        )

    uid = payload["user_id"]
    now = datetime.now(UTC).isoformat()

    await db.onboarding_tour_events.insert_one({
        "user_id": uid,
        "event": event,
        "step_id": payload_in.step_id,
        "role": payload_in.role,
        "at": now,
    })

    # The resume point. Only a real view moves it: a skipped step is one
    # the owner never saw, and resuming onto it would show them a step the
    # engine is about to skip again.
    update: dict[str, Any] = {"updated_at": now}
    if event == "step_viewed" and payload_in.step_id:
        update["last_step_id"] = payload_in.step_id
    if event == "completed":
        update["completed_at"] = now
        # Cleared so a completed tour restarts from the beginning rather
        # than from wherever it happened to finish.
        update["last_step_id"] = None
    if event == "started":
        update.setdefault("started_at", now)

    await db.onboarding_tour.update_one({"user_id": uid}, {"$set": update}, upsert=True)
    return {"ok": True}


@router.get("/onboarding/state")
async def onboarding_state(payload: dict = Depends(verify_token)) -> dict[str, Any]:
    """The checklist, the dismissals, and whether to show any of it.

    Role-aware, and a person who is both gets both lists with their primary
    role first — per CLAUDE.md this site serves anyone with something to
    offer, and one human really can be both a landlord and a plumber.
    """
    uid = payload["user_id"]
    user_doc = await db.users.find_one(
        {"id": uid},
        {"_id": 0, "role": 1, "created_at": 1, "phone": 1, "whatsapp_number": 1},
    )
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    role = user_doc.get("role") or "renter"
    age_days = _account_age_days(user_doc)

    # Which lists apply. Driven by what the person actually HAS as well as
    # by their role: an owner who also runs a business should see both, and
    # the role flag alone would hide one of them.
    has_business = bool(await db.businesses.find_one({"owner_user_id": uid}, {"_id": 1}))
    has_property = bool(await db.properties.find_one({"owner_id": uid}, {"_id": 1}))

    wants_business = role == "provider" or has_business
    wants_property = role in ("owner", "manager") or has_property

    lists: list[dict[str, Any]] = []
    if wants_business:
        lists.append({"role": "business", "items": await _business_items(uid)})
    if wants_property:
        lists.append({"role": "property", "items": await _property_items(uid, user_doc)})
    # Primary role first.
    if role in ("owner", "manager"):
        lists.sort(key=lambda x: x["role"] != "property")
    else:
        lists.sort(key=lambda x: x["role"] != "business")

    for entry in lists:
        entry["done"] = sum(1 for i in entry["items"] if i["done"])
        entry["total"] = len(entry["items"])

    dismissed_doc = await db.onboarding_dismissals.find_one({"user_id": uid}, {"_id": 0, "ids": 1})
    dismissed = list((dismissed_doc or {}).get("ids") or [])

    # T4 — whether the tour has been taken, and where it was left. Drives
    # "Resume" vs "Show me around", and T7's rule that the inline offers
    # stop once the tour is done while the header entry stays forever.
    tour_doc = await db.onboarding_tour.find_one(
        {"user_id": uid}, {"_id": 0, "completed_at": 1, "last_step_id": 1},
    ) or {}

    # Past the age cap the checklist goes away entirely. Tips and the help
    # menu are unaffected — those are not "new user" furniture, they are
    # captions on features, and a feature is no less new to someone the
    # first time they reach it in month three.
    stale = age_days is not None and age_days > CHECKLIST_MAX_AGE_DAYS

    return {
        "role": role,
        "checklists": [] if stale else lists,
        "dismissed": dismissed,
        "account_age_days": age_days,
        "tour": {
            "completed": bool(tour_doc.get("completed_at")),
            "last_step_id": tour_doc.get("last_step_id"),
        },
    }


@router.post("/onboarding/dismiss")
async def onboarding_dismiss(
    payload_in: DismissIn, payload: dict = Depends(verify_token),
) -> dict[str, Any]:
    """Remember that this person closed a tip or an offer, for good.

    Server-side, and that is the requirement rather than an implementation
    detail: `localStorage` alone re-shows every tip the first time someone
    opens the dashboard on their phone, which reads as the site having
    forgotten them.
    """
    tip_id = payload_in.id.strip()
    if tip_id not in DISMISSIBLE_IDS:
        # Named, so a client sending a stale id learns why rather than
        # silently appearing to succeed and re-showing the tip forever.
        raise HTTPException(
            status_code=400,
            detail=f"Unknown dismissible id. Accepted: {', '.join(sorted(DISMISSIBLE_IDS))}",
        )

    # `$addToSet` so a double-click, or two tabs, cannot record it twice.
    await db.onboarding_dismissals.update_one(
        {"user_id": payload["user_id"]},
        {
            "$addToSet": {"ids": tip_id},
            "$set": {"updated_at": datetime.now(UTC).isoformat()},
        },
        upsert=True,
    )
    doc = await db.onboarding_dismissals.find_one(
        {"user_id": payload["user_id"]}, {"_id": 0, "ids": 1},
    )
    return {"dismissed": list((doc or {}).get("ids") or [])}
