"""Puts an opening still beside the inspo picture it copies, at the same height, to look at before anyone sees the
still (page rules 3aa.33; Tzvi, 19 Nov 2026, Burnt: "compare to the inspo it still looks better tell me why"). A
light check passed the first remake and the inspo alike (middle 87 / edges 47 against 92 / 49); only the two side by
side showed what was missing: closeness, one hard side light, the board's thickness, one hero, the dark beyond.

    python scripts/inspo-beside.py <inspo picture> <still> [more stills] [--out sheet.jpg]

Writes <first still>-beside-inspo.jpg next to the first still (or --out), the inspo on the left. Look at it for the
five points of 3aa.33 and write what you compared in the brief's shot_seen line."""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

a = sys.argv[1:]
out = None
if '--out' in a:
    i = a.index('--out'); out = Path(a[i + 1]); del a[i:i + 2]
if len(a) < 2:
    sys.exit('usage: python scripts/inspo-beside.py <inspo picture> <still> [more stills] [--out sheet.jpg]')
H, GAP = 640, 16
ims = []
for p in a:
    im = Image.open(p).convert('RGB')
    ims.append(im.resize((round(im.width * H / im.height), H), Image.LANCZOS))
sheet = Image.new('RGB', (sum(i.width for i in ims) + GAP * (len(ims) - 1), H + 34), 'white')
d = ImageDraw.Draw(sheet)
x = 0
for p, im in zip(a, ims):
    sheet.paste(im, (x, 34))
    d.text((x + 4, 10), ('INSPO  ' if x == 0 else '') + Path(p).name, fill='black')
    x += im.width + GAP
out = out or Path(a[1]).with_name(Path(a[1]).stem + '-beside-inspo.jpg')
sheet.save(out, quality=88)
print('saved', out, '- look at it for 3aa.33: close, hero angle, one side light, thickness and one hero, dark beyond')
