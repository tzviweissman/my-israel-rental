"""Cut the drawn poses off their green sheets (gen.py) into one PNG each in sprites/ (free, no generation).

    python docs/ads/gen/chicken-munch-chanukah-moving/cut.py

Green is keyed out with soft edges and its spill taken off the outline; each grid cell keeps only its biggest drawing
(the jug flying out of the throw pose is left out: code throws the separate jug)."""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
SP = HERE / "sprites"
SP.mkdir(exist_ok=True)
SHEETS = {
    "hero": (3, ["search", "jug-up", "think", "throw", "bite", "chew", "jar1", "jar2", "jug"]),
    "friends": (2, ["f1-bite", "f1-chew", "f2-bite", "f2-chew"]),
}


def key(a):
    # only the sheet's own green goes (its colour sampled from the corners), so friend two's dark green cape stays
    bg = np.median(np.concatenate([a[:20, :20].reshape(-1, 3), a[-20:, -20:].reshape(-1, 3)]), axis=0)
    dist = np.sqrt(((a.astype(float) - bg) ** 2).sum(axis=2))
    alpha = np.clip((dist - 45) * 5, 0, 255).astype("uint8")
    r, g, b = (a[..., i].astype(int) for i in range(3))
    out = a.copy()
    edge = (alpha < 255) & (g > np.maximum(r, b))
    out[..., 1] = np.where(edge, np.maximum(r, b), g).clip(0, 255).astype("uint8")   # no green fringe on the outline
    return np.dstack([out, alpha])


for sheet, (n, names) in SHEETS.items():
    rgba = key(np.asarray(Image.open(HERE / "out" / f"{sheet}.jpg").convert("RGB")))
    H, W = rgba.shape[:2]
    for i, name in enumerate(names):
        y0, x0 = (i // n) * H // n, (i % n) * W // n
        cell = rgba[y0:y0 + H // n, x0:x0 + W // n].copy()
        k, lab, st, _ = cv2.connectedComponentsWithStats((cell[..., 3] > 128).astype(np.uint8), 8)
        if k < 2:
            continue
        big = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
        keep = cv2.dilate((lab == big).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
        cell[..., 3] = np.where(keep, cell[..., 3], 0)
        ys, xs = np.nonzero(cell[..., 3] > 8)
        Image.fromarray(cell[ys.min():ys.max() + 1, xs.min():xs.max() + 1]).save(SP / f"{name}.png")
        print(name, xs.max() - xs.min() + 1, "x", ys.max() - ys.min() + 1)
