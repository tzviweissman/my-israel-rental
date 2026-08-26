"""The payment-link allowlist, and the near-misses it has to refuse.

An owner-supplied URL rendered as a button on a page carrying our name is an
open redirect unless something checks where it goes. The visitor's reason
for trusting that button is that they found it on this site, so a link to a
credential harvester is worse here than almost anywhere else.

These are pure functions over strings — no database, no server, no
credentials — so they run in milliseconds and cannot quietly skip.

The cases that matter are not the obviously-bad URLs. They are the ones a
substring or suffix check would wave through:

    "paybox.co.il" in url           -> evil.com/?ref=paybox.co.il
    url.endswith("paybox.co.il")    -> evil-paybox.co.il
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from utils.payment_links import (  # noqa: E402
    ALLOWED_PAYMENT_DOMAINS,
    MAX_PAYMENT_LINKS,
    PaymentLinkError,
    clean_payment_links,
    is_allowed_payment_url,
)


@pytest.mark.parametrize("url", [
    "https://paybox.co.il/pay/abc123",
    "https://www.paybox.co.il/pay/abc123",
    "https://app.bitpay.co.il/x",
    "https://buy.stripe.com/test_123",
    "https://paypal.me/somebakery",
    "https://meshulam.co.il/purchase?b=1",
])
def test_real_payment_links_are_allowed(url):
    assert is_allowed_payment_url(url), url


@pytest.mark.parametrize("url,why", [
    # THE case. A suffix check passes this and it is a different company.
    ("https://evil-paybox.co.il/pay", "suffix match without a dot boundary"),
    ("https://evilpaybox.co.il/pay", "no separator at all"),
    # A substring check passes these.
    ("https://evil.com/?ref=paybox.co.il", "allowlisted domain in the query"),
    ("https://evil.com/paybox.co.il", "allowlisted domain in the path"),
    ("https://evil.com#paybox.co.il", "allowlisted domain in the fragment"),
    # Host confusion.
    ("https://paybox.co.il.evil.com/pay", "allowlisted domain as a subdomain OF evil"),
    ("https://paybox.co.il@evil.com/pay", "userinfo makes the host look right"),
    # Not a payment link at all.
    ("http://paybox.co.il/pay", "plain http"),
    ("javascript:alert(1)", "not a url scheme we accept"),
    ("data:text/html,<h1>pay</h1>", "data url"),
    ("//paybox.co.il/pay", "scheme-relative, no scheme to check"),
    ("", "empty"),
    ("   ", "whitespace"),
    ("https://", "no host"),
])
def test_near_misses_are_refused(url, why):
    assert not is_allowed_payment_url(url), f"{why}: {url}"


def test_trailing_dot_fqdn_is_still_matched():
    """`paybox.co.il.` is a valid absolute form of the same host, and a
    plain string comparison misses it."""
    assert is_allowed_payment_url("https://paybox.co.il./pay")


def test_every_allowlisted_domain_matches_itself_and_a_subdomain():
    """Guards the guard: a typo in the tuple would otherwise sit unnoticed
    until an owner reported that their real link was refused."""
    for d in ALLOWED_PAYMENT_DOMAINS:
        assert is_allowed_payment_url(f"https://{d}/x"), d
        assert is_allowed_payment_url(f"https://pay.{d}/x"), d


def test_clean_keeps_good_links_and_labels_them():
    out = clean_payment_links([
        {"label": "Pay with Bit", "url": "https://bitpay.co.il/p/1"},
        {"label": "", "url": "https://paybox.co.il/pay/2"},
    ])
    assert out[0] == {"label": "Pay with Bit", "url": "https://bitpay.co.il/p/1"}
    # An unlabelled link takes the provider's name, never a generic "Pay":
    # a visitor should know where a payment button sends them.
    assert out[1]["label"] == "Paybox"


def test_clean_refuses_a_bad_link_loudly():
    """Silently dropping it would leave the owner believing it saved."""
    with pytest.raises(PaymentLinkError) as ei:
        clean_payment_links([{"label": "Pay", "url": "https://evil-paybox.co.il/x"}])
    assert "paybox.co.il" in str(ei.value), "the message should name what IS accepted"


def test_clean_enforces_the_cap():
    too_many = [{"label": "x", "url": "https://paybox.co.il/p"} for _ in range(MAX_PAYMENT_LINKS + 1)]
    with pytest.raises(PaymentLinkError):
        clean_payment_links(too_many)


def test_clean_handles_empty_and_none():
    assert clean_payment_links(None) == []
    assert clean_payment_links([]) == []
    # A row whose url was cleared is dropped, not an error — deleting a link
    # is a normal edit.
    assert clean_payment_links([{"label": "x", "url": "  "}]) == []


def test_label_is_capped():
    out = clean_payment_links([{"label": "P" * 500, "url": "https://paybox.co.il/p"}])
    assert len(out[0]["label"]) <= 40
