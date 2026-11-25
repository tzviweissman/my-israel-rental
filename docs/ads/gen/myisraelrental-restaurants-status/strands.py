"""The weave (A11.2), take 2c (Tzvi, 25 Nov 2026: "it only goes through the number once it should be wrapping in and
out and show the pasta texture"). Free, code only.
    backend/.venv/Scripts/python docs/ads/gen/myisraelrental-restaurants-status/strands.py

1. pasta.png: the twist cut from the full-size photo (gen.py's photo-2.jpg, 1520 wide, with the cut-out shape of
   twist.png from ad-fit-picture.py --cut), laid 20% larger than full width so the strands' texture shows, at the
   ad's own size so ad.html lays it at 0,0.
2. loose.png and strands.png (take 3): the twist hangs whole behind the number (laid in front of a zero it hid it,
   "5,c00+"), and four loose strands shot alone (gen.py take 3, photo-3.jpg, cut from the blue by colour) weave
   through it. loose.png is every strand, under the digits; strands.png is the parts that pass IN FRONT: each
   character in turn, and neighbouring strands opposite (strand 1 over the 5, strand 2 under it, ...), a true
   over-and-under weave. Every switch falls in the gap between two characters, where no white is beside it, so no
   cut shows. The characters' columns were measured
   on ad.html?bare=1 (out/bare.png); re-measure if the number's size or font changes."""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
SCALE = 1.2                  # against the ad's width
DX, DY = -108, -310          # where the scaled picture's corner sits on the ad
CHARS = [(0, 196), (212, 293), (309, 513), (527, 731), (744, 948), (961, 1079)]   # 5 , 0 0 0 +
FRONT = [True, False, True, False, True, False]

src = Image.open(HERE / "out" / "photo-2.jpg").convert("RGB")
alpha = Image.open(HERE / "twist.png").getchannel("A").resize(src.size, Image.LANCZOS)
cut = src.copy()
cut.putalpha(alpha)
w = round(1080 * SCALE)
cut = cut.resize((w, round(src.height * w / src.width)), Image.LANCZOS)
pasta = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0))
pasta.alpha_composite(cut, (0, 0), (-DX, -DY, -DX + 1080, min(cut.height, -DY + 1920)))
pasta.save(HERE / "pasta.png", optimize=True)

# the loose strands: blue ground keyed out by colour (orange pasta has far more red than blue), raised LOOSE_DY px
LOOSE_DY = -50
lp = np.asarray(Image.open(HERE / "out" / "photo-3.jpg").convert("RGB").resize((1080, 1910), Image.LANCZOS)).astype(int)
mask = np.clip((lp[..., 0] - lp[..., 2] - 20) * 6, 0, 255).astype(np.uint8)
# shiny highlights are pale, so they key out as small holes (blue dashes on the pasta): closed before softening
mask = np.asarray(Image.fromarray(mask).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(0.8)))
loose = np.zeros((1920, 1080, 4), np.uint8)
y0 = -LOOSE_DY
loose[:1910 - y0, :, :3] = lp[y0:]
loose[:1910 - y0, :, 3] = mask[y0:]
Image.fromarray(loose).save(HERE / "loose.png", optimize=True)

# which strand each pixel belongs to: each strand's centre line is traced in the columns where all four show apart
# (holes in the sauce closed first), filled in across the columns where they touch, and every pixel goes to the
# nearest line. Counting runs column by column broke a strand wherever its sauce broke the mask (a barcode of cuts).
on = np.asarray(Image.fromarray((loose[..., 3] > 60).astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(9))) > 0
N = 4
centres = np.full((N, 1080), np.nan)
for x in range(1080):
    col = on[:, x].astype(int)
    d = np.diff(np.concatenate(([0], col, [0])))
    st, en = np.nonzero(d == 1)[0], np.nonzero(d == -1)[0]
    keep = (en - st) >= 10
    st, en = st[keep], en[keep]
    if len(st) == N:
        centres[:, x] = (st + en) / 2
xs = np.arange(1080)
for k in range(N):
    good = ~np.isnan(centres[k])
    centres[k] = np.interp(xs, xs[good], centres[k][good])
ys = np.arange(1920)[:, None]
idx = np.argmin(np.abs(ys[None, :, :] - centres[:, None, :]), axis=0)
edges = [0] + [(CHARS[i][1] + CHARS[i + 1][0]) // 2 for i in range(len(CHARS) - 1)] + [1080]
char = np.zeros(1080, int)
for i in range(len(CHARS)):
    char[edges[i]:edges[i + 1]] = i
front = ((char[None, :] + idx) % 2 == 0)
out = loose.copy()
out[..., 3] = np.where(front, out[..., 3], 0)
Image.fromarray(out).save(HERE / "strands.png", optimize=True)
print("pasta.png, loose.png, strands.png; switching at", edges[1:-1])
