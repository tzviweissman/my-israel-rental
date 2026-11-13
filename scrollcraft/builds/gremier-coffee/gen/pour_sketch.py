"""Rough sketch of Gremier's opening in the POUR / PLAY way (12 Nov 2026, docs/inspo/pinterest-coffee-2026-11-11),
for Tzvi to approve before any paid still or clip. Each scene as the visitor sees it: a laptop frame beside a phone
frame. Run from the build folder: python gen/pour_sketch.py -> gen/pour-sketch.png"""
from PIL import Image, ImageDraw, ImageFont

CREAM, SAND, BREW, BREW2, INK, ICE, MILK = (246, 238, 227), (236, 223, 204), (59, 10, 2), (107, 42, 20), (28, 20, 16), (214, 228, 234), (250, 247, 240)
F = 'C:/Windows/Fonts/'
def font(name, size):
    try: return ImageFont.truetype(F + name, size)
    except OSError: return ImageFont.load_default()


def big(d, xy, text, size, fill, anchor='mm', fit=None):
    f = font('georgiab.ttf', size)
    while fit and d.textlength(text, font=f) > fit and size > 10:
        size -= 4; f = font('georgiab.ttf', size)
    d.text(xy, text, font=f, fill=fill, anchor=anchor)


def small(d, xy, text, size=16, fill=INK, anchor='la'):
    d.text(xy, text, font=font('segoeuib.ttf', size), fill=fill, anchor=anchor)


def grinder(d, cx, top, s):
    """the grinder taken apart in the air: hopper with beans, burr ring, the two body halves apart, the spout"""
    d.polygon([(cx - 40 * s, top), (cx + 40 * s, top), (cx + 24 * s, top + 55 * s), (cx - 24 * s, top + 55 * s)], fill=ICE, outline=INK, width=2)
    for i in range(10): d.ellipse((cx - 28 * s + (i % 5) * 12 * s, top + 8 * s + (i // 5) * 14 * s, cx - 20 * s + (i % 5) * 12 * s, top + 16 * s + (i // 5) * 14 * s), fill=BREW2)
    d.ellipse((cx - 34 * s, top + 70 * s, cx + 34 * s, top + 84 * s), outline=INK, width=3)          # burr ring
    d.rounded_rectangle((cx - 62 * s, top + 95 * s, cx - 38 * s, top + 190 * s), 6, fill=(40, 40, 40))  # body half, left
    d.rounded_rectangle((cx + 38 * s, top + 95 * s, cx + 62 * s, top + 190 * s), 6, fill=(40, 40, 40))  # body half, right
    d.rounded_rectangle((cx - 16 * s, top + 100 * s, cx + 16 * s, top + 175 * s), 4, fill=(90, 90, 90))  # burrs
    for y in range(int(top + 180 * s), int(top + 260 * s), int(9 * s) or 1):                            # grounds falling
        d.line((cx - 3 * s, y, cx + 3 * s, y + 4 * s), fill=BREW2, width=max(2, int(3 * s)))


def jar(d, cx, top, s, fill):
    """their glass jar with water and ice (or cold brew), and its tap"""
    d.rounded_rectangle((cx - 60 * s, top, cx + 60 * s, top + 150 * s), int(30 * s), fill=fill, outline=INK, width=2)
    for i in range(4): d.rectangle((cx - 40 * s + i * 22 * s, top + 25 * s + (i % 2) * 20 * s, cx - 24 * s + i * 22 * s, top + 41 * s + (i % 2) * 20 * s), outline=MILK, width=2)
    d.rectangle((cx + 52 * s, top + 120 * s, cx + 72 * s, top + 130 * s), fill=MILK, outline=INK)
    return cx + 66 * s, top + 132 * s


def scene(n, w, h):
    im = Image.new('RGB', (w, h), CREAM); d = ImageDraw.Draw(im)
    phone = h > w
    s = w / 800 if not phone else w / 380
    cx, mid = w // 2, h // 2
    if n == 1:   # Grind: the grinder taken apart inside a huge word
        word = Image.new('RGBA', im.size, (0, 0, 0, 0)); wd = ImageDraw.Draw(word)
        big(wd, (cx, mid), 'COLD', 400, (205, 120, 80), fit=w * 0.94)
        im.paste(word, (0, 0), word)
        grinder(d, cx, mid - 150 * s, s)
        box = (int(cx + 36 * s), 0, int(cx + 64 * s), h)   # the word in front of the grinder's right half: they interlock
        im.paste(word.crop(box), box[:2], word.crop(box))
        small(d, (24, h - 60), 'Grind', int(24 * s))
    elif n == 2:  # Steep: grounds fall through a huge word into their jar; coffee clouds through the water
        big(d, (cx, mid - 40 * s), 'STEEP', 400, (205, 120, 80), fit=w * 0.94)
        for y in range(0, int(mid), int(10 * s)): d.line((cx - 3, y, cx + 3, y + 5), fill=BREW2, width=3)
        jar(d, cx, mid, s, ICE)
        for k in range(3): d.ellipse((cx - 40 * s + k * 20 * s, mid + 10 * s + k * 25 * s, cx + 10 * s + k * 20 * s, mid + 50 * s + k * 25 * s), fill=BREW2)
        small(d, (24, h - 60), 'Steep, hours not minutes', int(20 * s))
    elif n == 3:  # Pour: cold brew runs from the tap into a pool that rises across the screen as a wave
        tx, ty = jar(d, cx - 60 * s, mid - 200 * s, s, BREW)
        wave = h * 0.62
        d.line((tx, ty, tx, wave), fill=BREW, width=int(6 * s))
        pts = [(0, h)] + [(x, wave + 14 * s * ((x // 60) % 2 * 2 - 1)) for x in range(0, w + 60, 60)] + [(w, h)]
        d.polygon(pts, fill=BREW)
        big(d, (cx, wave + (h - wave) / 2), 'POUR', 400, CREAM, fit=w * 0.9)
    else:        # Shop: the wave clears to a glass of iced coffee with their bottles floating round it, ready to add
        big(d, (cx, 80 * s), 'Find your cold brew', 60, INK, fit=w * 0.9)
        d.rounded_rectangle((cx - 70 * s, 120 * s, cx + 70 * s, 160 * s), 10, fill=(0, 0, 0)); small(d, (cx, 140 * s), 'Shop cold brew', int(15 * s), CREAM, 'mm')
        g = (cx - 45 * s, mid - 20 * s, cx + 45 * s, mid + 160 * s)
        d.polygon([(g[0], g[1]), (g[2], g[1]), (g[2] - 8 * s, g[3]), (g[0] + 8 * s, g[3])], fill=BREW, outline=INK, width=2)
        d.line((cx - 30 * s, g[1] + 40 * s, cx + 20 * s, g[1] + 90 * s), fill=MILK, width=int(6 * s))
        spots = [(-260, -10), (-200, 150), (200, -10), (260, 150)] if not phone else [(-90, -60), (90, -60), (-90, 250), (90, 250)]
        for (dx, dy), pid in zip(spots, ['classic', 'house', 'colombia', 'vanilla-latte']):
            p = Image.open(f'assets/p/{pid}.webp').convert('RGB'); p.thumbnail((int((150 if w > h else 120) * s), int(100 * s)))
            x, y = int(cx + dx * s - p.width / 2), int(mid + dy * s - p.height / 2)
            d.rounded_rectangle((x - 6, y - 6, x + p.width + 6, y + p.height + 30), 10, fill=(255, 255, 255))
            im.paste(p, (x, y)); small(d, (x + 4, y + p.height + 4), '+ Add', 13)
    d.rectangle((0, 0, w - 1, 30 * (w / 800)), fill=(240, 230, 216)); small(d, (12, 6 * (w / 800)), 'Gremier Coffee Co.', int(14 * (w / 800)))
    return im


if __name__ == "__main__":
    rows = []
    for n in (1, 2, 3, 4):
        lap, ph = scene(n, 800, 450), scene(n, 253, 450)
        row = Image.new('RGB', (800 + 253 + 30, 450 + 20), (255, 255, 255))
        row.paste(lap, (10, 10)); row.paste(ph, (820, 10))
        rows.append(row)
    sheet = Image.new('RGB', (rows[0].width, sum(r.height for r in rows)), (255, 255, 255))
    for i, r in enumerate(rows): sheet.paste(r, (0, i * r.height))
    sheet.save('gen/pour-sketch.png')
    print('gen/pour-sketch.png')
