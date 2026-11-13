"""Pictures cut out of a catalog, menu or ad screenshot (Tzvi, 10 Nov 2026: "add the picture cut out option").

The reader (a vision model) gives each item a box around its own picture, as fractions of the page it is on.
Only a picture big enough to show on a listing is kept: a thumbnail cut out of a menu looks worse than no photo,
so small ones are dropped and the owner adds that photo themselves.
"""
from __future__ import annotations

import asyncio
import io
from typing import Any

MIN_SIDE = 320  # px, the short side of a kept picture
BOX_RULE = (
    "photo_box    the box around THIS item's own photo on the page, as [left, top, right, bottom] fractions of the "
    "page's width and height (0 to 1), tight to the photo, without its caption or price. null when the item has "
    "no photo of its own, or the photo is shared by several items.\n"
    "  page         the number of the picture the item is on, counting from 1 in the order given."
)


def crop(page: bytes, box: Any) -> bytes | None:
    """The box cut out of one page as a JPEG, or None when the box is unusable or the picture too small."""
    from PIL import Image
    if not (isinstance(box, (list, tuple)) and len(box) == 4):
        return None
    try:
        x0, y0, x1, y1 = (min(1.0, max(0.0, float(v))) for v in box)
    except (TypeError, ValueError):
        return None
    if x1 - x0 < 0.03 or y1 - y0 < 0.03:
        return None
    im = Image.open(io.BytesIO(page)).convert("RGB")
    w, h = im.size
    part = im.crop((round(x0 * w), round(y0 * h), round(x1 * w), round(y1 * h)))
    part = _trim(part, _page_colour(im))
    if min(part.size) < MIN_SIDE:
        return None
    buf = io.BytesIO()
    part.save(buf, "JPEG", quality=90)
    return buf.getvalue()


def _page_colour(im):
    """The page's own ground: the commonest colour round its edge."""
    import numpy as np
    a = np.asarray(im.convert("RGB"))
    edge = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]) // 8 * 8
    vals, counts = np.unique(edge.reshape(-1, 3), axis=0, return_counts=True)
    return vals[counts.argmax()].astype(int) + 4


def _longest_run(mask):
    best, start, run_start = (0, 0, 0), None, None
    for i, v in enumerate(list(mask) + [False]):
        if v and run_start is None:
            run_start = i
        elif not v and run_start is not None:
            if i - run_start > best[0]:
                best = (i - run_start, run_start, i)
            run_start = None
    return best[1], best[2]


def _trim(part, ground):
    """The reader's boxes run loose (tested 10 Nov 2026: a caption and the ad's text under a photo came along).
    Rows and columns that are mostly the page's ground, text on it included, are cut away: what is kept is the
    largest solid block, the photo, with a small margin."""
    import numpy as np
    a = np.asarray(part).astype(int)
    on_ground = np.abs(a - ground).sum(axis=2) < 36
    t, b = _longest_run(on_ground.mean(axis=1) < 0.6)
    if b - t < 10:
        return part
    left, right = _longest_run(on_ground[t:b].mean(axis=0) < 0.6)
    if right - left < 10:
        return part
    pad = round(0.01 * max(part.size))
    box = (max(0, left - pad), max(0, t - pad), min(part.width, right + pad), min(part.height, b + pad))
    # A product photographed on the page's own colour (shoes on white, on a white page) has no edge to find:
    # the trim would cut into the product, so a trim that takes away more than this keeps the box as given.
    if (box[2] - box[0]) * (box[3] - box[1]) < 0.55 * part.width * part.height:
        return part
    return part.crop(box)


async def keep(pages: list[bytes], item: dict[str, Any]) -> str | None:
    """The item's picture, uploaded, from its `photo_box` and `page`; None when there is none worth showing."""
    from utils.cloud_storage import upload_bytes_to_cloudinary
    try:
        n = int(item.get("page") or 1) - 1
    except (TypeError, ValueError):
        n = 0
    if not (0 <= n < len(pages)):
        return None
    # In a thread: a crop of a phone-sized page takes ~0.4 s, and up to 30 rows would hold every request.
    jpg = await asyncio.to_thread(crop, pages[n], item.get("photo_box"))
    if not jpg:
        return None
    try:
        return (await upload_bytes_to_cloudinary(jpg, is_video=False, folder="myisraelrental/catalog-crops"))["url"]
    except Exception:  # noqa: BLE001 - the row works without its picture
        return None


if __name__ == "__main__":
    from PIL import Image
    page = Image.new("RGB", (1000, 1400), "white")
    buf = io.BytesIO()
    page.save(buf, "JPEG")
    raw = buf.getvalue()
    assert crop(raw, [0.1, 0.1, 0.6, 0.5]) is not None  # 500 x 560
    assert crop(raw, [0.1, 0.1, 0.2, 0.2]) is None  # 100 x 140: a thumbnail
    assert crop(raw, None) is None and crop(raw, [0, 0, "x", 1]) is None
    # a dark 400x400 photo at (100,100) with a line of "text" under it: a loose box comes back as the photo
    from PIL import ImageDraw
    d = ImageDraw.Draw(page)
    d.rectangle((100, 100, 499, 499), fill=(40, 90, 60))
    d.rectangle((100, 540, 420, 560), fill="black")
    buf = io.BytesIO()
    page.save(buf, "JPEG", quality=95)
    got = Image.open(io.BytesIO(crop(buf.getvalue(), [0.05, 0.05, 0.55, 0.43])))
    assert abs(got.width - 400) < 30 and abs(got.height - 400) < 30, got.size
    print("ok")
