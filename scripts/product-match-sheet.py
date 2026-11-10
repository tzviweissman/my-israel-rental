"""Every generated copy of the product, beside the real photo (ad rule A3.9, Tzvi 9 Nov 2026).

    python scripts/product-match-sheet.py <generated.jpg> <real photo> <out.jpg>

Why: Chicken Munch's status ad (9 Nov 2026) had his real bowl of Hot Poppers right, but the pieces the model added
in the air came out square, lighter, glowing at the edges, with dry crumbs round them. Nobody looked at them up close
because the bowl looked right. A generated picture that adds copies of the product (pieces in the air, a second
item, a stack) gets this sheet: each separate piece is found, cropped at full size, and put in a row over a crop of
the real photo at the same scale, so shape, colour, coating and anything round them are compared piece by piece.

It finds the pieces with the same cut-out model as the ad maker. Any piece not joined to the main one is a copy.
It prints how many it found; zero copies with copies in the picture means look by hand, never skip the rule.
Run with backend/.venv/Scripts/python (it needs numpy, opencv and the cut-out model)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

import cv2  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

from utils.cutout import _model  # noqa: E402


def product_mask(im: Image.Image) -> np.ndarray:
    x = np.asarray(im.resize((1024, 1024), Image.BILINEAR), dtype=np.float32) / 255.0 - 0.5
    s = _model()
    pred = s.run(None, {s.get_inputs()[0].name: x.transpose(2, 0, 1)[None]})[0][0, 0]
    pred = (pred - pred.min()) / max(float(pred.max() - pred.min()), 1e-6)
    m = np.asarray(Image.fromarray((pred * 255).astype(np.uint8)).resize(im.size, Image.BILINEAR))
    return (m >= 110).astype(np.uint8)


def main(gen: str, real: str, out: str) -> None:
    im = Image.open(gen).convert("RGB")
    im.thumbnail((1600, 2900))
    mask = product_mask(im)
    n, lab, st, _ = cv2.connectedComponentsWithStats(mask)
    parts = sorted(range(1, n), key=lambda i: -st[i, 4])
    if not parts:
        raise SystemExit("no product found: compare by hand")
    main_area = st[parts[0], 4]
    copies = [i for i in parts[1:] if st[i, 4] > main_area * 0.01]
    print(f"{len(copies)} separate copies found beside the main product")
    pad = 12
    crops = []
    for i in [parts[0]] + copies:
        x, y, w, h = st[i, :4]
        crops.append(im.crop((max(0, x - pad), max(0, y - pad), x + w + pad, y + h + pad)))
    # the real photo at the generated picture's scale: its product spans about as wide as the main product
    ref = Image.open(real).convert("RGB")
    rm = product_mask(ref)
    ys, xs = np.nonzero(rm)
    if len(xs):
        ref = ref.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    scale = st[parts[0], 2] / ref.width
    ref = ref.resize((max(1, round(ref.width * scale)), max(1, round(ref.height * scale))))
    row_h = max(c.height for c in crops)
    # The main product first, then every separate piece: a prop the model split off (a pot behind the product)
    # shows here too, and is judged by eye, never counted as a copy by name alone.
    row = crops
    W = max(sum(c.width for c in row) + pad * (len(row) + 1), ref.width + 2 * pad)
    H = 60 + row_h + 60 + ref.height + pad
    sheet = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(sheet)
    d.text((pad, 18), "GENERATED: MAIN PRODUCT, THEN EACH SEPARATE PIECE (full size)", fill="black")
    x = pad
    for c in row:
        sheet.paste(c, (x, 50))
        x += c.width + pad
    d.text((pad, 60 + row_h + 18), "REAL PHOTO (same scale)", fill="black")
    sheet.paste(ref, (pad, 60 + row_h + 50))
    sheet.save(out, quality=90)
    print("wrote", out, sheet.size)


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    main(*sys.argv[1:])
