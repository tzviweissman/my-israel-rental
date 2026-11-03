"""Krysp: home, shop (menu and order on one page), contact. Run from the build folder:
python gen/build.py   (facts only from src/record.json; see OWNER-QUESTIONS.md for what is still unknown)"""
import dataclasses, os, sys
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
sys.path.insert(0, '../../starter'); import sitekit as kit

SITE = kit.Site(
    name='Krysp', short='Krysp', slug='krysp',
    pages=[('index', 'Home'), ('shop', 'Shop'), ('contact', 'Contact')],
    contacts=[kit.Contact('whatsapp-only', '+972 53-485-7841'), kit.Contact('email', 'kryspboards@gmail.com')],
    fonts='family=Nunito:wght@800;900&family=Mulish:wght@400;700;800',
    cta=('shop.html#order', 'Order'), bar=('Luxe, $38', 'Deluxe peanut chew board'),
    mark_html='<img src="assets/mark.webp" alt="" width="40" height="40">',
    about='We’re a home business making deluxe peanut chew boards.',
    ordering=('Ordering', ['Order on WhatsApp', 'Made at home in Jerusalem']),
    place='Jerusalem', close_title='Order your Luxe board, $38', close_extra='KRYSP')

TITLE = 'Krysp · Deluxe peanut chew boards, Jerusalem'
DESC = ('Krysp is a home business in Jerusalem making deluxe peanut chew boards under the strict hashgacha of Rabbi Wiener. '
        'The Luxe board is $38. Order on WhatsApp.')
OG = 'og.webp'
P = lambda n: kit.price(n, 'USD')

def finish(page):
    """site category meta after the charset line (rule 3t)"""
    f = f'{page}.html'
    s = open(f, encoding='utf8').read().replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="site-category" content="food-shop">', 1).replace(' <span class="arw" aria-hidden="true">→</span>', '')
    open(f, 'w', encoding='utf8').write(s)

# a thin crack between sections: one main line and a branch, drawn in as it comes into view (reveal R14)
CRACKS = [
    ('M0 15 L130 11 L190 19 L310 8 L400 18 L520 10 L610 20 L760 9 L850 17 L980 12 L1080 19 L1200 14', 'M610 20 L632 28 M310 8 L296 1'),
    ('M0 13 L90 18 L210 9 L330 17 L470 8 L560 16 L700 11 L830 20 L950 10 L1070 17 L1200 12', 'M470 8 L482 0 M830 20 L846 29'),
]
def crack(i=0):
    a, b = CRACKS[i % 2]
    return f'<svg class="crack" viewBox="0 0 1200 30" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="{a}"/><path d="{b}"/></svg>\n'

def hh(t):
    """a heading whose letters close up as it arrives (heading effect H10)"""
    return f'<span class="hh">{t}</span>'

SEAM = ('<svg class="seam" viewBox="0 0 40 1000" preserveAspectRatio="none" aria-hidden="true" focusable="false">'
        '<path d="M20 0 L14 90 L25 170 L12 270 L27 360 L16 450 L26 560 L13 650 L24 760 L17 850 L22 940 L20 1000 M16 450 L4 470 M26 560 L38 576"/></svg>')

# The advert film (gen/advert-brief.md, gen/film.sh, 2 Nov 2026): peanut butter and chocolate swirl round the whole chew,
# a close-up, the halves broken open on a board, then her real board dissolves in. Marks follow film.sh's joins (11.2 s):
# c2 0.35 (3.9 s, the close-up) the intro steps back and the small price-and-Order card takes its place for the rest of
# the film (the review: half the film had no price on a laptop). No labels on the film:
# what is inside her chews is not in her record (OWNER-QUESTIONS 3).
HOME = f'''  <section class="film" id="film" aria-labelledby="h-open" data-frames="269" data-src="assets/film" data-video="assets/film/opening-{{k}}.mp4" data-marks="0.35">
    <div class="stage">
      <div class="screen"><canvas aria-hidden="true"></canvas></div>
      <div class="words">
        <h1 id="h-open">Deluxe peanut chew boards</h1>
        <div class="go"><p class="lede">Made at home in Jerusalem.</p><a class="btn" href="shop.html#order"><span>Order</span></a><ul class="btn-facts"><li>Luxe board, {P(38)}</li><li>Under the hashgacha of Rabbi Wiener</li><li>Order on WhatsApp</li></ul></div>
      </div>
      <p class="giant" aria-hidden="true">KRYSP</p>
      <div class="card"><p>Luxe board, {P(38)}</p><a class="btn" href="shop.html#order"><span>Order</span></a></div>
    </div>
  </section>

  <section class="band" aria-labelledby="h-home">
    <div class="wrap">
      <h2 id="h-home" class="rev">{hh('Made at home')}</h2>
      <p class="rev">We make our boards under the strict hashgacha of Rabbi Wiener.</p>
    </div>
  </section>

  {crack(0)}
  <section class="sec cat-sec" id="menu" aria-labelledby="h-boards">
    <div class="wrap">
      <h2 id="h-boards" class="rev">{hh('Our boards')}</h2>
      <!-- Live from her shop when the site serves this page (mir-catalog.js): the typed-in tile below shows if that data is missing. -->
      <div data-mir-catalog data-mir-skip data-href="shop.html?add={{name}}" data-out="Out of stock">
        <div data-mir-list>
          <ul class="cat">
            <li class="rev"><a href="shop.html?add=Luxe" aria-label="Luxe, $38. Add it to your order"><span class="ph"><img src="assets/luxe-sm.webp" alt="The Luxe board of peanut chews" width="900" height="675" loading="lazy"></span><span class="tx"><b>Luxe</b><span class="w">Deluxe peanut chew board</span><span class="rowp"><span class="pr">{P(38)}</span><span class="btn"><span>Add</span></span></span></span></a></li>
          </ul>
        </div>
        <template data-mir-group><div><h3 data-f="group"></h3><ul class="cat" data-f="items"></ul></div></template>
        <template data-mir-item><li class="rev in"><a data-f="link"><span class="ph"><img data-f="img" alt=""></span><span class="tx"><b data-f="name"></b><span class="rowp"><span class="pr" data-f="price"></span><span class="btn"><span>Add</span></span></span></span></a></li></template>
      </div>
    </div>
  </section>

  {crack(1)}
  <section class="sec how" aria-labelledby="h-how">
    <div class="wrap">
      <div>
        <h2 id="h-how" class="rev">{hh('Three steps to your board')}</h2>
        <a class="btn go-more" href="shop.html#order"><span>Order</span></a>
      </div>
      <ol class="hsteps rev">
        <li><div><b>Add your board</b><span>Add the Luxe board to your basket in the shop.</span></div></li>
        <li><div><b>Tell us the day</b><span>Pick your day and add a note. We confirm the day with you.</span></div></li>
        <li><div><b>Send it on WhatsApp</b><span>Your order opens in WhatsApp, written out. Send it and we reply to you.</span></div></li>
      </ol>
    </div>
  </section>
{kit.gallery(hh('Photos'))}'''

HOME_JS = '<script src="film.js"></script>' + chr(10)
SITE.write('index', TITLE, DESC, OG, HOME, HOME_JS); finish('index')

# ---- shop: menu and order on one page (rules 3k) ----
SHOP = f'''  <form id="form" novalidate>
  <section class="stage-shop" id="items" aria-labelledby="h-shop">
    <div class="wrap st-grid">
      <div class="st-l">
        <div class="st-ph" id="st-ph"><img class="on" data-p="luxe" src="assets/luxe.webp" alt="The Luxe board: peanut chews, plain and half-dipped in dark chocolate with white drizzle, on a bamboo board" width="1448" height="1086"></div>
        <div class="st-pick" id="st-pick" role="group" aria-label="Our boards"><button type="button" class="chipb" data-p="luxe" aria-pressed="true">Luxe</button></div>
      </div>
      <div class="st-info">
        <p class="kick">Shop</p>
        <h1 id="h-shop"><span id="st-name">Luxe</span></h1>
        <p class="st-desc" id="st-desc">A deluxe peanut chew board, made at home in Jerusalem.</p>
        <div class="st-buy">
          <span class="pr" id="st-price">{P(38)}</span>
          <span class="step" role="group" aria-label="How many"><button type="button" data-d="-1" aria-label="One fewer">−</button><output id="st-n">1</output><button type="button" data-d="1" aria-label="One more">+</button></span>
          <button class="btn" type="button" id="st-add"><span>Add, $38</span></button>
        </div>
        <p class="st-in" id="st-in" aria-live="polite"></p>
        <ul class="facts" aria-label="About our boards">
          <li>Made at home in Jerusalem under the hashgacha of Rabbi Wiener.</li>
          <li>You send your order on WhatsApp and we reply to you.</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="sec" id="order" aria-labelledby="h-basket">
    <div class="wrap">
      <ol class="osteps" id="steps" aria-label="Order steps">
        <li class="is-now" aria-current="step"><button type="button" data-go="1">Step 1: Your basket</button></li>
        <li><button type="button" data-go="2">Step 2: When and where</button></li>
        <li><button type="button" data-go="3">Step 3: Your details</button></li>
      </ol>
      <div class="form">
        <div>
          <div class="card ostep" data-s="1">
            <h2 id="h-basket">Your basket</h2>
            <ul class="blist" id="sum-list"><li><span>Your basket is empty. Add a board above.</span></li></ul>
            <p class="err" id="e-items"></p>
            <a class="more lnk" href="#items">Keep shopping</a>
          </div>
          <div class="card ostep" data-s="2" hidden>
            <h2>When and where</h2>
            <div id="w-when"><label class="f" for="when">Preferred day</label><input class="fld" id="when" type="date"><p class="hint">We confirm the day with you on WhatsApp.</p><p class="err" id="e-when"></p></div>
            <label class="f" for="note">A note for us</label>
            <textarea class="fld" id="note" maxlength="500"></textarea>
          </div>
          <div class="card ostep" data-s="3" hidden>
            <h2>Your details</h2>
            <div id="w-me"><label class="f" for="me">Your name</label><input class="fld" id="me" autocomplete="name" maxlength="80"><p class="err" id="e-me"></p></div>
            <div id="w-ph"><label class="f" for="ph">Your phone</label><input class="fld" id="ph" type="tel" autocomplete="tel" maxlength="30"><p class="err" id="e-ph"></p></div>
          </div>
        </div>
        <aside class="card sum" id="c-items" aria-live="polite">
          <h3>Your order</h3>
          <ul id="sum-mini"><li><span>Nothing yet</span></li></ul>
          <p class="sum-where" id="sum-where" hidden></p>
          <div class="total"><span>Total</span><span id="total">$0</span></div>
          <button class="btn" id="send" type="submit"><span>Continue to when and where</span></button>
          <button class="back" id="back" type="button" hidden>Back</button>
          <p class="note" id="send-note">Next: the day you would like and a note.</p>
          <p class="sent" id="sent" role="status" hidden></p>
          <a class="keep lnk" href="#items">Keep shopping</a>
        </aside>
      </div>
    </div>
  </section>
  </form>
'''
SHOP_JS = '<script>\n' + open('gen/shop.js', encoding='utf8').read() + '</script>\n'
SITE.write('shop', 'Shop · Krysp peanut chew boards',
           'Order the Luxe deluxe peanut chew board, $38, from Krysp, a home business in Jerusalem under the hashgacha of Rabbi Wiener. Choose the day you would like and send your order on WhatsApp.', OG, SHOP, SHOP_JS); finish('shop')

# ---- contact ----
CONTACT = SITE.page_head('Contact', 'Order, or ask us a question.') + f'''  <section class="sec" style="padding-block: 1.5rem 3rem" aria-label="How to reach us">
    <div class="wrap">
      <div class="contact-tiles">
        <div class="tile"><h3>WhatsApp</h3><p><a class="lnk" href="https://wa.me/972534857841" target="_blank" rel="noopener">+972 53-485-7841</a></p></div>
        <div class="tile"><h3>Email</h3><p><a class="lnk" href="mailto:kryspboards@gmail.com">kryspboards@gmail.com</a></p></div>
        <div class="tile"><h3>Where</h3><p>A home business in Jerusalem.</p></div>
        <div class="tile"><h3>Hashgacha</h3><p>Our boards are made under the strict hashgacha of Rabbi Wiener.</p></div>
      </div>
    </div>
  </section>
'''
SITE.write('contact', 'Contact · Krysp', 'WhatsApp +972 53-485-7841 or email kryspboards@gmail.com. Krysp, a home business in Jerusalem making deluxe peanut chew boards.', OG, CONTACT); finish('contact')
_c = open('contact.html', encoding='utf8').read(); open('contact.html', 'w', encoding='utf8').write(_c.replace(f'\n        <p>{SITE.contacts_html()}</p>', '', 1))   # the close band repeats no numbers (the tiles above have them); the footer keeps them (3v.1)
print('built')
