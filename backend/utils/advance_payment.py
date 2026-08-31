"""Spot a message asking someone to pay before they hold the item.

WHY THIS IS THE ONE INTERVENTION WORTH BUILDING. The platform touches no
money, has no escrow and offers no buyer protection - deliberately, and
that is not changing. What it can do is interrupt at the moment somebody
is about to send money to a stranger. The BBB found that where a bank or
card company intervened at that moment, 40% of targets did not lose
money. Friction at the payment moment is the only intervention in the
research with a measured effect.

The pattern this exists to catch is the dominant Israeli marketplace scam
per ISOC-IL's May 2026 alert: advance payment to a stranger, dressed as a
forged bank-transfer screenshot, a fake courier invoice, a "GLS shipping
fee", or an Israel Post phishing link. Every variant requires the victim
to pay before they hold the item.

TWO SIGNALS, NOT ONE, AND THAT IS THE WHOLE DESIGN.

  payment  - deposit, transfer, send the fee, Bit, PayPal
  distance - I am abroad, my courier will collect, I will ship it

Either alone is ordinary. "Can you hold it, I will come Thursday" is a
normal message on a goods board; so is "I can pay by Bit when I collect".
It is the CLUSTER that is the scam shape: money moving before the item
does, because the person cannot come.

Requiring both is what keeps this from crying wolf. A warning that fires
on every message mentioning money is a warning nobody reads by week two,
and then it is not there for the message that matters.

WHAT THIS IS NOT. It is not a block, not a classifier, and not evidence.
It cannot tell a scammer from a genuinely travelling buyer, and the
honest response to both is the same: do not send money before you have
the item. So the caller shows the person a warning and lets them proceed.
Nobody is accused, nothing is hidden, and a false positive costs one
dismissed dialog.
"""
from __future__ import annotations

import re

# Money changing hands. Hebrew and English, because the board is both and
# a scammer writes in whichever language the seller posted in.
PAYMENT_TERMS: tuple[str, ...] = (
    "deposit", "down payment", "advance", "prepay", "pay first", "pay in advance",
    "pay before", "transfer the money", "bank transfer", "wire", "western union",
    "send the fee", "shipping fee", "delivery fee", "paypal", "bit ", "paybox",
    "gift card", "bitcoin", "crypto", "iban", "swift",
    "מקדמה", "העברה בנקאית", "לשלם מראש", "תשלום מראש", "דמי משלוח",
    "ביט", "פייפאל", "העברה", "מקדמת",
)

# The reason given for why the item cannot simply be handed over.
DISTANCE_TERMS: tuple[str, ...] = (
    "abroad", "overseas", "out of the country", "not in israel", "another city",
    "my courier", "the courier", "courier will", "shipping company", "delivery company",
    "i will send it", "i'll send it", "send it to you", "ship it to you",
    "hold it for me", "reserve it for me", "on my behalf", "my agent",
    "cannot come", "can't come", "unable to come", "travelling", "traveling",
    "בחו\"ל", "בחול", "לא בארץ", "שליח", "השליח", "חברת משלוחים",
    "אשלח לך", "לשמור לי", "לא אוכל להגיע", "בשליחות",
)


def _hits(text: str, terms: tuple[str, ...]) -> list[str]:
    found = []
    for term in terms:
        if term in text:
            found.append(term.strip())
    return found


def advance_payment_signals(message: str | None) -> dict[str, list[str]]:
    """Which of the two signal families this message carries.

    Returned rather than a bare bool so the caller can log what matched
    and a human reviewing a false positive can see why it fired.
    """
    if not message:
        return {"payment": [], "distance": []}
    text = f" {message.lower()} "
    # Collapse punctuation so "pay-first" and "pay first" read alike, but
    # keep the quote in בחו"ל.
    text = re.sub(r"[.,!?;:()\[\]/\\-]+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return {
        "payment": _hits(text, PAYMENT_TERMS),
        "distance": _hits(text, DISTANCE_TERMS),
    }


def is_advance_payment_risk(message: str | None) -> bool:
    """True only when BOTH families are present.

    The conjunction is the point. Either signal alone is an ordinary
    sentence on a second-hand board, and firing on either would train
    people to dismiss the warning before it ever mattered.
    """
    s = advance_payment_signals(message)
    return bool(s["payment"]) and bool(s["distance"])
