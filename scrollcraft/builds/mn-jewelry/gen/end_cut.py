"""The opening's closing scene: "Quality. Sparkle. Comfort." in giant type with the ring crossing the letters (the "Reveal
radiance" site Tzvi sent, 9 Nov 2026). The ring in front is cut, with the shop's own cut-out model, from the film's own last
frame, so it sits exactly over the still film: assets/film/ring-d.webp and ring-m.webp, see-through around the ring.

    backend venv python gen/end_cut.py   (after gen/film.sh)
"""
import os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, cv2
from PIL import Image
from studio import alpha_of

for k, clip in (('d', 'assets/film/opening-d.mp4'), ('m', 'assets/film/opening-m.mp4')):
    png = f'gen/film/last-{k}.png'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-sseof', '-0.1', '-i', clip, '-frames:v', '1', '-update', '1', png], check=True)
    rgb = np.asarray(Image.open(png).convert('RGB'))
    a = alpha_of(rgb)
    n, lab, stats, _ = cv2.connectedComponentsWithStats((a > 0.5).astype(np.uint8))
    if n > 1:   # the ring only: the largest piece
        big = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA])); a[(lab != big) & (lab > 0)] = 0
    a = cv2.GaussianBlur(a.astype(np.float32), (0, 0), 1.2)
    Image.fromarray(np.dstack([rgb, (a * 255).clip(0, 255)]).astype(np.uint8), 'RGBA').save(f'assets/film/ring-{k}.webp', quality=88)
    print(k, rgb.shape)
