"""Gifted Israel's pages. Run from the build folder: python gen/build.py (after gen/assets.py).
Words are theirs: their flyer, listing and GiftedIsrael.com. Nothing about delivery, payment, engraving price or
lead time is stated beyond what those say; those wait for OWNER-QUESTIONS.md."""
import json
import re
import sys
from html import escape

sys.path.insert(0, '../../starter')
import sitekit as kit  # noqa: E402

kit.KINDS['phone'] = ('Call', 'tel:+{d}', False)  # their site shows the US number with a phone sign; WhatsApp on it is asked
GI = json.loads(re.search(r'window\.GI = (.*);\s*$', open('assets/catalog.js', encoding='utf8').read(), re.S).group(1))
ITEMS = GI['items']
BY = {i['name']: i for i in ITEMS}
ORDER = ['Chanukah', 'Shabbos', 'Havdalah', 'Rosh Hashana', 'Judaica', 'Home & Decor', 'Games & Gifts']
COUNT = len(ITEMS)
CHEAPEST = min(i['price'] for i in ITEMS)


def money(n):
    return f'₪{n:g}'


SITE = kit.Site(
    name='Gifted Israel', short='Gifted Israel', slug='gifted-israel',
    pages=[('index', 'Home'), ('shop', 'Shop'), ('contact', 'Contact')],
    contacts=[kit.Contact('whatsapp-only', '+972 55-331-1744'), kit.Contact('phone', '+1 929-996-7704'), kit.Contact('email', 'giftedbyadele@gmail.com')],
    fonts='family=David+Libre&family=Alef:wght@400;700',
    cta=('shop.html', 'Shop the collection'), bar=(f'From {money(CHEAPEST)}', f'{COUNT} pieces. We deliver.'),
    place='Israel', close_title='For all your gifting needs',
    mark_html='<img src="assets/mark.png" alt="" width="34" height="28">',
    close_extra='GIFTED',
    about='For all your gifting needs. Carrying a full line of Waterdale products in Israel.',
    ordering=('Ordering', ['We deliver', 'Your order opens in WhatsApp, written out for you']),
    ld_type='Store')


def head_extra(html):
    # the category of rules 3t, on every page
    html = html.replace('<span class="arw" aria-hidden="true">→</span>', '<span class="arw" aria-hidden="true">↗</span>').replace('<span class="arw" aria-hidden="true"></span>', '<span class="arw" aria-hidden="true">↗</span>')
    html = html.replace('<link rel="preconnect" href="https://fonts.googleapis.com">', '<meta name="site-category" content="fashion-shop">\n<link rel="preconnect" href="https://fonts.googleapis.com">', 1)
    if 'id="gifts"' in html:
        # the home page: what it sells, one kind (rules 3g.18), and where the button colour is in their own product (3g.19, BRAND.md)
        html = html.replace('<meta name="site-category" content="fashion-shop">', '<meta name="site-category" content="fashion-shop">\n<meta name="offers" content="gifts">\n<meta name="product-colour" content="#7A351B" data-from="assets/g/gia0015d7c59.webp">', 1)
    return html


def card(it, lazy=True):
    load = ' loading="lazy" decoding="async"' if lazy else ' fetchpriority="high"'
    return (f'<li class="pc"><a class="pc-a" data-f="link" data-id="{it["id"]}" href="shop.html?p={it["id"]}">'
            f'<span class="pc-ph"><img data-f="img" src="assets/p/{it["id"]}.webp" alt="{escape(it["name"], True)}" width="{it["w"]}" height="{it["h"]}"{load}></span>'
            f'<span class="pc-t"><b data-f="name">{escape(it["name"])}</b><span data-f="price">{money(it["price"])}</span></span></a></li>')


def piece(cls='', attrs='', size=900, eager=False):
    src = 'assets/hero-menorah-900.webp'
    extra = ' fetchpriority="high"' if eager else ' loading="lazy" decoding="async"'
    return (f'<figure class="piece {cls}" {attrs}><img src="{src}" alt="The Diamond Menorah: clear Lucite with a gold mirrored base" width="{size}" height="{size}"{extra}>'
            '<span class="engr" aria-hidden="true"></span><span class="spark" aria-hidden="true"></span></figure>')


GIFTS = json.loads(open('assets/gifts.js', encoding='utf8').read().replace('window.GIFTS = ', '', 1).rstrip().rstrip(';'))
OCC_CHIPS = ''.join(f'<button class="chip" type="button" aria-pressed="{"true" if i == 0 else "false"}">{escape(k)}</button>' for i, k in enumerate(GIFTS['occ']))
PILE_NOJS = ''.join(f'<img src="assets/g/{g["id"]}.webp" alt="" width="{g["w"]}" height="{g["h"]}">' for g in GIFTS['pool'][:12])
OPENING = f'''  <section class="gifts" id="gifts" aria-labelledby="h-open">
    <div class="g-words" id="g-words">
      <div class="g-head">
        <h1 id="h-open" data-arrive style="--d:100">For all your gifting needs</h1>
        <a class="btn" href="shop.html" data-arrive style="--d:250">Shop the collection <span class="arw" aria-hidden="true"></span></a>
      </div>
      <ul class="btn-facts" data-arrive style="--d:300"><li>From <b>{money(CHEAPEST)}</b></li><li><b>{COUNT}</b> pieces</li><li>We deliver</li></ul>
      <div class="g-q-row" data-arrive style="--d:350"><h2 class="g-q" id="g-q">What is the occasion?</h2><a class="lnk g-all" href="shop.html">Shop all <span class="arw" aria-hidden="true"></span></a></div>
      <div class="g-occ" id="g-occ" data-motion-flow role="group" aria-labelledby="g-q" data-arrive style="--d:400">{OCC_CHIPS}</div>
    </div>
    <div class="g-caps" id="g-caps" aria-live="polite"></div>
    <div class="g-pile" id="g-pile" aria-hidden="true"><noscript>{PILE_NOJS}</noscript></div>
  </section>
'''

SHOW = ['Diamond Menorah', 'Pearlstone Oil Jug Chanukah Block', 'Painted Chanukah Block', 'Painted by Batya Chanukah Block',
        'Classic Luxe Dreidel Card + Block', 'Classic 2.0 Chanukah Brachos Match Cloche', 'Painted by Batya Menorah Tray', 'Onyx Tabletop Chanukah Brachos']
CHANUKAH = f'''  <section class="sec" id="chanukah" aria-labelledby="h-ch" style="padding-top:var(--s7)">
    <div class="wrap rev">
      <h2 id="h-ch">Set for Chanukah</h2>
      <ul class="cards">{''.join(card(BY[n]) for n in SHOW[:4])}</ul>
      <p class="sec-foot"><a class="lnk" href="shop.html?c=Chanukah">All {sum(1 for i in ITEMS if i['cat'] == 'Chanukah')} Chanukah pieces <span class="arw" aria-hidden="true"></span></a></p>
    </div>
  </section>
'''

M = BY['Diamond Menorah']
STUDIO = f'''  <section class="sec studio" id="engrave" aria-labelledby="h-en">
    <div class="wrap rev">
      {piece('s-piece', 'id="s-piece"', 900, False)}
      <div>
        <h2 id="h-en">Add your engraving</h2>
        <p class="lede">Type a name or a date to see how it could look.</p>
        <div class="row-name"><h3>{escape(M['name'])}</h3><span class="pr">{money(M['price'])}</span></div>
        <label class="f" for="engr-in">Your engraving</label>
        <input class="fld" id="engr-in" maxlength="28" autocomplete="off" value="The Cohen Family">
        <p class="hint">A preview. We confirm the wording, the price and where it goes with you on WhatsApp before we engrave.</p>
        <a class="btn" id="engr-add" href="shop.html#order">Add with engraving, {money(M['price'])}</a>
      </div>
    </div>
  </section>
'''

REPS = {'Chanukah': 'Pearlstone Oil Jug Chanukah Block', 'Shabbos': 'Resin Curve Hadlokas Neiros Tray', 'Havdalah': 'Facet Havdalah Candle', 'Rosh Hashana': 'Bee Honey Dish',
        'Judaica': 'Painted Kosel Tzedakah Box', 'Home & Decor': 'Mauve Faux Floral', 'Games & Gifts': 'Leather Tic Tac Toe'}


def year_card(c, on):
    ins = [i for i in ITEMS if i['cat'] == c]
    rep = BY[REPS[c]]
    return (f'<a class="yc{" on" if on else ""}" href="shop.html?c={c.replace("&", "%26").replace(" ", "%20")}">'
            f'<img src="assets/p/{rep["id"]}.webp" alt="" width="{rep["w"]}" height="{rep["h"]}" loading="lazy" decoding="async">'
            f'<div><h3>{escape(c)}</h3><p class="yc-m">{len(ins)} pieces, from {money(min(i["price"] for i in ins))}</p></div>'
            '<span class="yc-go">Shop <span class="arw" aria-hidden="true"></span></span></a>')


YEAR = f'''  <section class="sec" id="occasions" aria-labelledby="h-oc">
    <div class="wrap rev">
      <h2 id="h-oc">Shop by category</h2>
      <div class="year">{''.join(year_card(c, c == 'Chanukah') for c in ORDER)}</div>
    </div>
  </section>
'''

WHO = '''  <section class="sec who" id="who" aria-labelledby="h-who">
    <div class="wrap rev">
      <video src="assets/chanukah.mp4" poster="assets/chanukah-poster.webp" width="606" height="760" muted loop playsinline preload="none" data-play aria-label="Our Painted by Batya Chanukah pieces set out on a table"></video>
      <div>
        <h2 id="h-who">The full Waterdale line, here in Israel</h2>
        <p class="lede">Gifted Israel carries a full line of Waterdale products in Israel. Looking for the perfect gift? Tell us who it is for and we help you choose, on WhatsApp.</p>
        <p style="margin-top:var(--s5)"><a class="lnk" href="https://wa.me/972553311744" target="_blank" rel="noopener">Chat on WhatsApp <span class="arw" aria-hidden="true"></span></a></p>
      </div>
    </div>
  </section>
'''

HOW = '''  <section class="sec how" id="how" aria-labelledby="h-how">
    <div class="wrap rev">
      <h2 id="h-how">How ordering works</h2>
      <ol>
        <li><b>Choose your pieces</b><span>Pick the finish and nusach, and add engraving where a piece offers it.</span></li>
        <li><b>Choose the day</b><span>Tell us where to deliver and when you need it.</span></li>
        <li><b>Send it on WhatsApp</b><span>Your order opens written out. We confirm it with you there, with the delivery fee.</span></li>
      </ol>
    </div>
  </section>
'''

SCRIPTS_HOME = '''<script src="assets/catalog.js"></script>
<script src="gifted.js"></script>
<script src="assets/gifts.js"></script>
<script src="gifts-open.js"></script>
<script>
(function () {
  var GI = window.GI, s = document.getElementById('s-piece'), inp = document.getElementById('engr-in'), add = document.getElementById('engr-add');
  var id = GI.items.filter(function (i) { return i.name === 'Diamond Menorah'; })[0].id;
  function ready(f) { if (document.fonts && document.fonts.ready) document.fonts.ready.then(f); else f(); }
  ready(function () {
    GI.engrave(s, inp.value, false);
  });
  addEventListener('resize', function () { GI.engrave(s, inp.value || ' ', false); });
  inp.addEventListener('input', function () { GI.engrave(s, inp.value || ' ', false); add.firstChild.textContent = (inp.value.trim() ? 'Add with engraving, ' : 'Add, ') + GI.money(GI.by[id].price); });
  add.addEventListener('click', function () { GI.add(GI.key(id, '', '', inp.value.trim()), 1); });
  // their clip plays only while it is on screen, and never with motion off
  var v = document.querySelector('video[data-play]');
  if (v && !matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { v.preload = 'auto'; v.play().catch(function () {}); } else v.pause(); }); }, { threshold: .4 }).observe(v);
})();
</script>
'''


def group(c):
    ins = [i for i in ITEMS if i['cat'] == c]
    return f'<div class="grp" data-c="{escape(c, True)}"><h2 data-f="group">{escape(c)}</h2><ul class="cards" data-f="items">{"".join(card(i, not (c == ORDER[0] and k == 0)) for k, i in enumerate(ins))}</ul></div>'


CHIPS = ''.join(f'<button class="chip" type="button" data-c="{escape(c, True)}">{escape(c)}</button>' for c in ORDER)

SHOP = f'''{SITE.page_head('The collection', f'{COUNT} pieces from the Waterdale Collection. Tap a piece to see it, choose its finish and add it.')}
  <div class="wrap"><p style="margin:var(--s5) 0 0"><button class="btn-line" id="st-add" type="button">Add the Diamond Menorah, {money(M['price'])}</button></p></div>
  <div class="wrap">
    <div class="filters" id="filters" role="group" aria-label="Go to a category"><div class="chips">{CHIPS}</div></div>
    <div id="cat" data-mir-catalog data-href="shop.html?add={{name}}" data-other="More gifts" data-out="Out of stock">
      <div data-mir-list>{''.join(group(c) for c in ORDER)}</div>
      <template data-mir-group><div class="grp"><h2 data-f="group"></h2><ul class="cards" data-f="items"></ul></div></template>
      <template data-mir-item><li class="pc"><a class="pc-a" data-f="link"><span class="pc-ph"><img data-f="img" alt=""></span><span class="pc-t"><b data-f="name"></b><span data-f="price"></span></span></a></li></template>
    </div>
  </div>
  <dialog class="sheet" id="sheet" aria-labelledby="sh-name">
    <span class="grab" aria-hidden="true"></span>
    <button class="sh-close" id="sh-x" type="button" aria-label="Close">×</button>
    <div class="sh-in">
      <figure class="sh-ph"><img id="sh-img" alt="" width="800" height="800"></figure>
      <div>
        <h2 id="sh-name"></h2>
        <span class="pr" id="sh-pr"></span>
        <div id="sh-opts"></div>
        <p class="desc" id="sh-desc"></p>
        <dl class="spec" id="sh-spec"></dl>
        <div class="buy">
          <span class="step"><button type="button" data-d="-1" aria-label="One fewer">−</button><output id="sh-n">1</output><button type="button" data-d="1" aria-label="One more">+</button></span>
          <button class="btn" id="sh-add" type="button"><span>Add</span></button>
        </div>
      </div>
    </div>
  </dialog>
  <form id="form" novalidate>
  <section class="sec" id="order" aria-labelledby="h-basket">
    <div class="wrap">
      <ol class="osteps" id="steps" aria-label="Order steps">
        <li class="is-now" aria-current="step"><button type="button" data-go="1">Step 1: Your basket</button></li>
        <li><button type="button" data-go="2">Step 2: Delivery or pickup</button></li>
        <li><button type="button" data-go="3">Step 3: Your details</button></li>
      </ol>
      <div class="form">
        <div>
          <div class="card ostep" data-s="1">
            <h2 id="h-basket">Your basket</h2>
            <ul class="blist" id="sum-list"><li><span>Your basket is empty. Tap a piece above to add it.</span></li></ul>
            <p class="err" id="e-items" role="alert"></p>
          </div>
          <div class="card ostep" data-s="2" hidden>
            <h2>Delivery or pickup</h2>
            <div class="ful chips" role="radiogroup" aria-label="Delivery or pickup"><label class="chip"><input type="radio" name="ful" value="delivery" checked>Delivery</label><label class="chip"><input type="radio" name="ful" value="pickup">Pickup</label></div>
            <div id="w-addr"><label class="f" for="addr">Delivery address</label><input class="fld" id="addr" autocomplete="street-address" maxlength="160" placeholder="Street, number, city"><p class="err" id="e-addr" role="alert"></p><p class="hint">We deliver. We confirm the fee on WhatsApp.</p></div>
            <div id="w-when"><label class="f" for="when" id="when-l">Delivery day</label><input class="fld" id="when" type="date"><p class="hint" id="h-pick" hidden>We send the pickup address on WhatsApp.</p><p class="err" id="e-when" role="alert"></p><button type="button" class="chip" id="first-day" hidden>Choose the first day</button></div>
          </div>
          <div class="card ostep" data-s="3" hidden>
            <h2>Your details</h2>
            <div id="w-me"><label class="f" for="me">Your name</label><input class="fld" id="me" autocomplete="name" maxlength="80"><p class="err" id="e-me" role="alert"></p></div>
            <div id="w-ph"><label class="f" for="ph">Your phone</label><input class="fld" id="ph" type="tel" autocomplete="tel" maxlength="30"><p class="err" id="e-ph" role="alert"></p></div>
            <label class="f" for="note">Anything else</label>
            <textarea class="fld" id="note" maxlength="500"></textarea>
          </div>
        </div>
        <aside class="card sum" id="c-items" aria-live="polite">
          <h3>Your order</h3>
          <ul id="sum-mini"><li><span>Nothing yet</span></li></ul>
          <p class="sum-where" id="sum-where" hidden></p>
          <div class="total"><span>Total</span><span id="total">₪0</span></div>
          <button class="btn" id="send" type="submit"><span>Continue to delivery or pickup</span></button>
          <button class="back" id="back" type="button" hidden>Back</button>
          <p class="note" id="send-note">Next: delivery or pickup, and the day.</p>
          <p class="sent" id="sent" role="status" hidden></p>
          <a class="keep lnk" href="#cat">Keep shopping</a>
        </aside>
      </div>
    </div>
  </section>
  </form>
'''

CONTACT = f'''{SITE.page_head('Talk to us', 'Looking for something unique? Corporate gifting, custom orders and gift cards: tell us what you need.')}
  <section class="sec" style="padding-top:var(--s6)">
    <div class="wrap">
      <ul class="reach">
        <li><b>WhatsApp</b><a href="https://wa.me/972553311744" target="_blank" rel="noopener">+972 55-331-1744</a><p>Also where you can see our catalog.</p></li>
        <li><b>Call</b><a href="tel:+19299967704">+1 929-996-7704</a><p>Our US number.</p></li>
        <li><b>Email</b><a href="mailto:giftedbyadele@gmail.com">giftedbyadele@gmail.com</a></li>
      </ul>
    </div>
  </section>
'''

TITLE = 'Gifted Israel · Waterdale Judaica and gifts, delivered'
DESC = f'For all your gifting needs. A full line of Waterdale products in Israel: {COUNT} Shabbos, Havdalah and Chanukah pieces. We deliver.'

BASE_TAIL = '<script src="assets/catalog.js"></script>\n<script src="gifted.js"></script>\n'
SITE.write('index', TITLE, DESC, 'og.webp', OPENING + YEAR + CHANUKAH + STUDIO + WHO + HOW + kit.gallery('From our gallery') + kit.faq('Your questions'), SCRIPTS_HOME)
SITE.write('shop', 'Shop · Gifted Israel', f'All {COUNT} Waterdale pieces: Chanukah, Shabbos, Havdalah, Rosh Hashana, Judaica, home and games. Order on WhatsApp.', 'og.webp', SHOP + SITE.gift_section(), BASE_TAIL + '<script src="shop.js"></script>\n<script src="gift.js"></script>\n')
SITE.write('contact', 'Contact · Gifted Israel', 'Reach Gifted Israel on WhatsApp, by phone or by email, for orders, corporate gifting, custom orders and gift cards.', 'og.webp', CONTACT + kit.faq('Your questions'), BASE_TAIL)
for p in ('index', 'shop', 'contact'):
    h = open(f'{p}.html', encoding='utf8').read()
    open(f'{p}.html', 'w', encoding='utf8').write(head_extra(h))
print('built', COUNT)
