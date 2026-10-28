"""Cut her doughnuts off their white backgrounds (no generation: her own pixels).
Background = near-white pixels joined to the border, the hole = the large near-white piece inside,
and the grey floor shadow = pale, colourless pixels joined to the background. Then the skill's
cutout.py cleans the edge. Usage: python cut.py p05 p06 ..."""
import sys, subprocess, os
import numpy as np, cv2
from PIL import Image
B = 'C:/Users/tzviw/Documents/mir-hero/scrollcraft/builds/bake-away/'
for n in sys.argv[1:]:
    a = np.asarray(Image.open(f'{B}src/owner/{n}.jpg').convert('RGB')).astype(np.int16)
    h, w, _ = a.shape
    mn, mx = a.min(2), a.max(2)
    white = (mn >= 244)
    shadow = (mn >= 140) & ((mx - mn) <= 10)          # pale and colourless: floor shadow
    cand = (white | shadow).astype(np.uint8)
    n_, lab, st, _ = cv2.connectedComponentsWithStats(cand, connectivity=4)
    bg = np.zeros((h, w), bool)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    for k in border: bg |= lab == k
    # the hole: the one large pure-white piece nearest the doughnut's middle (shine on white glaze
    # is also pure white, so only a piece near the centre counts)
    ys, xs = np.where(~bg); cy, cx = (ys.min() + ys.max()) / 2, (xs.min() + xs.max()) / 2
    nw, lw, sw, cw = cv2.connectedComponentsWithStats(white.astype(np.uint8), connectivity=4)
    edge = set(np.unique(np.concatenate([lw[0], lw[-1], lw[:, 0], lw[:, -1]])))
    best = None
    for k in range(1, nw):
        if k in edge or sw[k, cv2.CC_STAT_AREA] < h * w * 0.004: continue
        d = np.hypot(cw[k][0] - cx, cw[k][1] - cy) / max(xs.max() - xs.min(), 1)
        if d < 0.12 and (best is None or d < best[0]): best = (d, k)
    if best: bg |= lw == best[1]
    # the floor shadow under the doughnut: below the lowest coloured (fried dough, glaze) pixel of each
    # column everything is floor
    hsv = cv2.cvtColor(a.astype(np.uint8), cv2.COLOR_RGB2HSV)
    col = (hsv[..., 1] > 70) & (hsv[..., 2] > 60)
    col = cv2.morphologyEx(col.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)).astype(bool)
    low = np.array([np.where(col[:, x])[0].max() if col[:, x].any() else -1 for x in range(w)], float)
    ok = low >= 0
    if ok.sum() > 10:
        low = np.interp(np.arange(w), np.where(ok)[0], low[ok])
        low = cv2.dilate(low.astype(np.float32).reshape(1, -1), np.ones((1, 41), np.uint8)).ravel()
        for x in range(w):
            bg[int(low[x]) + 3:, x] = True
    fg = (~bg).astype(np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    alpha = cv2.GaussianBlur(fg * 255, (3, 3), 0)
    ys, xs = np.where(fg)
    pad = 8
    box = (max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad, w), min(ys.max() + pad, h))
    rgba = np.dstack([a.astype(np.uint8), alpha]).astype(np.uint8)
    raw = f'{B}gen/cut/{n}-raw.png'
    Image.fromarray(rgba).crop(box).save(raw)
    out = f'{B}gen/cut/{n}.png'
    subprocess.run([sys.executable, os.path.expanduser('~/.claude/skills/build-business-page/scripts/cutout.py'), raw, out], check=True)
    print(n, 'box', box)
