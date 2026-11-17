"""Front layer for the Chicken Munch moving ad: the top half (the word area) of ground.jpg and every clip frame, keeping
only the glaze-orange pixels (red well above blue), so the pour and the top pieces sit in front of HOT. (A11.2).
    python docs/ads/gen/chicken-munch-moving/keyfront.py      writes front/0000.png (ground) and front/NNNN.png (clip/)"""
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
(HERE / "front").mkdir(exist_ok=True)


def key(src, out):
    a = np.asarray(Image.open(src).convert("RGB").resize((1080, 1920)))[:960].astype(int)
    k = a[..., 0] - a[..., 2]
    al = np.clip((k - 60) * 8.5, 0, 255).astype("uint8")
    Image.fromarray(np.dstack([a.astype("uint8"), al]), "RGBA").save(out, optimize=False, compress_level=1)


key(HERE / "ground.jpg", HERE / "front" / "0000.png")
for f in sorted((HERE / "clip").glob("*.jpg")) if (HERE / "clip").exists() else []:
    key(f, HERE / "front" / f"{f.stem}.png")
print(len(list((HERE / "front").glob("*.png"))), "front frames")
