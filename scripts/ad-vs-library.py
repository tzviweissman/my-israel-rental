"""Our ad beside the Pinterest library's 5s of the same kind of idea (ad rule A9.7, Tzvi 10 Nov 2026).

    python scripts/ad-vs-library.py <our ad.jpg> <idea kind>[+<idea kind>] <out.jpg> [--cat <category>]

Why: M and N Jewelry's "FOREVER" (a ring in a velvet box under one word) was polished, passed the pro sheet and was
sent, and only beside the library did it show as a plain "minimal luxury" ad: a kind that averages 3.24 of 5 there,
while the 5s that use the very same ring box turn it into a joke (biryani in a ring box, a toy car in a jewellery
box). Tzvi: "how do we make sure to make a 5 every time". So every ad names its kind of idea, and this sheet puts it
beside four 5s of that kind from docs/inspo/pinterest-ads-2026-11-02, where it either holds its own or does not.

The kinds and their averages are printed. A kind that averages under 4.0 on its own (minimal luxury, big type,
lifestyle, info flyer...) is refused unless it is joined with one that averages 4.0 or more ("minimal-luxury+visual-pun"):
a beautiful plain ad is a 3 there however well it is made."""
import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
LIB = ROOT / "docs" / "inspo" / "pinterest-ads-2026-11-02"
H = 640
BAR = 4.0


def kinds(row):
    v = row.get("idea") or ""
    return v if isinstance(v, list) else re.findall(r"'([a-z-]+)'", v)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ad")
    ap.add_argument("kinds")
    ap.add_argument("out")
    ap.add_argument("--cat", default="")
    a = ap.parse_args()
    rows = json.loads((LIB / "data.json").read_text(encoding="utf8"))
    scores = defaultdict(list)
    for r in rows:
        for k in kinds(r):
            scores[k].append(float(r.get("score") or 0))
    avg = {k: sum(v) / len(v) for k, v in scores.items()}
    want = [k for k in a.kinds.split("+") if k]
    unknown = [k for k in want if k not in avg]
    if unknown:
        raise SystemExit(f"unknown kind {unknown}; the library's kinds: " + ", ".join(f"{k} {v:.2f}" for k, v in sorted(avg.items(), key=lambda x: -x[1])))
    for k in want:
        print(f"{k}: {avg[k]:.2f} of 5 over {len(scores[k])} library ads")
    if max(avg[k] for k in want) < BAR:
        raise SystemExit(f"refused: no kind here averages {BAR} or more. Join it with one that does (" +
                         ", ".join(k for k, v in sorted(avg.items(), key=lambda x: -x[1]) if v >= BAR) + ") or pick another idea.")
    fives = [r for r in rows if float(r.get("score") or 0) >= 5 and set(want) & set(kinds(r))]
    fives.sort(key=lambda r: (r.get("cat") != a.cat, -len(set(want) & set(kinds(r)))))
    picks = fives[:4]
    cells = []
    for label, f in [("OURS", a.ad)] + [(f"5/5 {r['cat']} {r['code']}: {', '.join(kinds(r))}", LIB / r["img"]) for r in picks]:
        im = Image.open(f).convert("RGB")
        im = im.resize((int(im.width * H / im.height), H))
        c = Image.new("RGB", (im.width, H + 40), "white")
        c.paste(im, (0, 40))
        ImageDraw.Draw(c).text((4, 10), label, fill="black")
        cells.append(c)
    sheet = Image.new("RGB", (sum(c.width for c in cells) + 12 * (len(cells) - 1), H + 40), "white")
    x = 0
    for c in cells:
        sheet.paste(c, (x, 0))
        x += c.width + 12
    sheet.save(a.out, quality=86)
    print(f"wrote {a.out}: ours beside {len(picks)} library 5s of {'+'.join(want)}. Answer A9.7 with 'Score: N' and what it shares with them.")


if __name__ == "__main__":
    sys.exit(main())
