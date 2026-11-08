"""The opening's gifts (Tzvi, 5 Nov 2026): their real photos cut off their white, and which pieces rise for each occasion.
Writes assets/g/<id>.webp and assets/gifts.js. Run from the build folder after gen/assets.py. Nothing generated.
The choice of pieces per occasion is ours; OWNER-QUESTIONS.md asks the owner to check it."""
import json
import re

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

OCC = {
    'Birthday': ['Jewelry Roll', 'Cosmetic Bag', 'Brush with Mirror', 'Toiletry Bag', 'Mod Floral Diffuser- Flower', 'Leather Othello/Checkers Game'],
    'Wedding': ['Classic 2.0 Raised Challah Board', 'Resin Curve Hadlokas Neiros Tray', 'Marble & Clear Bencher Set', 'Resin Kiddush Cup', 'Resin Round Dip Bowl Set', 'Tall Wine Decanter'],
    'New home': ['Stripe Mezuzah Case', 'Resin Arch Tzedakah Box', 'Cherry Blossom Washing Cup', 'Basics Traditional Asher Yatzar', 'Onyx Diffuser', 'Wood Salad Bowl'],
    'For kids': ['Leather Kids Gedolim Book', 'Leather Gedolim Matching Game', 'Leather Tic Tac Toe', 'Leather Othello/Checkers Game', 'Boy Crocodile Patent Leather Bib'],
    'Hosting': ['Cherry Blossom Napkin Holder', 'Resin Salt Shakers', 'Wood Charcuterie Board', 'Leather Wine Bag', 'Classic Wine Stand', 'Classic Knife Stand'],
    'Chanukah': ['Diamond Menorah', 'Pearlstone Oil Jug Chanukah Block', 'Painted by Batya Menorah Tray', 'Classic Luxe Dreidel Card + Block', 'Onyx Tabletop Chanukah Brachos', 'Large Leather Menorah Tray'],
    'Rosh Hashana': ['Bee Honey Dish', 'Die-Cut Apple Honey Dish', 'Painted by Batya Honey Dish', 'Classic 2.0 Simanim Card Set', 'Leather Simanim Pouch & Card Set', 'Suspended Honey Dish'],
    'Under ₪100': ['Edge Cup', 'Leather Wine Bag', 'Minimalist Havdalah Candle', 'Tie - Dye Butterfly Napkin Rings', 'Regal Knife Blade Cover', 'Leather Kriyas Shema Book'],
}
# the rest of the pile comes from the whole shop (TOTAL pieces), each category taking turns
TOTAL = 112
P = json.load(open('src/site/Product.json', encoding='utf8'))
C = json.loads(re.search(r'window\.GI = (.*);\s*$', open('assets/catalog.js', encoding='utf8').read(), re.S).group(1))['items']
BY = {i['name']: i for i in C}
SRC = {'gi' + p['id'][-10:]: p['id'] for p in P}


def cut(path, size):
    im = Image.open(path).convert('RGB')
    im.thumbnail((900, 900), Image.LANCZOS)
    a = np.asarray(im, dtype=np.int16)
    near = a.min(axis=2) > 232
    lab, _ = ndimage.label(near)
    edge = set(np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])) - {0}
    bg = np.isin(lab, list(edge))
    # the faint floor reflection under a piece stays near white: take what is left of it with the edge's own softness
    keep = ndimage.binary_opening(~bg, iterations=2)
    fill = keep.mean()
    alpha = Image.fromarray((keep * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(1.1))
    out = im.convert('RGBA'); out.putalpha(alpha)
    box = alpha.point(lambda v: 255 if v > 24 else 0).getbbox()
    out = out.crop(box)
    out.thumbnail((size, size), Image.LANCZOS)
    # the shadow it throws on what lies under it is baked in: no filters on moving images (rules 3h)
    pad = round(size * .09)
    cv = Image.new('RGBA', (out.width + pad * 2, out.height + pad * 2), (0, 0, 0, 0))
    sh = Image.new('RGBA', cv.size, (0, 0, 0, 0))
    sh.paste(Image.new('RGBA', out.size, (31, 22, 18, 120)), (pad, pad + round(size * .03)), out.getchannel('A'))
    cv = Image.alpha_composite(cv, sh.filter(ImageFilter.GaussianBlur(size * .032)))
    cv.alpha_composite(out, (pad, pad))
    return cv, fill


chosen = list(dict.fromkeys(n for v in OCC.values() for n in v))
missing = [n for n in chosen if n not in BY]
assert not missing, missing
# every category in turn, so the heap is the whole shop
cats = {}
for i in C:
    if i['name'] not in chosen:
        cats.setdefault(i['cat'], []).append(i['name'])
rest = []
while any(cats.values()):
    for c in list(cats):
        if cats[c]:
            rest.append(cats[c].pop(0))
pool, skipped = [], []
for n in chosen + rest:
    if len(pool) >= TOTAL:
        break
    it = BY[n]
    # pieces that rise are shown large; those that only lie in the heap can be smaller files
    g, fill = cut(f"src/site/img/{SRC[it['id']]}.jpg", 380 if n in chosen else 240)
    # a photo not on white comes back almost solid, and a clear piece almost empty: neither reads in a heap
    if n not in chosen and (fill > .62 or fill < .05):
        skipped.append(n)
        continue
    g.save(f"assets/g/{it['id']}.webp", 'WEBP', quality=80, method=6, alpha_quality=85)
    pool.append({'id': it['id'], 'name': n, 'price': it['price'], 'w': g.width, 'h': g.height})
print('left out of the heap:', skipped)
occ = {k: [BY[n]['id'] for n in v] for k, v in OCC.items()}
assert all(BY[n]['price'] < 100 for n in OCC['Under ₪100'])
open('assets/gifts.js', 'w', encoding='utf8').write('window.GIFTS = ' + json.dumps({'pool': pool, 'occ': occ}, ensure_ascii=False) + ';\n')
print(len(pool), 'pieces')

# a sheet to look at, on the page's ground
n = len(pool); cols = 16; S = 112
sheet = Image.new('RGB', (cols * S, (n // cols + 1) * S), '#FFFFFF')
for i, p in enumerate(pool):
    g = Image.open(f"assets/g/{p['id']}.webp"); g.thumbnail((S - 6, S - 6))
    sheet.paste(g, (i % cols * S + 3, i // cols * S + 3), g)
sheet.save('gen/look/gifts-sheet.png')

# the room they lie in: white wall, a pale stone floor, made here, nothing generated
W, H = 1920, 1200
y = np.arange(H) / (H - 1)
t = np.clip((y - .56) / .12, 0, 1); t = t * t * (3 - 2 * t)
wall, floor = np.array([255, 255, 255.]), np.array([240, 234, 226.])
row = wall[None] * (1 - t[:, None]) + floor[None] * t[:, None]
row -= (np.clip(y - .68, 0, 1) * 14)[:, None]
Image.fromarray(np.repeat(row[:, None], W, axis=1).clip(0, 255).astype('uint8')).save('assets/floor.webp', 'WEBP', quality=88)
