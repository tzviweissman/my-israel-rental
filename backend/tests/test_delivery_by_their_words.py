"""A shop that says it delivers is a shop that delivers (routes/marketplace/orders.py).

Tzvi, 14 Oct 2026: "any business that has delivery on their page should
have delivery automatically turned on". The owner's own switch still wins
in both directions; only a shop that never chose is read from its words.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes.marketplace.orders import offers_delivery, says_delivery  # noqa: E402

STORE = {"gig_type": "store", "title": "Gifts", "description": ""}


def test_their_words_turn_it_on():
    assert offers_delivery({}, {"description": "Hand wrapped gifts, delivered across Israel"}, STORE)
    assert offers_delivery({}, {"description_he": "משלוחים לכל הארץ"}, STORE)
    assert offers_delivery({}, {"description": ""}, {**STORE, "description": "Free shipping over $100"})


def test_a_shop_serving_all_of_israel_delivers():
    assert offers_delivery({}, {"serves_nationwide": True}, STORE)


def test_pickup_only_stays_off():
    assert not offers_delivery({}, {"description": "Pickup only, no delivery"}, STORE)
    assert not offers_delivery({}, {"description_he": "איסוף בלבד"}, STORE)


def test_silence_stays_off():
    assert not offers_delivery({}, {"description": "Fresh challah every Friday"}, STORE)
    assert not offers_delivery({}, None, None)


def test_the_owners_switch_wins_both_ways():
    says = {"description": "We deliver anywhere in Jerusalem"}
    assert not offers_delivery({"delivery_on": False}, says, STORE)
    assert offers_delivery({"delivery_on": True}, {"description": ""}, STORE)


def test_delivery_times_set_before_the_switch_still_count():
    assert offers_delivery({"windows": {"delivery": [{"weekday": 1, "start": "10:00", "end": "12:00"}]}}, {}, STORE)


def test_words_inside_other_words_do_not_count():
    assert not says_delivery({"description": "Undeliverable? No: a shipshape bakery"}, STORE)
