"""A moving ad's movement beside the motion library's 5s (ad rule A10.8, Tzvi 16 Nov 2026).

    python scripts/moving-ad-vs-library.py <ad.mp4> <out.jpg> [--cat food] [--codes d76,p101,p009]

Why: ad-vs-library.py judges one picture, the last frame, so a moving ad was scored on where it ends and never on
what moves. This lays six frames of our ad, start to end, in the top row and six of three 5/5 moving ads from
docs/inspo/pinterest-ads-2026-11-02/motion under it (the codes given, else the ad's category first), so the motion
itself is compared: one idea acted out, or words sliding over a still photo."""
import argparse
import json
from pathlib import Path

import cv2
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
MOT = ROOT / "docs" / "inspo" / "pinterest-ads-2026-11-02" / "motion"
H, N = 360, 6


def strip(path, label):
    cap = cv2.VideoCapture(str(path))
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
    tiles = []
    for i in range(N):
        cap.set(cv2.CAP_PROP_POS_FRAMES, min(n - 1, round(i * (n - 1) / (N - 1))))
        ok, f = cap.read()
        if not ok:
            continue
        im = Image.fromarray(cv2.cvtColor(f, cv2.COLOR_BGR2RGB))
        k = min(H / im.height, H / im.width)  # wide library videos fit an H square, so no row dwarfs ours
        tiles.append(im.resize((round(im.width * k), round(im.height * k))))
    w = sum(t.width for t in tiles) + 8 * (len(tiles) - 1)
    row = Image.new("RGB", (max(w, 600), H + 34), "white")
    ImageDraw.Draw(row).text((4, 6), label, fill="black")
    x = 0
    for t in tiles:
        row.paste(t, (x, 34))
        x += t.width + 8
    return row


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ad")
    ap.add_argument("out")
    ap.add_argument("--cat", default="")
    ap.add_argument("--codes", default="")
    a = ap.parse_args()
    rows = [r for r in json.loads((MOT / "data.json").read_text(encoding="utf8")) if r["score"] == 5]
    if a.codes:
        want = a.codes.split(",")
        rows = [r for c in want for r in rows if r["code"] == c]
    else:
        rows.sort(key=lambda r: r["cat"] != a.cat)
    rows = rows[:3]
    strips = [strip(a.ad, f"OURS  {Path(a.ad).name}")]
    strips += [strip(MOT / r["video"], f"5/5  {r['code']} ({r['idea']}, {r['cat']}): {r['what'][:110]}") for r in rows]
    W = max(s.width for s in strips)
    sheet = Image.new("RGB", (W, sum(s.height + 12 for s in strips)), (235, 235, 235))
    y = 0
    for s in strips:
        sheet.paste(s, (0, y))
        y += s.height + 12
    sheet.save(a.out, quality=88)
    print(f"wrote {a.out}: ours beside {', '.join(r['code'] for r in rows)}")


if __name__ == "__main__":
    main()
