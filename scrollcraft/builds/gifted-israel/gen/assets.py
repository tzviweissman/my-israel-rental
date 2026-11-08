"""Gifted Israel's pictures and catalogue, from their own site (GiftedIsrael.com, read 4 Nov 2026 into src/site/)
and their flyer (src/owner/p01.jpg). Run from the build folder: python gen/assets.py

Writes assets/p/<id>.webp (every shown product, 800 px on its own white), assets/hero-menorah.webp, the logo
mark, the Chanukah clip from their own site, og.webp, and assets/catalog.js (window.GI: the products the
shop and the home page show, with the ids gen/catalog/load_products.py loads into their MyIsraelRental shop).
"""
import json
import os
import re
import subprocess

from PIL import Image

os.makedirs('assets/p', exist_ok=True)
P = [x for x in json.load(open('src/site/Product.json', encoding='utf8')) if not x['hidden']]

# Six pieces have no category on their site; placed by what they are
NO_CAT = {'Resin Curve Hadlokas Neiros Tray': 'Shabbos', 'Resin Besamim Cloche': 'Havdalah', 'Resin Arch Tzedakah Box': 'Judaica',
          'Resin Shabbos Matchbox Holder': 'Shabbos', 'Watercolor Flowers Hadlakos Neiros Tabletop': 'Shabbos', 'Onyx Butterfly Hadlokas Neiros': 'Shabbos'}
# Their main photo is on a coloured ground, a hand or too small; another photo of the same piece, on white, is used (rules 8.1)
ALT = {'Resin Shabbos Matchbox Holder': 3, 'Rotating Resin Mayim Achronim': 3, 'Rosh Hashanah Pomegranate Leather Simanim Cards & Pouch': 2,
       'Classic Bread / Towel Tray': 5, 'Leather Passport Case': 1}


def pid(x):
    return 'gi' + x['id'][-10:]


def facts(desc):
    """The spec lines at the end of their descriptions ("DIMENSIONS: 13" x 7.5""), and the first paragraph."""
    lines = [l.strip() for l in desc.split('\n') if l.strip()]
    spec = [l for l in lines if re.match(r'^[A-Z][A-Z /]{3,}:', l)]
    body = [l for l in lines if l not in spec]
    first = body[0] if body else ''
    return first, [(l.split(':', 1)[0].strip().capitalize(), l.split(':', 1)[1].strip()) for l in spec]


def webp(src, out, size, q=80):
    im = Image.open(src).convert('RGB')
    im.thumbnail((size, size), Image.LANCZOS)
    im.save(out, 'WEBP', quality=q, method=6)
    return im.size


# Their website lists the Scalloped Finger Towel twice, once Silver and once Pink, same price: one piece with a
# finish choice (gen/catalog/whatsapp-check.md, Tzvi 4 Nov 2026: "make sure there's no doubles")
towels = [x for x in P if x['name'].strip() == 'Scalloped Finger Towel']
if len(towels) == 2 and towels[0]['price_shekel'] == towels[1]['price_shekel']:
    towels[0]['colors'] = sorted({c for t in towels for c in t.get('colors') or []}, key=str.lower)
    P.remove(towels[1])

items = []
for x in P:
    name = x['name'].strip()
    src = f"src/site/img/{x['id']}.jpg"
    if name in ALT:
        src = f"src/site/alt/{x['id']}-{ALT[name]}.jpg"
    w, h = webp(src, f'assets/p/{pid(x)}.webp', 800)
    first, spec = facts(x['description'])
    cols = sorted({c.strip().capitalize() for c in x.get('colors') or []})
    items.append({
        'id': pid(x), 'name': name, 'price': x['price_shekel'], 'cat': x['category'] or NO_CAT.get(name, 'Judaica'),
        'cats': sorted(set([x['category'] or NO_CAT.get(name, 'Judaica')] + (x.get('categories') or []))),
        'w': w, 'h': h, 'desc': first, 'spec': spec,
        'finish': cols if len(cols) > 1 else [], 'finish1': cols[0] if len(cols) == 1 else '',
        'nusach': bool(re.search(r'NUSACH:\s*Ashkenaz\s*/\s*Sefard', x['description'])),
        'engrave': bool(re.search(r'engrav', x['description'], re.I)),
    })

with open('assets/catalog.js', 'w', encoding='utf8') as f:
    f.write('// From GiftedIsrael.com, 4 Nov 2026 (gen/assets.py). Product ids match gen/catalog/load_products.py.\n')
    f.write('window.GI = ' + json.dumps({'items': items}, ensure_ascii=False, separators=(',', ':')) + ';\n')

# the opening piece, whole, at its own size on its own white
menorah = next(x for x in P if x['name'] == 'Diamond Menorah')
# full-screen canvases: the photo's ground is pure white (255,255,255 at every edge), so it is extended with its own
# white and nothing is generated (rules 3c.12). gifted.js holds the same numbers to place the engraving.
def canvas(out, W, H, ox, oy, S):
    c = Image.new('RGB', (W, H), 'white')
    c.paste(Image.open(f"src/site/img/{menorah['id']}.jpg").convert('RGB').resize((S, S), Image.LANCZOS), (ox, oy))
    c.save(out, 'WEBP', quality=86, method=6)
webp(f"src/site/img/{menorah['id']}.jpg", 'assets/hero-menorah-900.webp', 900, 84)

# the logo mark from the flyer: their red gift box, the grey square keyed out
flyer = Image.open('src/owner/p01.jpg').convert('RGBA')
box = flyer.crop((625, 78, 885, 300))
px = box.load()
for yy in range(box.size[1]):
    for xx in range(box.size[0]):
        r, g, b, a = px[xx, yy]
        red = r - max(g, b)                      # the mark is deep red on grey
        px[xx, yy] = (111, 13, 12, max(0, min(255, int(red * 3.2)))) if red > 8 else (0, 0, 0, 0)
box = box.crop(box.getbbox())
box.thumbnail((160, 160), Image.LANCZOS)
box.save('assets/mark.png', optimize=True)

# their own Chanukah clip from their site (pieces set out on a table), small and silent, with a still
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '8.5', '-t', '6.5', '-i', 'src/site/video/chanukah.mp4', '-an', '-vf', 'crop=606:760:0:150,eq=contrast=1.06:brightness=-0.035', '-c:v', 'libx264',
                '-crf', '27', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'assets/chanukah.mp4'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '10.5', '-i', 'src/site/video/chanukah.mp4', '-frames:v', '1', '-vf', 'crop=606:760:0:150,eq=contrast=1.06:brightness=-0.035',
                'gen/look/chanukah-poster.png'], check=True)
webp('gen/look/chanukah-poster.png', 'assets/chanukah-poster.webp', 960, 80)

# the share picture: the menorah on white, 1200x630
og = Image.new('RGB', (1200, 630), 'white')
m = Image.open(f"src/site/img/{menorah['id']}.jpg").convert('RGB')
m.thumbnail((760, 760))
og.paste(m.crop((0, 90, m.size[0], 90 + 630)), ((1200 - m.size[0]) // 2 + 150, 0))
mk = Image.open('assets/mark.png')
og.paste(mk, (90, 250), mk)
og.save('assets/og.webp', 'WEBP', quality=82)
print(len(items), 'items')
