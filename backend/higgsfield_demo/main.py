"""Seedance 2.5 text-to-video through the official Higgsfield SDK.

    cd backend && .venv/Scripts/python higgsfield_demo/main.py

BILLABLE: every run is one paid generation. Run it by hand only.

Credentials: HF_KEY="key-id:key-secret" in backend/.env.local (gitignored).
The SDK reads HF_KEY from the environment itself; this file never reads,
prints or logs it.

`subscribe` does not raise when a job fails: it polls until the job is in a
final state and returns whatever the result endpoint says. So the final
status is captured from `on_queue_update`, and anything but Completed, or a
completed job with no video URL, exits non-zero.
"""
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env.local")

import higgsfield_client  # noqa: E402  (after the env is loaded)

MODEL = "bytedance/seedance-2.5/text-to-video"
ARGS = {"prompt": "A cinematic scene at sunset", "duration": 5, "resolution": "720p", "aspect_ratio": "16:9"}


def main() -> int:
    final = {}

    def on_update(status):
        final["status"] = status
        print("status:", type(status).__name__, flush=True)

    try:
        result = higgsfield_client.subscribe(
            MODEL, arguments=ARGS,
            on_enqueue=lambda rid: print("request id:", rid, flush=True),
            on_queue_update=on_update,
        )
    except higgsfield_client.CredentialsMissedError:
        print("FAILED: HF_KEY is not set (backend/.env.local).", file=sys.stderr)
        return 2
    except Exception as e:  # noqa: BLE001  network or API error: say so, never succeed
        print(f"FAILED: {type(e).__name__}: {e}", file=sys.stderr)
        return 1

    status = final.get("status")
    if isinstance(status, (higgsfield_client.Failed, higgsfield_client.NSFW, higgsfield_client.Cancelled)):
        print(f"FAILED: the request ended as {type(status).__name__}.", file=sys.stderr)
        return 1
    if not isinstance(status, higgsfield_client.Completed):
        print(f"FAILED: unexpected final status {status!r}.", file=sys.stderr)
        return 1

    url = ((result or {}).get("video") or {}).get("url")
    if not url:
        print(f"FAILED: completed but no video URL; response keys: {sorted((result or {}).keys())}", file=sys.stderr)
        return 1
    print("video:", url)
    return 0


if __name__ == "__main__":
    sys.exit(main())
