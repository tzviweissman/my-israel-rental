"""Gremier Coffee: their own photos (src/site, from gremiercoffee.co.il, 10 Nov 2026) sized for the site, and the
catalogue every page shares (assets/catalog.js). Run from the build folder: python gen/assets.py
Prices and words are theirs, from their shop page that day (src/facts.md)."""
import json
import os

from PIL import Image

SRC, OUT = 'src/site', 'assets'
os.makedirs(f'{OUT}/p', exist_ok=True)

# id, name, price, was, category, size line, their words, photo
ITEMS = [
    ('classic', 'Classic Dark Roast', 49, None, 'Bottles', '1 litre', 'Our signature. Deep and smooth: strong enough for milk, smooth enough to drink black.', 'classic-liter-lifestyle-v2'),
    ('house', 'House Blend Medium Roast', 49, 54, 'Bottles', '1 litre', 'Chocolatey and bright, right in the middle. The one to pick if you are not sure.', 'house-blend-lifestyle-v1'),
    ('colombia', 'Colombia Light Roast', 49, 54, 'Bottles', '1 litre', 'Bright and fruity, with a lighter body. Best over ice, black or with a splash of milk.', 'colombia-liter-lifestyle-v2'),
    ('sweetened', 'Sweetened Classic', 49, None, 'Bottles', '1 litre', 'Our Classic, already sweetened. Just pour over ice.', 'sweetened-liter-lifestyle-v3'),
    ('decaf', 'Decaf', 49, None, 'Bottles', '1 litre', 'All the smoothness of our cold brew, without the caffeine. For evenings, and for anyone cutting back.', 'decaf-liter-lifestyle-v2'),
    ('vanilla-latte', 'Vanilla Cream Latte', 59, None, 'Mini packs', '4 × 250 ml', 'Sweet, creamy vanilla cold brew in four minis. Contains dairy.', 'vanilla-cream-latte-lifestyle-v1'),
    ('caramel-latte', 'Caramel Cream Latte', 59, None, 'Mini packs', '4 × 250 ml', 'Sweet, creamy caramel cold brew in four minis. Tastes like a caramel latte. Contains dairy.', 'caramel-cream-latte-lifestyle-v1'),
    ('original-latte', 'Original Cream Latte', 59, None, 'Mini packs', '4 × 250 ml', 'Sweet, creamy cold brew in four minis: for the fridge, the bag or the lunchbox. Contains dairy.', 'original-cream-latte-lifestyle-v1'),
    ('classic-mini', 'Classic Mini 4-Pack', 59, None, 'Mini packs', '4 × 250 ml', 'Our Classic cold brew, black and unsweetened, in four minis.', 'classic-mini-lifestyle-v1'),
    ('jug-classic', '5L Classic Dark Roast Jug', 169, (5, 'classic'), 'Wholesale', '5 litres', 'Five litres of Classic for the office, a busy home or an event. Keep it in the fridge.', 'classic-jug-lifestyle-v2'),
    ('jug-house', '5L House Blend Jug', 229, (5, 'house'), 'Wholesale', '5 litres', 'Five litres of House Blend for the office, a busy home or an event. Keep it in the fridge.', 'house-jug-lifestyle-v2'),
    ('jug-colombia', '5L Colombia Light Roast Jug', 229, (5, 'colombia'), 'Wholesale', '5 litres', 'Five litres of Colombia for the office, a busy home or an event. Keep it in the fridge.', 'colombia-jug-lifestyle-v2'),
    ('jugs-three', '3 × 5L Classic Dark Roast Jugs', 489, (15, 'classic'), 'Wholesale', '15 litres', 'Fifteen litres of Classic, our best price per litre. Made for offices, shops and big events.', 'classic-three-jugs-lifestyle-v2'),
    ('six-litres', 'Your own 6-pack of litres', 279, (6, 'classic'), 'Bottles', '6 × 1 litre', 'Pick any 6 litre bottles and mix the flavours you like: tell us which six in the order note. 5% off for taking 6.', 'six-liters'),
    ('caramel-syrup', 'Caramel Syrup', 59, None, 'Syrups', 'one bottle', 'Rich caramel-flavoured syrup: the café caramel latte, at home.', 'sweet-caramel-syrup-lifestyle-v1'),
    ('vanilla-syrup', 'Vanilla Bean Syrup', 59, None, 'Syrups', 'one bottle', 'Sweet vanilla-flavoured syrup that turns any cold brew into a treat.', 'vanilla-bean-syrup-lifestyle-v1'),
    ('bar-premium', 'Premium Coffee Bar', 349, None, 'Coffee bars', 'from', 'Everything for a coffee bar in one box: the dispenser, cold brew, milk, cups, straws and caramel, vanilla and sugar syrups.', '01-sunlit-closeup-v3'),
    ('sugar-cups', 'Sugar syrup + 25 XL cups, lids & straws', 64, None, 'Coffee bars', '25 cups', 'Twenty-five 500 ml cups with domed lids and straws, and sugar syrup that mixes easily into cold coffee.', 'sugar-serving-kit-lids-v3'),
    ('cups', '25 XL cups, lids & straws', 24.9, None, 'Coffee bars', '25 cups', 'Twenty-five extra-large 500 ml cups with clear domed lids and sturdy straws, ready to serve your coffee.', 'cups-straws-lids-pack-v3'),
]
CATS = ['Bottles', 'Mini packs', 'Wholesale', 'Syrups', 'Coffee bars']
COLOUR = {'classic': '#F2C531', 'house': '#2FA8E0', 'colombia': '#2DBA7A', 'decaf': '#8A5A3C', 'sweetened': '#F2C531'}


def save(src, dst, width, q=80):
    im = Image.open(src).convert('RGB')
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=q, method=6)
    while os.path.getsize(dst) > 600_000 and q > 50:   # rules 3s.24: no photo over 600 KB
        q -= 8
        im.save(dst, 'WEBP', quality=q, method=6)
    return im.size


out = []
for id_, name, price, was, cat, size, desc, photo in ITEMS:
    ext = 'png' if photo == 'six-liters' else 'jpg' if photo == 'six-minis' else 'webp'
    w, h = save(f'{SRC}/{photo}.{ext}', f'{OUT}/p/{id_}.webp', 1200)
    out.append(dict(id=id_, name=name, price=price, **({'was_of': was, 'was': None} if isinstance(was, tuple) else {'was': was}), cat=cat, size=size, desc=desc, w=w, h=h, colour=COLOUR.get(id_)))

# the event pictures and the rest
for name, width in [('02-garden-reception-v3', 1600), ('03-modern-meeting-v3', 1200), ('06-home-celebration-v3', 1200),
                    ('09-terrace-two-v3', 1200), ('10-bright-minimal-v3', 1200), ('01-sunlit-closeup-v3', 1600),
                    ('09-coffee-bar', 1445), ('bar-master-dark-v4', 1782), ('07-minis', 1536), ('06-syrups', 1536),
                    ('08-five-liter', 1536), ('10-elevate', 1024), ('00-intro-wide', 1536)]:
    save(f'{SRC}/{name}.webp', f'{OUT}/{name}.webp', width)
Image.open(f'{SRC}/logo.png').convert('RGBA').resize((256, 256), Image.LANCZOS).save(f'{OUT}/logo.webp', 'WEBP', quality=90)
# the link preview, 1200x630, from their own bar photo
im = Image.open(f'{SRC}/02-garden-reception-v3.webp').convert('RGB')
im = im.resize((1200, 800), Image.LANCZOS).crop((0, 85, 1200, 715))
im.save(f'{OUT}/og.webp', 'WEBP', quality=82)

# the litre 6-pack card is six of their own litre photos (gen/sixes.py, 1200x800)
import subprocess, sys as _s
subprocess.run([_s.executable, 'gen/sixes.py'], check=True)
for it in out:
    if it['id'] == 'six-litres':
        it['w'], it['h'] = 1200, 800
_s.path.insert(0, '../../starter')
from shopkit import catalog_js, prices_json   # the 6-pack's saving from the litre price; prices.json for the server (3j.14)
cat_js = catalog_js(out, CATS, 'From gremiercoffee.co.il, 10 Nov 2026 (gen/assets.py): their products, prices and words.')
open(f'{OUT}/catalog.js', 'w', encoding='utf8').write(cat_js)
open('prices.json', 'w', encoding='utf8').write(prices_json(out))
print(len(out), 'items')
