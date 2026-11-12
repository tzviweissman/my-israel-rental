"""Lays our real screens into the plain white phone screens and billboard of the series pictures (rule A3.12):
measured from the picture (the white area round a seed point), never guessed.

    backend/.venv/Scripts/python docs/ads/gen/myisraelrental-series-status/lay_screens.py <scene> <shape> <take>"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
SCREENS = {"rentals": ("screen-rentals.png", "top"), "shop": ("screen-shop.jpg", "top"), "ads": ("screen-ads.jpg", "contain")}
# The billboard poster is shaded towards its right edge: its paper is lighter than 150, a phone screen than 200.
LIGHT = {"ads": 150}
SEEDS = {"story": {"rentals": (0.22, 0.52), "shop": (0.25, 0.54), "ads": (0.72, 0.48)}}


def run(path: Path, seed: tuple[float, float], screen: Path, fit: str, light: int = 200) -> Image.Image:
    im = Image.open(path).convert("RGB")
    a = np.asarray(im.convert("L")).astype(int)
    sx, sy = int(seed[0] * im.width), int(seed[1] * im.height)
    row, col = a[sy], a[:, sx]
    x0 = sx
    while x0 > 0 and row[x0 - 1] > light: x0 -= 1
    x1 = sx
    while x1 < im.width - 1 and row[x1 + 1] > light: x1 += 1
    y0 = sy
    while y0 > 0 and col[y0 - 1] > light: y0 -= 1
    y1 = sy
    while y1 < im.height - 1 and col[y1 + 1] > light: y1 += 1
    print(path.name, "screen", x0, x1, y0, y1)
    w, h = x1 - x0 + 1, y1 - y0 + 1
    sc = Image.open(screen).convert("RGB")
    k = {"top": w / sc.width, "cover": max(w / sc.width, h / sc.height)}.get(fit) or min(w / sc.width, h / sc.height) * 0.94
    sc = sc.resize((round(sc.width * k), round(sc.height * k)), Image.LANCZOS)
    tile = Image.new("RGB", (w, h), "white")
    if fit == "contain":
        tile.paste(sc, ((w - sc.width) // 2, (h - sc.height) // 2))
    else:
        left = (sc.width - w) // 2
        top = 0 if fit == "top" else (sc.height - h) // 2
        tile.paste(sc.crop((left, top, left + w, top + min(h, sc.height - top))), (0, 0))
    box = a[y0:y1 + 1, x0:x1 + 1] > light
    mask = Image.new("L", im.size, 0)
    mask.paste(Image.fromarray((box * 255).astype("uint8")), (x0, y0))
    mask = mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    layer = Image.new("RGB", im.size)
    layer.paste(tile, (x0, y0))
    im.paste(layer, (0, 0), mask)
    return im


if __name__ == "__main__":
    scene, shape, take = sys.argv[1:4]
    src = HERE / "out" / f"{scene}-{shape}-{take}.jpg"
    if scene in SCREENS:
        name, fit = SCREENS[scene]
        out = run(src, SEEDS[shape][scene], HERE / name, fit, LIGHT.get(scene, 200))
    else:
        out = Image.open(src).convert("RGB")
    out.save(HERE / "out" / f"{scene}-{shape}-{take}-screen.jpg", quality=94)
