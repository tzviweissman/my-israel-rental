"""Retired, do not run: the pictures now come from gen/studio_edit.py (10 Nov 2026). Only `alpha_of` is still used, by
gen/end_cut.py for the film's closing ring. It was: each owner photo cut out with the ISNet model the backend uses
(utils/cutout.py) and set on one ground at the same size.

    backend venv python gen/studio.py [pNN ...]  -> assets/pNN-st.webp (1000 x 1000) and gen/studio-sheet.jpg
"""
import os, sys
os.environ.setdefault('CUTOUT_MODEL_DIR', os.path.expanduser('~/.cutout-model'))
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, r'C:\Users\tzviw\Documents\mir-mn-jewelry\backend')
import numpy as np, cv2
from PIL import Image
from utils.cutout import _model

# Tzvi, 8 Nov 2026 (after 22 high-end jewelry videos): the dark luxury look. Every piece on the same near-black velvet,
# one soft spotlight behind it, one shadow under it.
GROUND = np.array([18, 19, 25], np.float32)   # the site's ground, #121319
LIGHT = np.array([44, 46, 58], np.float32)    # the spotlight's centre
SIZE, FILL = 1000, 0.72                          # every piece fills the same share of its square


def alpha_of(rgb):
    x = np.asarray(Image.fromarray(rgb).resize((1024, 1024), Image.BILINEAR), dtype=np.float32) / 255.0 - 0.5
    s = _model()
    pred = s.run(None, {s.get_inputs()[0].name: x.transpose(2, 0, 1)[None]})[0][0, 0]
    pred = (pred - pred.min()) / max(float(pred.max() - pred.min()), 1e-6)
    a = cv2.resize(pred.astype(np.float32), (rgb.shape[1], rgb.shape[0]))
    a = np.clip((a - 0.3) / 0.4, 0, 1)
    # keep only the pieces of real size (stray specks of the old ground go)
    n, lab, stats, _ = cv2.connectedComponentsWithStats((a > 0.5).astype(np.uint8))
    keep = np.zeros_like(a)
    big = stats[1:, cv2.CC_STAT_AREA].max() if n > 1 else 0
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= max(150, big * 0.02):
            keep[lab == i] = 1
    keep = cv2.dilate(keep, np.ones((5, 5), np.uint8))
    return a * keep


def tidy(name, rgb, a):
    """what one photo needs beyond the cut: props, the ground seen through a ring, a stray piece of the setting"""
    h, w = a.shape
    # a mirror reflection under the ring is the old table, not the piece: everything below the ring's lowest claw goes
    cut = {'p05': 625}.get(name)
    if cut: a[cut:] = 0
    if name == 'p10':   # the linen seen through the twist ring: its opening, traced by hand on this one photo (the model fills it)
        k = 1239 / 800
        pts = [(95, 300), (115, 262), (160, 240), (230, 222), (320, 212), (420, 212), (520, 210), (600, 215), (640, 232), (675, 260),
               (688, 300), (670, 322), (570, 326), (530, 322), (500, 335), (430, 358), (330, 370), (250, 366), (150, 346), (100, 330)]
        hole = np.zeros(a.shape, np.uint8)
        cv2.fillPoly(hole, [np.array([[int(x * k), int(y * k)] for x, y in pts], np.int32)], 1)
        hole = cv2.erode(hole, np.ones((9, 9), np.uint8))
        a *= 1 - cv2.GaussianBlur(hole.astype(np.float32), (0, 0), 2.5)
    if name == 'p03':   # shot on white with a mirror below: the reflection and the white seen between the bands go
        keep = np.ones(a.shape, np.float32)
        keep[805:] = 0
        keep[805:965, 395:635] = 1          # the stone and its lower claws hang below the band
        keep[724:746, 300:415] = 0; keep[724:746, 625:830] = 0
        a *= cv2.GaussianBlur(keep, (0, 0), 2)
    if name == 'p09':   # the navy velvet of the box
        r, g, b = [rgb[:, :, i].astype(np.int16) for i in range(3)]
        a[(b > r + 18) & (b > g + 10)] = 0
    if name == 'p20':   # the clear block the bangle leans on: its dark and bluish faces
        r, g, b = [rgb[:, :, i].astype(np.int16) for i in range(3)]
        a[(rgb.max(axis=2) < 95) | ((b > r + 12) & (rgb.max(axis=2) < 170))] = 0
    n, lab2, stats, cents = cv2.connectedComponentsWithStats((a > 0.5).astype(np.uint8))
    if n > 1:
        big = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        if name in ('p16', 'p20', 'p09', 'p12', 'p03', 'p05'):   # the piece alone (a lost chain's last fragment, the rest of a prop)
            a[(lab2 != big) & (lab2 > 0)] = 0
        if name == 'p14':   # a piece of the sweets beside the pendant
            for i in range(1, n):
                if cents[i][0] < w * 0.35: a[lab2 == i] = 0
    # the soft halo of whatever was taken out goes with it
    a *= cv2.dilate((a > 0.5).astype(np.float32), np.ones((7, 7), np.uint8))
    return a


def tinted(name, rgb):
    """A photo shot on pure white keeps its own studio reflection: its white is tinted to the site's ground (every pixel
    times ground/white, so the piece darkens by under 6%) and it is framed like the cut-outs, the same size in its square."""
    a = alpha_of(rgb)
    cut = {'p03': 985, 'p05': 625}[name]; a[cut:] = 0
    ys, xs = np.where(a > 0.5)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    side = int(max(x1 - x0, y1 - y0) / FILL)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2 + 10
    pad = side
    big = np.full((rgb.shape[0] + 2 * pad, rgb.shape[1] + 2 * pad, 3), 255, np.uint8); big[pad:pad + rgb.shape[0], pad:pad + rgb.shape[1]] = rgb
    sq = big[pad + cy - side // 2: pad + cy + side - side // 2, pad + cx - side // 2: pad + cx + side - side // 2].astype(np.float32)
    sq = cv2.resize(sq, (SIZE, SIZE), interpolation=cv2.INTER_AREA if side > SIZE else cv2.INTER_CUBIC)
    return (sq * (GROUND / 255.0)[None, None]).clip(0, 255).astype(np.uint8)


def studio_ground(w, h, cx, cy):
    """near-black velvet with one soft spotlight centred behind the piece, and a faint grain so it never bands"""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / (0.62 * max(w, h))
    k = np.clip(1 - r, 0, 1) ** 1.8
    out = GROUND[None, None] * (1 - k[:, :, None]) + LIGHT[None, None] * k[:, :, None]
    return out + np.random.default_rng(7).normal(0, 1.2, (h, w, 1))


def cut(src):
    """the piece alone: its pixels (edges cleaned of the old ground) and its alpha, cropped to it"""
    rgb = np.asarray(Image.open(src).convert('RGB'))
    name = os.path.basename(src)[:3]
    a = tidy(name, rgb, alpha_of(rgb))
    ys, xs = np.where(a > 0.2)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    crop, ca = rgb[y0:y1, x0:x1].astype(np.float32), a[y0:y1, x0:x1]
    # the old ground bleeds into soft edges: pull edge colour toward the piece's own nearby colour
    solid = (ca > 0.95).astype(np.uint8)
    if solid.any():
        inner = cv2.inpaint(crop.astype(np.uint8), (1 - solid).astype(np.uint8) * 255, 3, cv2.INPAINT_TELEA).astype(np.float32)
        w = np.clip((0.95 - ca) / 0.95, 0, 1)[:, :, None]
        crop = crop * (1 - w) + inner * w
    return crop, ca


def place(src, with_alpha=False):
    crop, ca = cut(src)
    h, w = ca.shape
    k = SIZE * (0.86 if max(h, w) > 1.8 * min(h, w) else FILL) / max(h, w)
    nh, nw = max(1, int(h * k)), max(1, int(w * k))
    crop = cv2.resize(crop, (nw, nh), interpolation=cv2.INTER_AREA)
    ca = cv2.resize(ca, (nw, nh), interpolation=cv2.INTER_AREA)
    out = studio_ground(SIZE, SIZE, SIZE // 2, SIZE // 2)
    ox, oy = (SIZE - nw) // 2, (SIZE - nh) // 2 - 10
    # one soft shadow, the same for every piece: the piece's own shape, flattened, blurred and set just below it
    sh = np.zeros((SIZE, SIZE), np.float32)
    cv2.ellipse(sh, (SIZE // 2, min(SIZE - 30, oy + nh + 6)), (int(nw * 0.42), max(10, int(nw * 0.045))), 0, 0, 360, 1.0, -1)
    sh = cv2.GaussianBlur(sh, (0, 0), 16)
    out *= (1 - 0.55 * np.clip(sh, 0, 1))[:, :, None]
    region = out[oy:oy + nh, ox:ox + nw]
    region[:] = region * (1 - ca[:, :, None]) + crop * ca[:, :, None]
    if with_alpha:   # where the piece is in the square (gen/golds.py tints only there)
        full = np.zeros((SIZE, SIZE), np.float32); full[oy:oy + nh, ox:ox + nw] = ca
        return out.clip(0, 255).astype(np.uint8), full
    return out.clip(0, 255).astype(np.uint8)


# p02 (the ring on glass) and p20 (the bangle through a clear block) do not cut cleanly from their props: p02's ring is
# shown by p03, and the bangle waits for a clean photo (OWNER-QUESTIONS)
if __name__ == '__main__':
    names = sys.argv[1:] or [f'p{n:02d}' for n in range(3, 22) if n not in (3, 9, 11, 12, 13, 20)]   # p09's shank is lost in the velvet, p11 and p13 are second photos that cut badly
    tiles = []
    for n in names:
        im = place(f'src/owner/{n}.jpg')
        Image.fromarray(im).save(f'assets/{n}-st.webp', quality=86)
        tiles.append(cv2.resize(im, (250, 250)))
        print(n, flush=True)
    rows = [np.hstack(tiles[i:i + 5] + [np.zeros((250, 250, 3), np.uint8)] * (5 - len(tiles[i:i + 5]))) for i in range(0, len(tiles), 5)]
    Image.fromarray(np.vstack(rows)).save('gen/studio-sheet.jpg', quality=85)
