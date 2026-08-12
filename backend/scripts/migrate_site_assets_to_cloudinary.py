"""Move the generated hero/scene assets off the Higgsfield CDN onto our own
Cloudinary account, and record the new URLs in the manifest.

WHY THIS EXISTS
---------------
The cinematic home page, the Stays and Services heroes and the Requests
board all pointed at ``d8j0ntlcm91z4.cloudfront.net`` — Higgsfield's
delivery CDN for the images and clips it generated for us. Hotlinking
someone else's CDN in production is a dependency we do not control: those
URLs can expire or be rotated at any time, and the failure mode is every
hero on the site going blank at once with nothing in our logs to explain
it. The manifest said as much from the day it was written.

WHAT IT DOES
------------
For each asset in ``assets/generated/assets-manifest.json``, hands the
source URL to Cloudinary, which fetches it server-side (far faster than
downloading ~95 MB here and re-uploading it), and stores it under a
stable, readable public_id — ``myisraelrental/site/<key>``. The manifest
gains a ``cloudinary_url`` next to the original ``url``; the original is
kept, not replaced, so this stays re-runnable and the provenance of each
asset survives.

Delivery URLs come back carrying ``f_auto,q_auto`` (``q_auto`` alone for
video, where format switching is not safe) — the same treatment every
other Cloudinary asset in this app gets, and worth having on ~95 MB of
hero media.

IDEMPOTENT. ``overwrite=False`` with a fixed public_id means a second run
returns the existing asset instead of re-uploading it, so re-running
after a partial failure costs nothing and changes nothing.

USAGE
-----
    cd backend
    ./.venv/Scripts/python.exe scripts/migrate_site_assets_to_cloudinary.py --dry-run
    ./.venv/Scripts/python.exe scripts/migrate_site_assets_to_cloudinary.py

Uploads consume Cloudinary storage quota, so --dry-run first is the
habit this repo asks for before anything that spends real credit.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parent
sys.path.insert(0, str(BACKEND))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(BACKEND / ".env")

import cloudinary  # noqa: E402
import cloudinary.uploader  # noqa: E402

MANIFEST = REPO / "assets" / "generated" / "assets-manifest.json"
FOLDER = "myisraelrental/site"
VIDEO_EXTS = {".mp4", ".webm", ".mov"}


def _configure() -> None:
    name = os.environ.get("CLOUDINARY_CLOUD_NAME")
    key = os.environ.get("CLOUDINARY_API_KEY")
    secret = os.environ.get("CLOUDINARY_API_SECRET")
    if not (name and key and secret):
        # Names only — never echo the values.
        missing = [
            k for k, v in (
                ("CLOUDINARY_CLOUD_NAME", name),
                ("CLOUDINARY_API_KEY", key),
                ("CLOUDINARY_API_SECRET", secret),
            ) if not v
        ]
        sys.exit(f"Missing Cloudinary config: {', '.join(missing)}")
    cloudinary.config(cloud_name=name, api_key=key, api_secret=secret, secure=True)
    print(f"Cloudinary account: {name}")


def _with_auto_transforms(url: str, is_video: bool) -> str:
    """Mirrors utils.cloud_storage._with_auto_transforms. Duplicated rather
    than imported because that module pulls in the whole app config; this
    script is meant to run standalone."""
    if not url or "/upload/" not in url:
        return url
    head, tail = url.split("/upload/", 1)
    if "q_auto" in tail.split("/", 1)[0]:
        return url
    return f"{head}/upload/{'q_auto' if is_video else 'f_auto,q_auto'}/{tail}"


def _reachable(url: str) -> bool:
    """A delivery URL that 404s is worse than no migration at all — it
    would swap a working hotlink for a broken self-host."""
    try:
        req = urllib.request.Request(url, method="HEAD")
        return urllib.request.urlopen(req, timeout=30).status == 200
    except Exception:
        return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="List what would be uploaded; spend nothing.")
    args = ap.parse_args()

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assets = manifest["assets"]

    todo = [a for a in assets if not a.get("cloudinary_url")]
    print(f"{len(assets)} assets in manifest, {len(todo)} not yet migrated\n")

    if args.dry_run:
        for a in todo:
            is_video = Path(a["file"]).suffix.lower() in VIDEO_EXTS
            print(f"  would upload {'video' if is_video else 'image'}  "
                  f"{FOLDER}/{a['key']}   <- {a['file']}")
        print("\nDry run — nothing uploaded.")
        return 0

    if not todo:
        print("Nothing to do.")
        return 0

    _configure()
    failures = []
    for a in todo:
        is_video = Path(a["file"]).suffix.lower() in VIDEO_EXTS
        try:
            res = cloudinary.uploader.upload(
                a["url"],
                resource_type="video" if is_video else "image",
                folder=FOLDER,
                public_id=a["key"],
                overwrite=False,
                use_filename=False,
                unique_filename=False,
            )
            url = _with_auto_transforms(res.get("secure_url", ""), is_video)
            if not _reachable(url):
                failures.append((a["key"], "uploaded but delivery URL not reachable"))
                continue
            a["cloudinary_url"] = url
            a["cloudinary_public_id"] = res.get("public_id")
            print(f"  ok  {res.get('bytes', 0)/1048576:5.2f} MB  {a['key']}")
        except Exception as e:  # noqa: BLE001
            failures.append((a["key"], str(e)[:120]))
            print(f"  FAILED  {a['key']}: {str(e)[:120]}")

    # Written even on partial failure so completed uploads are recorded and
    # a re-run skips them.
    manifest["note"] = (
        "Higgsfield-generated assets. `url` is the ORIGINAL Higgsfield CDN "
        "link, kept for provenance only — do NOT ship it; those URLs can "
        "expire. `cloudinary_url` is our own copy and is what the site "
        "uses. Re-run backend/scripts/migrate_site_assets_to_cloudinary.py "
        "after adding an asset. Regenerate with the same model + prompt; "
        "job_id is for reproducibility/support."
    )
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
                        encoding="utf-8")

    done = sum(1 for a in assets if a.get("cloudinary_url"))
    print(f"\n{done}/{len(assets)} assets now self-hosted")
    if failures:
        print("\nFAILURES:")
        for k, why in failures:
            print(f"  {k}: {why}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
