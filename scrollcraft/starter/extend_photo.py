"""Extend a photo to the screen's shape: never zoom, never frame it (page rules 3c.12).

The method from RS Modest Activewear (27 Oct 2026, builds/rs-modest-activewear/gen/wide-brief.md):

  1. pad    put the photo on a 16:9 and a 9:16 canvas, AT AN EDGE (a photo centred with padding on all
            sides gets moved and shrunk by the model), the rest filled with its own edge colours.
  2. (you)  fill only the padded part with Higgsfield nano_banana_2, 2k, the canvas as image_references,
            at the canvas aspect. Never outpaint_image: it re-makes the whole scene. ~1.5 credits each.
  3. paste  put the original pixels back over the fill with a feathered seam, aligned by SIFT in case the
            model nudged the photo; refuses when the model resized it (regenerate instead).
  4. ultra  21:9 for wide laptops: stretch the plain generated side of the 16:9 result (21:9 generation
            fails on Higgsfield); the photo itself is not touched.

Run with the backend venv python (it has numpy, PIL and cv2) and C:/ paths:
  python extend_photo.py pad   assets/skirts-2k.webp gen/ext                 [--wide-at right] [--tall-at top]
  python extend_photo.py paste gen/ext/canvas-wide.json gen/ext/fill-wide.png assets/skirts-wide.webp --width 3600
  python extend_photo.py paste gen/ext/canvas-tall.json gen/ext/fill-tall.png assets/skirts-tall.webp --width 1200
  python extend_photo.py ultra gen/ext/canvas-wide.json assets/skirts-wide.webp assets/skirts-ultra.webp --width 4200
  python extend_photo.py selftest

Then serve them with <picture> (see the RS index.html doors): tall for (max-width: 860px), ultra for
(min-aspect-ratio: 17/10), wide as the <img>. A real place (the owner's shop) is never extended: keep a crop
and mark it data-crop-ok.
"""
import argparse
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

SHAPES = {'wide': 16 / 9, 'tall': 9 / 16}
PROMPT = ('Extend this photo. Fill ONLY the flat smeared areas with more of the same plain background that is '
          'already in the photo (same wall, same floor, same light and shadows). Keep the existing photo exactly '
          'where it is, at the same size. Add no new objects, plants, furniture or text.')


def load(path):
    return np.asarray(Image.open(path).convert('RGB'))


def save(arr, path, width=None):
    img = Image.fromarray(arr)
    if width and img.width > width:
        img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    img.save(path, quality=86) if path.lower().endswith(('.webp', '.jpg')) else img.save(path)
    return img.size


def place(w, h, aspect, at):
    """Canvas size and the photo's box on it, photo against edge `at`."""
    if abs(w / h - aspect) < 0.02:
        return None
    if w / h < aspect:  # photo too narrow: add width
        cw, ch = round(h * aspect), h
        x = cw - w if at == 'right' else 0 if at == 'left' else (cw - w) // 2
        return (cw, ch), (x, 0, w, h)
    cw, ch = w, round(w / aspect)  # photo too wide: add height
    y = 0 if at == 'top' else ch - h if at == 'bottom' else (ch - h) // 2
    return (cw, ch), (0, y, w, h)


def pad(src, out_dir, ats, strip):
    for name, aspect in SHAPES.items():
        photo = load(src)
        if name == 'tall' and strip:
            # Thin side strips on the phone canvas, as on RS (photo 1800 wide on 2160): the fill then kept
            # the photo in place; with no strips it is untested.
            ph, pw = photo.shape[:2]
            nw = round(pw * (1 - 2 * strip))
            photo = cv2.resize(photo, (nw, round(ph * nw / pw)), interpolation=cv2.INTER_LANCZOS4)
            photo = np.pad(photo, ((0, 0), ((pw - nw) // 2, pw - nw - (pw - nw) // 2), (0, 0)), mode='edge')
        h, w = photo.shape[:2]
        fit = place(w, h, aspect, ats[name])
        if not fit:
            print(f'{name}: the photo is already this shape, use it as it is')
            continue
        (cw, ch), (x, y, _, _) = fit
        canvas = np.pad(photo, ((y, ch - h - y), (x, cw - w - x), (0, 0)), mode='edge')
        if name == 'tall' and strip:
            x, w, h = x + (pw - nw) // 2, nw, round(ph * nw / pw)
        png = os.path.join(out_dir, f'canvas-{name}.png')
        save(canvas, png)
        with open(png[:-4] + '.json', 'w') as f:
            json.dump({'src': os.path.abspath(src), 'canvas': png, 'size': [cw, ch], 'box': [x, y, w, h]}, f)
        print(f'{name}: {png} {cw}x{ch}, generate at aspect {"16:9" if aspect > 1 else "9:16"}')
    print('\nPrompt (nano_banana_2, 2k, canvas as image_references):\n' + PROMPT)


def find_shift(photo, fill_region):
    """Affine taking the photo onto where the fill drew it, or None if SIFT cannot tell."""
    sift = cv2.SIFT_create(4000)
    g1, g2 = (cv2.cvtColor(a, cv2.COLOR_RGB2GRAY) for a in (photo, fill_region))
    k1, d1 = sift.detectAndCompute(g1, None)
    k2, d2 = sift.detectAndCompute(g2, None)
    if d1 is None or d2 is None or len(k1) < 8 or len(k2) < 8:
        return None
    pairs = cv2.BFMatcher().knnMatch(d1, d2, k=2)
    good = [m for m, n in (p for p in pairs if len(p) == 2) if m.distance < 0.75 * n.distance]
    if len(good) < 8:
        return None
    a = np.float32([k1[m.queryIdx].pt for m in good])
    b = np.float32([k2[m.trainIdx].pt for m in good])
    M, _ = cv2.estimateAffinePartial2D(a, b, method=cv2.RANSAC, ransacReprojThreshold=3)
    return M


def paste(meta_path, fill_path, out, width, feather):
    meta = json.load(open(meta_path))
    cw, ch = meta['size']
    x, y, w, h = meta['box']
    photo = np.asarray(Image.open(meta['src']).convert('RGB').resize((w, h), Image.LANCZOS))
    fill = np.asarray(Image.fromarray(load(fill_path)).resize((cw, ch), Image.LANCZOS))

    M = find_shift(photo, fill[y:y + h, x:x + w])
    if M is None:
        M = np.float32([[1, 0, 0], [0, 1, 0]])
        print('SIFT found too little to compare; pasting at the padded place')
    scale = float(np.hypot(M[0, 0], M[1, 0]))
    dx, dy = float(M[0, 2]), float(M[1, 2])
    print(f'the fill moved the photo by {dx:.1f},{dy:.1f} px at scale {scale:.3f}')
    if abs(scale - 1) > 0.01 or abs(dx) > 40 or abs(dy) > 40:
        sys.exit('The model resized or moved the photo: pasting back would leave ghost edges. Regenerate '
                 '(photo hard against one edge, less padding), never ship this fill.')
    M = M.copy()
    M[0, 2] += x
    M[1, 2] += y
    placed = cv2.warpAffine(photo, M, (cw, ch), flags=cv2.INTER_LANCZOS4)
    mask = cv2.warpAffine(np.ones((h, w), np.float32), M, (cw, ch), flags=cv2.INTER_LINEAR)
    # Feather inward on the seam sides only: BORDER_REPLICATE keeps the mask at 1 where the photo meets the
    # canvas edge, so the photo's own outer edges stay sharp.
    # Erode by the whole feather so the ramp reaches 0 at the photo's edge: its own edge pixels (often a thin
    # dark line) must not show through.
    mask = cv2.erode(mask, np.ones((2 * feather + 1, 2 * feather + 1), np.uint8), borderType=cv2.BORDER_REPLICATE)
    k = feather * 2 + 1
    mask = cv2.GaussianBlur(mask, (k, k), feather / 3, borderType=cv2.BORDER_REPLICATE)[..., None]
    result = (placed * mask + fill * (1 - mask)).round().clip(0, 255).astype(np.uint8)
    if ch > cw and w < cw:
        # Phone: drop the generated side strips (10 px kept each side). Phones are taller than 9:16
        # (390x844 is about 0.46), so the narrower picture fits them better too.
        x0 = max(0, round(x + M[0, 2] - meta['box'][0]) - 10)
        result = result[:, x0:min(cw, x0 + w + 20)]
    print('wrote', out, save(result, out, width), '- check the seam at full size beside the original')
    return result


def ultra(meta_path, wide_path, out, width, aspect=21 / 9):
    """Stretch the generated plain side of the 16:9 result to 21:9; the photo keeps its pixels."""
    meta = json.load(open(meta_path))
    x, _, w, _ = meta['box']
    img = load(wide_path)
    H, W = img.shape[:2]
    s = W / meta['size'][0]
    nw = round(H * aspect)
    if x > 0:  # plain part on the left
        cut = round(x * s * 0.9)  # keep a margin of fill next to the seam unstretched
        plain = cv2.resize(img[:, :cut], (nw - (W - cut), H), interpolation=cv2.INTER_CUBIC)
        res = np.concatenate([plain, img[:, cut:]], axis=1)
    else:  # plain part on the right
        cut = round((x + w) * s + (W - (x + w) * s) * 0.1)
        plain = cv2.resize(img[:, cut:], (nw - cut, H), interpolation=cv2.INTER_CUBIC)
        res = np.concatenate([img[:, :cut], plain], axis=1)
    print('wrote', out, save(res, out, width))


def selftest():
    import tempfile
    rng = np.random.default_rng(1)
    photo = np.full((400, 300, 3), 200, np.uint8)
    photo[100:300, 80:220] = rng.integers(0, 255, (200, 140, 3), dtype=np.uint8)  # textured "product"
    d = tempfile.mkdtemp()
    src = os.path.join(d, 'p.png')
    Image.fromarray(photo).save(src)
    pad(src, d, {'wide': 'right', 'tall': 'top'}, 0.1)
    meta = json.load(open(os.path.join(d, 'canvas-wide.json')))
    cw, ch = meta['size']
    assert abs(cw / ch - 16 / 9) < 0.01 and meta['box'][0] == cw - 300, meta
    canvas = load(meta['canvas'])
    fill = np.roll(canvas, 3, axis=1)  # a model that nudged the photo 3 px
    fill[:, :3] = 90
    Image.fromarray(fill).save(os.path.join(d, 'fill.png'))
    res = paste(os.path.join(d, 'canvas-wide.json'), os.path.join(d, 'fill.png'), os.path.join(d, 'o.png'), None, 20)
    x = cw - 300 + 3
    inner = res[120:280, x + 100:x + 200].astype(int) - photo[120:280, 100:200]
    assert np.abs(inner).mean() < 3, np.abs(inner).mean()  # the product is the original's pixels
    meta_t = json.load(open(os.path.join(d, 'canvas-tall.json')))
    assert meta_t['box'] == [30, 0, 240, 320] and abs(meta_t['size'][0] / meta_t['size'][1] - 9 / 16) < 0.01, meta_t
    ultra(os.path.join(d, 'canvas-wide.json'), os.path.join(d, 'o.png'), os.path.join(d, 'u.png'), None)
    u = load(os.path.join(d, 'u.png'))
    assert abs(u.shape[1] / u.shape[0] - 21 / 9) < 0.01 and (u[:, -200:] == res[:, -200:]).all()
    print('selftest ok')


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('pad')
    p.add_argument('src'); p.add_argument('out_dir')
    p.add_argument('--wide-at', default='right', choices=['left', 'right', 'top', 'bottom', 'centre'])
    p.add_argument('--tall-at', default='top', choices=['left', 'right', 'top', 'bottom', 'centre'])
    p.add_argument('--strip', type=float, default=180 / 2160, help='phone canvas side strip, share of width')
    p = sub.add_parser('paste')
    p.add_argument('meta'); p.add_argument('fill'); p.add_argument('out')
    p.add_argument('--width', type=int); p.add_argument('--feather', type=int, default=90)
    p = sub.add_parser('ultra')
    p.add_argument('meta'); p.add_argument('wide'); p.add_argument('out'); p.add_argument('--width', type=int)
    sub.add_parser('selftest')
    a = ap.parse_args()
    if a.cmd == 'pad':
        pad(a.src, a.out_dir, {'wide': a.wide_at, 'tall': a.tall_at}, a.strip)
    elif a.cmd == 'paste':
        paste(a.meta, a.fill, a.out, a.width, a.feather)
    elif a.cmd == 'ultra':
        ultra(a.meta, a.wide, a.out, a.width)
    else:
        selftest()
