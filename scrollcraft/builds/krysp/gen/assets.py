"""Krysp images from her two photos only (no generation): the board photo whole, the logo, the peach ground, the link preview."""
from PIL import Image, ImageFilter
import os
os.chdir(os.path.join(os.path.dirname(__file__), '..'))
PEACH = (243, 213, 187)
board = Image.open('src/owner/p02.jpg').convert('RGB')          # 1448x1086, kept whole
board.save('assets/luxe.webp', quality=86, method=6)               # shown at most at its own size
board.resize((900, 675), Image.LANCZOS).save('assets/luxe-sm.webp', quality=84, method=6)
logo = Image.open('src/owner/p01.jpg').convert('RGB')
logo.resize((160, 160), Image.LANCZOS).save('assets/mark.webp', quality=90, method=6)
# the peach ground: her logo peach with a soft warm light from the upper left (a picture, so the first screen is mostly picture)
W, H = 1920, 1200
g = Image.new('RGB', (W, H), PEACH)
px = g.load()
for y in range(H):
    for x in range(W):
        d = ((x / W - .25) ** 2 + (y / H - .15) ** 2) ** .5
        k = max(0, 1 - d * 1.25) * 9 - max(0, d - .8) * 14
        px[x, y] = tuple(max(0, min(255, int(c + k))) for c in PEACH)
g.save('assets/ground.webp', quality=82, method=6)
# link preview: the board whole on peach, 1200x630
og = Image.new('RGB', (1200, 630), PEACH)
b = board.resize((660, 495), Image.LANCZOS)
og.paste(b, (270, 68))
og.save('assets/og.webp', quality=84, method=6)
for f in sorted(os.listdir('assets')): print(f, os.path.getsize('assets/' + f))
