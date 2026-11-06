"""The opening's pictures, all from one generated still (gen/mirror/wide-0.png, gen/mirror-brief.md). No paid call here.
1. Wide and tall canvases: only the plain wall and plain table are extended, the mirror's pixels are untouched.
   The fill model has no API route that answers (gen/fill.py tried it), and on a plain wall and table the rows' own
   colours are seamless, so the extension is done here.
2. Bulbs are measured on the picture (bright blobs) and written to gen/bulbs.json in fractions of each canvas.
3. The bulbs-off picture is the same pixels: bulbs turned to matte frosted globes, the room's warmth taken down.
4. The logo is cut from its pink ground; the share picture is the lit room.
Run from the build folder: python gen/assets.py"""
import json
import numpy as np
import cv2
from PIL import Image, ImageFilter

src = Image.open('gen/mirror/wide-0.png').convert('RGB')
A = np.asarray(src).astype(np.float32)
H, W, _ = A.shape


def grain(shape, amp, seed):
    n = np.random.default_rng(seed).normal(0, amp, shape[:2])
    return cv2.GaussianBlur(n.astype(np.float32), (0, 0), 1.2)[..., None]


# ── measure the bulbs: bright round blobs, the front globe of each pair is the bigger, higher-left one ──
lum = A.mean(axis=2)
mask = (lum > 236).astype(np.uint8)
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
n, lab, stats, cent = cv2.connectedComponentsWithStats(mask)
blobs = [(cent[i][0], cent[i][1], (stats[i, cv2.CC_STAT_WIDTH] + stats[i, cv2.CC_STAT_HEIGHT]) / 4) for i in range(1, n)
         if stats[i, cv2.CC_STAT_AREA] > 500 and cent[i][0] > 1100]
cx, cy = np.mean([b[0] for b in blobs]), np.mean([b[1] for b in blobs])
blobs.sort(key=lambda b: np.arctan2(b[1] - cy, b[0] - cx))
print(len(blobs), 'bulbs, r', [round(b[2]) for b in blobs])

# ── bulbs off: the same globes, matte and frosted, following their real outline; a little less warmth in the room ──
yy, xx = np.mgrid[:H, :W].astype(np.float32)
near = np.zeros((H, W), np.uint8)
shade = np.ones((H, W), np.float32)
for x, y, r in blobs:
    d = np.hypot(xx - x, yy - y)
    near[d < r * 1.32] = 1
    s_ = 1 - .13 * np.clip(((xx - x) * .7 + (yy - y) * .7) / (r * 1.3) + .2, 0, 1.3)
    inside = d < r * 1.32
    shade[inside] = np.minimum(shade[inside], s_[inside])
m = np.clip((lum - 214) / 22, 0, 1) * near.astype(np.float32)
m = cv2.GaussianBlur(m, (0, 0), 1.4)
globe = np.stack([240 * shade, 232 * shade, 230 * shade], axis=2)
off = A * (1 - m[..., None]) + globe * m[..., None]
glow = np.zeros((H, W), np.float32)
for x, y, r in blobs:
    glow = np.maximum(glow, np.exp(-(np.hypot(xx - x, yy - y) / (r * 3.0)) ** 2))
off = off * (1 - .22 * glow[..., None]) + off.mean(axis=2, keepdims=True) * .22 * glow[..., None]
OFF = (off * np.array([.80, .78, .83], np.float32)).clip(0, 255)


def extend_wide(a):
    """2400 x 1350: the original at the bottom right, wall added above and to the left."""
    TW, TH = 2400, 1350
    ox, oy = TW - W, TH - H
    out = np.zeros((TH, TW, 3), np.float32)
    out[oy:, ox:] = a
    # above: the top rows, flipped and stretched (plain wall, above the highest bulb)
    top = cv2.resize(a[:170][::-1], (W, oy), interpolation=cv2.INTER_LINEAR)
    out[:oy, ox:] = cv2.GaussianBlur(top, (0, 0), 6)
    # left: the left columns flipped, which holds the wall and the stone's own grain
    out[:, :ox] = out[:, ox:ox + ox][:, ::-1]
    # soften the joins
    for edge_y in (oy,):
        band = out[edge_y - 24:edge_y + 24].copy()
        out[edge_y - 24:edge_y + 24] = cv2.GaussianBlur(band, (0, 0), 8) * .6 + band * .4
    return out, ox, oy


def extend_tall(a):
    """1118 x 1988: the mirror's part of the picture (no brush), plain wall added above and to the left, the table
    continued below for the words."""
    X0, TOP, LEFT, TW, TH = 1130, 110, 200, 1118, 1988
    part = a[:, X0:]
    out = np.zeros((TH, TW, 3), np.float32)
    out[TOP:TOP + H, LEFT:] = part
    out[:TOP, LEFT:] = cv2.GaussianBlur(cv2.resize(part[:160][::-1], (TW - LEFT, TOP)), (0, 0), 6)
    out[:TOP + H, :LEFT] = np.repeat(cv2.GaussianBlur(out[:TOP + H, LEFT:LEFT + 24], (0, 0), 5).mean(axis=1, keepdims=True), LEFT, axis=1)
    y0 = TOP + H
    tone = cv2.GaussianBlur(out[y0 - 22:y0], (0, 0), 40).mean(axis=0, keepdims=True)
    tone = cv2.GaussianBlur(np.repeat(tone, 9, axis=0), (0, 0), 60)[:1]
    rest = np.repeat(tone, TH - y0, axis=0)
    speck = (out[y0 - 22:y0] - cv2.GaussianBlur(out[y0 - 22:y0], (0, 0), 6)).std()
    rest = rest + grain(rest.shape, float(speck) * 1.4, 3)
    out[y0:] = rest
    band = out[y0 - 22:y0 + 22].copy()
    t = np.abs(np.linspace(-1, 1, 44))[:, None, None]
    out[y0 - 22:y0 + 22] = band * t + cv2.GaussianBlur(band, (0, 0), 7) * (1 - t)
    return out, LEFT - X0, TOP


def save(a, name, q):
    Image.fromarray(a.clip(0, 255).astype('uint8')).save(f'assets/{name}.webp', quality=q, method=6)


lit_w, ox, oy = extend_wide(A)
off_w, _, _ = extend_wide(OFF)
lit_t, tx, ty = extend_tall(A)
off_t, _, _ = extend_tall(OFF)
save(lit_w, 'room-wide', 80); save(off_w, 'room-wide-off', 76); save(lit_t, 'room-tall', 78); save(off_t, 'room-tall-off', 74)
LW, LH, TW, TH = lit_w.shape[1], lit_w.shape[0], lit_t.shape[1], lit_t.shape[0]
json.dump({
    'wide': [[round((x + ox) / LW * 100, 2), round((y + oy) / LH * 100, 2), round(r / LW * 100, 2)] for x, y, r in blobs],
    'tall': [[round((x + tx) / TW * 100, 2), round((y + ty) / TH * 100, 2), round(r / TW * 100, 2)] for x, y, r in blobs],
}, open('gen/bulbs.json', 'w'))

# the logo, cut from its pink: alpha is how far each pixel is from the ground, colour stays hers
lg = np.asarray(Image.open('src/owner/p01.jpg').convert('RGB')).astype(np.float32)
ground = np.array([248, 211, 219], np.float32)
dist = np.abs(lg - ground).sum(axis=2)
alpha = np.clip(dist / 150, 0, 1)
ys, xs = np.where(alpha > .25)
box = xs.min() - 6, ys.min() - 6, xs.max() + 7, ys.max() + 7
rgb = (lg - ground * (1 - alpha[..., None])) / np.maximum(alpha[..., None], .05)
rose = np.dstack([rgb.clip(0, 255), alpha * 255]).astype('uint8')
Image.fromarray(rose, 'RGBA').crop(box).resize((560, round(560 * (box[3] - box[1]) / (box[2] - box[0]))), Image.LANCZOS).save('assets/logo.webp', quality=90, method=6)
pale = np.dstack([np.full(lg.shape[:2], 248), np.full(lg.shape[:2], 211), np.full(lg.shape[:2], 219), alpha * 255]).astype('uint8')
Image.fromarray(pale, 'RGBA').crop(box).resize((560, round(560 * (box[3] - box[1]) / (box[2] - box[0]))), Image.LANCZOS).save('assets/logo-pale.webp', quality=90, method=6)

# the link preview: the lit room, 1200 x 630
og = Image.fromarray(lit_w.clip(0, 255).astype('uint8')).resize((1200, 675), Image.LANCZOS).crop((0, 45, 1200, 675))
og.save('assets/og.jpg', quality=84)
print('wrote', LW, LH, TW, TH, 'logo box', box)
