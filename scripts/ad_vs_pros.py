"""Our ads beside pro ads at the same height, before anyone is shown them (Tzvi, 8 Nov 2026: "make sure we dont
make it bland in the future"). Rule A9.5 in docs/ad-rules-checklist.md.

    python scripts/ad_vs_pros.py <out.jpg> <our ad.jpg> [<our ad.jpg> ...] [--refs <pin.jpg>,<pin.jpg>,...]

The pro side is docs/inspo/pro-references/*.jpg. Look at the sheet and answer, for each of ours, the five
questions in A9.5; any "no" goes back to be remade before it is shown.
--refs puts the given pictures on the other side instead: top posters of the ad's own subject from a Pinterest search
saved under docs/inspo/, for A9.9 (Tzvi, 25 Nov 2026: the restaurants ad passed A9.5 and the library, and was still
the dullest beside pasta posters).
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


args = sys.argv[1:]
refs = None
if "--refs" in args:
    i = args.index("--refs")
    refs = [Path(r) for r in args[i + 1].split(",") if r]
    del args[i:i + 2]
    missing = [str(r) for r in refs if not r.exists()]
    if len(refs) < 3 or missing:
        sys.exit(f"--refs needs three or more pictures that exist (missing: {missing or 'none'}, given {len(refs)})")
ours = row(args[1:], "OURS")
pros = (row(refs, "SAME SUBJECT (Pinterest)") if refs else
        row(sorted((ROOT / "docs" / "inspo" / "pro-references").glob("*.jpg")), "PROS (docs/inspo/pro-references)"))
sheet = Image.new("RGB", (max(ours.width, pros.width), ours.height + pros.height + 20), "white")
sheet.paste(ours, (0, 0))
sheet.paste(pros, (0, ours.height + 20))
sheet.save(args[0], quality=88)
print("wrote", args[0], sheet.size)
