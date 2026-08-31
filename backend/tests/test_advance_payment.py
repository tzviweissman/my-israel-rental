"""The advance-payment detector fires on the scam and stays quiet otherwise.

The false-NEGATIVE tests are the ones that matter for harm, and the
false-POSITIVE tests are the ones that matter for whether the warning
still works in three months. A dialog that fires on every message
mentioning money is dismissed reflexively by week two, and then it is not
there for the message that counts - so "ordinary messages stay quiet" is
a safety test, not a politeness test.

The scam texts below follow ISOC-IL's May 2026 alert: forged transfer
screenshots, fake courier invoices, a shipping fee payable up front.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from utils.advance_payment import (  # noqa: E402
    advance_payment_signals,
    is_advance_payment_risk,
)


# --------------------------------------------------------------------------
# Must fire: money moving before the item does, because the person cannot come
# --------------------------------------------------------------------------

@pytest.mark.parametrize("message", [
    "Hi, I am abroad right now but my courier will collect it. Send me your bank transfer details.",
    "I can't come myself, my agent will pick it up. Just pay the shipping fee first.",
    "I'm travelling until next month. I'll send the deposit by Bit and the courier will come.",
    "Please hold it for me, I will pay in advance by PayPal, I am overseas.",
    "The delivery company needs the shipping fee prepaid, then I'll send it to you.",
    "אני בחו\"ל, השליח שלי יאסוף. אעביר לך מקדמה בביט.",
    "לא אוכל להגיע, אשלח שליח. תשלום מראש בהעברה בנקאית.",
])
def test_the_scam_shape_is_caught(message):
    assert is_advance_payment_risk(message), f"missed: {message!r}"


# --------------------------------------------------------------------------
# Must NOT fire: each signal alone is an ordinary sentence here
# --------------------------------------------------------------------------

@pytest.mark.parametrize("message", [
    # payment, no distance - a normal way to arrange a handover
    "Can I pay by Bit when I collect it?",
    "Is the price firm or would you take a deposit to hold it until Sunday?",
    "I'll bring cash, does 400 work?",
    "אפשר לשלם בביט כשאני מגיע?",
    # distance, no payment - also completely normal
    "I'm abroad until Tuesday, can it wait until I'm back?",
    "My husband will come and collect it, is that alright?",
    "I can't come today, would Thursday suit you?",
    "אני בחו\"ל עד יום שלישי, אפשר לשמור?",
    # neither
    "Is the sofa still available?",
    "Does it fit through a standard door?",
    "What are the dimensions?",
])
def test_ordinary_messages_stay_quiet(message):
    assert not is_advance_payment_risk(message), f"false positive on: {message!r}"


def test_both_families_are_required():
    """The conjunction, asserted directly rather than inferred from the
    cases above - it is the single decision this module makes."""
    payment_only = "I can send a deposit by PayPal"
    distance_only = "I am abroad and my courier will collect"
    both = "I am abroad, my courier will collect, I'll send a deposit by PayPal"

    assert advance_payment_signals(payment_only)["payment"]
    assert not advance_payment_signals(payment_only)["distance"]
    assert not is_advance_payment_risk(payment_only)

    assert advance_payment_signals(distance_only)["distance"]
    assert not advance_payment_signals(distance_only)["payment"]
    assert not is_advance_payment_risk(distance_only)

    assert is_advance_payment_risk(both)


def test_it_reports_what_matched():
    """A human reviewing a false positive has to be able to see why it
    fired, and the log needs something better than True."""
    s = advance_payment_signals("I am abroad, please send the deposit first")
    assert "abroad" in s["distance"]
    assert "deposit" in s["payment"]


def test_punctuation_and_case_do_not_defeat_it():
    for variant in [
        "I'm ABROAD -- my courier will collect. DEPOSIT first, please.",
        "i am abroad...my courier will collect...deposit first",
        "I am abroad (my courier will collect) — deposit first",
    ]:
        assert is_advance_payment_risk(variant), variant


@pytest.mark.parametrize("junk", [None, "", "   ", "?", "\n\n"])
def test_empty_input_is_safe(junk):
    assert is_advance_payment_risk(junk) is False
    s = advance_payment_signals(junk)
    assert s == {"payment": [], "distance": []}


def test_it_never_raises_on_odd_input():
    for weird in ["\x00\x01", "🙂" * 50, "a" * 5000, "בחו\"ל" * 100]:
        assert isinstance(is_advance_payment_risk(weird), bool)
