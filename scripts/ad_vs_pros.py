"""Our ads beside pro ads at the same height, before anyone is shown them (Tzvi, 8 Nov 2026: "make sure we dont
make it bland in the future"). Rule A9.5 in docs/ad-rules-checklist.md.

    python scripts/ad_vs_pros.py <out.jpg> <our ad.jpg> [<our ad.jpg> ...]

The pro side is docs/inspo/pro-references/*.jpg. Look at the sheet and answer, for each of ours, the five
questions in A9.5; any "no" goes back to be remade before it is shown.
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
H = 640


def row(paths, label):
    cells = []
    for p in paths:
        im = Image.open(p).convert("RGB")
        cells.append(im.resize((int(im.width * H / im.height), H)))
    w = sum(c.width for c in cells) + 12 * (len(cells) - 1)
    out = Image.new("RGB", (w, H + 40), "white")
    ImageDraw.Draw(out).text((4, 8), label, fill="black")
    x = 0
    for c in cells:
        out.paste(c, (x, 40))
        x += c.width + 12
    return out


ours = row(sys.argv[2:], "OURS")
pros = row(sorted((ROOT / "docs" / "inspo" / "pro-references").glob("*.jpg")), "PROS (docs/inspo/pro-references)")
sheet = Image.new("RGB", (max(ours.width, pros.width), ours.height + pros.height + 20), "white")
sheet.paste(ours, (0, 0))
sheet.paste(pros, (0, ours.height + 20))
sheet.save(sys.argv[1], quality=88)
print("wrote", sys.argv[1], sheet.size)
