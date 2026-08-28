"""The jobs digest is scheduled, and its unsubscribe works (spec L2).

WHAT WENT WRONG, AND WHAT THIS PINS
-----------------------------------
`POST /marketplace/job-searches/send-digest` existed, was admin-only, and
nothing called it on a schedule — while `JobsBoard.jsx:62` promised "a
daily digest of new matches" and `JobRequestsTab.jsx:55` labelled saved
searches "daily digest". The promise was in the UI and the delivery was in
nobody's hands.

The failure mode is silent by nature: no error, no log, just a provider
who saves a search, hears nothing, and concludes the board is dead. So the
things asserted here are the ones whose absence says nothing:

  * the loop exists and is actually started by `server.py`
  * the work is callable WITHOUT an admin request, which is what let it be
    admin-only-and-therefore-never-run in the first place
  * the unsubscribe token round-trips, and refuses a token minted for a
    different purpose
  * the opt-out link is a real endpoint

Deliberately no database in these: they are about wiring, and a test that
needs a seeded Mongo to prove a loop is registered is a test that gets
skipped in CI and stops protecting anything.
"""
import inspect
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routes.marketplace import jobs  # noqa: E402
from utils.notification_tokens import (  # noqa: E402
    NotificationTokenError,
    verify_notification_token,
)


# --------------------------------------------------------------------------
# The wiring — the part that was missing
# --------------------------------------------------------------------------

def test_the_digest_can_be_sent_without_an_admin_request():
    """`_send_jobs_digest` takes no arguments.

    This is the whole shape of the bug: the logic lived inside a route
    guarded by `_admin_only`, so the only way to run it was for a human to
    press something. A scheduler cannot supply a `user=Depends(...)`.
    """
    assert callable(jobs._send_jobs_digest)
    assert inspect.iscoroutinefunction(jobs._send_jobs_digest)
    assert list(inspect.signature(jobs._send_jobs_digest).parameters) == []


def test_the_daily_loop_exists():
    assert inspect.iscoroutinefunction(jobs.jobs_digest_daily_loop)


def test_server_actually_starts_the_loop():
    """Reads server.py rather than importing it: the assertion is that the
    startup path REFERENCES the loop, and importing the app to find out
    would spin up every other loop as a side effect.

    A loop that exists and is never scheduled is exactly the state this
    spec item describes, so 'it is defined' is not enough to assert.
    """
    src = (Path(__file__).resolve().parents[1] / "server.py").read_text(encoding="utf-8")
    assert "jobs_digest_daily_loop" in src, (
        "server.py never starts the jobs digest loop — the endpoint would "
        "exist and never run, which is the bug this spec item is about"
    )
    assert "asyncio.create_task(jobs_digest_daily_loop())" in src


def test_it_runs_at_the_same_hour_as_the_requests_digest():
    """Both digests claim 09:00 UTC; the requests one's docstring already
    says it shares the hour. If one drifts, a provider gets two marketplace
    emails at unrelated times of day."""
    src = inspect.getsource(jobs.jobs_digest_daily_loop)
    assert "hour=9" in src


# --------------------------------------------------------------------------
# The unsubscribe
# --------------------------------------------------------------------------

def test_optout_token_round_trips():
    token = jobs.create_jobs_optout_token("user-123")
    claims = verify_notification_token(token, jobs.JOBS_OPT_OUT_PURPOSE)
    assert claims["user_id"] == "user-123"


def test_an_optout_token_is_not_accepted_for_another_purpose():
    """Purpose is checked, so a jobs unsubscribe link cannot be replayed
    against the snooze or requests endpoints."""
    token = jobs.create_jobs_optout_token("user-123")
    with pytest.raises(NotificationTokenError):
        verify_notification_token(token, "requests_optout")


def test_rubbish_is_refused():
    with pytest.raises(NotificationTokenError):
        verify_notification_token("not-a-token", jobs.JOBS_OPT_OUT_PURPOSE)


def test_the_optout_endpoint_is_public_and_registered():
    """Public on purpose — the signed token IS the authentication. An
    unsubscribe that first demands a login is not an unsubscribe."""
    route = next(
        (r for r in jobs.router.routes
         if getattr(r, "path", "") == "/marketplace/job-searches/emails/opt-out"),
        None,
    )
    assert route is not None, "the opt-out endpoint is not registered"
    params = inspect.signature(jobs.jobs_optout_from_email).parameters
    assert "user" not in params, "the opt-out must not require a signed-in user"


def test_the_optout_field_is_on_the_shared_prefs_document():
    """Same document the requests opt-out writes to. Two preference stores
    would mean two places to check, and one of them eventually forgotten."""
    assert jobs.JOBS_OPT_OUT_FIELD == "jobs_emails_off"
    src = inspect.getsource(jobs.jobs_optout_from_email)
    assert "job_notification_preferences" in src


def test_the_digest_checks_the_optout_before_doing_any_work():
    """Ordering matters: the check sits above the mode check and the match
    query, so no amount of matching can talk us into emailing somebody who
    asked us to stop."""
    src = inspect.getsource(jobs._send_jobs_digest)
    # The IDENTIFIER, not its value: the source reads
    # `pref.get(JOBS_OPT_OUT_FIELD)`, so searching for "jobs_emails_off"
    # finds nothing and the assertion passes vacuously in one direction
    # and explodes in the other.
    opt_out_at = src.index("JOBS_OPT_OUT_FIELD")
    mode_at = src.index('mode = pref.get("mode")')
    assert opt_out_at < mode_at, (
        "the opt-out is checked after other filtering — it must come first"
    )


def test_the_email_carries_the_unsubscribe_link():
    src = inspect.getsource(jobs._send_jobs_digest)
    assert "/jobs-emails-off?t=" in src, (
        "the digest has no one-click unsubscribe; a settings link that "
        "requires signing in first is not one"
    )
