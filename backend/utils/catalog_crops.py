"""Pictures cut out of a catalog, menu or ad screenshot (Tzvi, 10 Nov 2026: "add the picture cut out option").

The reader (a vision model) gives each item a box around its own picture, as fractions of the page it is on.
Only a picture big enough to show on a listing is kept: a thumbnail cut out of a menu looks worse than no photo,
so small ones are dropped and the owner adds that photo themselves.
"""
from __future__ import annotations

import asyncio
import io
from typing import Any

# px, the short side of a kept picture. 320 until 23 Nov 2026, when it dropped every photo of a WhatsApp catalog
# (its thumbnails are ~238px on an iPhone screenshot); 200 still shows sharp in a product row.
MIN_SIDE = 200
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


def list_tiles(page: bytes) -> list[tuple[int, int, int, int]]:
    """The photo squares of a list-layout screenshot (one photo per row, in a column at the left or right edge, as in
    a WhatsApp or Instagram catalog), top to bottom, as pixel boxes. Only photos fully on the page.

    The reader's own boxes ran about one row low on every WhatsApp screenshot (23 Nov 2026: Soda Can got The
    Couples Box's photo), so on such a page the photo is found here and matched by row instead."""
    import numpy as np
    from PIL import Image
    im = Image.open(io.BytesIO(page)).convert("RGB")
    W, H = im.size
    s = 300 / W
    small = np.asarray(im.resize((300, max(1, round(H * s))))).astype(int)
    h = small.shape[0]
    busy = np.abs(small - _page_colour(im)).sum(axis=2) > 48
    best_boxes: list[tuple[int, int, int, int]] = []
    for lo, hi in ((0.02, 0.30), (0.70, 0.98)):  # the photo column at the left, or at the right (Hebrew)
        rows = busy[:, int(lo * 300):int(hi * 300)].mean(axis=1) > 0.4  # 0.4: dark food on a dark page
        boxes, start = [], None
        for y, v in enumerate(list(rows) + [False]):
            if v and start is None:
                start = y
            elif not v and start is not None:
                # A photo is tall (text lines are not) and not cut by the page's edge.
                if y - start >= 0.06 * h and start > 0 and y < h - 1:
                    left, right = _longest_run(busy[start:y].mean(axis=0) > 0.4)
                    if 0.6 < (right - left) / (y - start) < 1.6:
                        boxes.append((round(left / s), round(start / s), round(right / s), round(y / s)))
                start = None
        if len(boxes) > len(best_boxes):
            best_boxes = boxes
    return best_boxes


def tile_crop(page: bytes, box: tuple[int, int, int, int]) -> bytes | None:
    from PIL import Image
    part = Image.open(io.BytesIO(page)).convert("RGB").crop(box)
    if min(part.size) < MIN_SIDE:
        return None
    buf = io.BytesIO()
    part.save(buf, "JPEG", quality=90)
    return buf.getvalue()


def look(jpg: bytes) -> str:
    """A rough fingerprint of a picture (8x8 average hash): the same logo cut from several rows gives the same one."""
    from PIL import Image
    g = Image.open(io.BytesIO(jpg)).convert("L").resize((8, 8))
    px = list(g.getdata())
    avg = sum(px) / len(px)
    return "".join("1" if v > avg else "0" for v in px)


def norm(name: str) -> str:
    """A name compared across readings: letters and digits only ("Fire🔥 Poppers" is "fire poppers")."""
    import re
    return " ".join(re.findall(r"\w+", (name or "").lower()))


async def names_on(page: tuple[str, bytes], n: int, api_key: str) -> list[str] | None:
    """The product names beside the page's n photos, top to bottom, read on their own: one screenshot and one
    question is reliable where the whole read's page and row numbers were not (23 Nov 2026: across 13
    screenshots they pointed at the wrong screen). None unless exactly n come back."""
    import json
    import re
    import uuid
    from utils.llm import LlmChat, UserMessage
    chat = LlmChat(api_key=api_key, session_id=str(uuid.uuid4()), system_message=(
        "You read one screenshot of a shop's catalog, a list with one product photo per row. Reply with JSON only: "
        '{"names": [...]}, the product name written beside each row whose photo is fully visible, top to bottom, '
        "exactly as written. Skip a row whose photo is cut off by the top or bottom edge, and section headings."))
    chat.with_model("anthropic", "claude-haiku-5-5")
    try:
        raw = await chat.send_message(UserMessage(text=f"This screenshot has {n} such rows. The names, top to bottom.",
                                                  images=[page]))
        m = re.search(r"\{.*\}", raw, re.S)
        names = json.loads(m.group(0)).get("names") if m else None
    except Exception:  # noqa: BLE001 - the page then gives no photos, never wrong ones
        return None
    return [str(x) for x in names] if isinstance(names, list) and len(names) == n else None


async def photos_by_name(images: list, page_tiles: list, api_key: str) -> dict:
    """Name -> (page, photo box) for every list page whose names were read back in full; the first sighting wins."""
    pages = [i for i, t in enumerate(page_tiles) if len(t) >= 2]
    found = await asyncio.gather(*(names_on(images[i], len(page_tiles[i]), api_key) for i in pages))
    out: dict = {}
    for i, names in zip(pages, found):
        for name, box in zip(names or [], page_tiles[i]):
            out.setdefault(norm(name), (i, box))
    return out


async def upload(jpg: bytes | None) -> str | None:
    from utils.cloud_storage import upload_bytes_to_cloudinary
    if not jpg:
        return None
    try:
        return (await upload_bytes_to_cloudinary(jpg, is_video=False, folder="myisraelrental/catalog-crops"))["url"]
    except Exception:  # noqa: BLE001 - the row works without its picture
        return None


async def keep(pages: list[bytes], item: dict[str, Any], rows: list | None = None,
               page_tiles: list | None = None) -> str | None:
    """The item's picture, uploaded, from its `photo_box` and `page`; None when there is none worth showing."""
    from utils.cloud_storage import upload_bytes_to_cloudinary
    try:
        n = int(item.get("page") or 1) - 1
    except (TypeError, ValueError):
        n = 0
    if not (0 <= n < len(pages)):
        return None
    # In a thread: a crop of a phone-sized page takes ~0.4 s, and up to 60 rows would hold every request.
    tiles = page_tiles[n] if page_tiles is not None else await asyncio.to_thread(list_tiles, pages[n])
    if len(tiles) >= 2:
        return None  # a list page: its photos come by name (photos_by_name), never from the reader's box
    jpg = await asyncio.to_thread(crop, pages[n], item.get("photo_box"))
    if not jpg:
        return None
    item["look"] = look(jpg)
    try:
        return (await upload_bytes_to_cloudinary(jpg, is_video=False, folder="myisraelrental/catalog-crops"))["url"]
    except Exception:  # noqa: BLE001 - the row works without its picture
        return None


def tile_sheet(paths: list[str], out: str) -> list[int]:
    """Free check before a paid read: each screenshot with its found photo squares in red, side by side. A square
    that is off its photo, or a photo with no square, is wrong before any money is spent (Bawk Bawk, 23 Nov 2026)."""
    from PIL import Image, ImageDraw
    w, h = 234, 506
    sheet = Image.new("RGB", (len(paths) * (w + 6), h), "white")
    counts = []
    for i, p in enumerate(paths):
        raw = open(p, "rb").read()
        tiles = list_tiles(raw)
        im = Image.open(io.BytesIO(raw)).convert("RGB")
        d = ImageDraw.Draw(im)
        for bx in tiles:
            d.rectangle(bx, outline="red", width=max(4, im.width // 120))
        sheet.paste(im.resize((w, h)), (i * (w + 6), 0))
        counts.append(len(tiles))
    sheet.save(out)
    return counts


if __name__ == "__main__" and len(__import__("sys").argv) > 2:
    # python utils/catalog_crops.py shot1.png shot2.png ... sheet.jpg
    import sys
    print("photos found per screenshot:", tile_sheet(sys.argv[1:-1], sys.argv[-1]), "->", sys.argv[-1])
elif __name__ == "__main__":
    from PIL import Image
    page = Image.new("RGB", (1000, 1400), "white")
    buf = io.BytesIO()
    page.save(buf, "JPEG")
    raw = buf.getvalue()
    assert crop(raw, [0.1, 0.1, 0.6, 0.5]) is not None  # 500 x 560
    assert crop(raw, [0.1, 0.1, 0.2, 0.2]) is None  # 100 x 140: a thumbnail
    assert crop(raw, [0.1, 0.1, 0.34, 0.27]) is not None  # 240 x 238: a WhatsApp catalog photo
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
    # a dark catalog list: three photos down the left, a line of text beside each, one photo cut off at the bottom
    page = Image.new("RGB", (1170, 2532), (10, 10, 10))
    d = ImageDraw.Draw(page)
    for k in range(3):
        d.rectangle((50, 300 + k * 380, 290, 540 + k * 380), fill=(200, 120, 40))
        d.rectangle((340, 380 + k * 380, 900, 410 + k * 380), fill="white")
    d.rectangle((50, 2400, 290, 2531), fill=(200, 120, 40))
    buf = io.BytesIO()
    page.save(buf, "PNG")
    tiles = list_tiles(buf.getvalue())
    assert len(tiles) == 3 and abs(tiles[1][1] - 680) < 10, tiles
    print("ok")
