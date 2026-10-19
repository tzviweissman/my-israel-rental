# Cut the poppers bowl out of his photo (blue cloth behind) with GrabCut seeded by colour.
import sys, numpy as np, cv2
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
bgr = cv2.imread(src); h, w = bgr.shape[:2]
hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
H, S, V = hsv[..., 0].astype(int), hsv[..., 1].astype(int), hsv[..., 2].astype(int)
blue = (H > 95) & (H < 135) & (S > 180)
dark = (V < 30)
mask = np.full((h, w), cv2.GC_PR_FGD, np.uint8)
mask[blue | dark] = cv2.GC_PR_BGD
mask[blue & (S > 215)] = cv2.GC_BGD
food = ((H < 25) | (H > 170)) & (S > 120) & (V > 90)
mask[food] = cv2.GC_FGD
body = np.zeros((h, w), np.uint8); cv2.fillPoly(body, [np.array([[60,560],[1520,560],[1330,1180],[1150,1270],[500,1275],[300,1180]], np.int32)], 1); mask[(body == 1) & (S < 150)] = cv2.GC_FGD
mask[:6, :] = cv2.GC_BGD; mask[-6:, :] = cv2.GC_BGD; mask[:, :6] = cv2.GC_BGD; mask[:, -6:] = cv2.GC_BGD
bg, fg = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
cv2.grabCut(bgr, mask, None, bg, fg, 6, cv2.GC_INIT_WITH_MASK)
m = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
m = np.where(lab == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])), 255, 0).astype(np.uint8)
ff = m.copy(); mm = np.zeros((h + 2, w + 2), np.uint8); cv2.floodFill(ff, mm, (0, 0), 128); m[ff != 128] = 255
m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
m = cv2.GaussianBlur(cv2.erode(m, np.ones((3, 3), np.uint8)), (5, 5), 0)
rgba = np.dstack([cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB), m])
ys, xs = np.where(m > 10); rgba = rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
Image.fromarray(rgba).save(dst, quality=90)
# preview on black and on red
p = Image.fromarray(rgba); 
for c, n2 in [((14, 13, 12), 'k'), ((239, 43, 43), 'r')]:
    b = Image.new('RGB', p.size, c); b.paste(p, (0, 0), p); b.save(dst.replace('.webp', f'-on-{n2}.jpg'), quality=80)
print(p.size)
