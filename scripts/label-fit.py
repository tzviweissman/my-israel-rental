"""Lay a business's real label onto the product a generated clip drew, frame by frame (A28.2).
The label is warped onto the corners of the clip's own label (so it covers it whole, at its angle), then takes that
label's light: its shading, its warm tint, its softness, and some of the shine on top. A flat label pasted into a fixed
or hand-tracked box looked stuck on, and the drawn label showed out from under it (American Crust, Tzvi 23 Nov 2026).
The clip's own label is found by colour: a whole, filled, label-shaped patch of the label's main colour, so the still
the clip starts from shows a plain panel in that colour where the label goes (A28.3).
Usage: backend/.venv/Scripts/python scripts/label-fit.py <clip.mp4> <out frame folder> <label.png> [hue_lo hue_hi]
  (hue in OpenCV's 0-180 scale; default 16 30, a golden yellow). Prints how many frames found it; the rest are
  filled in from their neighbours, so check a contact sheet of the frames the ad uses."""
import sys, os, shutil, subprocess, cv2, numpy as np

src, dst, lab_path = sys.argv[1], sys.argv[2], sys.argv[3]
H_LO, H_HI = (int(sys.argv[4]), int(sys.argv[5])) if len(sys.argv) > 5 else (16, 30)
os.makedirs(dst, exist_ok=True)
tmp = dst + '_raw'
os.makedirs(tmp, exist_ok=True)
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', src, '-vf', 'fps=30,scale=1080:1920', f'{tmp}/%04d.jpg'], check=True)
label = cv2.imread(lab_path)
lh, lw = label.shape[:2]
names = sorted(os.listdir(tmp))

def quad(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    m = cv2.inRange(hsv, (H_LO, 170, 170), (H_HI, 255, 255))
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

imgs = [cv2.imread(f'{tmp}/{n}') for n in names]
grays = [cv2.cvtColor(im, cv2.COLOR_BGR2GRAY) for im in imgs]
qs = [quad(im) for im in imgs]
idx = [i for i, q in enumerate(qs) if q is not None]
if not idx:
    sys.exit('no label found in ' + src)
# The label is found by colour in ONE frame only, then carried along with the pack's own surface by tracking points on
# the pack (optical flow). Finding it afresh in every frame made it slide and wobble on the pack: the colour patch
# changes shape with hands, steam and shine (Tzvi 23 Nov 2026: "the sticker is still moving around").
med = np.median(np.array([qs[i] for i in idx]), 0)
ref = min(idx, key=lambda i: np.abs(qs[i] - med).sum())   # the most typical sighting
Q0 = qs[ref]

def region(q, img_shape):
    c = q.mean(0); big = c + (q - c) * np.float32([1.5, 2.2])   # the pack around the label
    m = np.zeros(img_shape, np.uint8); cv2.fillConvexPoly(m, big.astype(np.int32), 255)
    return m

LK = dict(winSize=(21, 21), maxLevel=3, criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, 0.01))
track = [None] * len(names); track[ref] = Q0.copy()
for step in (1, -1):
    H = np.eye(3)                      # ref -> current frame
    i = ref
    p = cv2.goodFeaturesToTrack(grays[ref], 400, 0.01, 6, mask=region(Q0, grays[ref].shape))
    p0 = p.copy()                      # the same points in the ref frame
    while 0 <= i + step < len(names):
        j = i + step
        p1, st, _ = cv2.calcOpticalFlowPyrLK(grays[i], grays[j], p, None, **LK)
        pb, st2, _ = cv2.calcOpticalFlowPyrLK(grays[j], grays[i], p1, None, **LK)
        ok = (st.ravel() == 1) & (st2.ravel() == 1) & (np.linalg.norm((pb - p).reshape(-1, 2), axis=1) < 1.0)
        if ok.sum() >= 12:
            Hn, inl = cv2.findHomography(p0[ok], p1[ok], cv2.RANSAC, 2.0)
            if Hn is not None:
                H = Hn
                keep = np.where(ok)[0][inl.ravel() == 1]
                p, p0 = p1[keep], p0[keep]
            else:
                p, p0 = p1[ok], p0[ok]
        track[j] = cv2.perspectiveTransform(Q0[None], H)[0]
        if len(p) < 60:                # running short: new points on the pack, mapped back to the ref frame
            n = cv2.goodFeaturesToTrack(grays[j], 400, 0.01, 6, mask=region(track[j], grays[j].shape))
            if n is not None:
                p = np.concatenate([p, n]); p0 = np.concatenate([p0, cv2.perspectiveTransform(n, np.linalg.inv(H))])
        i = j
full = np.array(track, np.float64)
drift = np.mean([np.abs(full[i] - qs[i]).mean() for i in idx])
# only a gentle smoothing on top, for sub-pixel shimmer
k = np.exp(-0.5 * (np.arange(-4, 5) / 1.5) ** 2); k /= k.sum()
pad = np.concatenate([full[:1].repeat(4, 0), full, full[-1:].repeat(4, 0)])
sm = np.array([np.tensordot(k, pad[i:i + 9], 1) for i in range(len(full))], np.float32)

for i, n in enumerate(names):
    img = imgs[i]
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
shutil.rmtree(tmp)
print(dst, len(names), 'frames, found by colour in', len(idx), '; tracked from frame', ref + 1,
      f'; tracked vs colour corners differ by {drift:.1f}px on average')
