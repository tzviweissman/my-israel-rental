"""Measure a hand-made moving ad before anyone sees it (ad rules A10.2 to A10.5, Tzvi 16 Nov 2026).

    backend/.venv/Scripts/python scripts/check-moving-ad.py <ad.mp4> [<ad.mp4> ...]

Why: check-ad-designs measures the ad maker's own videos, but a hand-made one (L.A. Cholent's, 16 Nov 2026) was
timed by hand, and its first cut held still for 0.8 seconds against the 1.5 the rules ask. This reads every frame
and fails a video that is not H.264 at 1080 wide, runs outside 5 to 10 seconds, opens on an empty ground, hardly
moves, holds still under 1.5 seconds at the end, or whose QR code is not found, does not open a link, or is still
for 3 seconds or less."""
import subprocess
import sys

import cv2
import numpy as np


def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height",
                          "-of", "csv=p=0", path], capture_output=True, text=True, check=True).stdout.strip().split(",")
    return out[0], int(out[1]), int(out[2])


def frames(path):
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    out = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        out.append(f)
    return out, fps


def worst_square(a, b, k=30):
    """The biggest mean difference in any k x k square: a wisp of steam or a small QR barely moves the whole mean."""
    d = np.abs(a.astype(np.int16) - b.astype(np.int16)).mean(axis=2)
    h, w = (d.shape[0] // k) * k, (d.shape[1] // k) * k
    return d[:h, :w].reshape(h // k, k, w // k, k).mean(axis=(1, 3)).max()


def still_run(fs, box=None, tol=3.0):
    """How many frames at the end look the same as the last one (the whole frame, or one box of it)."""
    x0, y0, x1, y1 = box or (0, 0, fs[0].shape[1], fs[0].shape[0])
    last = fs[-1][y0:y1, x0:x1]
    n = 0
    for f in reversed(fs):
        if worst_square(f[y0:y1, x0:x1], last) > tol:
            break
        n += 1
    return n


def check(path):
    bad = []
    codec, w, h = probe(path)
    if codec != "h264" or w != 1080:
        bad.append(f"{codec} {w}x{h}, not H.264 1080 wide (A10.4)")
    fs, fps = frames(path)
    dur = len(fs) / fps
    if not 5 <= dur <= 10:
        bad.append(f"{dur:.1f} seconds, not about 6 (A10.4)")
    first = fs[0].astype(np.int16)
    busy = (np.abs(first - first[0, 0]).sum(axis=2) > 30).mean()
    if busy < 0.04:
        bad.append(f"the first frame is an empty ground ({busy:.0%} has anything on it, A10.2)")
    moved = np.abs(fs[len(fs) // 3].astype(np.int16) - fs[-1].astype(np.int16)).mean()
    if moved < 0.4:
        bad.append(f"it hardly moves ({moved:.2f})")
    hold = still_run(fs) / fps
    if hold < 1.5:
        bad.append(f"holds still {hold:.1f} seconds at the end, under 1.5 (A10.3)")
    link, pts, _ = cv2.QRCodeDetector().detectAndDecode(fs[-1])
    qr = "none"
    if pts is None or not link:
        bad.append("no QR code read on the last frame (A10.1)")
    else:
        p = pts.reshape(-1, 2)
        box = (int(p[:, 0].min()) - 4, int(p[:, 1].min()) - 4, int(p[:, 0].max()) + 4, int(p[:, 1].max()) + 4)
        qhold = still_run(fs, box) / fps
        qr = f"{link} still {qhold:.1f}s"
        if not link.startswith("https://"):
            bad.append(f"the QR code reads {link!r}, not a link")
        if qhold <= 3:
            bad.append(f"the QR code is still for {qhold:.1f} seconds, not over 3 (A10.3)")
    print(f"{path}: {w}x{h} {codec}, {dur:.1f}s, holds {hold:.1f}s, QR {qr}")
    for b in bad:
        print(f"  FAIL {b}")
    return not bad


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    ok = all([check(p) for p in sys.argv[1:]])
    sys.exit(0 if ok else 1)
