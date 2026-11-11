"""Rename M and N Jewelry's four shop products so customers see what each holds (Tzvi, 8 Nov 2026: "change the product
names to the correct names"). Only the names change: ids, prices and photos stay. Run from backend/ with railway run:
    python ../scrollcraft/builds/mn-jewelry/gen/rename_products.py           (dry run: prints before and after)
    python ../scrollcraft/builds/mn-jewelry/gen/rename_products.py --write   (writes the four names)"""
import asyncio, sys
sys.path.insert(0, '.')
from routes.deps import db  # noqa: E402

GIG = '437e8b9b-e536-418a-9e20-19bf6768fa92'
NAMES = {  # what each product's own photos show
    '259cea53a30a': 'Solitaire and halo rings',
    '80e61c425af4': 'Diamond bands and solitaires',
    '2a0f5884ad9e': 'Necklaces and tennis bracelets',
    'f6ce9201e19b': 'Earrings, bangle and solitaire',
}


async def main():
    g = await db.marketplace_gigs.find_one({'_id': GIG}, {'products': 1, 'business_id': 1})
    assert g and g.get('business_id') == '7830e50f-f67a-41e6-8c61-8ba97ea41d9e', 'not their listing'
    for p in g['products']:
        print(p['id'], repr(p['name']), '->', repr(NAMES.get(p['id'], p['name'])), p.get('price'), p.get('currency'))
    if '--write' not in sys.argv:
        print('dry run, nothing written'); return
    for pid, name in NAMES.items():
        r = await db.marketplace_gigs.update_one({'_id': GIG, 'products.id': pid}, {'$set': {'products.$.name': name}})
        print(pid, 'matched', r.matched_count, 'modified', r.modified_count)

asyncio.run(main())
