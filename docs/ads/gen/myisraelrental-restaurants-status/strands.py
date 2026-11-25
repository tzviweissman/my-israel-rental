"""The weave (A11.2, A3.13), take 4 (Tzvi, 25 Nov 2026, beside Pinterest "PASTA"/"TWIST": "something about ours
just looks bland", "fix it"). Free, code only.
    backend/.venv/Scripts/python docs/ads/gen/myisraelrental-restaurants-status/strands.py

gen.py take 4 made the pasta around our own typed number (plate.png, ad.html?plate=1), so ground.jpg (its photo laid
by ad-fit-picture.py) already holds the digits in place (measured within 3px) with the ribbon's real shadows on them.
ad.html types our crisp digits over it again; front.png puts back, over the characters the ribbon passes IN FRONT
of, the photo's pasta, herbs and the darker blue where the pasta shades a digit. Over the other characters our digit
hides the ribbon, so it goes behind them and shows again in their holes. Every switch falls in the gap between two
characters, where no blue is beside it, so no cut shows. The columns were measured on ad.html?bare=1."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
CHARS = [(0, 196), (212, 293), (309, 513), (527, 731), (744, 948), (961, 1079)]   # 5 , 0 0 0 +
FRONT = [True, False, True, False, True, True]   # the ribbon goes behind the comma and the second zero
BASE = np.array([14, 90, 142])                   # the photo's own digit blue (median)

im = np.asarray(Image.open(HERE / "ground.jpg").convert("RGB")).astype(int)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
lum = im @ np.array([0.299, 0.587, 0.114])
blue = (b - r) > 50
pasta = (((r - b) > 40) | (((g - r) > 30) & ((g - b) > 20)) | (lum < 90)) & ~blue   # golden ribbon, parsley (a real leaf green: the
# blue-to-cream blend at the digits' edges is faintly green and came back as a dashed line), pepper; never the blue
# where the pasta shades a digit: only well inside the photo's digits, never their pale anti-aliased edge, which
# showed as a dashed line inside our crisp digits
inner = np.asarray(Image.fromarray((blue * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(11))) > 0
shade = inner & (lum < (BASE @ np.array([0.299, 0.587, 0.114])) - 6)
grow = np.asarray(Image.fromarray((pasta * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))) > 0
keep = np.asarray(Image.fromarray(((grow | shade) * 255).astype(np.uint8))
                  .filter(ImageFilter.GaussianBlur(0.8))).astype(float) / 255
edges = [0] + [(CHARS[i][1] + CHARS[i + 1][0]) // 2 for i in range(len(CHARS) - 1)] + [1080]
cols = np.zeros(1080)
for i, f in enumerate(FRONT):
    if f:
        cols[edges[i]:edges[i + 1]] = 1
alpha = (keep * cols[None, :] * 255).astype(np.uint8)
alpha[:400] = 0                                  # only around the number: above it nothing is covered
alpha[1100:] = 0
out = np.zeros((1920, 1080, 4), np.uint8)
out[:im.shape[0], :, :3] = im
out[:im.shape[0], :, 3] = alpha
Image.fromarray(out).save(HERE / "front.png", optimize=True)
print("front.png: in front over characters", [i for i, f in enumerate(FRONT) if f], "switching at", edges[1:-1])
