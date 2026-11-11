"""The business's own email address on the site (Tzvi, 11 Nov 2026: "can we
connect the AI agent to their emails?").

Reading a person's Gmail directly needs Google's restricted-scope review and
a yearly paid security audit. This needs neither: every business gets an
address of its own, `<token>@INBOUND_EMAIL_DOMAIN`, and sends mail to it
by forwarding (a Gmail or Outlook rule, or by hand) or by CC. Postmark
receives it (an inbound domain whose MX points at Postmark) and posts it
to /api/webhooks/postmark-inbound.

What happens to an email:
  1. Matched to the business by the address it was sent to. Anything else
     is dropped.
  2. Sorted without spending credit when it is obviously not a customer:
     Postmark's spam verdict, bulk mail (List-Unsubscribe, Precedence),
     automatic replies and bounces. Gmail's "confirm forwarding" email is
     kept apart and its code shown to the owner, because Gmail will not
     forward until someone clicks it.
  3. Otherwise Claude reads it (utils/lead_assist.py): what kind of email,
     who the customer is (the original sender when the owner forwarded it
     by hand), a one-line summary, and a reply draft.
  4. A customer email becomes a card on the leads board (leads.py, source
     "email") with its draft. Nothing is sent until a person presses Send.

Sending: from our address under the business's name ("Dani Movers via
MyIsraelRental"), Reply-To the owner's own email, threaded on the
customer's message. Only to the customer address the email itself gave,
so the inbox cannot be used to mail anyone else.

Kept INBOX_DAYS days (a TTL index), then gone.

Setup outside the code (docs/email-inbox.md): INBOUND_EMAIL_DOMAIN, the MX
record, the Postmark inbound webhook with ?token=INBOUND_EMAIL_SECRET.
"""
from __future__ import annotations

import html
import os
import re
import secrets
import unicodedata
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from routes.deps import db, logger, verify_token

router = APIRouter(tags=["marketplace"])

INBOX_DAYS = 180
SENDS_PER_DAY = 200
CUSTOMER_CATEGORIES = ("lead", "question", "booking", "complaint", "other")
GMAIL_CONFIRM_FROM = "forwarding-noreply@google.com"


def inbound_domain() -> str:
    return (os.environ.get("INBOUND_EMAIL_DOMAIN") or "").strip().lower()


def inbound_secret() -> str:
    return os.environ.get("INBOUND_EMAIL_SECRET") or os.environ.get("POSTMARK_WEBHOOK_SECRET") or ""


# --------------------------------------------------------------------------
# Pure helpers (tests/test_email_inbox.py)
# --------------------------------------------------------------------------
def make_token(name: str) -> str:
    """A readable, unguessable local part: "danimovers-k3x9qp". Pure apart
    from the random tail."""
    ascii_ = unicodedata.normalize("NFKD", name or "").encode("ascii", "ignore").decode()
    stem = re.sub(r"[^a-z0-9]", "", ascii_.lower())[:20] or "biz"
    tail = "".join(secrets.choice("abcdefghjkmnpqrstuvwxyz23456789") for _ in range(6))
    return f"{stem}-{tail}"


def recipient_tokens(payload: dict[str, Any], domain: str) -> list[str]:
    """Every local part the email was addressed to on our domain (or on
    Postmark's own inbound address, where the token is the +hash). Pure."""
    addrs: list[str] = []
    for k in ("ToFull", "CcFull", "BccFull"):
        for r in payload.get(k) or []:
            if isinstance(r, dict) and r.get("Email"):
                addrs.append(r["Email"])
    if payload.get("OriginalRecipient"):
        addrs.append(payload["OriginalRecipient"])
    out: list[str] = []
    if payload.get("MailboxHash"):
        out.append(str(payload["MailboxHash"]).lower())
    for a in addrs:
        local, _, dom = a.strip().lower().rpartition("@")
        if not local:
            continue
        if domain and dom == domain:
            out.append(local.split("+", 1)[-1] if "+" in local else local)
        elif dom.endswith("inbound.postmarkapp.com") and "+" in local:
            out.append(local.split("+", 1)[1])
    seen: list[str] = []
    for t in out:
        if t and t not in seen:
            seen.append(t)
    return seen


def header(payload: dict[str, Any], name: str) -> str:
    for h in payload.get("Headers") or []:
        if isinstance(h, dict) and str(h.get("Name", "")).lower() == name.lower():
            return str(h.get("Value") or "")
    return ""


def quick_sort(payload: dict[str, Any]) -> str | None:
    """A category decided without the model, or None to ask it. Pure."""
    sender = str((payload.get("FromFull") or {}).get("Email") or payload.get("From") or "").lower()
    if sender == GMAIL_CONFIRM_FROM:
        return "setup"
    if header(payload, "X-Spam-Status").lower().startswith("yes"):
        return "spam"
    try:
        if float(header(payload, "X-Spam-Score") or 0) >= 5:
            return "spam"
    except ValueError:
        pass
    local = sender.split("@", 1)[0]
    if local in ("mailer-daemon", "postmaster"):
        return "newsletter"
    auto = header(payload, "Auto-Submitted").lower()
    if auto and auto != "no":
        return "newsletter"
    if header(payload, "List-Unsubscribe") or header(payload, "Precedence").lower() in ("bulk", "list", "junk"):
        return "newsletter"
    return None


def gmail_confirmation(text: str) -> dict[str, str]:
    """The code and link in Gmail's "confirm forwarding" email. Pure."""
    code = re.search(r"(?:Confirmation code|קוד אישור)[:\s]*([0-9]{6,12})", text or "", re.I)
    link = re.search(r"https://mail(?:-settings)?\.google\.com/\S+", text or "")
    return {"code": code.group(1) if code else "", "link": link.group(0).rstrip(").,>") if link else ""}


_FWD_FROM = re.compile(r"^(?:\*?From\*?|מאת|De|От)\s*:\s*\*?(.*?)\*?\s*$", re.I | re.M)
_ADDR = re.compile(r"[\w.+'-]+@[\w-]+(?:\.[\w-]+)+")


def forwarded_sender(text: str) -> tuple[str, str]:
    """(name, email) of the original sender in a hand-forwarded email, from
    its first "From:" line. ("", "") when there is none. Pure."""
    m = _FWD_FROM.search(text or "")
    if not m:
        return "", ""
    line = m.group(1)
    addr = _ADDR.search(line)
    if not addr:
        return "", ""
    name = line[:addr.start()].strip().strip('"<>[]( ').strip()
    return name[:80], addr.group(0).lower()


def is_forward(subject: str) -> bool:
    return bool(re.match(r"^\s*(?:fwd?|fw|הועבר|tr|wg)\s*:", subject or "", re.I))


def reply_html(body: str) -> str:
    """A plain, personal-looking email: the text and nothing else. Pure."""
    paras = [p.strip() for p in re.split(r"\n\s*\n", body.strip()) if p.strip()]
    inner = "".join(
        f'<p style="margin:0 0 14px 0;">{html.escape(p).replace(chr(10), "<br>")}</p>' for p in paras
    )
    return (
        '<!DOCTYPE html><html><body dir="auto" style="margin:0;padding:16px;font-family:-apple-system,'
        'BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;'
        f'color:#111827;"><div dir="auto">{inner}</div></body></html>'
    )


# --------------------------------------------------------------------------
# Owner-side reading
# --------------------------------------------------------------------------
async def owner_emails(biz: dict[str, Any]) -> set[str]:
    out = set()
    u = await db.users.find_one({"id": biz.get("owner_user_id")}, {"email": 1}) or {}
    for v in (u.get("email"), biz.get("contact_email"), biz.get("email")):
        if v:
            out.add(str(v).strip().lower())
    return out


async def ensure_address(biz: dict[str, Any]) -> str | None:
    """The business's address, made the first time it is asked for. None
    when the inbound domain is not set up on this server."""
    domain = inbound_domain()
    if not domain:
        return None
    token = (biz.get("inbox") or {}).get("token")
    if not token:
        for _ in range(5):
            token = make_token(biz.get("name") or "")
            if not await db.businesses.find_one({"inbox.token": token}, {"_id": 1}):
                break
        await db.businesses.update_one({"_id": biz["_id"], "inbox.token": {"$exists": False}},
                                       {"$set": {"inbox.token": token, "inbox.created_at": datetime.now(UTC).isoformat()}})
        fresh = await db.businesses.find_one({"_id": biz["_id"]}, {"inbox": 1}) or {}
        token = (fresh.get("inbox") or {}).get("token") or token
    return f"{token}@{domain}"


async def email_cards(business_id: str, since: str) -> dict[str, dict[str, Any]]:
    """Leads-board cards (leads.py) for the customer emails of the last
    DAYS days."""
    cards: dict[str, dict[str, Any]] = {}
    async for e in db.inbox_emails.find({"business_id": business_id, "received_at": {"$gte": since},
                                         "category": {"$in": list(CUSTOMER_CATEGORIES)},
                                         "status": {"$nin": ["spam", "deleted"]}}):
        key = f"email:{e['_id']}"
        replied = bool(e.get("replied_at"))
        cards[key] = {
            "key": key, "source": "email", "email_id": e["_id"],
            "name": e.get("customer_name") or e.get("customer_email") or "",
            "title": e.get("summary") or e.get("subject") or "",
            "last_text": (e.get("text") or "").strip()[:140], "subject": e.get("subject") or "",
            "customer_email": e.get("customer_email") or "", "category": e.get("category"),
            "created_at": e["received_at"], "last_at": e.get("replied_at") or e["received_at"],
            "last_from_customer": not replied,
            "auto_stage": "replied" if replied or e.get("status") == "done" else "new",
            "draft": None if replied else (e.get("draft") or None),
            "draft_subject": e.get("draft_subject") or "",
            "draft_state": e.get("draft_state"),
            "can_send": bool(e.get("customer_email")),
        }
    return cards


# --------------------------------------------------------------------------
# Receiving
# --------------------------------------------------------------------------
@router.post("/webhooks/postmark-inbound")
async def postmark_inbound(request: Request, token: str | None = None):
    """Postmark's inbound webhook. Always 200 for an authenticated call
    (Postmark retries anything else), whatever we make of the email."""
    secret = inbound_secret()
    if not secret or not token or not secrets.compare_digest(token, secret):
        raise HTTPException(status_code=401, detail="Invalid webhook token")
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body") from None
    try:
        await receive(payload)
    except Exception as e:  # noqa: BLE001
        logger.warning("[inbox] could not take an email: %s", e, exc_info=True)
    return {"ok": True}


async def receive(payload: dict[str, Any], *, draft_now: bool = False) -> str | None:
    """Store one inbound email. Returns its id, or None when it is for no
    business, a repeat, or the owner's own reply."""
    biz = None
    for t in recipient_tokens(payload, inbound_domain()):
        biz = await db.businesses.find_one({"inbox.token": t})
        if biz:
            break
    if not biz:
        return None

    from_full = payload.get("FromFull") or {}
    from_email = str(from_full.get("Email") or payload.get("From") or "").strip().lower()
    from_name = str(from_full.get("Name") or "").strip()[:80]
    subject = str(payload.get("Subject") or "").strip()[:300]
    text = str(payload.get("TextBody") or "")
    if not text.strip() and payload.get("HtmlBody"):
        from utils.email import _strip_html
        text = html.unescape(_strip_html(str(payload["HtmlBody"])))
    text = text[:20000]
    message_id = header(payload, "Message-ID") or str(payload.get("MessageID") or "")
    in_reply_to = header(payload, "In-Reply-To")
    now = datetime.now(UTC)
    mine = await owner_emails(biz)

    # The owner CC'd us on their own answer: the enquiry it answers is replied.
    if from_email in mine and not is_forward(subject):
        refs = [r for r in re.split(r"\s+", f"{in_reply_to} {header(payload, 'References')}") if r]
        if refs:
            await db.inbox_emails.update_many(
                {"business_id": biz["_id"], "message_id": {"$in": refs}, "replied_at": None},
                {"$set": {"replied_at": now.isoformat(), "replied_by": "own_email"}})
            return None

    category = quick_sort(payload)
    forwarded = from_email in mine
    customer_name, customer_email = (from_name, from_email) if not forwarded else forwarded_sender(text)
    doc = {
        "_id": str(uuid.uuid4()), "business_id": biz["_id"], "postmark_id": str(payload.get("MessageID") or uuid.uuid4()),
        "message_id": message_id, "from_email": from_email, "from_name": from_name, "subject": subject, "text": text,
        "forwarded": forwarded, "customer_email": customer_email, "customer_name": customer_name,
        "received_at": now.isoformat(), "expires_at": now + timedelta(days=INBOX_DAYS),
        "category": category or "pending", "status": "open", "replied_at": None,
        "draft": None, "draft_state": "skipped" if category else "pending",
    }
    if category == "setup":
        doc["setup"] = gmail_confirmation(text)
    # Postmark retries a delivery it is unsure of; the unique index is the race guard.
    if await db.inbox_emails.find_one({"business_id": biz["_id"], "postmark_id": doc["postmark_id"]}, {"_id": 1}):
        return None
    try:
        await db.inbox_emails.insert_one(doc)
    except DuplicateKeyError:
        return None

    if category == "setup":
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()), "user_id": biz.get("owner_user_id"), "type": "inbox_setup",
            "message": "Gmail is asking you to confirm forwarding to your MyIsraelRental address",
            "action_url": "/dashboard?tab=customers&view=leads", "read": False, "created_at": now.isoformat()})
    elif not category:
        from utils.bg_tasks import spawn
        if draft_now:
            await make_draft(doc["_id"])
        else:
            spawn(make_draft(doc["_id"]))
    return doc["_id"]


async def make_draft(email_id: str) -> None:
    """Ask Claude about one stored email and keep what it says. Never raises."""
    e = await db.inbox_emails.find_one({"_id": email_id})
    if not e:
        return
    biz = await db.businesses.find_one({"_id": e["business_id"]})
    if not biz:
        return
    owner = await db.users.find_one({"id": biz.get("owner_user_id")}, {"preferred_language": 1}) or {}
    lang = "he" if str(owner.get("preferred_language") or "").startswith("he") else "en"
    try:
        from utils.lead_assist import draft_for_email
        out = await draft_for_email(db, biz, e, owner_lang=lang)
    except Exception as err:  # noqa: BLE001
        logger.warning("[inbox] draft failed for %s: %s", email_id, err)
        await db.inbox_emails.update_one({"_id": email_id}, {"$set": {"draft_state": "failed",
                                                                       "category": e["category"] if e["category"] != "pending" else "other"}})
        return
    if out is None:
        await db.inbox_emails.update_one({"_id": email_id}, {"$set": {"draft_state": "limit",
                                                                       "category": e["category"] if e["category"] != "pending" else "other"}})
        return
    update = {"category": out["category"], "summary": out["summary"], "language": out["language"],
              "draft": out["reply"] or None, "draft_subject": out["reply_subject"] or _re(e.get("subject")),
              "draft_state": "ready" if out["reply"] else "skipped"}
    # The model's reading of who the customer is wins only where we had none,
    # or the owner forwarded it (the header sender is then the owner).
    if out["customer_email"] and (e.get("forwarded") or not e.get("customer_email")):
        update["customer_email"] = out["customer_email"]
    if out["customer_name"] and (e.get("forwarded") or not e.get("customer_name")):
        update["customer_name"] = out["customer_name"]
    await db.inbox_emails.update_one({"_id": email_id}, {"$set": update})
    if out["category"] in CUSTOMER_CATEGORIES:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()), "user_id": biz.get("owner_user_id"), "type": "inbox_email",
            "message": ("מייל חדש: " if lang == "he" else "New email: ") + (out["summary"] or e.get("subject") or "")[:120],
            "action_url": "/dashboard?tab=customers&view=leads", "read": False,
            "created_at": datetime.now(UTC).isoformat()})


def _re(subject: str | None) -> str:
    s = (subject or "").strip()
    return s if re.match(r"^\s*re\s*:", s, re.I) else f"Re: {s}".strip()


# --------------------------------------------------------------------------
# The owner's side
# --------------------------------------------------------------------------
async def _access(business_id: str, user: dict[str, Any]) -> dict[str, Any]:
    from utils.business_access import business_access
    return await business_access(db, business_id, user, "customers")


@router.get("/marketplace/businesses/{business_id}/inbox")
async def get_inbox(business_id: str, user=Depends(verify_token)):
    biz = await _access(business_id, user)
    from utils.lead_assist import DAILY_CAP, used_today
    setup = await db.inbox_emails.find({"business_id": business_id, "category": "setup", "status": "open"},
                                       {"_id": 1, "setup": 1, "received_at": 1}).sort("received_at", -1).to_list(3)
    filtered = await db.inbox_emails.find(
        {"business_id": business_id, "$or": [{"category": {"$in": ["spam", "newsletter"]}}, {"status": "spam"}],
         "received_at": {"$gte": (datetime.now(UTC) - timedelta(days=30)).isoformat()}},
        {"_id": 1, "from_email": 1, "from_name": 1, "subject": 1, "received_at": 1, "category": 1}).sort("received_at", -1).to_list(20)
    received = await db.inbox_emails.count_documents({"business_id": business_id}, limit=1)
    return {
        "address": await ensure_address(biz),
        "received_any": bool(received),
        "setup": [{"id": s["_id"], **(s.get("setup") or {}), "received_at": s["received_at"]} for s in setup],
        "filtered": [{"id": f.pop("_id"), **f} for f in filtered],
        "nudge_on": not (biz.get("lead_nudge") or {}).get("off"),
        "drafts_today": await used_today(db, business_id), "drafts_cap": DAILY_CAP,
    }


class SendIn(BaseModel):
    subject: str = Field(..., min_length=1, max_length=200)
    body: str = Field(..., min_length=1, max_length=8000)


async def send_reply(biz: dict[str, Any], email_id: str, subject: str, body: str, by: str) -> None:
    e = await db.inbox_emails.find_one({"_id": email_id, "business_id": biz["_id"]})
    if not e:
        raise HTTPException(status_code=404, detail="Email not found")
    if not e.get("customer_email"):
        raise HTTPException(status_code=400, detail="This email has no address to answer. Reply from your own email.")
    day = datetime.now(UTC).date().isoformat()
    sent_today = await db.inbox_sends.count_documents({"business_id": biz["_id"], "day": day})
    if sent_today >= SENDS_PER_DAY:
        raise HTTPException(status_code=429, detail="That is today's limit of replies from here. Reply from your own email.")
    reply_to = sorted(await owner_emails(biz))
    reply_to_addr = biz.get("contact_email") or (reply_to[0] if reply_to else None)
    headers = {}
    if e.get("message_id"):
        headers = {"In-Reply-To": e["message_id"], "References": e["message_id"]}
    from utils.email import send_email
    ok = await send_email(e["customer_email"], subject.strip(), reply_html(body), text_body=body.strip(),
                          tag="inbox_reply", reply_to=reply_to_addr, from_name=biz.get("name") or None,
                          headers=headers or None)
    if not ok:
        raise HTTPException(status_code=502, detail="The email did not go out. Try again in a minute.")
    now = datetime.now(UTC).isoformat()
    await db.inbox_sends.insert_one({"_id": str(uuid.uuid4()), "business_id": biz["_id"], "email_id": email_id,
                                     "day": day, "by": by, "at": now})
    await db.inbox_emails.update_one({"_id": email_id}, {"$set": {"replied_at": now, "replied_by": by,
                                                                   "sent_subject": subject.strip(), "sent_body": body.strip()}})


@router.post("/marketplace/businesses/{business_id}/inbox/{email_id}/send")
async def send(business_id: str, email_id: str, body: SendIn, user=Depends(verify_token)):
    biz = await _access(business_id, user)
    await send_reply(biz, email_id, body.subject, body.body, user["user_id"])
    return {"ok": True}


@router.post("/marketplace/businesses/{business_id}/inbox/{email_id}/redraft")
async def redraft(business_id: str, email_id: str, user=Depends(verify_token)):
    await _access(business_id, user)
    if not await db.inbox_emails.find_one({"_id": email_id, "business_id": business_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Email not found")
    await make_draft(email_id)
    e = await db.inbox_emails.find_one({"_id": email_id}, {"draft": 1, "draft_subject": 1, "draft_state": 1})
    if e.get("draft_state") == "limit":
        raise HTTPException(status_code=429, detail="That is today's limit of suggested replies. Write this one yourself, or try tomorrow.")
    return {"draft": e.get("draft"), "draft_subject": e.get("draft_subject"), "draft_state": e.get("draft_state")}


class StatusIn(BaseModel):
    status: Literal["open", "done", "spam"]


@router.post("/marketplace/businesses/{business_id}/inbox/{email_id}/status")
async def set_status(business_id: str, email_id: str, body: StatusIn, user=Depends(verify_token)):
    await _access(business_id, user)
    e = await db.inbox_emails.find_one({"_id": email_id, "business_id": business_id}, {"category": 1})
    if not e:
        raise HTTPException(status_code=404, detail="Email not found")
    update: dict[str, Any] = {"status": body.status}
    # "Not spam" on something we filtered: treat it as a customer email.
    if body.status == "open" and e.get("category") in ("spam", "newsletter"):
        update["category"] = "other"
    await db.inbox_emails.update_one({"_id": email_id}, {"$set": update})
    return {"ok": True}


async def ensure_inbox_indexes() -> None:
    await db.businesses.create_index("inbox.token", unique=True, sparse=True)
    await db.inbox_emails.create_index([("business_id", 1), ("postmark_id", 1)], unique=True)
    await db.inbox_emails.create_index([("business_id", 1), ("received_at", -1)])
    await db.inbox_emails.create_index([("business_id", 1), ("message_id", 1)])
    await db.inbox_emails.create_index("expires_at", expireAfterSeconds=0)
    await db.inbox_sends.create_index([("business_id", 1), ("day", 1)])
    await db.ai_draft_usage.create_index("day")
