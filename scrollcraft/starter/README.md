# Starter for a designed site

Learned from Chicken Munch, The Whipped Cup and Nails by Elisheva (19 Oct 2026),
which each rewrote the same skeleton by hand. The starter holds **how a site
works**, never **how it looks**: every business still gets its own brand,
opening and signature moment, and `scripts/check-fingerprints.mjs` fails a
build that comes out too close to another.

## Steps

1. **Fetch the business** (one command, writes nothing live). From `backend/`:

   ```bash
   PYTHONIOENCODING=utf-8 railway run --service "my-israel-rental Backend" "$(cygpath -w .venv/Scripts/python.exe)" ../scrollcraft/starter/fetch_business.py <slug> <folder>
   ```

   It writes `src/record.json`, every photo as `src/owner/pNN.jpg` and a
   numbered `sheet.jpg`. Read the sheet first (rules 3o.6). Draft the
   owner's questions now and start building while they answer (rules 0b.2a).

2. **Copy the skeleton** into `scrollcraft/builds/<folder>/`: `site.css`,
   `site.js` and a `gen/build.py` that imports `sitekit` (example below).
   In `site.js` set `BASKET_KEY`. In `site.css` replace every CHANGE token
   with this business's brand, from its own logo, photos and menu.

3. **Choose the look before writing any section**, and write it into
   `scrollcraft/fingerprints.json`: hero, signature, nav, close, layout,
   ground, and `own_colours` (colours from their logo or menu). Then run:

   ```bash
   node scripts/check-fingerprints.mjs scrollcraft/builds/<folder>
   ```

   A clash means changing the new site's fonts, colours or design. Never
   change an existing site to make room. Run it again before publishing.

4. **Build the business's own parts** below the marked line in `site.css`
   and in `gen/build.py`: the opening, the signature moment (rules 3n), the
   sections, the order or booking page with each item's rules (3l).

5. **Check in the background, all pages at once**, from the first draft:
   `clipped.mjs` and `readable.mjs` per page, run in parallel. Then the wow
   gate (3n) before anything is shown.

## gen/build.py

```python
import sys; sys.path.insert(0, '../../starter'); import sitekit as kit

SITE = kit.Site(
    name='The Whipped Cup', short='The Whipped Cup', slug='rena-lipschitz',
    pages=[('index', 'Home'), ('menu', 'Menu'), ('order', 'Order'), ('contact', 'Contact')],
    contacts=[kit.Contact('whatsapp', '+1 929 993 6768'), kit.Contact('email', 'thewhippedcup@gmail.com')],
    fonts='family=Fraunces:wght@500;700&family=DM+Sans:wght@400;700',
    cta=('order.html', 'Order'), bar=('From ₪40 a jar', 'Each jar makes 3 to 4 coffees'),
    place='Ramat Eshkol, Jerusalem', close_title='Your cup, your cloud.')

SITE.write('index', 'The Whipped Cup · ...', 'description', 'og.webp', OPENING + SECTIONS + kit.gallery('From our kitchen'), OPENING_JS)
SITE.write('contact', 'Contact · ...', '...', 'og.webp', SITE.page_head('Say hello', '...') + CONTACT + kit.faq('Your questions'))
```

`kit.Contact` kinds: `whatsapp` (WhatsApp or call), `whatsapp-only`, `call`
(call only, no WhatsApp), `text`, `email`. Ask the owner which number takes
what (rules 3o.4). `kit.price(90)` sets the ₪ in the body face (3o.5).
