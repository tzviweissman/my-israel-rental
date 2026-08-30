"""Video-to-3D reconstruction providers, behind one seam.

WHY THIS IS AN INTERFACE AND NOT JUST A LUMA CLIENT
---------------------------------------------------
The feature was specified as "call the Luma AI API". The capture
(video-to-3D) endpoint is undocumented and unadvertised:

  * `docs.lumalabs.ai/llms.txt` — the full documentation index — lists
    only Dream Machine generative endpoints (generations, images, videos,
    reframe, modify, credits). No capture, NeRF, or splat endpoint.
  * `lumalabs.ai/api` markets only Ray3.2 (video) and Uni-1.1 (image).
  * `github.com/lumalabs/lumaapi-python`, Luma's own capture client,
    opens with "We are no longer actively supporting this capture API."

It is, however, STILL RUNNING — probed 30 Aug 2026, see the note on
`LumaTourProvider` and `scripts/probe_luma_capture.py`. Undocumented and
unsupported is not the same as switched off, and the earlier reading here
that it was gone was too strong.

It does mean the vendor leg is the part most likely to need replacing at
no notice, and it is the only part that is vendor-specific. Everything
else — the `property_tours` documents, the ownership checks, the upload
flow, the embed — is identical whichever service does the reconstruction.
Putting the vendor behind `TourProvider` means swapping it is one new
class and one env var, not a re-plumb.

`TOUR_PROVIDER` selects the implementation. Unset, the feature is off and
every route reports itself unconfigured rather than half-working.

THE STATUS VOCABULARY IS OURS, NOT THE VENDOR'S. Providers translate
their own states into `processing` / `ready` / `failed` here, so a vendor
that invents a new state cannot leak it into the database or the UI.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
from dataclasses import dataclass
from typing import Any, Protocol

import httpx

logger = logging.getLogger("server")

# Our vocabulary. A provider maps onto these; nothing else is ever stored.
STATUS_PENDING = "pending"        # record exists, video not uploaded yet
STATUS_PROCESSING = "processing"  # handed to the provider, awaiting result
STATUS_READY = "ready"            # embed URL in hand
STATUS_FAILED = "failed"          # gave up; `error` explains why

TERMINAL_STATUSES = {STATUS_READY, STATUS_FAILED}


@dataclass(frozen=True)
class TourJob:
    """A provider's answer about one reconstruction, in our vocabulary."""

    external_id: str
    status: str
    embed_url: str | None = None
    error: str | None = None
    progress: float | None = None  # 0..1 when the provider reports it


class ProviderError(RuntimeError):
    """The provider was reachable but refused, or answered unusably.

    Raised rather than returned so a caller cannot mistake a transport
    failure for a genuine `failed` reconstruction — the first is worth
    retrying, the second never is.
    """


class TourProvider(Protocol):
    name: str
    # False means the poller is the ONLY completion path. Routes read this
    # instead of assuming, so a provider without callbacks cannot leave
    # tours stuck at `processing` forever.
    supports_webhook: bool

    async def submit(self, *, video_url: str, tour_id: str, callback_url: str | None) -> TourJob:
        """Hand a video to the provider. Returns the job in `processing`."""
        ...

    async def fetch_status(self, external_id: str) -> TourJob:
        """Ask the provider where a job has got to."""
        ...

    def verify_webhook(self, *, headers: dict[str, str], raw_body: bytes) -> bool:
        """Is this callback genuinely from the provider?"""
        ...

    def parse_webhook(self, payload: dict[str, Any]) -> TourJob:
        """Turn a verified callback body into a job."""
        ...


# --------------------------------------------------------------------------
# Luma
# --------------------------------------------------------------------------

_LUMA_BASE = os.environ.get(
    "LUMA_API_BASE", "https://webapp.engineeringlumalabs.com/api/v2"
).rstrip("/")


class LumaTourProvider:
    """Luma Labs capture API.

    WHAT IS VERIFIED, AND WHAT IS NOT. Re-check any of it with
    `python -m scripts.probe_luma_capture`, which needs no key.

    Verified against the live server (30 Aug 2026):

      * The routes EXIST. `/api/v2/capture` and `/api/v2/capture/{slug}`
        answer with an auth error, while junk paths on the same host get
        404 "Resource not found". That control is the whole proof — a
        host that rejected everything unauthenticated would look the same.
      * The AUTH HEADER BELOW IS RIGHT. `Authorization: luma-api-key=…`
        with a bogus key returns 401 "API key does not exist" — parsed and
        looked up. `Bearer`, `x-api-key` and a malformed scheme are not
        understood at all.

    NOT verified, because it needs a real key: every field name that
    `submit` and `_to_job` read — `capture.slug`, `signedUrls.source`,
    `latestRun.status`, `latestRun.artifacts[].type`. Those are still
    taken from Luma's old client. Expect to adjust them on first contact.

    And note what "alive" does not mean: the capture API is absent from
    Luma's documentation index and from lumalabs.ai/api, which now
    markets only Ray3.2 and Uni-1.1. It is running, unadvertised and
    unsupported — so it can disappear without a deprecation notice. That
    is an argument for the seam above, not against using it.

    Two behaviours here are not incidental:

    1. NO WEBHOOK. The capture API never documented a callback, so
       `supports_webhook` is False and completion arrives only via the
       poller. `verify_webhook` therefore refuses everything — a provider
       that cannot sign a callback must not have one accepted on its
       behalf, or anyone who learns a tour id can mark it `ready` and
       choose the URL we iframe.

    2. IT WILL NOT TAKE OUR CLOUDINARY URL. Luma wants the bytes PUT to a
       signed URL of its own, so `submit` streams the video from
       Cloudinary through this process and up to Luma. That puts the
       server back in the bandwidth path for the vendor leg — the
       browser-to-Cloudinary leg still bypasses us, which is the one that
       matters for the person waiting, but a 500MB file does cross this
       container. If that becomes a problem the fix is a provider that
       accepts a source URL, not a change here.
    """

    name = "luma"
    supports_webhook = False

    def __init__(self, api_key: str) -> None:
        self._key = api_key

    @property
    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"luma-api-key={self._key}"}

    async def submit(self, *, video_url: str, tour_id: str, callback_url: str | None) -> TourJob:
        # Long timeout: this call includes relaying the whole video.
        async with httpx.AsyncClient(timeout=httpx.Timeout(600.0, connect=15.0)) as http:
            try:
                created = await http.post(
                    f"{_LUMA_BASE}/capture",
                    headers=self._headers,
                    data={"title": f"myisraelrental-{tour_id}"},
                )
                created.raise_for_status()
                body = created.json()
            except httpx.HTTPError as e:
                raise ProviderError(f"luma create failed: {e}") from e
            except ValueError as e:
                raise ProviderError("luma create returned non-JSON") from e

            slug = (body.get("capture") or {}).get("slug")
            upload_url = (body.get("signedUrls") or {}).get("source")
            if not slug or not upload_url:
                raise ProviderError(f"luma create missing slug/upload url: {list(body)}")

            # Stream Cloudinary -> Luma without buffering the whole file.
            try:
                async with http.stream("GET", video_url) as src:
                    src.raise_for_status()
                    await http.put(
                        upload_url,
                        content=src.aiter_bytes(),
                        headers={"Content-Type": "application/octet-stream"},
                    )
            except httpx.HTTPError as e:
                raise ProviderError(f"luma upload failed: {e}") from e

            try:
                triggered = await http.post(
                    f"{_LUMA_BASE}/capture/{slug}", headers=self._headers
                )
                triggered.raise_for_status()
            except httpx.HTTPError as e:
                raise ProviderError(f"luma trigger failed: {e}") from e

        return TourJob(external_id=slug, status=STATUS_PROCESSING)

    async def fetch_status(self, external_id: str) -> TourJob:
        async with httpx.AsyncClient(timeout=30.0) as http:
            try:
                res = await http.get(
                    f"{_LUMA_BASE}/capture/{external_id}", headers=self._headers
                )
                res.raise_for_status()
                body = res.json()
            except httpx.HTTPError as e:
                raise ProviderError(f"luma status failed: {e}") from e
            except ValueError as e:
                raise ProviderError("luma status returned non-JSON") from e
        return self._to_job(external_id, body)

    def _to_job(self, external_id: str, body: dict[str, Any]) -> TourJob:
        capture = body.get("capture") or body
        run = capture.get("latestRun") or {}
        raw = (capture.get("status") or run.get("status") or "").lower()

        if raw in ("complete", "completed", "finished"):
            embed = self._embed_url(run)
            if not embed:
                # Complete with nothing to show is a failure for us: the
                # listing page has no iframe to render.
                return TourJob(
                    external_id=external_id,
                    status=STATUS_FAILED,
                    error="provider reported complete but returned no embed url",
                )
            return TourJob(external_id=external_id, status=STATUS_READY, embed_url=embed)

        if raw in ("failed", "error", "rejected"):
            return TourJob(
                external_id=external_id,
                status=STATUS_FAILED,
                error=str(run.get("error") or capture.get("error") or "provider reported failure")[:500],
            )

        progress = run.get("progress")
        return TourJob(
            external_id=external_id,
            status=STATUS_PROCESSING,
            progress=float(progress) if isinstance(progress, (int, float)) else None,
        )

    @staticmethod
    def _embed_url(run: dict[str, Any]) -> str | None:
        for artifact in run.get("artifacts") or []:
            if artifact.get("type") in ("embed", "interactive", "scene"):
                url = artifact.get("url")
                if url:
                    return str(url)
        return None

    def verify_webhook(self, *, headers: dict[str, str], raw_body: bytes) -> bool:
        # See the class docstring: no documented signing scheme, so no
        # callback is trustworthy. Refusing is the safe default.
        return False

    def parse_webhook(self, payload: dict[str, Any]) -> TourJob:
        raise ProviderError("luma does not send webhooks")


# --------------------------------------------------------------------------
# Selection
# --------------------------------------------------------------------------

def _hmac_ok(secret: str, raw_body: bytes, supplied: str) -> bool:
    """Constant-time compare of a hex HMAC-SHA256 body signature.

    NOTHING CALLS THIS YET — Luma has no webhook, so no provider currently
    verifies one. It is here because the moment a second provider is added
    this is the first thing it needs, and getting `compare_digest` wrong
    is the classic way a webhook becomes an open endpoint. Delete it if a
    provider with real callbacks never arrives.
    """
    expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, (supplied or "").strip().lower())


def get_provider() -> TourProvider | None:
    """The configured provider, or None when the feature is switched off.

    None is a first-class answer, not an error: no key in a dev
    environment must not stop the backend booting.
    """
    choice = (os.environ.get("TOUR_PROVIDER") or "").strip().lower()
    if not choice:
        return None
    if choice == "luma":
        key = os.environ.get("LUMA_API_KEY", "").strip()
        if not key:
            logger.warning("TOUR_PROVIDER=luma but LUMA_API_KEY is empty; 3D tours disabled")
            return None
        return LumaTourProvider(key)
    logger.warning("unknown TOUR_PROVIDER %r; 3D tours disabled", choice)
    return None
