"""Read-only: Chicken Munch's business record, listings and photos."""
import asyncio, json, re, sys
sys.path.insert(0, '.')
from routes.deps import db  # noqa: E402

async def main():
    rx = re.compile('chicken munch', re.I)
    bizs = [b async for b in db.businesses.find({'$or': [{'name': rx}, {'slug': re.compile('chicken', re.I)}]})]
    gigs = [g async for g in db.marketplace_gigs.find({'$or': [{'title': rx}, {'business_name': rx}, {'provider_name': rx}]})]
    ids = {b['_id'] for b in bizs}
    gigs += [g async for g in db.marketplace_gigs.find({'business_id': {'$in': list(ids)}}) if g['_id'] not in {x['_id'] for x in gigs}]
    owners = {b.get('owner_user_id') for b in bizs} | {g.get('provider_id') for g in gigs}
    users = [u async for u in db.users.find({'id': {'$in': [o for o in owners if o]}}, {'password': 0, 'password_hash': 0, 'email': 0, 'phone': 0})]
    out = {'businesses': bizs, 'gigs': gigs, 'owner_names': [u.get('name') for u in users]}
    json.dump(out, open(sys.argv[1], 'w', encoding='utf8'), default=str, ensure_ascii=False, indent=1)
    for b in bizs: print('BIZ', b['_id'], b.get('slug'), b.get('name'), b.get('category'))
    for g in gigs: print('GIG', g['_id'], g.get('title'), g.get('category'), g.get('status'), len(g.get('images') or []), 'imgs')

asyncio.run(main())
