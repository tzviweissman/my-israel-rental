"""Clean or check a cut-out (Tzvi, 12 Oct 2026: Blazin' Boards' board kept a
sliced-off olive and white specks from its photo). One subject only, no fringe.
- keeps only the largest connected piece (drops the olive and stray specks)
- pulls the edge in by a pixel and removes pale, low-colour edge pixels
  (the white the photo's background left on the edge)
Usage: python cutout.py in.png out.webp     clean it
       python cutout.py --check in.webp     report; exit 1 on stray pieces or a pale fringe
Needs Pillow, numpy and opencv-python.
"""
import sys
from PIL import Image
import numpy as np, cv2

check = sys.argv[1] == '--check'
src = sys.argv[2] if check else sys.argv[1]
dst = None if check else sys.argv[2]
im = np.array(Image.open(src).convert('RGBA')).astype(np.float32)
a = im[..., 3]
solid = (a > 40).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(solid, connectivity=8)
keep = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
mask = (lab == keep).astype(np.uint8)
stray = [int(x) for x in st[1:, cv2.CC_STAT_AREA] if x > 20][1:] if n > 2 else []
# fill holes inside the subject
ff = mask.copy() * 255; h, w = ff.shape; mm = np.zeros((h + 2, w + 2), np.uint8)
cv2.floodFill(ff, mm, (0, 0), 128); mask = (ff != 128).astype(np.uint8)
# the edge band: pale, low-colour pixels there are background, not food
inner = cv2.erode(mask, np.ones((3, 3), np.uint8), iterations=2)
band = (mask > 0) & (inner == 0)
rgb = im[..., :3]
lum = rgb.mean(2); chroma = rgb.max(2) - rgb.min(2)
pale = band & (lum > 200) & (chroma < 30)
if check:
    edge_px = int(band.sum()) or 1
    bad = bool(stray) or pale.sum() / edge_px > 0.10
    print(src, 'stray pieces:', len(stray), stray[:6], 'pale edge:', f'{pale.sum() / edge_px:.1%}', 'FAIL' if bad else 'ok')
    sys.exit(1 if bad else 0)
mask[pale] = 0
mask = cv2.erode(mask, np.ones((3, 3), np.uint8), iterations=1)
# the edge takes the colour of the subject just inside it, so no background
# colour rides along on the soft edge
edge = ((cv2.dilate(mask, np.ones((5, 5), np.uint8)) > 0) & (cv2.erode(mask, np.ones((5, 5), np.uint8)) == 0)).astype(np.uint8)
rgb = cv2.inpaint(rgb.clip(0, 255).astype(np.uint8), edge * 255, 3, cv2.INPAINT_TELEA).astype(np.float32)
alpha = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 0.8) * 255
alpha = np.minimum(alpha, a)
out = np.dstack([rgb, alpha]).clip(0, 255).astype(np.uint8)
Image.fromarray(out, 'RGBA').save(dst, quality=92, method=6)
print(dst, 'pieces dropped:', n - 2, 'pale edge px:', int(pale.sum()))
