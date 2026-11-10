"""Lay a generated picture on an ad at full width, never shrunk (ad rule A3.9, Tzvi 10 Nov 2026).

    backend/.venv/Scripts/python scripts/ad-fit-picture.py <picture> <out dir> <top> [--shape story|feed|square] [--cut]

Why: L.A. Cholent's first status ad had its picture shrunk to make room for the words, and the sides filled with
the picture's edge colours. Tzvi: "whiteish on the sides... make it look premium". A pro ad's picture runs edge to
edge. So the picture is laid at the ad's full width, starting <top> pixels down; only what lies above and below it
(a plain wall, a table falling to dark) is carried on, in the picture's own top and bottom colours, faded in over
60px. If the picture is taller than the room left, it stops: make it again in a shorter shape (the model takes 1:1,
3:4, 2:3, 9:16 and wider), never shrink it.

Writes <out dir>/ground.jpg (the ad's ground) and, with --cut, <out dir>/front.png (the product cut out at the
same place, for laying in front of a headline)."""
import argparse
import io
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

SIZES = {"story": (1080, 1920), "feed": (1080, 1350), "square": (1080, 1080)}
FADE = 60


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("picture")
    ap.add_argument("out")
    ap.add_argument("top", type=int)
    ap.add_argument("--shape", default="story", choices=SIZES)
    ap.add_argument("--cut", action="store_true")
    a = ap.parse_args()
    W, H = SIZES[a.shape]
    im = Image.open(a.picture).convert("RGB")
    im = im.resize((W, round(W * im.height / im.width)), Image.LANCZOS)
    h = im.height
    if a.top < 0 or a.top + h > H:
        raise SystemExit(f"the picture is {h}px tall at full width and starts at {a.top}: it does not fit the {H}px "
                         f"{a.shape}. Make it again in a shorter shape; never shrink it (A3.9).")
    import cv2
    px = np.asarray(im).astype(np.float32)
    top = cv2.GaussianBlur(px[:30].mean(0, keepdims=True), (0, 0), 25)[0]
    bot = cv2.GaussianBlur(px[-30:].mean(0, keepdims=True), (0, 0), 25)[0]
    g = np.empty((H, W, 3), np.float32)
    g[:a.top] = top
    g[a.top:a.top + h] = px
    g[a.top + h:] = bot
    for i in range(FADE):
        t = i / FADE
        if a.top > 0:
            g[a.top + i] = g[a.top + i] * t + top * (1 - t)
        if a.top + h < H:
            j = a.top + h - 1 - i
            g[j] = g[j] * t + bot * (1 - t)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    ground = Image.fromarray(np.clip(g, 0, 255).astype(np.uint8))
    ground.save(out / "ground.jpg", quality=94)
    print(f"ground.jpg: the picture at full width, rows {a.top} to {a.top + h} of {H}")
    if a.cut:
        from utils.ad_shots import front_cut
        buf = io.BytesIO()
        ground.save(buf, "JPEG", quality=95)
        c = front_cut(buf.getvalue())
        if c:
            Image.open(io.BytesIO(c)).resize((W, H)).save(out / "front.png")
            print("front.png: the product cut out at the same place")
        else:
            print("no clear product to cut out: the headline stays above the product")


if __name__ == "__main__":
    main()
