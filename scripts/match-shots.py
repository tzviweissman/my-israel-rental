"""Line up the round thing in two shots of a moving ad, so a cut from one to the other lands exactly (M14, 18 Nov 2026).

    backend/.venv/Scripts/python scripts/match-shots.py <shot A.jpg> <shot B.jpg> [<sheet.jpg>]

Why: the L.A. Cholent remake cut from the pot (shot 2) to the bowl (shot 3), "one circle in one place". The first
generated bowl sat higher and smaller than the pot, it was judged by eye, and a second paid still was made. This finds
the biggest circle (pot, bowl, plate, cup, can seen from above) in each shot at the ad's 1080x1920 and prints the CSS
transform that puts B's circle on A's (transform-origin 0 0): give it to shot B's layer at the cut and ease it to
none, so B starts exactly where A ended and settles into its own place. It also says whether B is close enough to
use without a remake (centre within 40px and size within 10%). The sheet shows A, B, and B moved over A at half
strength: one circle, not two, means the cut will land."""
import sys

import cv2
import numpy as np

W, H = 1080, 1920


def circle(path):
    img = cv2.resize(cv2.imread(path), (W, H))
    g = cv2.medianBlur(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), 7)
    found = cv2.HoughCircles(g, cv2.HOUGH_GRADIENT, dp=1.2, minDist=40, param1=90, param2=40,
                             minRadius=int(W * 0.22), maxRadius=int(W * 0.46))
    # the strongest circle (Hough sorts by votes) that lies wholly in the frame: the rim of the pot or bowl, not an
    # arc of stone texture running off the edge
    inside = [c for c in (found[0] if found is not None else []) if c[2] <= c[0] <= W - c[2] and c[2] <= c[1] <= H - c[2]]
    if not inside:
        sys.exit(f"no circle found in {path}: is the round thing seen from above, whole, and 45 to 90% of the width?")
    x, y, r = inside[0]
    return img, float(x), float(y), float(r)


def main(a, b, sheet=None):
    ia, xa, ya, ra = circle(a)
    ib, xb, yb, rb = circle(b)
    s = ra / rb
    tx, ty = xa - s * xb, ya - s * yb
    off, size = ((xa - xb) ** 2 + (ya - yb) ** 2) ** 0.5, abs(rb / ra - 1)
    print(f"A: circle at {xa:.0f},{ya:.0f} radius {ra:.0f}")
    print(f"B: circle at {xb:.0f},{yb:.0f} radius {rb:.0f}  (off by {off:.0f}px, size {size:.0%})")
    print(f"B's layer at the cut: transform-origin: 0 0; transform: translate({tx:.1f}px, {ty:.1f}px) scale({s:.4f})")
    print("close enough to use as it is" if off <= 40 and size <= 0.10
          else "far apart: the transform hides it at the cut, but B's own place differs a lot; remake B if the settle looks wrong")
    if sheet:
        moved = cv2.warpAffine(ib, np.float32([[s, 0, tx], [0, s, ty]]), (W, H))
        over = cv2.addWeighted(ia, 0.5, moved, 0.5, 0)
        for im, (x, y, r) in ((ia, (xa, ya, ra)), (ib, (xb, yb, rb))):
            cv2.circle(im, (int(x), int(y)), int(r), (0, 220, 255), 6)
        cv2.circle(over, (int(xa), int(ya)), int(ra), (0, 220, 255), 6)
        cv2.imwrite(sheet, cv2.resize(np.hstack([ia, ib, over]), (3 * 540, 960)))
        print("sheet", sheet)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(*sys.argv[1:4])
