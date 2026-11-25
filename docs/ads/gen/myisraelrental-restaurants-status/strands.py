"""The weave (A11.2): which parts of the pasta lie in front of "5,000+". Free, code only, from fit's front.png.
    backend/.venv/Scripts/python docs/ads/gen/myisraelrental-restaurants-status/strands.py
The nest (x from 500) sits in front of the zeros, as if the fork were stuck in them; the loose strands lie in front
of the "5" (x under 230) and pass behind the comma and the first zero (230 to 500), so they read as threaded through."""
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
im = Image.open(HERE / "front.png").convert("RGBA")
a = np.asarray(im).copy()
x = np.arange(a.shape[1])
# a soft 14px seam at each edge of the hidden band, so no strand ends in a hard vertical cut
keep = np.clip(np.maximum((222 - x) / 14, (x - 486) / 14), 0, 1)
a[..., 3] = (a[..., 3] * keep[None, :]).astype(np.uint8)
Image.fromarray(a).save(HERE / "strands.png", optimize=True)
print("strands.png: in front at x<222 and x>=500, soft seams")
