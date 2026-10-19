"""Step one of a build, in one go (Tzvi, 19 Oct 2026: builds should be
faster). Pulls a business's live record and listings, downloads every photo,
numbers them on one contact sheet, and prints the facts the page may use.

Run from backend/ (reads the live database, writes nothing to it):

    railway run --service "my-israel-rental Backend" <python> \
        ../scrollcraft/starter/fetch_business.py <slug> <build-folder-name>

Set PYTHONIOENCODING=utf-8 first on Windows, or Hebrew text crashes the print.

Writes scrollcraft/builds/<folder>/src/record.json, src/owner/pNN.jpg (every
photo, numbered in the order: cover, gallery, then each listing's items) and
sheet.jpg. Look at the sheet before anything else (page rules 3o.6): skip
duplicates, note screenshots, and ask the owner about any photo whose kind is
not clear.
"""
import asyncio
import json
import os
import sys
import urllib.request

from PIL import Image, ImageDraw

sys.path.insert(0, '.')
from routes.deps import db  # noqa: E402

slug, folder = sys.argv[1], sys.argv[2]
OUT = os.path.join('..', 'scrollcraft', 'builds', folder)
SRC = os.path.join(OUT, 'src', 'owner')


def full(url: str) -> str:
    # Cloudinary: the original, as a JPEG at high quality
    return url.replace('/upload/f_auto,q_auto/', '/upload/f_jpg,q_90/') if 'res.cloudinary.com' in url else url


async def main():
    biz = await db.businesses.find_one({"slug": slug}) or await db.businesses.find_one({"_id": slug})
    if not biz:
        sys.exit(f"no business {slug}")
    gigs = [g async for g in db.marketplace_gigs.find({"business_id": biz["_id"]})]
    drop = {"embedding"}
    record = {"business": {k: v for k, v in biz.items() if k not in drop},
              "listings": [{k: v for k, v in g.items() if k not in drop} for g in gigs]}
    os.makedirs(SRC, exist_ok=True)
    with open(os.path.join(OUT, 'src', 'record.json'), 'w', encoding='utf8') as f:
        json.dump(record, f, default=str, ensure_ascii=False, indent=1)

    urls = [u for u in [biz.get("cover_url"), biz.get("logo_url")] if u]
    for g in gigs:
        urls += g.get("gallery") or []
        for it in (g.get("tiers") or []) + (g.get("products") or []):
            urls += it.get("images") or ([it["image"]] if it.get("image") else [])
    seen, files = set(), []
    for u in urls:
        if u in seen:
            continue
        seen.add(u)
        name = os.path.join(SRC, 'p%02d.jpg' % (len(files) + 1))
        try:
            urllib.request.urlretrieve(full(u), name)
            files.append(name)
        except Exception as e:  # noqa: BLE001
            print('  could not fetch', u, type(e).__name__)
    if files:
        cols, W, H = 7, 300, 400
        rows = (len(files) + cols - 1) // cols
        sheet = Image.new('RGB', (W * cols, H * rows), 'black')
        d = ImageDraw.Draw(sheet)
        for i, f in enumerate(files):
            im = Image.open(f).convert('RGB')
            size = im.size
            im.thumbnail((W, H))
            x, y = (i % cols) * W + (W - im.size[0]) // 2, (i // cols) * H
            sheet.paste(im, (x, y))
            d.rectangle([(i % cols) * W, y, (i % cols) * W + 120, y + 22], fill='black')
            d.text(((i % cols) * W + 5, y + 5), 'p%02d %dx%d' % (i + 1, *size), fill='white')
        sheet.save(os.path.join(OUT, 'sheet.jpg'), quality=85)

    print(f"{biz.get('name')} ({biz.get('slug')}), areas {biz.get('areas')}, nationwide {biz.get('serves_nationwide')}")
    for k in ("description", "hours", "languages", "founded_year", "kosher_certification", "delivery_note", "payment_note", "lead_time"):
        if biz.get(k):
            print(f"  {k}: {biz[k]}")
    for g in gigs:
        print(f"LISTING {g.get('title')} [{g.get('gig_type')}, {g.get('status')}] area {g.get('area')} whatsapp {g.get('whatsapp')} email {g.get('contact_email')}")
        if g.get("description"):
            print("  " + g["description"].replace("\n", " / ")[:600])
        for it in (g.get("tiers") or []) + (g.get("products") or []):
            print(f"  - {it.get('name')}: {it.get('price')} {it.get('currency')} {it.get('duration_minutes') or ''} {it.get('description') or ''}"[:300])
        if g.get("weekly_availability"):
            print(f"  hours: {json.dumps(g['weekly_availability'])}")
        for q in g.get("faqs") or []:
            print(f"  FAQ {q}")
    print(f"{len(files)} photos in {SRC}, sheet at {os.path.join(OUT, 'sheet.jpg')}")

asyncio.run(main())
