"""Is an opening still lit like a premium product photo: the product bright enough to see, and the frame's edges
falling off toward dark round it? One check for both (page rules 3aa.33; Tzvi, 18 Nov 2026, Burnt: "i like how in
the inspo its dark around the wood so it makes it dramatic", then "the angle of the wood made it look dramatic and
premium ... not just a sky view of the board which is very plain"). The flat, evenly lit top-down still passed every
other check.

    python scripts/check-light-pool.py <still or folder> [more] [--soft] [--product x0 y0 x1 y1]

For stills it is the brightness check too (19 Nov 2026, "do all 3 improvemnets"): brightness.py, made for films, also
failed a still whose dark ground was the point, and lifting that ground to pass it made this check call the still
FLAT, so the two could not both pass. Here a dark ground on purpose passes; a dark product does not.

For each picture, on the 0 to 100 scale:
- the product: the mean of the middle half (or the --product box, shares of the frame), at least 33, brightness.py's
  floor for the subject (calibrated on The Brown Box);
- the edges: the outer ring (the top and bottom eighths, the left and right tenths), at most 0.75 of the product, or
  simply dark (under 25). --soft (a bright brand: a bakery in white, a cleaning service, a kids' shop) asks only for
  the ring at most 0.9 of the product: a step darker at the edges, never black.
A tall (phone) frame is its wide still cropped close, the product running off both sides: its product is the middle
third across of the rows 45% to 95% down (where the phone layout puts it, the words in the dark above), and its
falloff is judged on the wide still. Exit 1 on a DARK product or a FLAT picture.
Measured on Burnt, 19 Nov 2026: the flat top-down master, product 39 and ring 40 (FLAT); the low angled one, 34 and 18
(pool). The angle itself (low, three-quarter, the product diagonal) is a LOOK line in the checklist.
A still whose product sits off-centre names its own box in product-boxes.json beside it ({"<file>": [x0, y0, x1, y1]},
shares of the frame). Inside a named box the product reads the mean of its brighter three quarters, so a design cut
into it as black recesses is not read as a dark product (20 Nov 2026: Burnt's close iron read 29 from its black flame
and letters while its steel face was bright).
Light with a direction (rules 3aj.17; 27 Nov 2026, Boxed Israel): a product photo on a plain ground also gets its
ground's spread, the brightness range (95th less 5th percentile, 0 to 100) across the pixels of the ground's own
colour. An evenly lit studio ground has no direction of light: their overhead box on blue measured 4.3, and both
judges called it flat in two rounds although its product mean (63) was level with the references' (62, 68); the same
box with a warm light falling across it measured 12. Under 6 prints EVEN, a note and never a failure: a colour-block
studio look on purpose (Milk Bar's pie on flat red, 1.0) stays allowed. CONCEPT.md's `- light:` line then says
"re-lit" or "kept even: <why>" for that screen, decided before the board."""
import sys
from pathlib import Path

import json

import numpy as np
from PIL import Image, ImageStat

argv = sys.argv[1:]
box = tuple(float(v) for v in argv[argv.index('--product') + 1:argv.index('--product') + 5]) if '--product' in argv else None
if box: del argv[argv.index('--product'):argv.index('--product') + 5]
soft = '--soft' in argv
args = [a for a in argv if not a.startswith('--')]
if not args:
    sys.exit('usage: python scripts/check-light-pool.py <still or folder> [more] [--soft] [--product x0 y0 x1 y1]')
files = []
for a in args:
    p = Path(a)
    files += sorted(f for f in p.iterdir() if f.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp')) if p.is_dir() else [p]
luma = lambda im: ImageStat.Stat(im).mean[0] / 2.55


def ground_spread(path):
    """The brightness range across the plain ground (pixels of the outer ring's own colour), or None when the
    picture has too little plain ground to judge (a scene, not a product on a ground)."""
    rgb = np.asarray(Image.open(path).convert('RGB').resize((300, max(1, round(300 * Image.open(path).height / Image.open(path).width)))), np.float32)
    h, w, _ = rgb.shape
    ring = np.zeros((h, w), bool); ring[:h // 8] = ring[-(h // 8):] = True; ring[:, :w // 10] = ring[:, -(w // 10):] = True
    chroma = lambda c: c / (c.sum(-1, keepdims=True) + 1e-3)
    near = np.abs(chroma(rgb) - chroma(np.median(rgb[ring], 0))).sum(-1) < 0.04
    if near.mean() < 0.25:
        return None
    g = rgb[near].mean(-1) / 2.55
    return float(np.percentile(g, 95) - np.percentile(g, 5))
bright = lambda im: (lambda a: a[a >= np.percentile(a, 25)].mean() / 2.55)(np.asarray(im, np.float32))
boxes = lambda f: (lambda j: json.loads(j.read_text(encoding='utf-8')).get(f.name) if j.exists() else None)(f.parent / 'product-boxes.json')
dark = flat = 0
for f in files:
    im = Image.open(f).convert('L')
    W, H = im.size
    own = None if box else boxes(f)
    pbox = tuple(int(v * s) for v, s in zip(box or own, (W, H, W, H))) if (box or own) else None
    read = bright if own else luma
    if H > W:                                   # a phone frame
        prod = read(im.crop(pbox or (W // 3, int(H * 0.45), 2 * W // 3, int(H * 0.95))))
        ok_p = prod >= 33; dark += not ok_p
        print(f"{'ok  ' if ok_p else 'DARK'}  {f.name}: product {prod:.0f} (phone: its falloff judged on the wide still)")
        continue
    prod = read(im.crop(pbox or (W // 4, H // 4, 3 * W // 4, 3 * H // 4)))
    parts = [im.crop((0, 0, W, H // 8)), im.crop((0, H - H // 8, W, H)), im.crop((0, 0, W // 10, H)), im.crop((W - W // 10, 0, W, H))]
    ring = sum(luma(p) * p.width * p.height for p in parts) / sum(p.width * p.height for p in parts)
    ok_p = prod >= 33
    ok_f = ring <= prod * (0.9 if soft else 0.75) or (not soft and ring < 25)
    dark += not ok_p; flat += not ok_f
    word = 'pool' if ok_p and ok_f else 'DARK' if not ok_p else 'FLAT'
    sp = ground_spread(f)
    spread = '' if sp is None else f", ground spread {sp:.1f}" + (' EVEN (no direction of light: re-light it, or write "kept even: <why>" on the CONCEPT.md light line, 3aj.17)' if sp < 6 else '')
    print(f"{word}  {f.name}: product {prod:.0f}, edges {ring:.0f}{spread}")
if dark or flat:
    sys.exit(f'\n{dark} dark product(s), {flat} flat picture(s): light the product itself (never the ground round it), '
             'and let the edges fall off toward dark (rule 3aa.33), or --soft for a bright brand')
print('lit like a product photo')
