"""Is an opening still lit like a premium product photo: one pool of light on the product, the frame's edges falling
off toward dark? (page rules 3aa.33; Tzvi, 18 Nov 2026, Burnt: "i like how in the inspo its dark around the wood so it
makes it dramatic", then "the angle of the wood made it look dramatic and premium ... not just a sky view of the
board which is very plain".) The flat, evenly lit top-down still passed every other check.

    python scripts/check-light-pool.py <still or folder> [more] [--soft]

For each picture: the mean brightness of the middle half (where the product is) and of the outer ring (the top and
bottom eighths, the left and right tenths). Passes when the ring is at most 0.75 of the middle, or simply dark (under
64 of 255). --soft (a bright brand: a bakery in white, a cleaning service, a kids' shop) asks only for the ring at
most 0.9 of the middle: a step darker at the edges, never black. Exit 1 on a flat picture.
Measured on Burnt, 19 Nov 2026: the flat top-down master, middle 99 and ring 103 (FLAT); the low angled one, middle 87
and ring 47 (pool). The angle itself (low, three-quarter, the product diagonal) is a LOOK line in the checklist."""
import sys
from pathlib import Path

from PIL import Image, ImageStat

args = [a for a in sys.argv[1:] if not a.startswith('--')]
soft = '--soft' in sys.argv
if not args:
    sys.exit('usage: python scripts/check-light-pool.py <still or folder> [more] [--soft]')
files = []
for a in args:
    p = Path(a)
    files += sorted(f for f in p.iterdir() if f.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp')) if p.is_dir() else [p]
bad = 0
for f in files:
    im = Image.open(f).convert('L').resize((480, 270) if Image.open(f).width >= Image.open(f).height else (270, 480))
    W, H = im.size
    mid = ImageStat.Stat(im.crop((W // 4, H // 4, 3 * W // 4, 3 * H // 4))).mean[0]
    parts = [im.crop((0, 0, W, H // 8)), im.crop((0, H - H // 8, W, H)), im.crop((0, 0, W // 10, H)), im.crop((W - W // 10, 0, W, H))]
    ring = sum(ImageStat.Stat(p).mean[0] * p.width * p.height for p in parts) / sum(p.width * p.height for p in parts)
    ok = ring <= mid * (0.9 if soft else 0.75) or (not soft and ring < 64)
    bad += not ok
    print(f"{'pool' if ok else 'FLAT'}  {f.name}: middle {mid:.0f}, edges {ring:.0f}")
if bad:
    sys.exit(f'\n{bad} flat picture(s): light the product and let the edges fall off toward dark (rule 3aa.33), '
             'or --soft for a bright brand')

