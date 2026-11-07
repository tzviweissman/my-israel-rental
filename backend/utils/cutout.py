"""The product cut out of its photo, for the ad maker's made-for-you ads
(Tzvi, 2 Nov 2026: "unique eye catching ads without tons of credits").

Free and on our own server: the open ISNet model (the one rembg calls
isnet-general-use) through onnxruntime. Each photo is cut once; the PNG
goes to Cloudinary and `ad_cutouts` remembers it by the photo's URL, so a
second ad, or a second business owner pressing the button, costs nothing.

Measured on 2 Nov 2026: about 2.5 s a photo, 720 MB at the peak with the
arena off, 370 MB held after. One cut at a time (the lock) so two owners
pressing at once do not double that. The model (179 MB) is fetched from
rembg's release in the background when the server starts (server.py),
since the disk is wiped at every deploy; keeping it would need a volume,
and volumes are banned on the backend (CLAUDE.md, 18 Oct 2026).
"""
from __future__ import annotations

import asyncio
import io
import os
import urllib.request
from typing import Any

MODEL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx"
MODEL_PATH = os.path.join(os.environ.get("CUTOUT_MODEL_DIR", "/tmp/models"), "isnet-general-use.onnx")

_session = None
_lock = asyncio.Lock()
# Raised when cuts improve: older rows are ignored, so each photo is cut again once, the next time an ad needs it.
CUT_VERSION = 3


def prefetch_model() -> None:
    """Download the model file if this copy of the server lacks it. Run at
    startup on Railway, so it is there before anyone presses the button. A
    failure is quiet: the first cut-out tries again."""
    if os.path.exists(MODEL_PATH):
        return
    try:
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH + ".part")
        os.replace(MODEL_PATH + ".part", MODEL_PATH)
    except Exception:  # noqa: BLE001
        pass


def _model():
    global _session
    if _session is None:
        import onnxruntime as ort
        prefetch_model()
        opts = ort.SessionOptions()
        opts.enable_cpu_mem_arena = False  # 900 MB peak with it, 720 without
        opts.enable_mem_pattern = False
        opts.intra_op_num_threads = 2
        _session = ort.InferenceSession(MODEL_PATH, opts, providers=["CPUExecutionProvider"])
    return _session


def largest_part(mask):
    """Only the biggest connected piece of the mask: the product, without the
    stray leaf or the ghost of a glass the model half keeps (Blazin' Boards'
    photos, 2 Nov). A flood fill on a small copy, so no scipy."""
    import numpy as np
    from PIL import Image, ImageFilter
    small = np.array(Image.fromarray(mask).resize((256, 256), Image.NEAREST)) > 0
    seen = np.zeros_like(small)
    best: list[tuple[int, int]] = []
    for y0, x0 in zip(*np.nonzero(small)):
        if seen[y0, x0]:
            continue
        part, stack = [], [(y0, x0)]
        seen[y0, x0] = True
        while stack:
            y, x = stack.pop()
            part.append((y, x))
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < 256 and 0 <= nx < 256 and small[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        if len(part) > len(best):
            best = part
    keep = np.zeros((256, 256), np.uint8)
    for y, x in best:
        keep[y, x] = 255
    # The small map only says which piece to keep; the edge must stay the fine
    # mask's. Widened first, or its big squares cut stairs into the product's
    # edge (Tzvi, 5 Nov 2026: a downloaded ad looked fuzzy).
    keep = np.array(Image.fromarray(keep).filter(ImageFilter.MaxFilter(5)).resize(mask.shape[::-1], Image.NEAREST))
    return np.where(keep > 0, mask, 0).astype(np.uint8)


def shredded(alpha) -> bool:
    """A flyer or a see-through tub comes back in tatters (American Crust's pizza
    dough, 6 Nov 2026); a boxed photo is better than that. Measured on our 8 real
    cuts: the good ones have under 2% holes and edge score under 12, the two bad
    ones 22% holes, and edge scores of 30 and 36."""
    import numpy as np
    from PIL import Image
    s = np.array(Image.fromarray(alpha).resize((256, 256), Image.NEAREST)) >= 128
    outside = np.zeros_like(s)
    stack = [(y, x) for y in range(256) for x in (0, 255)] + [(y, x) for x in range(256) for y in (0, 255)]
    stack = [(y, x) for y, x in stack if not s[y, x]]
    for y, x in stack:
        outside[y, x] = True
    while stack:
        y, x = stack.pop()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < 256 and 0 <= nx < 256 and not s[ny, nx] and not outside[ny, nx]:
                outside[ny, nx] = True
                stack.append((ny, nx))
    area = max(int(s.sum()), 1)
    holes = int((~s & ~outside).sum()) / area
    edge = int((s[1:, :] != s[:-1, :]).sum() + (s[:, 1:] != s[:, :-1]).sum()) / area ** 0.5
    return holes > 0.1 or edge > 20


def cut(content: bytes) -> bytes | None:
    """A PNG of the product alone, cropped to it; None when the photo has no
    clear subject (the mask covers almost nothing or almost everything)."""
    import numpy as np
    from PIL import Image, ImageFilter
    im = Image.open(io.BytesIO(content)).convert("RGB")
    im.thumbnail((2600, 2600))  # kept large: a downloaded ad is 2160 wide
    x = np.asarray(im.resize((1024, 1024), Image.BILINEAR), dtype=np.float32) / 255.0 - 0.5
    s = _model()
    pred = s.run(None, {s.get_inputs()[0].name: x.transpose(2, 0, 1)[None]})[0][0, 0]
    pred = (pred - pred.min()) / max(float(pred.max() - pred.min()), 1e-6)
    mask = np.asarray(Image.fromarray((pred * 255).astype(np.uint8)).resize(im.size, Image.BILINEAR))
    mask = np.where(mask >= 128, mask, 0).astype(np.uint8)
    share = float((mask > 0).mean())
    if share < 0.03 or share > 0.92:
        return None
    mask = largest_part(mask)
    alpha = Image.fromarray(mask).filter(ImageFilter.MinFilter(5))  # no light rim
    out = im.convert("RGBA")
    out.putalpha(alpha)
    out = out.crop(out.getbbox())
    if shredded(np.asarray(out.getchannel("A"))):
        return None
    buf = io.BytesIO()
    out.save(buf, "PNG", optimize=True)
    return buf.getvalue()


async def cutout_url(src: str) -> str | None:
    """The cut-out of the photo at `src`, made once and kept."""
    from routes.deps import db, logger
    from utils.cloud_storage import upload_bytes_to_cloudinary
    row = await db.ad_cutouts.find_one({"src": src, "v": CUT_VERSION})
    if row:
        return row.get("url")
    async with _lock:
        row = await db.ad_cutouts.find_one({"src": src, "v": CUT_VERSION})
        if row:
            return row.get("url")
        url = None
        try:
            # The photo's own JPEG, not Cloudinary's f_auto pick (AVIF/WebP
            # that Pillow may not open).
            fetch = src.replace("/upload/f_auto,q_auto/", "/upload/f_jpg,q_auto:best/")
            # The address is the owner's own data: never let it reach the server's
            # own network (cloud metadata, the database). ponytail: a public URL
            # that redirects inward still passes; pin to Cloudinary if that matters.
            from utils.helpers import _is_public_ical_url
            if not await asyncio.to_thread(_is_public_ical_url, fetch):
                logger.warning("[cutout] refused non-public address %s", src[-40:])
                return None
            content = await asyncio.to_thread(lambda: urllib.request.urlopen(fetch, timeout=30).read())
            png = await asyncio.to_thread(cut, content)
            if png:
                url = (await upload_bytes_to_cloudinary(png, is_video=False, folder="myisraelrental/cutouts"))["url"]
        except Exception as exc:  # noqa: BLE001 - an ad without a cut-out still works
            logger.warning("[cutout] %s failed: %s", src[-40:], type(exc).__name__)
            return None
        await db.ad_cutouts.insert_one({"src": src, "url": url, "v": CUT_VERSION})
        return url


async def cutouts_for(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The items with a `cutout` URL each, in order; items whose photo has no
    clear subject are left out."""
    out = []
    for it in items:
        url = await cutout_url(it["photo"])
        if url:
            out.append({**it, "cutout": url})
    return out
