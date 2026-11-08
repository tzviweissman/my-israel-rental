"""The guitar behind the strings, from one generated still (gen/guitar/wide2-0.png, gen/guitar-brief.md):
1. the generator painted five strings of its own, and the page draws six that ring, so its strings are taken out by
   filling each one from the rows just above and below it (the grain runs along them);
2. the orange is brought back to the honey top of his flyer's guitar;
3. the tall picture is the same guitar extended with its own wood above and below, never zoomed past the soundhole.
Run from the build folder: python gen/guitar.py"""
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

src = np.asarray(Image.open('gen/guitar/wide2-0.png').convert('RGB')).astype(float)
H, W, _ = src.shape
lum = src.mean(axis=2)

# find the strings in the soundhole, where they are the only bright thing, then follow each one across the picture
col = int(W * .66)
hole = lum[:, col - 40:col + 40].mean(axis=1)
rows = [y for y in range(int(H * .15), int(H * .85)) if hole[y] > 70 and hole[y] >= hole[y - 3:y + 4].max()]
starts = []
for y in rows:
    if not starts or y - starts[-1] > 12:
        starts.append(y)
print('strings found at', starts, 'of', H)

out = src.copy()
xs = range(int(W * .5), int(W * .78), 8)
for y0, R in zip(starts, (18, 16, 12, 12, 12)):
    # each string is a straight line: fitted where it crosses the soundhole, then filled the whole way across
    ys = [y0 - 8 + int(np.argmax(lum[y0 - 8:y0 + 9, x])) for x in xs]
    slope, at0 = np.polyfit(list(xs), ys, 1)
    print(y0, 'slope', round(float(slope), 5))
    for x in range(W):
        yi = int(round(at0 + slope * x))
        p, q = out[yi - R, x].copy(), out[yi + R, x].copy()
        for k in range(-R + 1, R):
            t = (k + R) / (2 * R)
            out[yi + k, x] = p * (1 - t) + q * t

# the rings round the soundhole are the same all the way round: where a filled band crossed them, copy from the clean
# bottom of the circle at the same distance from the centre
cx, cy, hole_r = 1344, 554, 434  # measured on this picture
top_band, bottom_band = min(starts) - 22, max(starts) + 16
for y in range(top_band, bottom_band):
    for x in range(int(cx), W):
        r = np.hypot(x - cx, y - cy)
        if hole_r - 6 < r < 552:
            ang = np.radians(50) + (y - cy) / r * np.radians(20)
            sx, sy = cx + r * np.cos(ang), cy + r * np.sin(ang)
            if 0 <= int(sy) < H and 0 <= int(sx) < W:
                w = min(1, (y - top_band) / 14, (bottom_band - 1 - y) / 14)  # fades in, so no edge shows
                out[y, x] = out[y, x] * (1 - w) + src[int(sy), int(sx)] * w

# the neck has frets and dots, like the one in his flyer; the generator left it plain
NECK_END = int(cx - hole_r * 1.0)
x = NECK_END - 8
gap = 118.0
frets = []
while x > -5:
    frets.append(x)
    x -= int(gap)
    gap *= 1.06
for fx in frets:
    y1, y2 = int(336 - .0097 * fx), int(758 - .006 * fx)
    if 0 <= fx - 4 and fx + 5 < W:
        out[y1:y2, fx - 4:fx - 1] *= .55
        out[y1:y2, fx - 1:fx + 3] = [205, 200, 188]
        out[y1:y2, fx:fx + 1] = [245, 242, 232]
yy, xx = np.ogrid[:H, :W]
for k in (1, 3, 5):
    if k < len(frets):
        dx = (frets[k] + frets[k - 1]) // 2
        dy = int((336 + 758) / 2 - .008 * dx)
        out[(xx - dx) ** 2 + (yy - dy) ** 2 < 14 ** 2] = [232, 226, 212]

img = Image.fromarray(out.clip(0, 255).astype('uint8'))
# the flyer's top is honey, not orange: less colour, a little lighter
img = ImageEnhance.Color(img).enhance(.66)
img = ImageEnhance.Brightness(img).enhance(1.04)
img.save('assets/guitar-wide.webp', quality=80, method=6)

# tall: 1080 x 1920, the guitar at the height it has above the phone's card, its own wood above and below it
TW, TH, GH, TOP = 1080, 1920, 1046, 155
g = img.resize((round(W * GH / H), GH), Image.LANCZOS)
left = round(g.width * .66) - TW // 2
g = g.crop((left, 0, left + TW, GH))
# clean wood from the lower left of the wide picture, below the neck, mirrored to reach across
strip_h = 260
wood = img.crop((0, int(H * .72), int(W * .40), H)).resize((TW // 2, strip_h), Image.LANCZOS)
row = Image.new('RGB', (TW, strip_h))
row.paste(wood, (0, 0))
row.paste(wood.transpose(Image.FLIP_LEFT_RIGHT), (TW // 2, 0))
# the extra wood takes the picture's own colour, so no band shows at the join
ratio = np.asarray(g.crop((0, GH - 40, TW, GH))).mean(axis=(0, 1)) / np.asarray(row).mean(axis=(0, 1))
row = Image.fromarray((np.asarray(row) * ratio).clip(0, 255).astype('uint8')).filter(ImageFilter.GaussianBlur(5))  # plain under the card: the guitar is what is seen
t = Image.new('RGB', (TW, TH))
y = 0
while y < TH:
    t.paste(row if (y // strip_h) % 2 else row.transpose(Image.FLIP_TOP_BOTTOM), (0, y))
    y += strip_h
# soft joins so no line shows where the picture meets the extra wood
mask = Image.new('L', (TW, GH), 255)
m = np.asarray(mask).astype(float)
fade = 30
for i in range(fade):
    m[i, :] = m[-1 - i, :] = 255 * i / fade
t.paste(g, (0, TOP), Image.fromarray(m.astype('uint8')))
t.save('assets/guitar-tall.webp', quality=78, method=6)
print('wrote', W, H, 'and', TW, TH)
