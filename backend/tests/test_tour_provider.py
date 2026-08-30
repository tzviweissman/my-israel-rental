"""The vendor's answers are translated, not trusted.

WHY THIS FILE EXISTS. `LumaTourProvider._to_job` is the only place a
third-party's vocabulary crosses into ours, and everything downstream —
the poller's give-up counter, what the owner is told, whether an iframe
appears on a public listing — keys off the three words it produces. It is
also the part written against documentation nobody could verify (Luma's
capture API is no longer published; see the class docstring), so it is
exactly the code most likely to meet a response shape it did not expect.

The cases that matter are the awkward ones:

  * "complete" with NO artifact. The tempting read is success. It would
    write `status: ready` with `tour_embed_url: None`, and the listing
    page would render a toggle onto an empty iframe — a visible break on
    a public page, caused by treating a missing field as a detail.

  * A status nobody has seen before. Must stay `processing`: the poller
    retries and eventually times it out, whereas guessing `failed`
    discards a reconstruction that may have been minutes from done.

  * Webhooks. Luma documents no signing scheme, so `verify_webhook` must
    refuse EVERYTHING. If it ever returns True, anyone who guesses a tour
    id chooses the URL we put in a sandboxed-but-public iframe.

No network, no database — these are pure translations.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from utils.tour_provider import (  # noqa: E402
    STATUS_FAILED,
    STATUS_PROCESSING,
    STATUS_READY,
    LumaTourProvider,
    ProviderError,
    get_provider,
)


@pytest.fixture
def provider() -> LumaTourProvider:
    return LumaTourProvider("test-key-not-a-real-secret")


# --------------------------------------------------------------------------
# Status translation
# --------------------------------------------------------------------------

def test_complete_with_embed_is_ready(provider):
    job = provider._to_job("slug-1", {
        "capture": {
            "status": "complete",
            "latestRun": {
                "status": "complete",
                "artifacts": [{"type": "embed", "url": "https://lumalabs.ai/embed/abc"}],
            },
        }
    })
    assert job.status == STATUS_READY
    assert job.embed_url == "https://lumalabs.ai/embed/abc"
    assert job.external_id == "slug-1"


def test_complete_without_any_artifact_is_failed(provider):
    """The case that would otherwise put an empty iframe on a live listing."""
    job = provider._to_job("slug-2", {
        "capture": {"status": "complete", "latestRun": {"status": "complete", "artifacts": []}}
    })
    assert job.status == STATUS_FAILED
    assert job.embed_url is None
    assert "embed url" in (job.error or "")


def test_complete_with_only_unusable_artifacts_is_failed(provider):
    """A mesh download is not something the listing page can embed."""
    job = provider._to_job("slug-3", {
        "capture": {
            "status": "complete",
            "latestRun": {"artifacts": [{"type": "mesh", "url": "https://x/y.glb"}]},
        }
    })
    assert job.status == STATUS_FAILED


@pytest.mark.parametrize("raw", ["failed", "error", "rejected", "FAILED"])
def test_failure_words_map_to_failed(provider, raw):
    job = provider._to_job("slug-4", {"capture": {"status": raw, "latestRun": {}}})
    assert job.status == STATUS_FAILED
    assert job.error


def test_failure_carries_the_vendor_reason(provider):
    job = provider._to_job("slug-5", {
        "capture": {"status": "failed", "latestRun": {"error": "too few frames"}}
    })
    assert job.status == STATUS_FAILED
    assert "too few frames" in job.error


def test_failure_reason_is_truncated(provider):
    job = provider._to_job("slug-6", {
        "capture": {"status": "failed", "latestRun": {"error": "x" * 5000}}
    })
    # Straight into a Mongo document and then onto the owner's screen.
    assert len(job.error) <= 500


@pytest.mark.parametrize("raw", ["dispatched", "processing", "uploading", "queued", "", "banana"])
def test_everything_else_stays_processing(provider, raw):
    """Including states this code has never seen. Never guess `failed`."""
    job = provider._to_job("slug-7", {"capture": {"status": raw, "latestRun": {}}})
    assert job.status == STATUS_PROCESSING


def test_progress_is_read_when_offered(provider):
    job = provider._to_job("slug-8", {
        "capture": {"status": "processing", "latestRun": {"progress": 0.42}}
    })
    assert job.progress == pytest.approx(0.42)


def test_non_numeric_progress_is_dropped_not_crashed(provider):
    job = provider._to_job("slug-9", {
        "capture": {"status": "processing", "latestRun": {"progress": "halfway"}}
    })
    assert job.status == STATUS_PROCESSING
    assert job.progress is None


def test_a_flat_body_without_the_capture_wrapper_still_parses(provider):
    """Defensive: the wrapper is the documented shape, not a guarantee."""
    job = provider._to_job("slug-10", {"status": "processing"})
    assert job.status == STATUS_PROCESSING


# --------------------------------------------------------------------------
# Webhooks
# --------------------------------------------------------------------------

def test_luma_declares_no_webhook_support(provider):
    assert provider.supports_webhook is False


def test_luma_refuses_every_webhook(provider):
    """No signing scheme means no callback can be authenticated."""
    for headers in ({}, {"x-luma-signature": "anything"}, {"authorization": "Bearer x"}):
        assert provider.verify_webhook(headers=headers, raw_body=b'{"status":"complete"}') is False


def test_parsing_a_luma_webhook_raises(provider):
    with pytest.raises(ProviderError):
        provider.parse_webhook({"status": "complete"})


# --------------------------------------------------------------------------
# Selection
# --------------------------------------------------------------------------

def test_no_provider_configured_returns_none(monkeypatch):
    """An unset key must not stop the backend booting."""
    monkeypatch.delenv("TOUR_PROVIDER", raising=False)
    assert get_provider() is None


def test_luma_without_a_key_is_off_not_broken(monkeypatch):
    monkeypatch.setenv("TOUR_PROVIDER", "luma")
    monkeypatch.setenv("LUMA_API_KEY", "")
    assert get_provider() is None


def test_unknown_provider_name_is_off(monkeypatch):
    monkeypatch.setenv("TOUR_PROVIDER", "some-vendor-we-never-wired")
    assert get_provider() is None


def test_luma_with_a_key_is_selected(monkeypatch):
    monkeypatch.setenv("TOUR_PROVIDER", "Luma")  # case-insensitive on purpose
    monkeypatch.setenv("LUMA_API_KEY", "k")
    p = get_provider()
    assert isinstance(p, LumaTourProvider)
    assert p.name == "luma"
