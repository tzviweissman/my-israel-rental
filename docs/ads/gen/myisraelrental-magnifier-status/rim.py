"""The glass rim in front of the headline (A11.2, take 3): the blue rim's pixels from ground.jpg, above the line
the headline ends on, as rim.png with alpha, laid over the words in ad.html. Free, code only.
    backend/.venv/Scripts/python docs/ads/gen/myisraelrental-magnifier-status/rim.py"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
im = np.asarray(Image.open(HERE / "ground.jpg").convert("RGB")).astype(float)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
blue = (b > 120) & (b - r > 70) & (b - g > 25)          # the saturated rim blue, not the pale sky
blue[760:] = False
blue[:400] = False                                      # the sky above is blue too; the rim starts lower
a = Image.fromarray((blue * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
rgb = np.asarray(Image.open(HERE / "ground.jpg").convert("RGB")).copy()
rgb[np.asarray(a) == 0] = 0                            # clear pixels compress to nothing
out = Image.fromarray(rgb).convert("RGBA")
out.putalpha(a)
out.save(HERE / "rim.png", optimize=True)
ys, xs = np.nonzero(blue)
print("rim top", ys.min(), "x", xs.min(), "to", xs.max())
