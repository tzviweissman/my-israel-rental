"""Writes ../order.html from gen/order-src.html with their menu
(gen/catalog/products.json) as its fallback list. Photos are absolute: the
page is served at /business/the-brown-box/..."""
import json
from pathlib import Path
here = Path(__file__).parent
P = json.loads((here / 'catalog' / 'products.json').read_text(encoding='utf8'))
data = [{'name': p['name'], 'price': p['price'], 'price_to': None, 'currency': 'ILS',
         'image': f"/pages/the-brown-box/assets/menu/{p['slug']}.webp", 'group': p['group'], 'in_stock': p['in_stock']} for p in P]
src = (here / 'order-src.html').read_text(encoding='utf8')
out = src.replace('__FALLBACK__', json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('<', '\u003c'))
(here.parent / 'order.html').write_text(out, encoding='utf8', newline='')
print('order.html', len(data), 'items')
