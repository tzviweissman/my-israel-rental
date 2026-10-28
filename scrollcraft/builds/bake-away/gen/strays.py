"""Drops every piece of a cut-out except the doughnut itself (run with the backend venv python: it has numpy and opencv).
python gen/strays.py assets/dn-*.webp"""
import sys
import numpy as np, cv2
from PIL import Image
for f in sys.argv[1:]:
    im = np.array(Image.open(f).convert('RGBA')); a = im[..., 3]
    n, lab, st, _ = cv2.connectedComponentsWithStats((a > 40).astype(np.uint8), connectivity=8)
    if n <= 2: continue
    keep = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])); drop = (lab != keep) & (lab != 0)
    print(f, 'dropped', int(drop.sum()), 'px in', n - 2, 'pieces'); a[drop] = 0
    im[..., 3] = a; Image.fromarray(im).save(f, 'WEBP', quality=90, method=6)
