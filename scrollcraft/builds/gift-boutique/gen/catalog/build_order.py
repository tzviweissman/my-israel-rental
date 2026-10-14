"""Writes ../../order.html from order-src.html with the typed-in gift list
(products.json) as its fallback, so the order page and the home page start
from the same list. Photos are absolute: the page is served at
/business/the-gift-boutique/..., where a relative path would miss."""
import json
from pathlib import Path
here = Path(__file__).parent
P = json.loads((here / 'products.json').read_text(encoding='utf8'))
data = [{'name': p['name'], 'price': p['price'], 'price_to': p['price_to'], 'currency': 'USD',
         'image': f"/pages/the-gift-boutique/assets/cat/{p['slug']}.webp", 'group': p['group'], 'in_stock': p['in_stock']} for p in P]
src = (here / 'order-src.html').read_text(encoding='utf8')
out = src.replace('__FALLBACK__', json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('<', '\u003c'))
(here.parent.parent / 'order.html').write_text(out, encoding='utf8', newline='')
print('order.html', len(data), 'gifts')
