"""The steep's after still (gen/journey-brief.md, Key moment): their steep still hours later, made in code from it so the
jar is the same jar. The falling grounds above are replaced by the wall beside them; the water becomes even, deep
cold brew; only the glass's brightest glints are kept. Run from the build folder: python gen/steep_done.py"""
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

src = cv2.imread('gen/journey/steep-3.png'); H, W = src.shape[:2]; a = src.astype(float)


def soft(box, r, blur):
    m = Image.new('L', (W, H), 0); ImageDraw.Draw(m).rounded_rectangle(box, r, fill=255)
    return np.array(m.filter(ImageFilter.GaussianBlur(blur))).astype(float)[..., None] / 255


m = soft((880, 0, 1140, 360), 20, 22)
a = a * (1 - m) + np.roll(a, -300, axis=1) * m
lum = cv2.cvtColor(src, cv2.COLOR_BGR2GRAY).astype(float)[..., None] / 255
yy = np.linspace(0, 1, H)[:, None, None]
brew = np.concatenate([np.full((H, W, 1), 9.), np.full((H, W, 1), 20.), np.full((H, W, 1), 42.)], -1) * (1.3 - .4 * yy)
hi = np.clip((lum - .93) / .06, 0, 1) * .7
m2 = soft((846, 470, 1160, 1078), 26, 8)
a = a * (1 - m2) + (brew * (1 - hi) + src.astype(float) * hi) * m2
out = a.clip(0, 255).astype(np.uint8)
cv2.imwrite('gen/journey/steep-done.png', out)
cv2.imwrite('gen/journey/check-steep.jpg', cv2.resize(np.concatenate([src, out], 1), (1600, 450)))
