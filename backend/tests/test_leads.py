"""The leads board (routes/marketplace/leads.py)."""
from routes.marketplace.leads import apply_move, chat_leads, new_leads_only

OWNER = "owner"


def _m(sender, receiver, at, gig="g1", text="hi"):
    return {"property_id": gig, "sender_id": sender, "receiver_id": receiver, "created_at": at, "message": text}


def test_chat_cards_new_then_replied():
    msgs = [_m("dana", OWNER, "2026-10-20T10:00"), _m("yossi", OWNER, "2026-10-20T11:00", gig="g2"),
            _m(OWNER, "dana", "2026-10-20T12:00", text="Yes, Friday works")]
    cards = chat_leads(msgs, OWNER, {"g1": "Deep clean", "g2": "Moving"})
    assert cards["chat:g1:dana"]["auto_stage"] == "replied"
    assert cards["chat:g1:dana"]["last_text"] == "Yes, Friday works"
    assert cards["chat:g2:yossi"]["auto_stage"] == "new" and cards["chat:g2:yossi"]["title"] == "Moving"


def test_conversation_the_business_started_is_not_a_lead():
    assert chat_leads([_m(OWNER, "dana", "2026-10-20T10:00")], OWNER, {}) == {}


def test_a_move_holds_until_the_enquiry_changes():
    card = {"auto_stage": "replied"}
    assert apply_move(card, {"stage": "won", "from_stage": "replied"}) == "won"
    # the customer accepted a price since: the enquiry moved on, the old move no longer applies
    assert apply_move({"auto_stage": "quoted"}, {"stage": "lost", "from_stage": "replied"}) == "quoted"
    assert apply_move(card, None) == "replied"


def test_old_customers_are_not_new_leads():
    msgs = [_m("dana", OWNER, "2026-10-20T10:00"), _m("yossi", OWNER, "2026-10-20T11:00", gig="g2"), _m("avi", OWNER, "2026-10-20T12:00")]
    cards = new_leads_only(chat_leads(msgs, OWNER, {}), {"dana": "2026-09-01T09:00", "avi": "2026-10-21T09:00"})
    # dana ordered before she wrote: an old customer; avi first ordered after his chat: he was a lead, and stays
    assert set(cards) == {"chat:g2:yossi", "chat:g1:avi"}


def test_next_step_says_what_to_do():
    from routes.marketplace.leads import next_step
    now = "2026-11-12T12:00:00+00:00"
    assert next_step({"stage": "new", "last_at": "2026-11-12T11:00:00+00:00"}, now) == "answer"
    assert next_step({"stage": "replied", "last_from_customer": True, "last_at": now}, now) == "answer"
    assert next_step({"stage": "quoted", "last_at": "2026-11-11T12:00:00+00:00"}, now) is None
    assert next_step({"stage": "quoted", "last_at": "2026-11-09T12:00:00+00:00"}, now) == "follow_up"
    assert next_step({"stage": "replied", "last_from_customer": False, "last_at": "2026-11-08T12:00:00+00:00"}, now) == "check_in"
    assert next_step({"stage": "won", "last_at": "2026-10-01T12:00:00+00:00"}, now) is None


def test_parse_draft_reads_json_and_drops_long_dashes():
    from routes.marketplace.leads import parse_draft
    out = parse_draft('Here: {"subject": "Your move — Friday", "body": "Hi Dana – yes we can."}')
    assert out == {"subject": "Your move, Friday", "body": "Hi Dana, yes we can."}
    assert parse_draft("no json")["body"] == ""
