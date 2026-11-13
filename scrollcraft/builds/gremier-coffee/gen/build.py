"""Gremier Coffee's pages: home, shop (all products and the order on one page), contact.
Run from the build folder: python gen/assets.py && python gen/steep.py && python gen/build.py
Words are theirs: their MyIsraelRental listing and their own shop at gremiercoffee.co.il (src/facts.md)."""
import json
import re
import sys
from html import escape
from urllib.parse import quote

sys.path.insert(0, '../../starter')
sys.stdout.reconfigure(encoding='utf-8')
import sitekit as kit  # noqa: E402

GC = json.loads(re.search(r'window\.CAT = (.*);\s*$', open('assets/catalog.js', encoding='utf8').read(), re.S).group(1))
ITEMS, CATS = GC['items'], GC['cats']
BY = {i['id']: i for i in ITEMS}
P = kit.price
PHONE, MAIL = '+972 55-270-3413', 'gremiercoffee@gmail.com'
KOSHER = 'Kosher, Rabbi Shmuel Weiner'
DELIVERY = 'Order by Wednesday, receive by Shabbat, with regular delivery to Jerusalem and Beit Shemesh'

SITE = kit.Site(
    name='Gremier Coffee Co.', short='Gremier Coffee Co.', slug='gremier-coffee',
    pages=[('index', 'Home'), ('shop', 'Shop'), ('contact', 'Contact')],
    contacts=[kit.Contact('whatsapp-only', PHONE), kit.Contact('email', MAIL)],
    fonts='family=Noto+Serif:wght@600&family=Noto+Serif+Hebrew:wght@600&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Sans+Hebrew:wght@400;600',
    cta=('shop.html', 'Shop cold brew'), bar=('From ₪49', 'a litre of cold brew'),
    place='Jerusalem', close_title='Elevate every day.', close_extra='',
    mark_html='<img src="assets/logo.webp" alt="" width="40" height="40">',
    about='Slow-brewed cold brew for home, the office and events. Based in Jerusalem, delivered across Israel.',
    ordering=('Ordering', ['Your order opens in WhatsApp, written out for you', DELIVERY, 'Pickup is free', KOSHER]),
    ld_type='FoodEstablishment', ld_extra={'areaServed': 'Israel', 'servesCuisine': 'Cold brew coffee'})


def money(it):
    return P(it['price'])


def price_row(it):
    off = f'<span class="off">{round((1 - it["price"] / it["was"]) * 100)}% off</span>' if it.get('was') else ''
    was = f' <s aria-label="was ₪{it["was"]:g}">{P(it["was"])}</s>{off}' if it.get('was') else ''
    size = '' if it['size'] == 'from' else f'<span class="unit">{escape(it["size"])}</span>'
    pre = '<span class="unit">from</span> ' if it['size'] == 'from' else ''
    return f'<p class="pr-row">{pre}<span class="pr">{money(it)}</span>{was}{size}</p>'


def card(it, lazy=True, add=True):
    load = ' loading="lazy" decoding="async"' if lazy else ' fetchpriority="high"'
    stripe = f' style="--stripe:{it["colour"]}"' if it.get('colour') else ''
    btn = (f'<button class="btn btn-sm" type="button" data-add="{it["id"]}" aria-label="Add {escape(it["name"], True)}, ₪{it["price"]:g}">Add</button>'
           if add else '')
    return (f'<li class="pc"{stripe}><a class="pc-a" data-f="link" data-id="{it["id"]}" href="shop.html?p={it["id"]}">'
            f'<span class="pc-ph"><img data-f="img" src="assets/p/{it["id"]}.webp" alt="{escape(it["name"], True)}" width="{it["w"]}" height="{it["h"]}"{load}></span>'
            f'<span class="pc-t"><b data-f="name">{escape(it["name"])}</b>{price_row(it)}</span></a>{btn}</li>')


def head_extra(html, home=False):
    html = html.replace('<link rel="preconnect" href="https://fonts.googleapis.com">',
                        '<meta name="site-category" content="food-shop">\n<link rel="icon" href="assets/logo.webp" type="image/webp">\n<link rel="preconnect" href="https://fonts.googleapis.com">', 1)
    if home:   # what we offer, two kinds (3g.18), and where the button colour is in their own product (3g.19, BRAND.md)
        html = html.replace('<meta name="site-category" content="food-shop">', '<meta name="site-category" content="food-shop">\n<meta name="offers" content="cold brew|coffee bar">\n'
                            '<meta name="product-colour" content="#3B0A02" data-from="assets/p/classic.webp">', 1)
    return html.replace(' <span class="arw" aria-hidden="true">→</span>', '').replace('Gremier Coffee Co..', 'Gremier Coffee Co.')


# ── home ─────────────────────────────────────────────────────────────────────
# the opening (gen/film-brief.md): the cold brew journey, one shot led by the scroll, on their cream; chapters at the
# clip starts of gen/film.sh (0, 5.7, 11.4, 17.1 of 24.3 s). The last frame is their own coffee bar photo.
# the opening, from the starter's part (kit.opening_slides, slides.js): "you are the coffee" (gen/coffee-journey-brief.md),
# four clips chained by starter/clipchain.py (gen/chain.json), the last landing on their own coffee bar photo
OPENING = kit.opening_slides(
    # each word names what happens in its own scene (rules 3aa.20; Tzvi 12 Nov: "it shouldnt say cold by the beans")
    [('s1', 'Grind', 'Beans chosen for cold brew, ground fine'), ('s2', 'Cold', 'Cold water, never hot'),
     ('s3', 'Steep', 'Brewed for hours, not minutes'), ('s4', 'Pour', 'Over ice, with milk if you like'),
     ('s5', 'Serve', 'A coffee bar your guests pour themselves')],
    'Cold brew <span class="amp">&amp;</span> coffee bars',
    'Brewed for hours, not minutes. For your fridge, the office and your event, delivered across Israel.',
    ('shop.html', 'Shop cold brew'), [f'{P(49)} a litre bottle', f'Coffee bars from {P(349)}', KOSHER],
    ('assets/01-sunlit-closeup-v3.webp', 1200, 800), 'Stock your fridge.',
    'Beans pour into the grinder, which comes apart in the air; the grounds fall into a wavy ocean of cold water and turn '
    'it brown, the ocean becomes a whirlpool that pours into a glass of ice and milk, and the camera pulls back to our coffee bar')

KBAND = f'''  <section class="kband" aria-label="Kosher">
    <div class="wrap"><img src="assets/logo.webp" alt="" width="44" height="44" loading="lazy"><p>Kosher, under Rabbi Shmuel Weiner. Brewed in small batches and bottled fresh.</p></div>
  </section>
'''

BOTTLES = [BY[i] for i in ('classic', 'house', 'colombia', 'sweetened', 'decaf')]
# the film's last frame floods into the shop (rules 3aa.11): its tablecloth becomes this section's ground, and the
# glass the film ended on stands in the middle with the bottles round it, Add on each
FRIDGE = f'''  <section class="sec flood" id="coffees" aria-labelledby="h-fr">
    <div class="wrap">
      <div class="sec-h rev"><h2 id="h-fr">Find your cold brew.</h2><p class="lede">Pour it over ice, add milk if you like, and it is ready.</p></div>
      <ul class="cards round rev">{card(BOTTLES[0])}{card(BOTTLES[1])}<li class="hero" aria-hidden="true"><img src="assets/glass-centre.webp" alt="" width="320" height="370" loading="lazy" decoding="async"></li>{card(BOTTLES[2])}{card(BOTTLES[3])}</ul>
      <p class="sec-foot rev"><a class="lnk" href="shop.html?c=Bottles">All litre bottles, with Decaf <span class="arw" aria-hidden="true"></span></a></p>
    </div>
  </section>
'''

MINIS = [BY[i] for i in ('original-latte', 'vanilla-latte', 'caramel-latte', 'classic-mini')]
MINI = f'''  <section class="sec alt" id="minis" aria-labelledby="h-mi">
    <div class="wrap">
      <div class="sec-h rev"><h2 id="h-mi">Small bottles. Big favourites.</h2><p class="lede">Four 250 ml minis in every pack: for the fridge, the bag or the lunchbox. The cream lattes contain dairy.</p></div>
      <ul class="cards four rev">{''.join(card(i) for i in MINIS)}</ul>
    </div>
  </section>
'''

J1, J3 = BY['jug-classic'], BY['jugs-three']
OFFICE = f'''  <section class="sec office" id="office" aria-labelledby="h-of">
    <div class="wrap of-grid">
      <figure class="of-ph rev"><img src="assets/08-five-liter.webp" alt="Our 5 litre jug of Classic cold brew beside iced coffees on an oak table" width="1536" height="1024" loading="lazy" decoding="async"></figure>
      <div class="rev">
        <h2 id="h-of">For the office, a busy home or an event</h2>
        <ul class="of-list">
          <li><span>{escape(J1['name'])}</span>{price_row(J1)}<button class="btn btn-sm" type="button" data-add="{J1['id']}" aria-label="Add {escape(J1['name'], True)}">Add</button></li>
          <li><span>{escape(BY['jug-house']['name'])}</span>{price_row(BY['jug-house'])}<button class="btn btn-sm" type="button" data-add="jug-house" aria-label="Add 5L House Blend Jug">Add</button></li>
          <li><span>{escape(J3['name'])}</span>{price_row(J3)}<button class="btn btn-sm" type="button" data-add="{J3['id']}" aria-label="Add {escape(J3['name'], True)}">Add</button></li>
        </ul>
        <dl class="nums"><div><dt>5 L</dt><dd>in one jug</dd></div><div><dt>15 L</dt><dd>in three jugs</dd></div></dl>
        <p class="hint">Three jugs is our best price per litre: ₪32.60, against ₪33.80 for one Classic jug.</p>
      </div>
    </div>
  </section>
'''

# the coffee bar: where is your event? Each choice shows their own photo of a bar in that kind of place (3h.10)
PLACES = [('home', 'At home', '06-home-celebration-v3', 'Our coffee bar on a dining table at home, the dispenser with milk, syrups and cups'),
          ('garden', 'In a garden', '02-garden-reception-v3', 'Two of our dispensers on a long white table in a sunlit courtyard'),
          ('office', 'At the office', '03-modern-meeting-v3', 'Our coffee bar on a wooden counter in a bright meeting room'),
          ('evening', 'In the evening', '09-terrace-two-v3', 'Two of our dispensers on a terrace at dusk, lit from inside')]
BAR = BY['bar-premium']
BARS = f'''  <section class="sec bars" id="bars" data-place="home" aria-labelledby="h-bar">
    <div class="wrap bar-grid">
      <div class="bar-ph rev">{''.join(f'<img class="{"on" if i == 0 else ""}" data-p="{k}" src="assets/{f}.webp" alt="{escape(a, True)}" width="1200" height="800" loading="lazy" decoding="async">' for i, (k, _, f, a) in enumerate(PLACES))}</div>
      <div class="bar-t rev">
        <h2 id="h-bar">Make it a coffee bar.</h2>
        <p class="lede">Your guests pour their own iced coffee. Tell us how many are coming and we put it all together.</p>
        <div class="seg" role="group" aria-label="Where is your event?">{''.join(f'<button type="button" data-p="{k}" aria-pressed="{"true" if i == 0 else "false"}">{t}</button>' for i, (k, t, _, _) in enumerate(PLACES))}</div>
        <div class="bar-buy">
          <div><h3>{escape(BAR['name'])}</h3>{price_row(BAR)}</div>
          <button class="btn" type="button" data-add="bar-premium">Add the coffee bar</button>
        </div>
        <p class="hint">Dispenser, cold brew, milk, cups, straws and three syrups in one box. We confirm the price for your guest count on WhatsApp.</p>
        <p><a class="lnk" href="shop.html?c=Coffee%20bars">Extra cups and syrups <span class="arw" aria-hidden="true"></span></a></p>
      </div>
    </div>
  </section>
'''

STORY = '''  <section class="sec story" id="story" aria-labelledby="h-st">
    <div class="wrap st-grid">
      <div class="rev">
        <h2 id="h-st">It started in a basement</h2>
        <p class="lede">Our founder loved coffee but could not find any in Israel that met his standards, so he started brewing it in his basement. Today our cold brew goes all around the country.</p>
        <dl class="two">
          <div><dt>Brewed for hours, not minutes</dt><dd>Cold water and time bring out the sweet, chocolatey side of the coffee and leave the bitterness behind.</dd></div>
          <div><dt>Beans chosen for cold brew</dt><dd>From Colombia, Honduras, Costa Rica and beyond, in dark, medium and light roasts, each picked because it tastes great cold.</dd></div>
        </dl>
      </div>
      <figure class="rev"><img src="assets/07-minis.webp" alt="A pack of four Original Cream Latte minis on ice in a wooden tray" width="1536" height="1024" loading="lazy" decoding="async"></figure>
    </div>
  </section>
'''

HOW = f'''  <section class="sec how" id="how" aria-labelledby="h-how">
    <div class="wrap">
      <h2 id="h-how" class="rev">How ordering works</h2>
      <ol class="how-l rev">
        <li><b>Choose your coffee</b><span>Bottles, mini packs, jugs, syrups or a whole coffee bar.</span></li>
        <li><b>Delivery or pickup</b><span>{DELIVERY}. Pickup is free.</span></li>
        <li><b>Send it on WhatsApp</b><span>Your order opens written out. We confirm it with you there, with the delivery fee.</span></li>
      </ol>
      <aside class="deliv rev" aria-label="Delivery">
        <div><h3>Order by Wednesday, receive by Shabbat</h3><p>Regular delivery to Jerusalem and Beit Shemesh; across Israel in 2 to 5 days, or 1 to 2 expedited. Pickup is free.</p></div>
        <a class="btn" href="shop.html">Shop cold brew</a>
      </aside>
    </div>
  </section>
'''

HOME_TAIL = '<script src="assets/catalog.js"></script>\n<script src="catalog.js"></script>\n<script src="slides.js"></script>\n<script src="home.js"></script>\n'
BASE_TAIL = '<script src="assets/catalog.js"></script>\n<script src="catalog.js"></script>\n'

SITE.write('index', 'Gremier Coffee Co. · Cold brew and coffee bars',
           'Cold brew brewed for hours, not minutes: litre bottles from ₪49, minis, 5 litre jugs and coffee bars for events from ₪349. Delivered across Israel.',
           'og.webp', OPENING + FRIDGE + KBAND + MINI + OFFICE + BARS + STORY + HOW + kit.gallery('From our coffee bars') + kit.faq('Your questions'), HOME_TAIL)


# ── shop ─────────────────────────────────────────────────────────────────────
def group(c, first):
    ins = [i for i in ITEMS if i['cat'] == c]
    return (f'<div class="grp" data-c="{escape(c, True)}"><h2 data-f="group">{escape(c)}</h2>'
            f'<ul class="cards four" data-f="items">{"".join(card(i, not (first and k < 4)) for k, i in enumerate(ins))}</ul></div>')


CHIPS = ''.join(f'<button class="chip" type="button" data-c="{escape(c, True)}">{escape(c)}</button>' for c in CATS)
SHOP = kit.shop_page(SITE, ITEMS, CATS, popular='classic', wa='972552703413', gig='bb714c5a-f354-4fda-8f82-441e68b13067',
                     title_html='Shop cold brew', lede='Litre bottles, mini packs, jugs, syrups and coffee bars. Tap one to see it, or Add it straight to your basket.',
                     delivery_hint=f'{DELIVERY}. We confirm the fee on WhatsApp.', lead_days=2, addon='caramel-syrup',
                     addon_line='Make it your own', note_label='Anything else, for example how many guests for a coffee bar')
SITE.write('shop', 'Shop · Gremier Coffee Co.',
           f'All {len(ITEMS)} Gremier products: Classic, House Blend, Colombia, Sweetened and Decaf cold brew, latte minis, jugs, syrups and coffee bars.',
           'og.webp', SHOP + SITE.gift_section(), BASE_TAIL + '<script src="shop.js"></script>\n<script src="gift.js"></script>\n')


# ── contact ──────────────────────────────────────────────────────────────────
CONTACT = SITE.page_head('Talk to us', 'Questions about an order, delivery, coffee bars or anything else? WhatsApp is the fastest way to reach us.') + f'''  <section class="sec c-sec" style="padding-top:var(--s6)">
    <div class="wrap c-grid">
      <ul class="reach">
        <li><b>WhatsApp</b><a href="https://wa.me/972552703413" target="_blank" rel="noopener">{PHONE}</a><p>For existing orders too, so we can help quickly.</p></li>
        <li><b>Email</b><a href="mailto:{MAIL}">{MAIL}</a></li>
        <li><b>Delivery</b><p>{DELIVERY}.</p><p>Regular 2 to 5 days, expedited 1 to 2 days, events on the date and time you choose. Pickup is free.</p></li>
        <li><b>Kosher</b><p>Under Rabbi Shmuel Weiner.</p></li>
      </ul>
      <figure><img src="assets/10-bright-minimal-v3.webp" alt="Our coffee bar on a white table in a bright hall: the dispenser, milk, syrups, cups and straws" width="1200" height="800" fetchpriority="high"></figure>
    </div>
  </section>
''' + kit.faq('Your questions')
SITE.write('contact', 'Contact · Gremier Coffee Co.',
           f'WhatsApp Gremier Coffee on {PHONE} or email us. Order by Wednesday, receive by Shabbat in Jerusalem and Beit Shemesh.',
           'og.webp', CONTACT, BASE_TAIL)

for p in ('index', 'shop', 'contact'):
    h = open(f'{p}.html', encoding='utf8').read()
    open(f'{p}.html', 'w', encoding='utf8').write(head_extra(h, p == 'index'))
print('built', len(ITEMS))
