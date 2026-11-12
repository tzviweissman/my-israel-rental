"""Product photos for the ad maker (Tzvi, 8 Nov 2026: "build it"): the owner's own product photo, photographed
again by an image model on an empty set that fits the business, the way a product shoot would. A cut-out pasted
on a set always looked pasted on (the camera angles differ); a model that redraws the product into the set does
not. Tried by hand first on American Crust and Blazin' Boards (docs/ads/*-status-ad.jpg).

Billable: Higgsfield's Marketing Studio Image, about 2 credits (~$0.11) a picture. Each business may make
SHOTS_PER_DAY a day; every picture is kept, so a product, shape and setting is paid for once.
The product is redrawn from the owner's photo, never invented (ad rules A3.3); the prompt forbids changing it.
"""
from __future__ import annotations

import asyncio
import io
import urllib.request
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

SETS = Path(__file__).resolve().parent.parent / "assets" / "ad-sets"
SHOTS_PER_DAY = 5
MODEL = "marketing-studio/image/sunburst"
# The model takes 1:1, 3:4 and 9:16 but not 4:5 (refused, 10 Nov 2026): the feed photo is made 3:4 and the ad
# maker lays it over the 4:5 feed, losing a strip of the plain wall above and table below, never the product.
ASPECT = {"square": "1:1", "feed": "3:4", "story": "9:16"}

# One look per kind of business, so two businesses' ads do not come out the same picture (Tzvi, 8 Nov 2026:
# "make each design visually distinct"). The set is the empty picture the product is put on; the light, the
# moment and the word colours differ per kind.
KINDS: dict[str, dict[str, str]] = {
    "grill": {"set": "slate-dark", "dark": "1", "word": "#E9B864",
              "light": "One warm golden light from the side raking across the food so it glistens, the background "
                       "falling to near black, a thin wisp of smoke rising from it, a few flakes of coarse salt falling."},
    "bakery": {"set": "bakery-wood", "dark": "", "word": "#8A3B12",
               "light": "Soft warm morning light from a window on the side, a little flour dust in the air, a few "
                        "crumbs on the wood, cosy and fresh from the oven."},
    "cafe": {"set": "cafe-dark", "dark": "1", "word": "#F2C38B",
             "light": "Moody cafe light from one side, deep brown shadows, a curl of steam rising if it is warm, a "
                      "few coffee beans scattered near it."},
    "kitchen": {"set": "marble-light", "dark": "", "word": "#2F6B2F",
                "light": "Bright fresh daylight from the side, crisp and clean, a few drops of water and fresh herbs "
                         "near it."},
    "gift": {"set": "gift-light", "dark": "", "word": "#B03A6B",
             "light": "Bright soft daylight, a joyful pastel feel, a few pieces of confetti falling through the air."},
    "beauty": {"set": "beauty-light", "dark": "", "word": "#8A5A44",
               "light": "Soft diffused daylight, a calm luxurious feel, gentle shadows, a few petals near it."},
    # Not flat white: a product shoot's dark seamless backdrop with one light, which suits anything.
    "studio": {"set": "slate-dark", "dark": "1", "word": "#F2D48A",
               "light": "A plain dark seamless studio backdrop instead of image 2's wall, one strong soft light from the "
                        "side shaping the product and falling to near black behind it, a gentle reflection on the surface."},
}
# The kind from the listing's own words, when the ad's words did not name one (ads saved before they did).
_KIND_WORDS = [
    ("grill", ("meat", "steak", "grill", "bbq", "brisket", "jerky", "board", "burger", "shawarma", "בשר", "סטייק", "גריל")),
    ("bakery", ("bagel", "bread", "dough", "cake", "challah", "bake", "pastry", "cookie", "בצק", "חלה", "עוג", "מאפ")),
    ("cafe", ("coffee", "espresso", "latte", "tea", "smoothie", "juice", "קפה")),
    ("beauty", ("wig", "hair", "nail", "makeup", "lash", "skin", "beauty", "פאה", "שיער", "ציפורנ", "איפור")),
    ("gift", ("gift", "flower", "balloon", "party", "candle", "chocolate", "מתנ", "פרח", "בלונ")),
    ("kitchen", ("salad", "meal", "food", "catering", "cheese", "dairy", "kitchen", "סלט", "אוכל", "קייטרינג")),
]


def guess_kind(text: str) -> str:
    low = (text or "").lower()
    best, hits = "studio", 0
    for kind, words in _KIND_WORDS:
        n = sum(low.count(w) for w in words)
        if n > hits:
            best, hits = kind, n
    return best
OCCASIONS: dict[str, dict[str, str]] = {
    # No menorah, no dreidels: generated ones came with 7 or 11 branches and dreidels as sticks (7-8 Nov 2026).
    "chanukah": {"set": "chanukah-night", "dark": "1", "word": "#F5C542",
                 "light": "Chanukah night: behind it a deep navy blue wall with a string of tiny warm golden fairy "
                          "lights far behind, so out of focus they are soft round golden glows; gold-foil chocolate "
                          "coins scattered on the table near it catching the light; one warm golden light from the "
                          "side. No candles, no menorah, no dreidels."},
}


def look_for(kind: str, occasion: str) -> dict[str, str]:
    return OCCASIONS.get(occasion) or KINDS.get(kind) or KINDS["studio"]


def prompt_for(what: str, kind: str, occasion: str, shape: str) -> str:
    look = look_for(kind, occasion)
    tall = shape == "story"
    return (
        f"Product photograph for an advert. Image 1 is the real product: {what}. Image 2 is the empty set. "
        "Photograph exactly the product from image 1 standing on the table of image 2, as a real advertising hero "
        "shot made on that table: camera close and low, the product big, filling about "
        f"{'85' if tall else '75'} percent of the picture's width in the lower part of the picture, nothing of it "
        "cut off except where it is wider than the picture. A soft contact shadow where it touches the table. "
        "Keep the product identical to image 1: the same shape, colours, toppings, texture, arrangement and count; "
        "do not add, remove, rearrange or improve anything about it. "
        f"{look['light']} "
        f"The top {'40' if tall else '35'} percent of the picture is plain background for words. "
        "No text, no letters, no logos, no hands, no people."
    )


# Idea pictures (Tzvi, 12 Nov 2026: "lets make the improvements"): the library's best ads put one idea in the
# picture, and surprising scale is one of its two strongest kinds (4.13 of 5, docs/inspo/pinterest-ads-2026-11-02).
# Tzvi picked one to build: a crew of tiny people at work on the giant product.
# Blueprint: docs/ads/blueprints/design-shoot-ideas.md.
IDEAS = {"tiny"}
# The crew and their tools from the business's own world (ad rule A3.10).
_CREW = {
    "grill": "tiny chefs in white aprons and caps, with tongs and a small ladle",
    "bakery": "tiny bakers in white aprons and caps, with a rolling pin and a small sack of flour",
    "cafe": "tiny baristas in brown aprons, with a small jug and a tray",
    "kitchen": "tiny chefs in white aprons and caps, with a ladle and a small measuring cup",
    "gift": "tiny helpers in pastel overalls, with a roll of ribbon and a small gift tag",
    "beauty": "tiny stylists in black smocks, with brushes and a small comb",
    "studio": "tiny workers in white overalls, with cloths, a small bucket and a clipboard",
}


def idea_layout(idea: str, shape: str) -> Path:
    """The layout sketch the model photographs for real (ad rule A3.11), drawn by scripts/ad-layout-sketch.py."""
    return SETS / f"layout-{idea}-{shape}.png"


def prompt_for_idea(idea: str, what: str, kind: str, occasion: str, shape: str) -> str:
    """The product shoot with one idea in it. Image 1 the product, image 2 the set, image 3 the layout sketch."""
    look = look_for(kind, occasion)
    tall = shape == "story"
    crew = _CREW.get(kind, _CREW["studio"])
    return (
        f"Surreal advertising photograph. Image 1 is the real product: {what}. Image 2 is the empty set. Image 3 is "
        "the layout to photograph for real, keep its arrangement. The product from image 1 stands huge on the table "
        f"of image 2, filling about {'85' if tall else '80'} percent of the picture's width in the lower part, like a "
        f"giant building. A crew of five {crew}, each only about one tenth of the product's height, are busy looking "
        "after it as if it were a monument: one climbing a small wooden ladder leaning against it, two standing on top "
        "of it at work, one carrying a tool across the table, one looking up at it with a hand on the hip. They are "
        "real miniature people photographed with the product, in sharp focus, with real small shadows. "
        "Keep the product identical to image 1: the same shape, colours, labels, lids, texture and count; do not add, "
        "remove, open, rearrange or improve anything about it, and nothing spills from it. "
        f"{look['light']} "
        f"The top {'35' if tall else '30'} percent of the picture is plain background for words. "
        "No text, no letters, no logos, no giant people, no hands of normal size."
    )


def prompt_for_scene(what: str, shape: str) -> str:
    """A service's own photo (a cleaner at work, a van, a haircut) photographed again as an advert, not put on a
    product set: the same people, place and work, only the photography better (Tzvi, 10 Nov 2026)."""
    tall = shape == "story"
    return (
        f"Professional advertising photograph. Image 1 is a real photo from {what}. Photograph the same scene again "
        "as a top advertising photographer would: the same place, the same people, the same objects and the same work "
        "being done, the same number of each. Do not add, remove or replace anything or anyone, and do not change any "
        "face. Only the photography improves: flattering soft light with a warm glow, crisp focus, rich true colours, "
        "a clean composition with the main subject large in the lower part of the picture. "
        f"The top {'40' if tall else '35'} percent of the picture is calm, darker background for words. "
        "No text, no letters, no logos."
    )


def recent_count(rows: list[dict[str, Any]], now: datetime) -> int:
    since = (now - timedelta(days=1)).isoformat()
    return sum(1 for r in rows if r.get("created_at", "") >= since and r.get("status") != "failed")


def _fetchable(src: str) -> str:
    # The photo's own JPEG at a size the model reads well, not Cloudinary's f_auto pick.
    return src.replace("/upload/f_auto,q_auto/", "/upload/f_jpg,q_85,w_1400/")


def make_picture(product_url: str, prompt: str, shape: str, set_name: str | None, extra: list[Path] | None = None) -> bytes:
    """One billable call. Blocking: run it in a thread. HF_KEY is read by the client from the environment."""
    import os

    if not os.environ.get("HF_KEY"):
        # Locally the key is kept in backend/.env.local with the generation scripts'; on Railway it is a variable.
        from dotenv import load_dotenv
        load_dotenv(SETS.parent.parent / ".env.local")
    import higgsfield_client
    from PIL import Image

    final: dict[str, Any] = {}
    r = higgsfield_client.subscribe(
        MODEL,
        arguments={"prompt": prompt, "image_urls": [_fetchable(product_url)]
                   + ([higgsfield_client.upload_file(SETS / f"{set_name}.jpg")] if set_name else [])
                   + [higgsfield_client.upload_file(x) for x in (extra or [])],
                   "aspect_ratio": ASPECT[shape], "resolution": "2k", "quality": "medium", "enhance_prompt": False},
        on_queue_update=lambda s: final.update(s=s),
    )
    if not isinstance(final.get("s"), higgsfield_client.Completed):
        raise RuntimeError(f"picture not made: {type(final.get('s')).__name__}")
    images = (r or {}).get("images") or []
    if not images:
        raise RuntimeError("picture not made: no images")
    raw = urllib.request.urlopen(images[0]["url"], timeout=60).read()
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    im.thumbnail((2160, 3840))  # a downloaded ad is 2160 wide
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=90)
    return buf.getvalue()


def front_cut(content: bytes) -> bytes | None:
    """The product alone at the picture's full size (not cropped), so the ad can put it in front of its big word.
    None when the model finds no clear product, as with a board wider than the picture: the word then stays
    above the product instead."""
    import numpy as np
    from PIL import Image, ImageFilter

    from utils.cutout import _model, largest_part, shredded
    im = Image.open(io.BytesIO(content)).convert("RGB")
    im.thumbnail((1080, 1920))
    x = np.asarray(im.resize((1024, 1024), Image.BILINEAR), dtype=np.float32) / 255.0 - 0.5
    s = _model()
    pred = s.run(None, {s.get_inputs()[0].name: x.transpose(2, 0, 1)[None]})[0][0, 0]
    pred = (pred - pred.min()) / max(float(pred.max() - pred.min()), 1e-6)
    mask = np.asarray(Image.fromarray((pred * 255).astype(np.uint8)).resize(im.size, Image.BILINEAR))
    mask = largest_part(np.where(mask >= 128, mask, 0).astype(np.uint8))
    share = float((mask > 0).mean())
    if share < 0.08 or share > 0.85 or shredded(mask):
        return None
    out = im.convert("RGBA")
    out.putalpha(Image.fromarray(mask).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2)))
    buf = io.BytesIO()
    out.save(buf, "PNG", optimize=True)
    return buf.getvalue()


async def run_shot(shot_id: str, product_url: str, prompt: str, shape: str, set_name: str | None,
                   extra: list[Path] | None = None) -> None:
    """Makes the picture and its cut-out and keeps both; the row says how it went. Never raises."""
    from routes.deps import db, logger
    from utils.cloud_storage import upload_bytes_to_cloudinary
    try:
        content = await asyncio.to_thread(make_picture, product_url, prompt, shape, set_name, extra)
        url = (await upload_bytes_to_cloudinary(content, is_video=False, folder="myisraelrental/ad-shots"))["url"]
        cut_url = None
        try:
            png = await asyncio.to_thread(front_cut, content)
            if png:
                cut_url = (await upload_bytes_to_cloudinary(png, is_video=False, folder="myisraelrental/ad-shots"))["url"]
        except Exception as exc:  # noqa: BLE001 - the photo works without its cut-out
            logger.warning("[ad_shots] cut-out of %s failed: %s", shot_id, type(exc).__name__)
        await db.ad_shots.update_one({"id": shot_id}, {"$set": {"status": "ready", "url": url, "cut_url": cut_url,
                                                                "ready_at": datetime.now(UTC).isoformat()}})
    except Exception as exc:  # noqa: BLE001 - shown to the owner as "try again"
        logger.warning("[ad_shots] %s failed: %s %s", shot_id, type(exc).__name__, str(exc)[:120])
        await db.ad_shots.update_one({"id": shot_id}, {"$set": {"status": "failed"}})
