"""Owner-held payment links, and the allowlist that makes them safe.

A business puts its own payment link on its page — Bit, PayBox, Stripe and
the rest. **We never process the money.** The link belongs to the owner, the
payment happens on the provider's own domain, and the site takes nothing.
That is the standing position: free to list, free to be found, no commission.

WHY THE ALLOWLIST IS THE WHOLE FEATURE

An arbitrary owner-supplied URL rendered as a button on a page we host is an
open redirect with our name on it. A "payment link" pointing at a credential
harvester is indistinguishable, to a visitor, from a real one — and the
visitor's reason for trusting it is that they found it here.

So the destination is checked against a closed list, and the check is done
on the **registrable domain**, not with a suffix match:

    "paybox.co.il" in url                 -> evil.com/?x=paybox.co.il passes
    url.endswith("paybox.co.il")          -> evil-paybox.co.il passes
    host == d or host.endswith("." + d)   -> correct

That middle line is the trap this module exists to avoid, and
`test_payment_link_allowlist.py` pins it with `evil-paybox.co.il`.
"""
from __future__ import annotations

from urllib.parse import urlsplit

# Payment providers an Israeli small business actually uses, plus the two
# global ones. Every entry matches itself and its subdomains, nothing else.
#
# Adding a domain here is a security decision, not a convenience one: it
# grants that host the right to be linked from a page carrying our name.
ALLOWED_PAYMENT_DOMAINS: tuple[str, ...] = (
    # Israeli
    "bitpay.co.il",        # Bit
    "paybox.co.il",
    "meshulam.co.il",
    "grow.business",       # Meshulam Grow
    "payplus.co.il",
    "tranzila.com",
    "cardcom.solutions",
    "icount.co.il",
    "greeninvoice.co.il",
    "sumit.co.il",
    "morning.co.il",
    # Global
    "stripe.com",
    "paypal.com",
    "paypal.me",
    "revolut.me",
    "wise.com",
)

# The name a provider is KNOWN BY, which is not its domain. An owner pasting
# a `bitpay.co.il` link is thinking "Bit", and a visitor reading a button
# labelled "Bitpay" would wonder whether it is the right one.
#
# This exists so the owner's form can pre-fill a label and name the accepted
# providers in the owner's own vocabulary — the API's validation still runs
# off ALLOWED_PAYMENT_DOMAINS above and nothing here can widen it.
# `test_payment_link_allowlist` asserts every allowlisted domain has an entry,
# so adding a domain without naming it fails the suite rather than shipping a
# provider list with a hole in it.
PROVIDER_NAMES: dict[str, str] = {
    "bitpay.co.il": "Bit",
    "paybox.co.il": "PayBox",
    "meshulam.co.il": "Meshulam",
    "grow.business": "Grow",
    "payplus.co.il": "PayPlus",
    "tranzila.com": "Tranzila",
    "cardcom.solutions": "Cardcom",
    "icount.co.il": "iCount",
    "greeninvoice.co.il": "Green Invoice",
    "sumit.co.il": "Sumit",
    "morning.co.il": "Morning",
    "stripe.com": "Stripe",
    "paypal.com": "PayPal",
    "paypal.me": "PayPal",
    "revolut.me": "Revolut",
    "wise.com": "Wise",
}


def payment_providers() -> list[dict[str, str]]:
    """The accepted providers, for a client that has to name them.

    Read-only and derived: the tuple above stays the single authority on
    what is accepted, and this cannot add to it.
    """
    return [
        {"domain": d, "name": PROVIDER_NAMES.get(d, d)}
        for d in ALLOWED_PAYMENT_DOMAINS
    ]


# Six payment options is not a business, it is a warning. The cap is here
# rather than in the form so a second client cannot ignore it.
MAX_PAYMENT_LINKS = 4

MAX_LABEL_LEN = 40


class PaymentLinkError(ValueError):
    """Raised with a message intended to be shown to the owner."""


def registrable_host(url: str) -> str | None:
    """The lowercased host of `url`, or None if it is not a usable URL."""
    try:
        parts = urlsplit(url.strip())
    except ValueError:
        return None
    if not parts.scheme or not parts.netloc:
        return None
    # `netloc` carries userinfo and port; neither belongs in the check.
    # `user@evil.com` parses with hostname `evil.com`, which is what we want
    # to test — but a URL carrying credentials has no business being a
    # payment link at all, so it is refused outright below.
    return (parts.hostname or "").lower() or None


def is_allowed_payment_url(url: str) -> bool:
    """True when `url` is https and lands on an allowlisted payment domain."""
    raw = (url or "").strip()
    if not raw:
        return False
    try:
        parts = urlsplit(raw)
    except ValueError:
        return False

    # HTTPS only. A payment link over plain http is not one, and neither is
    # a `javascript:` or `data:` URL dressed up as a link.
    if parts.scheme.lower() != "https":
        return False
    # Credentials in a payment URL are either a mistake or an attack.
    if parts.username or parts.password:
        return False

    host = (parts.hostname or "").lower()
    if not host:
        return False
    # A trailing dot is a valid FQDN form ("paybox.co.il.") that string
    # comparison would miss.
    host = host.rstrip(".")

    return any(host == d or host.endswith("." + d) for d in ALLOWED_PAYMENT_DOMAINS)


def clean_payment_links(raw: list | None) -> list[dict]:
    """Validate and normalise the owner's list.

    Raises `PaymentLinkError` naming what went wrong, because an owner who
    pasted a link from an unsupported provider needs to know that is the
    reason rather than seeing it silently vanish.
    """
    if not raw:
        return []
    if len(raw) > MAX_PAYMENT_LINKS:
        raise PaymentLinkError(
            f"Up to {MAX_PAYMENT_LINKS} payment links.",
        )

    out: list[dict] = []
    for item in raw:
        data = item if isinstance(item, dict) else getattr(item, "model_dump", lambda: {})()
        url = str(data.get("url") or "").strip()
        label = str(data.get("label") or "").strip()[:MAX_LABEL_LEN]
        if not url:
            continue
        if not is_allowed_payment_url(url):
            raise PaymentLinkError(
                "That payment link is not from a provider we can show. "
                "Accepted: " + ", ".join(sorted(ALLOWED_PAYMENT_DOMAINS)),
            )
        if not label:
            # Fall back to the provider's own name rather than a generic
            # "Pay" — a visitor should know where a payment button sends
            # them before they press it.
            host = (registrable_host(url) or "").removeprefix("www.")
            label = host.split(".")[0].title()
        out.append({"label": label, "url": url})
    return out
