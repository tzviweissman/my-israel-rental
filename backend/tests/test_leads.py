"""The leads board (routes/marketplace/leads.py)."""
from routes.marketplace.leads import apply_move, chat_leads

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
