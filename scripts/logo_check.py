"""Does the business's logo read at phone size? (ad rule A4.6, Tzvi 18 Nov 2026: "make sure the logo never comes out
unclear again"). L.A. Cholent's logo is a round badge, thin gold letters round a faded slow cooker; shown at 120px in
the corner of its moving ad, the letters were 11px tall at 1080 wide, mush on a phone. Its wordmark, cut out clean
(docs/ads/gen/la-cholent-chain-moving/logo-mark.png) and shown at 320px, reads at about 40px.

    backend/.venv/Scripts/python scripts/logo_check.py <ad.png> <x,y,w,h>      the logo's box on a 1080-wide ad
    backend/.venv/Scripts/python scripts/logo_check.py --selftest

The lettering must be as tall as any other text on the ad: 30px at 1080 wide (A8.2). check-moving-ad.py runs this on
every moving ad's last frame, at the box record-moving-ad.mjs saves; a still ad's A4.6 answer quotes this line.
A logo with no letters at all (a pure mark) is set window.AD.logoText = false in a moving ad, and is not measured."""
import sys
from pathlib import Path

import cv2
import numpy as np

MIN = 30


def logo_letters(frame, box):
    """How many letter-like marks the logo box holds and their middle height in pixels at 1080 wide: strokes that
    differ from the box's own ground by over 40, shaped like a letter (not the pot or ring round them)."""
    x, y, w, h = box
    c = cv2.cvtColor(frame[max(0, y):y + h, max(0, x):x + w], cv2.COLOR_BGR2GRAY).astype(int)
    ink = (np.abs(c - np.median(c)) > 40).astype(np.uint8)
    _, _, st, _ = cv2.connectedComponentsWithStats(ink, 8)
    hs = [s[3] for s in st[1:] if s[4] >= 6 and s[3] >= 3 and 0.15 <= s[2] / s[3] <= 1.6 and s[3] < h * 0.8]
    return len(hs), (float(np.median(hs)) if hs else 0.0)


def verdict(frame, box):
    """None when the logo reads, else why not."""
    n, tall = logo_letters(frame, box)
    if n < 3:
        return ("no lettering read in the logo: too faint or too busy on its ground. Cut their wordmark out clean (like "
                "L.A. Cholent's logo-mark.png), or mark a pure mark as having no letters (A4.6)")
    if tall < MIN:
        return (f"the logo's letters are {tall:.0f}px tall at 1080, under {MIN}: unreadable on a phone. Show the wordmark "
                "larger, or cut it out of a badge or flyer (like L.A. Cholent's logo-mark.png) (A4.6)")
    return None


def selftest():
    ads = Path(__file__).resolve().parents[1] / "docs" / "ads"
    cases = [("la-cholent-moving-last.png", (944, 236, 100, 100), False),     # the round badge at 100px: mush
             ("chicken-munch-moving-last.png", (830, 104, 210, 90), True),   # a bold wordmark at 210px
             ("la-cholent-chain-moving-last.png", (706, 150, 320, 74), True)]  # the cut-out wordmark at 320px
    bad = 0
    for name, box, reads in cases:
        why = verdict(cv2.imread(str(ads / name)), box)
        ok = (why is None) == reads
        bad += not ok
        print(f"{'ok ' if ok else 'BAD'} {name}: {'must read' if reads else 'must fail'}{'' if ok else f' ({why})'}")
    return bad == 0


if __name__ == "__main__":
    if sys.argv[1:] == ["--selftest"]:
        sys.exit(0 if selftest() else 1)
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    img, box = cv2.imread(sys.argv[1]), tuple(int(v) for v in sys.argv[2].split(","))
    n, tall = logo_letters(img, box)
    why = verdict(img, box)
    print(f"{sys.argv[1]}: logo lettering {tall:.0f}px ({n} letters) {'reads' if why is None else 'FAIL ' + why}")
    sys.exit(0 if why is None else 1)
