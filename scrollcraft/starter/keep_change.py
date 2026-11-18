"""Keeps an image edit only where it was asked to change something (page rules 3aa.17; Tzvi, 18 Nov 2026, Burnt:
an edit adding the iron also redrew the walnut and the board by about 6 levels in 255 everywhere, which a clip
shows as the whole scene shimmering). The untouched still stays everywhere else, so the stills of one scene share
every other pixel and a clip between them cannot drift.

    python keep_change.py <untouched.png> <edited.png> <out.png> --box x0 y0 x1 y1
    python keep_change.py <untouched.png> <edited.png> <out.png> --changed [--box x0 y0 x1 y1] [--min 4000]

--box: keep the edit inside this box (pixels of the untouched still), its edge feathered.
--changed: keep only the areas that really changed (more than 38 levels), each at least --min pixels, holes closed
           (a lit edge of steel or a soft shadow stays whole); inside --box when one is given.
The edit is resized to the untouched still first. Check the result beside both before any clip."""
import sys

import cv2
import numpy as np
from PIL import Image


def keep(base, edit, box=None, changed=False, min_area=4000):
    base = np.asarray(base.convert('RGB')).astype(float)
    edit = np.asarray(edit.convert('RGB').resize((base.shape[1], base.shape[0]), Image.LANCZOS)).astype(float)
    H, W = base.shape[:2]
    x0, y0, x1, y1 = box or (0, 0, W, H)
    m = np.zeros((H, W), np.uint8)
    if changed:
        m[y0:y1, x0:x1] = np.abs(edit - base).max(2)[y0:y1, x0:x1] > 38
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21)))
        n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
        m = np.isin(lab, [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= min_area]).astype(np.uint8)
        soft = cv2.GaussianBlur(m.astype(float), (0, 0), 2)
    else:
        m[y0:y1, x0:x1] = 1
        soft = cv2.GaussianBlur(m.astype(float), (0, 0), 18)
    out = base * (1 - soft[..., None]) + edit * soft[..., None]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def _selftest():
    rng = np.random.default_rng(1)
    base = Image.fromarray((rng.random((200, 300, 3)) * 60 + 100).astype(np.uint8))
    e = np.asarray(base).astype(int) + rng.integers(-6, 7, (200, 300, 3))   # the edit's drift everywhere
    e[50:120, 80:160] = 20                                                   # and the one asked-for change
    edit = Image.fromarray(np.clip(e, 0, 255).astype(np.uint8))
    out = np.asarray(keep(base, edit, changed=True, min_area=500)).astype(int)
    b = np.asarray(base).astype(int)
    assert np.abs(out[150:, 200:] - b[150:, 200:]).max() == 0, 'drift kept away from the change'
    assert np.abs(out[60:110, 90:150] - 20).max() <= 1, 'the asked change lost'
    print('keep_change self-test passed')


if __name__ == '__main__':
    a = sys.argv[1:]
    if a == ['--test']:
        _selftest(); sys.exit()
    box = tuple(map(int, a[a.index('--box') + 1:a.index('--box') + 5])) if '--box' in a else None
    min_area = int(a[a.index('--min') + 1]) if '--min' in a else 4000
    keep(Image.open(a[0]), Image.open(a[1]), box, '--changed' in a, min_area).save(a[2])
    print('saved', a[2])
