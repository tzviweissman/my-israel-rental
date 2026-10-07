"""Make my photos match (storefront phase 6).

Only the owner, only a photo on that listing, only our own Cloudinary
images; the colour is the owner's; 10 a day per business; paused when the
month's allowance is nearly used; off without the flag; and the original is
kept so it can be put back. Cloudinary is stubbed, so this spends nothing.

Local MongoDB only.
    .venv/Scripts/python -m pytest -q tests/test_photo_match.py
"""
import asyncio
import os
import uuid
from pathlib import Path

import pytest
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
pytestmark = pytest.mark.skipif(
    not any(h in os.environ.get("MONGO_URL", "") for h in ("localhost", "127.0.0.1")),
    reason="local MongoDB only",
)

from fastapi import HTTPException  # noqa: E402

from routes.deps import db  # noqa: E402
from routes.marketplace import photo_match as pm  # noqa: E402

CLOUD = "testcloud"
PHOTO = f"https://res.cloudinary.com/{CLOUD}/image/upload/f_auto,q_auto/v17/myisraelrental/abc.jpg"
OWNER = {"user_id": "pm-owner"}


@pytest.fixture
def gig(monkeypatch):
    monkeypatch.setenv("CLOUDINARY_CLOUD_NAME", CLOUD)
    monkeypatch.setenv("PHOTO_MATCH_ENABLED", "1")
    monkeypatch.setattr(pm.cloud_storage, "CLOUDINARY_ENABLED", True)
    monkeypatch.setattr(pm, "_allowance_left", lambda: True)
    rendered = []

    async def render(url):
        rendered.append(url)
        return b"jpg"

    async def upload(content, **kw):
        return {"url": f"https://res.cloudinary.com/{CLOUD}/image/upload/v18/myisraelrental/matched/{uuid.uuid4().hex}.jpg"}

    monkeypatch.setattr(pm, "_render", render)
    monkeypatch.setattr(pm.cloud_storage, "upload_bytes_to_cloudinary", upload)
    gid, biz = f"pm-{uuid.uuid4().hex}", f"pm-biz-{uuid.uuid4().hex}"
    run(db.marketplace_gigs.insert_one({"_id": gid, "provider_user_id": OWNER["user_id"], "business_id": biz,
                                        "gig_type": "store", "products": [{"name": "Cake", "images": [PHOTO]}]}))
    yield gid, rendered
    run(db.marketplace_gigs.delete_one({"_id": gid}))
    run(db.photo_matches.delete_many({"business_key": biz}))


def run(c):
    return asyncio.get_event_loop().run_until_complete(c)


def preview(gid, url=PHOTO, color="#f3e6d3", user=OWNER):
    return run(pm.photo_match_preview(gid, pm.PhotoMatchIn(url=url, color=color), user))


def status(fn):
    with pytest.raises(HTTPException) as e:
        fn()
    return e.value.status_code


def test_derived_url_only_for_our_cloud(monkeypatch):
    monkeypatch.setenv("CLOUDINARY_CLOUD_NAME", CLOUD)
    assert pm.derived_url(PHOTO, "FFFFFF") == (
        f"https://res.cloudinary.com/{CLOUD}/image/upload/e_background_removal/b_rgb:FFFFFF/f_jpg/v17/myisraelrental/abc.jpg")
    assert pm.derived_url(PHOTO.replace(CLOUD, "someoneelse"), "FFFFFF") is None
    assert pm.derived_url("https://example.com/v17/a.jpg", "FFFFFF") is None


def test_preview_keeps_original_and_colour(gig):
    gid, rendered = gig
    out = preview(gid)
    assert out["original"] == PHOTO and out["color"] == "F3E6D3"
    assert "b_rgb:F3E6D3" in rendered[0]
    st = run(pm.photo_match_state(gid, OWNER))
    assert st["originals"] == {out["url"]: PHOTO}
    assert st["color"] == "F3E6D3" and st["left_today"] == pm.DAILY_CAP - 1
    # Re-doing a tidied photo starts again from the original, never cuts out twice.
    again = preview(gid, url=out["url"], color="FFFFFF")
    assert again["original"] == PHOTO and rendered[-1].endswith("v17/myisraelrental/abc.jpg")


def test_refusals(gig):
    gid, _ = gig
    assert status(lambda: preview(gid, user={"user_id": "someone-else"})) == 403
    assert status(lambda: preview(gid, url=PHOTO.replace("abc", "not-on-listing"))) == 400
    assert status(lambda: preview(gid, color="red")) == 400


def test_daily_cap(gig):
    gid, _ = gig
    for _ in range(pm.DAILY_CAP):
        preview(gid)
    assert status(lambda: preview(gid)) == 429


def test_paused_when_allowance_used(gig, monkeypatch):
    gid, rendered = gig
    monkeypatch.setattr(pm, "_allowance_left", lambda: False)
    assert status(lambda: preview(gid)) == 503 and not rendered


def test_off_without_flag(gig, monkeypatch):
    gid, rendered = gig
    monkeypatch.delenv("PHOTO_MATCH_ENABLED")
    assert run(pm.photo_match_state(gid, OWNER)) == {"enabled": False}
    assert status(lambda: preview(gid)) == 404 and not rendered
