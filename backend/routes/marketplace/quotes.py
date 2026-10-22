"""Quote requests (Tzvi, 16 Oct 2026, from Thumbtack and Angi: "the customer
describes the job and adds photos, the business sends a price, the customer
accepts with one tap").

For jobs a fixed price list cannot cover: a move, a leak, a renovation.
On a listing that takes them (`quotes_on`, on by default for service
listings that are not appointments or shops):

  1. The customer describes the job, adds up to six photos, a preferred
     date and the area, and how to reach them. No account; the reply comes
     back on a link of their own (`track_token`), and by email.
  2. The business sees it in Appointments → Quote requests, with the
     photos and the customer's contact, and answers with a price and a
     note (how long the price holds), or declines.
  3. The customer accepts or declines from their link. On accepting, the
     business is told and arranges the job with them directly.

Money is a figure, never moved: the site takes no payment (the same line
orders.py draws).
"""
from __future__ import annotations

import re
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field

from routes.deps import db, logger, optional_user, verify_token
from utils.media_url import is_allowed_media_url
from utils.rate_limit import check_rate

router = APIRouter(prefix="/marketplace", tags=["marketplace"])
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MAX_PHOTOS = 6


def quotes_open(gig: dict[str, Any]) -> bool:
    """Whether a listing takes quote requests: its own switch, else on for
    a service listing (not an appointment calendar or a shop)."""
    if "quotes_on" in gig and gig["quotes_on"] is not None:
        return bool(gig["quotes_on"])
    return (gig.get("gig_type") or "deliverable") == "deliverable"


@router.post("/quote-photo")
async def quote_photo(request: Request, file: UploadFile = File(...)):
    """A photo for a quote request, without an account. Images only, the
    same checks as every upload (routes/misc.py), and few per visitor."""
    check_rate(request, bucket="quote_photo", limit=12, window_seconds=600)
    from routes.misc import _read_validated_upload, _store_upload
    content, is_video = await _read_validated_upload(file)
    if is_video:
        raise HTTPException(status_code=400, detail="Photos only")
    stored = await _store_upload(content, False, file.filename)
    return {"url": stored.get("url")}


class QuoteIn(BaseModel):
    description: str = Field(..., min_length=10, max_length=2000)
    photos: list[str] = Field(default_factory=list, max_length=MAX_PHOTOS)
    preferred_date: Optional[str] = Field(None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    area: Optional[str] = Field(None, max_length=120)
    name: str = Field(..., min_length=2, max_length=80)
    phone: Optional[str] = Field(None, max_length=40)
    email: Optional[str] = Field(None, max_length=200)
    lang: Optional[Literal["en", "he"]] = None
    # Answers to the business's own questions (custom_fields.py), by
    # field id. A driver asks for the pickup time and how many
    # passengers; a mover asks which floor. Checked against the
    # questions as stored, so a required one cannot be skipped and an
    # answer to a question that no longer exists is dropped.
    answers: dict[str, Any] = Field(default_factory=dict)


def _public(q: dict[str, Any], gig: dict[str, Any], biz: dict[str, Any]) -> dict[str, Any]:
    return {
        "business": {"name": biz.get("name") or "", "name_he": biz.get("name_he"), "slug": biz.get("slug"), "logo_url": biz.get("logo_url")},
        "gig_title": gig.get("title") or "", "gig_title_he": gig.get("title_he"),
        "description": q["description"], "photos": q.get("photos") or [], "preferred_date": q.get("preferred_date"),
        "area": q.get("area"), "status": q["status"], "quote": q.get("quote"), "created_at": q.get("created_at"),
        # A price the business sent first: the page says "A price from",
        # not "Your quote request to".
        "from_business": q.get("source") == "business", "lang": q.get("lang") or "en",
    }


@router.post("/gigs/{gig_id}/quote-requests")
async def request_quote(gig_id: str, body: QuoteIn, request: Request, viewer=Depends(optional_user)):
    check_rate(request, bucket="quote_request", limit=8, window_seconds=3600)
    email = (body.email or "").strip().lower() or None
    phone = (body.phone or "").strip() or None
    if not (email or phone):
        raise HTTPException(status_code=400, detail="Please add an email or a phone number so the business can reach you")
    if email and not _EMAIL.match(email):
        raise HTTPException(status_code=400, detail="Please check the email address")
    if any(not is_allowed_media_url(u) for u in body.photos):
        raise HTTPException(status_code=400, detail="Add the photos with the photo button")
    gig = await db.marketplace_gigs.find_one({"_id": gig_id})
    if not gig or gig.get("status", "published") != "published" or not quotes_open(gig):
        raise HTTPException(status_code=404, detail="This listing is not taking quote requests")
    biz = await db.businesses.find_one({"_id": gig.get("business_id")}) or {}
    # Raises 400 in the question's own wording when a required one is
    # missing, so the customer is told which answer is needed.
    from .custom_fields import answers_text, check_answers
    answers = check_answers(biz, "quote", body.answers)
    now = datetime.now(UTC).isoformat()
    q = {
        "_id": str(uuid.uuid4()), "gig_id": gig_id, "business_id": gig.get("business_id"),
        "provider_user_id": gig.get("provider_user_id"), "customer_user_id": (viewer or {}).get("user_id"),
        "description": body.description.strip(), "photos": body.photos, "preferred_date": body.preferred_date,
        "area": (body.area or "").strip() or None, "name": body.name.strip(), "phone": phone, "email": email,
        "lang": body.lang or "en", "status": "new", "quote": None,
        # Stored WITH a copy of each question, so renaming or removing one
        # later never changes what this customer was actually asked.
        "answers": answers,
        "track_token": secrets.token_urlsafe(16), "created_at": now, "updated_at": now,
    }
    await db.quote_requests.insert_one(q)
    from .gigs import _notify
    await _notify(gig.get("provider_user_id"), "quote_request",
                  f"New quote request for {gig.get('title') or 'your listing'} from {q['name']}.", q["_id"])
    from .orders import _email, _esc
    owner = await db.users.find_one({"id": gig.get("provider_user_id")}, {"email": 1}) or {}
    await _email(owner.get("email"), f"Quote request: {gig.get('title') or ''}",
                 f"<p><b>{_esc(q['name'])}</b> asked for a price:</p><p>{_esc(q['description'])}</p>"
                 # The business's own questions and what this customer
                 # answered. Without them the email says "asked for a
                 # price" and leaves the pickup time in the dashboard.
                 + (f"<p>{_esc(answers_text(answers))}</p>".replace("\n", "<br>") if answers else "")
                 + (f"<p>{len(q['photos'])} photo(s) attached.</p>" if q["photos"] else ""),
                 tag="quote-request", button=("Answer with a price", "/dashboard?tab=appointments"))
    await _email_customer(q, gig, biz, "received")
    logger.info("[quotes] request gig=%s quote=%s", gig_id, q["_id"])
    return {"ok": True, "track_path": f"/quotes/{q['track_token']}"}


async def _email_customer(q: dict[str, Any], gig: dict[str, Any], biz: dict[str, Any], event: str) -> None:
    if not q.get("email"):
        return
    from utils import email as em
    from .orders import _frontend_url, _subject
    he = q.get("lang") == "he"
    business = (biz.get("name_he") if he and biz.get("name_he") else biz.get("name")) or ""
    texts = {
        "received": (("הבקשה נשלחה", f"שלחנו את הבקשה שלך ל<b>{em._esc(business)}</b>. כשתגיע הצעת מחיר, תקבל/י מייל.")
                     if he else ("Your request was sent", f"Your request went to <b>{em._esc(business)}</b>. You'll get an email when they reply with a price.")),
        "quoted": (("הגיעה הצעת מחיר", f"<b>{em._esc(business)}</b> שלחו הצעת מחיר. אפשר לאשר או לדחות בלחיצה.")
                   if he else ("You have a price", f"<b>{em._esc(business)}</b> sent you a price. Accept or decline with one tap.")),
        "declined": (("העסק לא יכול לקחת את העבודה", f"<b>{em._esc(business)}</b> לא יכולים לקחת את העבודה הזו הפעם.")
                     if he else ("The business can't take this one", f"<b>{em._esc(business)}</b> can't take this job this time.")),
    }
    head, line = texts[event]
    link = f"{_frontend_url()}/quotes/{q['track_token']}"
    inner = (f'<h2 style="color:#222;font-size:22px;margin:0 0 8px;">{em._esc(head)}</h2>'
             f'<p style="color:#333;font-size:15px;line-height:1.7;margin:0 0 18px;">{line}</p>'
             + em._button("לבקשה שלך" if he else "See your request", link))
    owner = await db.users.find_one({"id": gig.get("provider_user_id")}, {"email": 1}) or {}
    await em.send_email(q["email"], _subject(head), em._wrap(inner, preheader=head, lang="he" if he else "en"),
                        tag=f"quote-{event}", from_name=business or None, reply_to=owner.get("email"))


async def _by_token(token: str, request: Request) -> dict[str, Any]:
    check_rate(request, bucket="quote_track", limit=120, window_seconds=600)
    if not token or len(token) < 16:
        raise HTTPException(status_code=404, detail="This link is not valid")
    q = await db.quote_requests.find_one({"track_token": token})
    if not q:
        raise HTTPException(status_code=404, detail="This link is not valid")
    return q


async def _gig_biz(q: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    gig = await db.marketplace_gigs.find_one({"_id": q.get("gig_id")}) or {}
    biz = await db.businesses.find_one({"_id": q.get("business_id")}) or {}
    return gig, biz


@router.get("/quotes/track/{token}")
async def track_quote(token: str, request: Request):
    q = await _by_token(token, request)
    gig, biz = await _gig_biz(q)
    out = _public(q, gig, biz)
    vu = (q.get("quote") or {}).get("valid_until")
    out["expired"] = bool(q["status"] == "quoted" and vu and vu < datetime.now(UTC).date().isoformat())
    return out


class Answer(BaseModel):
    answer: Literal["accept", "decline"]


@router.post("/quotes/track/{token}/answer")
async def answer_quote(token: str, body: Answer, request: Request):
    q = await _by_token(token, request)
    if q["status"] != "quoted":
        raise HTTPException(status_code=409, detail="There is no price to answer yet")
    vu = (q.get("quote") or {}).get("valid_until")
    if body.answer == "accept" and vu and vu < datetime.now(UTC).date().isoformat():
        raise HTTPException(status_code=409, detail="This price has expired. Ask the business for a new one.")
    status = "accepted" if body.answer == "accept" else "declined_by_customer"
    r = await db.quote_requests.update_one({"_id": q["_id"], "status": "quoted"},
                                           {"$set": {"status": status, "answered_at": datetime.now(UTC).isoformat(),
                                                     "updated_at": datetime.now(UTC).isoformat()}})
    if not r.modified_count:
        raise HTTPException(status_code=409, detail="This was just answered. Refresh to see it.")
    gig, _ = await _gig_biz(q)
    from .gigs import _notify
    from .orders import _email, _esc
    word = "accepted" if status == "accepted" else "declined"
    await _notify(q.get("provider_user_id"), "quote_answered", f"{q['name']} {word} your price for {gig.get('title') or 'a job'}.", q["_id"])
    owner = await db.users.find_one({"id": q.get("provider_user_id")}, {"email": 1}) or {}
    contact = " · ".join(x for x in (q.get("phone"), q.get("email")) if x)
    await _email(owner.get("email"), f"Your price was {word}: {q['name']}",
                 f"<p><b>{_esc(q['name'])}</b> {word} your price for {_esc(gig.get('title'))}.</p>"
                 + (f"<p>Reach them on {_esc(contact)} to arrange it.</p>" if status == "accepted" else ""),
                 tag="quote-answered", button=("Open quote requests", "/dashboard?tab=appointments"))
    return {"ok": True, "status": status}


# ---------------------------------------------------------------------------
# the business's side
# ---------------------------------------------------------------------------

def _row(q: dict[str, Any], titles: dict[str, str]) -> dict[str, Any]:
    return {"id": q["_id"], "gig_id": q["gig_id"], "gig_title": titles.get(q["gig_id"], ""), "description": q["description"],
            "photos": q.get("photos") or [], "preferred_date": q.get("preferred_date"), "area": q.get("area"),
            "name": q["name"], "phone": q.get("phone"), "email": q.get("email"), "status": q["status"],
            "answers": q.get("answers") or [],
            "quote": q.get("quote"), "created_at": q.get("created_at"),
            "business_id": q.get("business_id"), "source": q.get("source") or "customer", "lang": q.get("lang") or "en",
            # To send the price on WhatsApp or by text: the link and a
            # ready message (Tzvi, 22 Oct 2026). Only once there is a price.
            **(_share(q, titles.get(q["gig_id"], "")) if q.get("quote") else {})}


def _track_url(q: dict[str, Any]) -> str:
    from .orders import _frontend_url
    return f"{_frontend_url()}/quotes/{q['track_token']}"


def quote_message(biz_name: str, q: dict[str, Any], title: str = "") -> str:
    """The message a business sends with its price. Pure."""
    first = (q.get("name") or "").strip().split(" ")[0]
    what = " ".join((title or q.get("description") or "").split())
    what = what if len(what) <= 80 else what[:79].rstrip() + "…"
    price = f"₪{q['quote']['price']:,.2f}".replace(".00", "")
    hello = ("שלום " + first if first else "שלום") if q.get("lang") == "he" else ("Hello " + first if first else "Hello")
    if q.get("lang") == "he":
        return (f"{hello},\nזו הצעת המחיר של {biz_name} עבור: {what}\nסה\"כ {price}.\n"
                f"אפשר לראות את הפירוט ולאשר כאן: {_track_url(q)}")
    return (f"{hello},\nHere is the price from {biz_name} for: {what}\nTotal {price}.\n"
            f"You can see the details and accept here: {_track_url(q)}")


def _share(q: dict[str, Any], title: str) -> dict[str, Any]:
    from utils.whatsapp_link import normalize_whatsapp_number
    phone = normalize_whatsapp_number(q.get("phone")) if q.get("phone") else None
    return {"link": _track_url(q), "message": quote_message(q.get("_biz_name") or "", q, title),
            "whatsapp_to": phone.lstrip("+") if phone else None}


@router.get("/quote-requests")
async def my_quote_requests(user=Depends(verify_token)):
    rows = await db.quote_requests.find({"provider_user_id": user["user_id"]}).sort("created_at", -1).to_list(200)
    ids = list({r["gig_id"] for r in rows})
    titles = {g["_id"]: g.get("title") or "" async for g in db.marketplace_gigs.find({"_id": {"$in": ids}}, {"title": 1})}
    names = {b["_id"]: b.get("name") or "" async for b in db.businesses.find(
        {"_id": {"$in": list({r.get("business_id") for r in rows})}}, {"name": 1})}
    for r in rows:
        r["_biz_name"] = names.get(r.get("business_id"), "")
    return {"quotes": [_row(r, titles) for r in rows], "new": sum(1 for r in rows if r["status"] == "new")}


class NewQuote(BaseModel):
    """A price the business sends first, after a call or a visit (Tzvi,
    22 Oct 2026). Lands in the same inbox, page and accept flow as a
    price answering a customer's request."""
    name: str = Field(..., min_length=2, max_length=80)
    phone: Optional[str] = Field(None, max_length=40)
    email: Optional[str] = Field(None, max_length=200)
    description: str = Field(..., min_length=2, max_length=2000)
    gig_id: Optional[str] = None
    price: Optional[float] = Field(None, gt=0, le=10_000_000)
    lines: list[Line] = Field(default_factory=list, max_length=20)
    note: str = Field("", max_length=1000)
    valid_days: int = Field(14, ge=1, le=90)
    lang: Literal["en", "he"] = "he"


@router.post("/businesses/{business_id}/quotes")
async def send_quote(business_id: str, body: NewQuote, user=Depends(verify_token)):
    from utils.business_access import business_access
    biz = await business_access(db, business_id, user, "orders")
    email = (body.email or "").strip().lower() or None
    if email and not _EMAIL.match(email):
        raise HTTPException(status_code=400, detail="Please check the email address")
    gig = {}
    if body.gig_id:
        gig = await db.marketplace_gigs.find_one({"_id": body.gig_id, "business_id": business_id}) or {}
        if not gig:
            raise HTTPException(status_code=404, detail="Listing not found")
    now = datetime.now(UTC)
    q = {
        "_id": str(uuid.uuid4()), "gig_id": body.gig_id or "", "business_id": business_id, "source": "business",
        "provider_user_id": biz.get("owner_user_id"), "customer_user_id": None,
        "description": body.description.strip(), "photos": [], "preferred_date": None, "area": None,
        "name": body.name.strip(), "phone": (body.phone or "").strip() or None, "email": email,
        "lang": body.lang, "status": "quoted", "answers": [],
        "quote": _priced(body.price, body.lines, body.note, body.valid_days, now),
        "track_token": secrets.token_urlsafe(16), "created_at": now.isoformat(), "updated_at": now.isoformat(),
    }
    await db.quote_requests.insert_one(q)
    await _email_customer(q, gig or {"provider_user_id": q["provider_user_id"]}, biz, "quoted")
    q["_biz_name"] = biz.get("name") or ""
    return _row(q, {q["gig_id"]: gig.get("title") or ""})


class Line(BaseModel):
    label: str = Field(..., min_length=1, max_length=80)
    amount: float = Field(..., gt=0, le=10_000_000)


def _priced(price: Optional[float], lines: list[Line], note: str, valid_days: int, now: datetime) -> dict[str, Any]:
    """The quote as stored. With lines, the price IS their total, so the
    breakdown the customer sees always adds up to what they accept."""
    if lines:
        price = sum(ln.amount for ln in lines)
    if not price:
        raise HTTPException(status_code=422, detail="Add a price")
    return {"price": round(price, 2), "currency": "ILS", "note": note.strip(),
            "lines": [{"label": ln.label.strip(), "amount": round(ln.amount, 2)} for ln in lines],
            "valid_until": (now.date() + timedelta(days=valid_days)).isoformat(), "at": now.isoformat()}


class Reply(BaseModel):
    action: Literal["quote", "decline"]
    price: Optional[float] = Field(None, gt=0, le=10_000_000)
    lines: list[Line] = Field(default_factory=list, max_length=20)
    note: str = Field("", max_length=1000)
    valid_days: int = Field(14, ge=1, le=90)


@router.post("/quote-requests/{quote_id}/reply")
async def reply_quote(quote_id: str, body: Reply, user=Depends(verify_token)):
    q = await db.quote_requests.find_one({"_id": quote_id})
    if not q or (q.get("provider_user_id") != user["user_id"] and user.get("role") != "admin"):
        raise HTTPException(status_code=404, detail="Quote request not found")
    if q["status"] not in ("new", "quoted"):
        raise HTTPException(status_code=409, detail="The customer has already answered")
    now = datetime.now(UTC)
    if body.action == "quote":
        sets = {"status": "quoted", "quote": _priced(body.price, body.lines, body.note, body.valid_days, now)}
        event = "quoted"
    else:
        sets = {"status": "declined", "decline_note": body.note.strip()}
        event = "declined"
    await db.quote_requests.update_one({"_id": quote_id}, {"$set": {**sets, "updated_at": now.isoformat()}})
    q.update(sets)
    gig, biz = await _gig_biz(q)
    await _email_customer(q, gig, biz, event)
    q["_biz_name"] = biz.get("name") or ""
    return _row(q, {q["gig_id"]: gig.get("title") or ""})


async def ensure_quote_indexes() -> None:
    await db.quote_requests.create_index("track_token", unique=True)
    await db.quote_requests.create_index([("provider_user_id", 1), ("created_at", -1)])
