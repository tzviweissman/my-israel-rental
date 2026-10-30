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

   **Extend any big photo that is not the screen's shape** (rules 3c.12,
   27 Oct 2026). Run it with the backend venv python; `extend_photo.py -h`
   has the full steps:

   ```bash
   python ../../starter/extend_photo.py pad assets/<photo>.webp gen/ext
   # one nano_banana_2 fill (2k, canvas as image_references) per canvas -> gen/ext/fill-wide.png, fill-tall.png
   python ../../starter/extend_photo.py paste gen/ext/canvas-wide.json gen/ext/fill-wide.png assets/<photo>-wide.webp --width 3600
   python ../../starter/extend_photo.py paste gen/ext/canvas-tall.json gen/ext/fill-tall.png assets/<photo>-tall.webp --width 1200
   python ../../starter/extend_photo.py ultra gen/ext/canvas-wide.json assets/<photo>-wide.webp assets/<photo>-ultra.webp --width 4200
   ```

   Serve the three with `<picture>` as RS Modest's doors do.

2. **Copy the skeleton** into `scrollcraft/builds/<folder>/`: `site.css`,
   `site.js` and a `gen/build.py` that imports `sitekit` (example below).
   In `site.js` set `BASKET_KEY`. In `site.css` replace every CHANGE token
   with this business's brand, from its own logo, photos and menu.

3. **Write CONCEPT.md first** (page rules 3q): three ideas from saved effects in `docs/inspo` (cite the pictures), one from the business's own words, the choice, the wow gate. `node scripts/check-concept.mjs <folder>` checks it, and publishing a new page refuses without it.

4. **Choose the look before writing any section**, and write it into
   `scrollcraft/fingerprints.json`: hero, signature, nav, close, layout,
   ground, `own_colours` (colours from their logo or menu), and `effects`
   (one id per kind from `_effects`, each found by a fresh search, rules 3p.4). Then run:

   ```bash
   node scripts/check-fingerprints.mjs scrollcraft/builds/<folder>
   ```

   A clash means changing the new site's fonts, colours or design. Never
   change an existing site to make room. Run it again before publishing.

5. **Build the business's own parts** below the marked line in `site.css`
   and in `gen/build.py`: the opening, the signature moment (rules 3n), the
   sections, the Shop (or Book) page: menu and order on ONE page, built as a
   product page (rules 3k; copy the shape of builds/whipped-cup/gen/shop.py and
   shop.js), each item's rules (3l), and the deal shown where the owner's
   prices make it real (3j).

6. **Check in the background, all pages at once**, from the first draft:
   `clipped.mjs` and `readable.mjs` per page, run in parallel. Then the wow
   gate (3n) before anything is shown.

## gen/build.py

```python
import sys; sys.path.insert(0, '../../starter'); import sitekit as kit

SITE = kit.Site(
    name='The Whipped Cup', short='The Whipped Cup', slug='rena-lipschitz',
    pages=[('index', 'Home'), ('shop', 'Shop'), ('contact', 'Contact')],  # menu and order are one page (rules 3k)
    contacts=[kit.Contact('whatsapp', '+1 929 993 6768'), kit.Contact('email', 'thewhippedcup@gmail.com')],
    fonts='family=Fraunces:wght@500;700&family=DM+Sans:wght@400;700',
    cta=('shop.html#order', 'Basket'), bar=('From ₪40 a jar', 'Each jar makes 3 to 4 coffees'),
    place='Ramat Eshkol, Jerusalem', close_title='Your cup, your cloud.')

SITE.write('index', 'The Whipped Cup · ...', 'description', 'og.webp', OPENING + SECTIONS + kit.gallery('From our kitchen'), OPENING_JS)
SITE.write('contact', 'Contact · ...', '...', 'og.webp', SITE.page_head('Say hello', '...') + CONTACT + kit.faq('Your questions'))
```

`kit.Contact` kinds: `whatsapp` (WhatsApp or call), `whatsapp-only`, `call`
(call only, no WhatsApp), `text`, `email`. Ask the owner which number takes
what (rules 3o.4). `kit.price(90)` sets the ₪ in the body face (3o.5).

## Ready parts and the one check (24 Oct 2026)

- **The builder brief**: every build or rework starts from `docs/build-brief-template.md`, filled in, nothing deleted. Each line is a mistake that already reached Tzvi.
- **`film.js`**: the opening film that follows the scroll (frames on a canvas, chapters by scroll point, passes so it scrubs at once). Copy it into the build, include it after `site.js`; the markup and CSS are at its top. `american-crust/gen/film.sh` makes the frames from a joined film.
- **`node scripts/check-build.mjs scrollcraft/builds/<folder>`**: every check in one command (site, fits, motion and readable on every page; concept, fingerprints and rules for the site), four at a time. Nothing is shown to Tzvi or published until it passes.

## The kit (rules 3u, 29 Oct 2026)

`kit/kit.css` and `kit/kit.js` hold the tested moving pieces from the seven videos: the first screen
arriving in order (`data-arrive`), laptop-only depth (`data-depth`), one rotating headline word
(`.rot`), a tilted label (`.tilt`) and question cards (`details.faq-q`). Copy the parts a site uses
into its own site.css and site.js. `kit/test.html` has buttons that replay each piece; a new moving
piece is tried there first (3u.12), then added to the kit.
