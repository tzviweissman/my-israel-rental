"""Lay the real label onto the pack the clip already drew, frame by frame.
The label is warped onto the corners of the clip's own yellow label (so it covers it whole, at its angle),
then takes that label's light: its shading, its warm tint, its softness, and some of the plastic's shine.
Usage: python label_fit.py out/d6.mp4 d6   (writes d6/0001.jpg ...)"""
import sys, os, subprocess, cv2, numpy as np

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
tmp = dst + '_raw'
os.makedirs(tmp, exist_ok=True)
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', src, '-vf', 'fps=30,scale=1080:1920', f'{tmp}/%04d.jpg'], check=True)
label = cv2.imread(os.path.join(os.path.dirname(__file__) or '.', 'label.png'))
lh, lw = label.shape[:2]
names = sorted(os.listdir(tmp))

def quad(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    m = cv2.inRange(hsv, (16, 170, 170), (30, 255, 255))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best = None
    for c in cs:
        x, y, w, h = cv2.boundingRect(c)
        a = cv2.contourArea(c)
        if w < 120 or h < 50 or not (1.3 < w / h < 3.6) or a < 0.6 * w * h:
            continue                       # only a whole, filled, label-shaped patch
        if best is None or a > cv2.contourArea(best):
            best = c
    if best is None:
        return None
    r = cv2.boxPoints(cv2.minAreaRect(best))
    s = r.sum(1); d = np.diff(r, axis=1).ravel()
    return np.float32([r[np.argmin(s)], r[np.argmin(d)], r[np.argmax(s)], r[np.argmax(d)]])  # tl tr br bl

qs = [quad(cv2.imread(f'{tmp}/{n}')) for n in names]
# fill misses from neighbours, then smooth each corner over 7 frames so it never jitters
idx = [i for i, q in enumerate(qs) if q is not None]
if not idx:
    sys.exit('no label found in ' + src)
arr = np.array([qs[i] for i in idx])
full = np.stack([np.stack([np.interp(range(len(qs)), idx, arr[:, k, j]) for j in range(2)], 1) for k in range(4)], 1)
sm = np.array([np.median(full[max(0, i - 3):i + 4], 0) for i in range(len(full))], np.float32)

for i, n in enumerate(names):
    img = cv2.imread(f'{tmp}/{n}')
    q = sm[i]
    c = q.mean(0); q = c + (q - c) * 1.06          # a touch larger so none of the drawn label shows
    H = cv2.getPerspectiveTransform(np.float32([[0, 0], [lw, 0], [lw, lh], [0, lh]]), q)
    warp = cv2.warpPerspective(label, H, (1080, 1920), flags=cv2.INTER_AREA)
    mask = cv2.warpPerspective(np.full((lh, lw), 255, np.uint8), H, (1080, 1920))
    mask = cv2.GaussianBlur(mask, (5, 5), 0).astype(np.float32)[..., None] / 255
    # the scene's light on the label: the drawn label's brightness, relative to its own mean, as shading
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    inside = mask[..., 0] > 0.5
    shade = cv2.GaussianBlur(g, (0, 0), 18) / max(1, g[inside].mean())
    shade = np.clip(0.75 + 0.25 * shade, 0.7, 1.15)[..., None]
    tint = np.array([0.88, 0.95, 1.0], np.float32)  # warm lamp light (BGR)
    lab = warp.astype(np.float32) * shade * tint * 0.92
    soft = 1.0 if (q[1][0] - q[0][0]) > 260 else 0.8
    lab = cv2.GaussianBlur(lab, (0, 0), soft)
    # keep some of the plastic's highlights over the label
    hi = np.clip((img.astype(np.float32) - 200) * 1.5, 0, 255) * 0.35
    out = img.astype(np.float32) * (1 - mask) + (lab + hi) * mask
    cv2.imwrite(f'{dst}/{n}', np.clip(out, 0, 255).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 92])
print(dst, len(names), 'frames,', len(idx), 'found')
