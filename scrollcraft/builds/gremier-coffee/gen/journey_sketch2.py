"""Rough sketch of Tzvi's "you are the coffee" film (12 Nov 2026): grind, the grounds drop into waves of cold water and
turn them brown, a whirlpool, out of the tap into the glass, the camera pulls back to their coffee bar photo.
Each scene as a laptop frame beside a phone frame (rules 3aa.13). Run from the build folder."""
import math
from PIL import Image, ImageDraw, ImageFont

from pour_sketch import CREAM, BREW, BREW2, INK, ICE, MILK, big, small, grinder

WATER, TERRA = (196, 222, 230), (205, 120, 80)


def waves(d, w, h, top, colour, amp, n=4):
    for k in range(n):
        y0 = top + k * (h - top) / n
        pts = [(x, y0 + amp * math.sin(x / 55 + k)) for x in range(0, w + 10, 10)] + [(w, h), (0, h)]
        shade = tuple(int(c * (1 - 0.08 * k)) for c in colour)
        d.polygon(pts, fill=shade)


def scene(n, w, h):
    im = Image.new('RGB', (w, h), CREAM); d = ImageDraw.Draw(im)
    phone = h > w
    s = w / 800 if not phone else w / 380
    cx, mid = w // 2, h // 2
    if n == 1:   # Grind: the grinder taken apart in the air inside COLD; the grounds fall out of the bottom
        word = Image.new('RGBA', im.size, (0, 0, 0, 0)); wd = ImageDraw.Draw(word)
        big(wd, (cx, mid), 'COLD', 400, TERRA, fit=w * 0.94); im.paste(word, (0, 0), word)
        grinder(d, cx, mid - 150 * s, s)
        box = (int(cx + 36 * s), 0, int(cx + 64 * s), h); im.paste(word.crop(box), box[:2], word.crop(box))
        small(d, (24, h - 50), '1. Grind', int(22 * s))
    elif n == 2:  # Steep: we fall with the grounds into waves of cold water; where they land the waves turn brown
        big(d, (cx, mid * 0.62), 'STEEP', 400, TERRA, fit=w * 0.94)
        waves(d, w, h, mid, WATER, 14 * s)
        for k in range(14):
            x = cx + (k - 7) * 9 * s; d.ellipse((x - 3, mid - 120 * s + k * 7 * s, x + 3, mid - 114 * s + k * 7 * s), fill=BREW2)
        for r in range(5):
            d.ellipse((cx - (40 + 30 * r) * s, mid + 10 * s, cx + (40 + 30 * r) * s, mid + (40 + 12 * r) * s), outline=BREW2, width=int(6 * s))
        small(d, (24, h - 50), '2. The grounds turn the waves brown', int(20 * s))
    elif n == 3:  # Swirl: all brown now; the waves turn into a whirlpool
        im.paste(BREW, (0, 0, w, h)); d = ImageDraw.Draw(im)
        for r in range(1, 9):
            rr = r * 34 * s; d.arc((cx - rr, mid - rr * 0.45, cx + rr, mid + rr * 0.45), r * 30, r * 30 + 250, fill=BREW2 if r % 2 else (140, 70, 35), width=int(7 * s))
        big(d, (cx, h * 0.2), 'SWIRL', 400, CREAM, fit=w * 0.8)
        small(d, (24, h - 50), '3. A whirlpool', int(20 * s), CREAM)
    elif n == 4:  # Out: the whirlpool runs down through the tap and pours into the glass of ice
        d.rounded_rectangle((cx - 160 * s, -40, cx + 60 * s, mid - 30 * s), int(30 * s), fill=BREW, outline=INK, width=2)
        d.rectangle((cx + 52 * s, mid - 70 * s, cx + 80 * s, mid - 56 * s), fill=MILK, outline=INK)
        d.line((cx + 72 * s, mid - 56 * s, cx + 72 * s, mid + 70 * s), fill=BREW, width=int(9 * s))
        g = (cx + 22 * s, mid + 40 * s, cx + 122 * s, mid + 190 * s)
        d.polygon([(g[0], g[1]), (g[2], g[1]), (g[2] - 8 * s, g[3]), (g[0] + 8 * s, g[3])], fill=ICE, outline=INK, width=2)
        d.rectangle((g[0] + 10 * s, g[1] + 80 * s, g[2] - 12 * s, g[3] - 4 * s), fill=BREW)
        small(d, (24, h - 50), '4. Out of the tap, into the glass', int(20 * s))
    else:        # Serve: the camera pulls back to their own coffee bar photo
        photo = Image.open('assets/open-wide.webp').convert('RGB')
        if phone:
            photo.thumbnail((w, h)); im.paste(photo, (0, int(h * 0.5 - photo.height * 0.2)))
            big(d, (cx, h * 0.3), 'Stock your fridge.', 40, INK, fit=w * 0.9)
        else:
            im = photo.resize((w, h)); d = ImageDraw.Draw(im)
            d.rounded_rectangle((20, h - 190, 380, h - 80), 12, fill=CREAM); big(d, (40, h - 135), 'Stock your fridge.', 34, INK, anchor='lm')
        small(d, (24, h - 50), '5. Pull back: their coffee bar', int(20 * s))
    d.rectangle((0, 0, w - 1, 30 * (w / 800)), fill=(240, 230, 216)); small(d, (12, 6 * (w / 800)), 'Gremier Coffee Co.', int(14 * (w / 800)))
    return im


rows = []
for n in (1, 2, 3, 4, 5):
    row = Image.new('RGB', (800 + 253 + 30, 470), (255, 255, 255))
    row.paste(scene(n, 800, 450), (10, 10)); row.paste(scene(n, 253, 450), (820, 10))
    rows.append(row)
sheet = Image.new('RGB', (rows[0].width, 470 * len(rows)), (255, 255, 255))
for i, r in enumerate(rows): sheet.paste(r, (0, i * 470))
sheet.save('gen/journey-sketch-2.png')
print('gen/journey-sketch-2.png')
