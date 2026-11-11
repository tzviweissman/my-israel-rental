"""The business's email address, AI reply drafts, and the waiting-lead nudge
(routes/marketplace/email_inbox.py, lead_nudge.py, utils/lead_assist.py).

The model is never called: `lead_assist._ask` is replaced with a canned
answer, and email sending with a recorder."""
import json
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

import jwt
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes.marketplace import email_inbox as ei  # noqa: E402
from routes.marketplace import lead_nudge as ln  # noqa: E402
from utils import lead_assist as la  # noqa: E402
from utils.auth import JWT_SECRET  # noqa: E402

OWNER, CUSTOMER, STRANGER = "owner-1", "cust-1", "stranger"
DOMAIN = "in.example.test"


def _auth(uid):
    tok = jwt.encode({"user_id": uid, "email": f"{uid}@example.test", "role": "owner"}, JWT_SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {tok}"}


# --------------------------------------------------------------------------
# Pure helpers
# --------------------------------------------------------------------------
def test_recipient_tokens_reads_our_domain_cc_and_postmark_hash():
    p = {"ToFull": [{"Email": "Someone@Gmail.com"}], "CcFull": [{"Email": "DaniMovers-k3x9qp@in.example.test"}],
         "OriginalRecipient": "x+abc123@inbound.postmarkapp.com"}
    assert ei.recipient_tokens(p, DOMAIN) == ["danimovers-k3x9qp", "abc123"]
    assert ei.recipient_tokens({"ToFull": [{"Email": "a@other.test"}]}, DOMAIN) == []


def test_make_token_is_readable_and_ascii():
    t = ei.make_token("דני הובלות")
    assert t.startswith("biz-") and len(t) == 10
    assert ei.make_token("Dani's Movers!").startswith("danismovers-")


def test_quick_sort_without_the_model():
    h = lambda **kw: {"Headers": [{"Name": k.replace("_", "-"), "Value": v} for k, v in kw.items()]}  # noqa: E731
    assert ei.quick_sort({"FromFull": {"Email": "forwarding-noreply@google.com"}}) == "setup"
    assert ei.quick_sort(h(X_Spam_Status="Yes, score=7")) == "spam"
    assert ei.quick_sort(h(List_Unsubscribe="<mailto:x>")) == "newsletter"
    assert ei.quick_sort(h(Auto_Submitted="auto-replied")) == "newsletter"
    assert ei.quick_sort({"FromFull": {"Email": "dana@gmail.com"}, **h(X_Spam_Score="1.2")}) is None


def test_gmail_confirmation_code_and_link():
    text = "Confirmation code: 123456789\nTo allow, click https://mail-settings.google.com/mail/vf-abc-123 ."
    assert ei.gmail_confirmation(text) == {"code": "123456789", "link": "https://mail-settings.google.com/mail/vf-abc-123"}


def test_forwarded_sender_from_a_hand_forward():
    body = "fyi\n\n---------- Forwarded message ---------\nFrom: Dana Levi <dana@gmail.com>\nDate: Mon\nSubject: Move"
    assert ei.forwarded_sender(body) == ("Dana Levi", "dana@gmail.com")
    assert ei.forwarded_sender("מאת: יוסי <yossi@walla.co.il>") == ("יוסי", "yossi@walla.co.il")
    assert ei.forwarded_sender("no header here") == ("", "")


def test_reply_html_escapes_what_was_typed():
    out = ei.reply_html("Hi <b>Dana</b>\n\nSee you")
    assert "&lt;b&gt;" in out and "<b>" not in out and out.count("<p") == 2


def test_parse_json_and_clean_reply():
    assert la.parse_json('Sure!\n```json\n{"reply": "Hi {there}"}\n```') == {"reply": "Hi {there}"}
    assert la.parse_json("no json") is None
    assert la.clean_reply("Thanks — we can come Friday. [Your name]") == "Thanks, we can come Friday."


def test_normalise_rejects_a_bad_address_and_drafts_nothing_for_spam():
    out = la.normalise_email_result({"category": "spam", "customer_email": "not an email", "reply": "Hello"})
    assert out["customer_email"] == "" and out["reply"] == ""
    assert la.normalise_email_result({"category": "weird"})["category"] == "other"


def test_business_facts_only_what_was_published():
    facts = la.business_facts({"name": "Dani Movers", "areas": ["Jerusalem"], "shabbat_closing": True},
                              [{"title": "Flat move", "tiers": [{"name": "2 rooms", "price": 1800}]}])
    assert "Dani Movers" in facts and "Jerusalem" in facts and "2 rooms 1800 ILS" in facts and "Shabbat" in facts


def test_waiting_picks_new_customer_last_in_window():
    now = datetime(2026, 11, 11, 10, 0, tzinfo=UTC)
    at = lambda m: (now - timedelta(minutes=m)).isoformat()  # noqa: E731
    cards = [
        {"key": "a", "stage": "new", "source": "chat", "last_from_customer": True, "last_at": at(90)},
        {"key": "b", "stage": "new", "source": "chat", "last_from_customer": True, "last_at": at(20)},     # too soon
        {"key": "c", "stage": "replied", "source": "chat", "last_from_customer": True, "last_at": at(90)},
        {"key": "d", "stage": "new", "source": "quote", "last_from_customer": True, "last_at": at(90)},
        {"key": "e", "stage": "new", "source": "email", "last_from_customer": True, "last_at": at(60 * 80)},  # too old
        {"key": "f", "stage": "new", "source": "email", "last_from_customer": True, "last_at": at(200)},
    ]
    assert [c["key"] for c in ln.waiting(cards, now)] == ["f", "a"]


def test_daytime_is_israel_time():
    assert ln.daytime(datetime(2026, 11, 11, 7, 0, tzinfo=UTC))       # 09:00 in Israel
    assert not ln.daytime(datetime(2026, 11, 11, 20, 0, tzinfo=UTC))  # 22:00


# --------------------------------------------------------------------------
# End to end
# --------------------------------------------------------------------------
@pytest_asyncio.fixture
async def env(monkeypatch):
    fake = AsyncMongoMockClient()["test_db"]
    import routes.deps as deps
    monkeypatch.setattr(deps, "db", fake)
    for name, module in list(sys.modules.items()):
        if (name.startswith("routes") or name.startswith("utils")) and getattr(module, "db", None) is not None:
            monkeypatch.setattr(module, "db", fake, raising=False)
    monkeypatch.setenv("INBOUND_EMAIL_DOMAIN", DOMAIN)
    monkeypatch.setenv("INBOUND_EMAIL_SECRET", "s3cret")
    monkeypatch.setenv("DISABLE_RATE_LIMIT", "1")

    asked = []

    async def fake_ask(prompt):
        asked.append(prompt)
        if "<email>" in prompt:
            return json.dumps({"category": "lead", "customer_name": "Dana", "customer_email": "dana@gmail.com",
                               "summary": "Wants a 3-room move on Friday", "language": "en",
                               "reply_subject": "Re: Moving", "reply": "Hi Dana, thanks. What floor are you on?\n\nDani Movers"})
        return json.dumps({"reply": "Hi, yes we can help. When do you need it?"})

    monkeypatch.setattr(la, "_ask", fake_ask)
    sent = []

    async def fake_send(to, subject, html_body, **kw):
        sent.append({"to": to, "subject": subject, **kw})
        return True

    import utils.email as ue
    monkeypatch.setattr(ue, "send_email", fake_send)

    await fake.users.insert_many([
        {"id": OWNER, "email": "dani@gmail.com", "name": "Dani", "preferred_language": "en"},
        {"id": CUSTOMER, "email": "c@example.test", "name": "Yossi"},
        {"id": STRANGER, "email": "s@example.test"},
    ])
    await fake.businesses.insert_one({"_id": "biz1", "name": "Dani Movers", "owner_user_id": OWNER, "active": True,
                                      "inbox": {"token": "danimovers-k3x9qp"}})
    await fake.marketplace_gigs.insert_one({"_id": "gig1", "business_id": "biz1", "provider_user_id": OWNER,
                                            "status": "published", "title": "Flat move"})
    import server
    async with AsyncClient(transport=ASGITransport(app=server.app), base_url="http://test") as c:
        yield c, fake, asked, sent


def _payload(**over):
    p = {"MessageID": "pm-1", "FromFull": {"Email": "dana@gmail.com", "Name": "Dana"}, "Subject": "Moving",
         "ToFull": [{"Email": "danimovers-k3x9qp@in.example.test"}], "TextBody": "Can you move us Friday?",
         "Headers": [{"Name": "Message-ID", "Value": "<abc@gmail.com>"}]}
    p.update(over)
    return p


@pytest.mark.asyncio
async def test_webhook_needs_the_secret(env):
    c, fake, *_ = env
    assert (await c.post("/api/webhooks/postmark-inbound", json=_payload())).status_code == 401
    assert (await c.post("/api/webhooks/postmark-inbound?token=wrong", json=_payload())).status_code == 401
    r = await c.post("/api/webhooks/postmark-inbound?token=s3cret", json=_payload(ToFull=[{"Email": "nobody@in.example.test"}]))
    assert r.status_code == 200 and await fake.inbox_emails.count_documents({}) == 0


@pytest.mark.asyncio
async def test_email_to_board_draft_and_send(env):
    c, fake, asked, sent = env
    eid = await ei.receive(_payload(), draft_now=True)
    assert await ei.receive(_payload(), draft_now=True) is None            # Postmark retried: one email
    assert len(asked) == 1 and "Can you move us Friday?" in asked[0]

    board = (await c.get("/api/marketplace/businesses/biz1/leads", headers=_auth(OWNER))).json()
    card = next(x for x in board["leads"] if x["source"] == "email")
    assert card["stage"] == "new" and card["draft"].startswith("Hi Dana") and card["title"] == "Wants a 3-room move on Friday"
    assert (await c.get("/api/marketplace/businesses/biz1/leads", headers=_auth(STRANGER))).status_code == 403

    r = await c.post("/api/marketplace/businesses/biz1/leads/reply", headers=_auth(OWNER),
                     json={"key": card["key"], "text": "Hi Dana, Friday works."})
    assert r.status_code == 200, r.text
    assert sent[-1]["to"] == "dana@gmail.com" and sent[-1]["reply_to"] == "dani@gmail.com"
    assert sent[-1]["from_name"] == "Dani Movers" and sent[-1]["headers"]["In-Reply-To"] == "<abc@gmail.com>"
    board = (await c.get("/api/marketplace/businesses/biz1/leads", headers=_auth(OWNER))).json()
    assert next(x for x in board["leads"] if x["key"] == f"email:{eid}")["stage"] == "replied"


@pytest.mark.asyncio
async def test_spam_and_bulk_spend_no_credit_and_stay_off_the_board(env):
    c, fake, asked, _ = env
    await ei.receive(_payload(MessageID="pm-2", Headers=[{"Name": "List-Unsubscribe", "Value": "<x>"}]), draft_now=True)
    await ei.receive(_payload(MessageID="pm-3", Headers=[{"Name": "X-Spam-Status", "Value": "Yes"}]), draft_now=True)
    assert asked == []
    board = (await c.get("/api/marketplace/businesses/biz1/leads", headers=_auth(OWNER))).json()
    assert not [x for x in board["leads"] if x["source"] == "email"]
    inbox = (await c.get("/api/marketplace/businesses/biz1/inbox", headers=_auth(OWNER))).json()
    assert inbox["address"] == "danimovers-k3x9qp@in.example.test" and len(inbox["filtered"]) == 2


@pytest.mark.asyncio
async def test_gmail_confirmation_is_shown_to_the_owner(env):
    c, fake, asked, _ = env
    await ei.receive(_payload(MessageID="pm-4", FromFull={"Email": "forwarding-noreply@google.com"},
                              TextBody="Confirmation code: 555666777 https://mail-settings.google.com/mail/vf-x"), draft_now=True)
    inbox = (await c.get("/api/marketplace/businesses/biz1/inbox", headers=_auth(OWNER))).json()
    assert inbox["setup"][0]["code"] == "555666777" and asked == []


@pytest.mark.asyncio
async def test_hand_forward_finds_the_real_customer(env):
    c, fake, asked, _ = env
    body = "---------- Forwarded message ---------\nFrom: Dana <dana@gmail.com>\nSubject: Moving\n\nCan you move us?"
    eid = await ei.receive(_payload(MessageID="pm-5", FromFull={"Email": "dani@gmail.com"}, Subject="Fwd: Moving", TextBody=body),
                           draft_now=True)
    e = await fake.inbox_emails.find_one({"_id": eid})
    assert e["forwarded"] and e["customer_email"] == "dana@gmail.com"
    assert "forwarded this email" in asked[0]


@pytest.mark.asyncio
async def test_daily_cap_stops_drafts(env, monkeypatch):
    c, fake, asked, _ = env
    monkeypatch.setattr(la, "DAILY_CAP", 1)
    await ei.receive(_payload(MessageID="pm-6"), draft_now=True)
    eid = await ei.receive(_payload(MessageID="pm-7"), draft_now=True)
    assert len(asked) == 1
    assert (await fake.inbox_emails.find_one({"_id": eid}))["draft_state"] == "limit"


@pytest.mark.asyncio
async def test_nudge_once_with_a_drafted_chat_reply(env):
    c, fake, asked, sent = env
    now = datetime(2026, 11, 11, 9, 0, tzinfo=UTC)   # 11:00 in Israel, a Wednesday
    await fake.messages.insert_one({"id": "m1", "property_id": "gig1", "sender_id": CUSTOMER, "receiver_id": OWNER,
                                    "message": "Do you move pianos?", "created_at": (now - timedelta(minutes=90)).isoformat()})
    assert await ln.run_once(now) == 1
    assert sent[-1]["to"] == "dani@gmail.com" and sent[-1]["tag"] == "lead_nudge"
    assert "Do you move pianos?" in asked[-1]
    assert await fake.notifications.count_documents({"user_id": OWNER, "type": "lead_waiting"}) == 1
    # Later the same day, nothing new: no second nudge.
    assert await ln.run_once(now + timedelta(hours=4)) == 0

    board = (await c.get("/api/marketplace/businesses/biz1/leads", headers=_auth(OWNER))).json()
    card = next(x for x in board["leads"] if x["source"] == "chat")
    assert card["draft"] == "Hi, yes we can help. When do you need it?"
    r = await c.post("/api/marketplace/businesses/biz1/leads/reply", headers=_auth(OWNER), json={"key": card["key"], "text": card["draft"]})
    assert r.status_code == 200
    board = (await c.get("/api/marketplace/businesses/biz1/leads", headers=_auth(OWNER))).json()
    assert next(x for x in board["leads"] if x["key"] == card["key"])["stage"] == "replied"


@pytest.mark.asyncio
async def test_nudge_off_and_at_night(env):
    c, fake, asked, sent = env
    now = datetime(2026, 11, 11, 9, 0, tzinfo=UTC)
    await fake.messages.insert_one({"id": "m1", "property_id": "gig1", "sender_id": CUSTOMER, "receiver_id": OWNER,
                                    "message": "Hi", "created_at": (now - timedelta(minutes=90)).isoformat()})
    assert await ln.run_once(now.replace(hour=21)) == 0     # 23:00 in Israel
    r = await c.put("/api/marketplace/businesses/biz1/lead-nudge", headers=_auth(OWNER), json={"on": False})
    assert r.status_code == 200
    assert await ln.run_once(now) == 0 and sent == []


@pytest.mark.asyncio
async def test_dashboard_counts_customers_waiting(env):
    c, fake, *_ = env
    await fake.messages.insert_one({"id": "m1", "property_id": "gig1", "sender_id": CUSTOMER, "receiver_id": OWNER,
                                    "message": "Hi", "created_at": datetime.now(UTC).isoformat()})
    await ei.receive(_payload(MessageID="pm-9"), draft_now=True)
    assert await ln.waiting_count(OWNER) == 2
    r = await c.get("/api/dashboard/summary", headers=_auth(OWNER))
    assert r.status_code == 200 and r.json()["leads_waiting"] == 2
