"""Bake away: home, shop (menu and order on one page), contact. Run from the build folder:
python gen/build.py   (facts only from src/record.json and the owner's card; see message-to-owner.md)"""
import sys; sys.path.insert(0, '../../starter'); import sitekit as kit

SITE = kit.Site(
    name='Bake away', short='Bake away', slug='bake-away',
    pages=[('index', 'Home'), ('shop', 'Shop'), ('contact', 'Contact')],
    contacts=[kit.Contact('whatsapp-only', '+972 58-323-3995'), kit.Contact('email', 'malkyballon@gmail.com')],
    fonts='family=Forum&family=Work+Sans:wght@400;600;700&family=Heebo:wght@500;700',
    cta=('shop.html#order', 'Order'), bar=('From ₪16', 'Doughnuts, cakes, challah and more'),
    place='Jerusalem', close_title='Order 24 to 48 hours ahead.', close_extra='BAKE AWAY')

TITLE = 'Bake away · Homemade doughnuts, cakes and challah, Jerusalem'
DESC = ('Bake away is a home-based business in Jerusalem: doughnuts from ₪16, cakes, challah, cinnamon buns, cheesecakes and babka, '
        'all with a high-quality, homemade taste. Order 24 to 48 hours ahead. Delivery in Jerusalem and more.')
OG = 'og.webp'
P = kit.price

def finish(page):
    """site category meta (rule 3t) after the charset line; her card's line under the giant name"""
    f = f'{page}.html'
    s = open(f, encoding='utf8').read().replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="site-category" content="food-shop">', 1).replace('→</span>', '</span>')
    s = s.replace('<p class="giant" aria-hidden="true">BAKE AWAY</p>', '<p class="giant" aria-hidden="true">BAKE AWAY</p>\n    <p class="cardline">Cakes, cookies &amp; more</p>', 1)
    open(f, 'w', encoding='utf8').write(s)

def lines(text):
    """a heading whose lines each rise from a mask (heading effect H1)"""
    return ''.join(f'<span class="ln"><span>{t}</span></span>' for t in text)

FL = [('p05', 'White glaze, milk chocolate lines'), ('p06', 'Milk chocolate, crushed topping'), ('p07', 'Chocolate, caramel and white lines'), ('p08', 'White glaze, chocolate and white pearls'),
      ('p11', 'Chocolate glaze, rainbow sprinkles'), ('p12', 'White glaze, cookie crumbs'), ('p13', 'Pink glaze, sprinkles'), ('p14', 'Chocolate glaze, crunchy topping')]

# (basket key, name, what it is, picture, alt, price); cakes has a choice, so its card says Choose and opens the shop
ROOM = [
    ('diy', 'DIY kit', '8 mini cake doughnuts, icings and topping', 'diy', 'A tray of mini doughnuts beside piping bags of icing and a jar of sprinkles', 70),
    ('tray', 'Trays of cake', '24 pieces of cake', 'trays', 'A tray of cake slices: plain, marble and chocolate', 120),
    ('challah', 'Challos', 'Baked at home', 'challah', 'Three braided challos tied with brown ribbons', 40),
    ('buns', 'Cinnamon buns', '6 cinnamon buns', 'buns', 'A box of six cinnamon buns with white icing lines', 50),
    ('cakes', 'Cakes', 'Marble, honey or mocca', 'cakes', 'Three loaf cakes tied with ribbon', 45),
    ('mini', 'Mini cheesecakes', '12 no-bake mini cheesecakes', 'mini', 'A tray of twelve mini cheesecakes', 120),
    ('cheese', 'Cheesecakes', 'A variety with chocolate, caramel and more', 'cheese', 'Cheesecakes with chocolate and caramel toppings on a wooden table', 250),
    ('babka', 'Babka', 'Baked at home', 'babka', 'A babka in a paper tray tied with a brown ribbon', 60),
]

def card(k, name, what, img, alt, price):
    act = (f'<a class="btn" href="shop.html?item={k}#items" aria-label="Choose your {name.lower()}, ₪{price}"><span>Choose</span></a>' if k == 'cakes'
           else f'<button class="btn" type="button" data-buy="{k}" aria-label="Add {name} to your order, ₪{price}"><span>Add</span></button>')
    return f'''        <article class="rc rev{' r' if len(k) % 2 else ''}">
          <div class="ph"><img src="assets/{img}.webp" alt="{alt}" width="120" height="120" loading="lazy"></div>
          <div class="tx"><h3>{name}</h3><p class="w">{what}</p><div class="row"><span class="pr">{P(price)}</span>{act}</div></div>
          <p class="slide">Order 24 to 48 hours ahead</p>
        </article>
'''

SPOT_IMGS = ''.join(f'<img src="assets/dn-{i}.webp" alt="" width="900" height="780"{" class=\"on\"" if n == 0 else ""}>' for n, (i, _) in enumerate(FL))
SPOT_CHIPS = ''.join(f'<button type="button" data-i="{n}" aria-pressed="{"true" if n == 0 else "false"}" aria-label="{d}"><img src="assets/dn-{i}.webp" alt="" width="62" height="52"></button>' for n, (i, d) in enumerate(FL))

HOME = f'''  <section class="film" id="film" data-frames="150" data-src="assets/film" data-marks="0.4,0.72" aria-labelledby="h-open">
    <div class="stage">
      <canvas aria-hidden="true"></canvas>
      <div class="words">
        <p class="chap"><span class="k1">Drizzled by hand</span><span class="k2">Baked at home in Jerusalem</span><span class="k3">Order 24 to 48 hours ahead</span></p>
        <h1 id="h-open">{lines(['High-quality,', 'homemade', 'taste'])}</h1>
        <p class="lede">Doughnuts, cakes, challah and cheesecakes, baked at home in Jerusalem.</p>
        <div class="go"><a class="btn" href="shop.html#order"><span>Order</span></a><p class="from">From {P(16)} a doughnut</p></div>
      </div>
    </div>
  </section>

  <section class="spot" id="flavours" aria-labelledby="h-spot">
    <div class="sticky">
      <div class="wrap sp-grid">
        <div class="sp-l">
          <p class="kick">Doughnuts <span id="sp-n">1 of 8</span></p>
          <h2 id="h-spot" aria-live="polite"><span id="sp-name">{FL[0][1]}</span></h2>
        </div>
        <div class="sp-ph" id="sp-ph">{SPOT_IMGS}</div>
        <div class="sp-r">
          <p class="grp-l" id="sp-kl">Milky or parve</p>
          <div class="seg" role="group" aria-labelledby="sp-kl"><button type="button" data-k="milky" aria-pressed="true">Milky</button><button type="button" data-k="parve" aria-pressed="false">Parve</button></div>
          <div class="buyrow"><span class="pr">{P(16)}</span><button class="btn" type="button" id="sp-add" aria-label="Add this doughnut to your order, ₪16"><span>Add, {P(16)}</span></button></div>
          <p class="tag">Same price, milky or parve.</p>
        </div>
      </div>
      <div class="chips" id="sp-chips" role="group" aria-label="Doughnut flavours">{SPOT_CHIPS}</div>
    </div>
  </section>

  <section class="sec cream" aria-labelledby="h-cream">
    <div class="wrap">
      <div class="trio rev">
        <img src="assets/cream-p02.webp" alt="A sugar dusted doughnut filled with cream and red jam" width="1080" height="1078" loading="lazy">
        <img src="assets/cream-p03.webp" alt="A sugar dusted doughnut filled with cream" width="1080" height="1078" loading="lazy">
        <img src="assets/cream-p04.webp" alt="A sugar dusted doughnut filled with cream and chocolate" width="1080" height="1078" loading="lazy">
      </div>
      <div class="rev r">
        <h2 id="h-cream">{lines(['Cream doughnuts'])}</h2>
        <p class="t">A very wide variety of doughnuts.</p>
        <div class="buyrow"><span class="pr">{P(18)}</span><button class="btn" type="button" data-buy="cream" aria-label="Add Cream doughnuts to your order, ₪18"><span>Add</span></button></div>
      </div>
    </div>
  </section>

  <section class="sec room" id="menu" aria-labelledby="h-room">
    <div class="wrap">
      <h2 id="h-room" class="rev">{lines(['Cakes, challah and more'])}</h2>
      <div class="rcs">
{''.join(card(*r) for r in ROOM)}      </div>
    </div>
  </section>

  <section class="sec kitchen" aria-labelledby="h-kitchen">
    <div class="wrap">
      <figure class="rev"><img src="assets/tray.webp" alt="A tray of glazed doughnuts in different flavours" width="912" height="1200" loading="lazy"></figure>
      <div class="rev r">
        <h2 id="h-kitchen">{lines(['Baked at home by Malky Ballon'])}</h2>
        <p class="t">We are a home-based business offering a variety of baked goods, including cakes, challah, doughnuts, cheesecakes, and more, all featuring a high-quality, homemade taste.</p>
        <p class="who">Founded in 2020 in Jerusalem. We speak Hebrew and English.</p>
      </div>
    </div>
  </section>

  <section class="sec get" aria-labelledby="h-get">
    <div class="wrap">
      <h2 id="h-get" class="rev">{lines(['Delivery, payment and kosher'])}</h2>
      <div class="tiles rev">
        <div class="tile"><h3>Delivery</h3><p>We deliver in Jerusalem and more. We confirm the fee and your day on WhatsApp.</p></div>
        <div class="tile"><h3>Payment</h3><p>Cash, bit or bank transfer.</p></div>
        <div class="tile"><h3>Kosher</h3><p>All ingredients are Badatz Eida HaChareidis.</p></div>
      </div>
    </div>
  </section>
{kit.gallery('From our kitchen')}'''

HOME_JS = '''<script src="film.js"></script>
<script>
(function () {
  var BA = window.BA;
  // Add on a card: one into the basket
  function add(key, n) { var b = window.siteBasket.get(); b[key] = Math.min(20, (+b[key] || 0) + (n || 1)); window.siteBasket.set(b); }
  [].forEach.call(document.querySelectorAll('[data-buy]'), function (b) {
    b.addEventListener('click', function () {
      var k = b.dataset.buy; add(k); window.siteToast('Added: ' + BA.label(k)); var s = b.querySelector('span'), t = s.textContent;
      b.classList.add('added'); s.textContent = 'Added'; setTimeout(function () { b.classList.remove('added'); s.textContent = t; }, 1100);
    });
  });
  // the flavour spot (X31): the same place turns through her flavours as the scroll passes, or when a flavour is tapped
  var sec = document.getElementById('flavours'); if (!sec) return;
  var imgs = [].slice.call(sec.querySelectorAll('#sp-ph img')), chips = [].slice.call(sec.querySelectorAll('#sp-chips button')), N = imgs.length;
  var nameEl = document.getElementById('sp-name'), cntEl = document.getElementById('sp-n'), addBtn = document.getElementById('sp-add'), idx = 0, kind = 'milky', raf = 0;
  function set(i) {
    if (i === idx) return; idx = i;
    imgs.forEach(function (im, k) { im.classList.toggle('on', k === i); });
    chips.forEach(function (c, k) { c.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
    var s = document.createElement('span'); s.textContent = BA.FL[i][1]; nameEl.innerHTML = ''; nameEl.appendChild(s);
    cntEl.textContent = (i + 1) + ' of ' + N;
  }
  var off = 0;   // a tapped flavour shifts the scroll's own count, so tapping never moves the page and scrolling on carries on from the tapped one
  function scrollIdx() { var r = sec.getBoundingClientRect(), span = Math.max(1, sec.offsetHeight - innerHeight); return Math.min(N - 1, Math.max(0, Math.floor(Math.min(.999, Math.max(0, -r.top / span)) * N))); }
  function fromScroll() { raf = 0; var r = sec.getBoundingClientRect(); sec.classList.toggle('on', r.top <= innerHeight * .12 && r.bottom > innerHeight * .6); set(Math.min(N - 1, Math.max(0, scrollIdx() + off))); }
  addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(fromScroll); }, { passive: true });
  chips.forEach(function (c, i) { c.addEventListener('click', function () { off = i - scrollIdx(); set(i); }); });
  [].forEach.call(sec.querySelectorAll('.seg button'), function (b) {
    b.addEventListener('click', function () { kind = b.dataset.k; [].forEach.call(sec.querySelectorAll('.seg button'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); });
  });
  addBtn.addEventListener('click', function () {
    var k = 'dn~' + kind + '~' + BA.FL[idx][0]; add(k); window.siteToast('Added: ' + BA.label(k));
    var s = addBtn.querySelector('span'), t = s.innerHTML; addBtn.classList.add('added'); s.textContent = 'Added'; setTimeout(function () { addBtn.classList.remove('added'); s.innerHTML = t; }, 1100);
  });
  fromScroll();
})();
</script>
'''

SITE.write('index', TITLE, DESC, OG, HOME, HOME_JS); finish('index')

# ---- shop: menu and order on one page (rules 3k) ----
STAGE_IMGS = (''.join(f'<img class="cut{" on" if n == 0 else ""}" data-p="dn" data-f="{i}" src="assets/dn-{i}.webp" alt="{d}" width="900" height="780">' for n, (i, d) in enumerate(FL)) +
              ''.join(f'<img data-p="{k}" src="assets/{img}.webp" alt="{alt}" width="1000" height="800" loading="lazy">' for k, _, _, img, alt, _ in [r for r in ROOM]) +
              '<img data-p="cream" src="assets/cream-p02.webp" alt="A sugar dusted doughnut filled with cream and red jam" width="1080" height="1078" loading="lazy">')
PICK = [('dn', 'Doughnuts'), ('cream', 'Cream doughnuts')] + [(k, n) for k, n, *_ in ROOM]
PICK_HTML = ''.join(f'<button type="button" class="chipb" data-p="{k}" aria-pressed="{"true" if n == 0 else "false"}">{t}</button>' for n, (k, t) in enumerate(PICK))

SHOP = f'''  <form id="form" novalidate>
  <section class="stage" id="items" aria-labelledby="h-shop">
    <div class="wrap st-grid">
      <div class="st-l">
        <div class="st-ph" id="st-ph">{STAGE_IMGS}</div>
        <div class="st-pick" id="st-pick" role="group" aria-label="Our bakes">{PICK_HTML}</div>
      </div>
      <div class="st-info">
        <p class="kick">Shop · Bake away</p>
        <h1 id="h-shop"><span id="st-name">Doughnuts</span></h1>
        <p class="st-desc" id="st-desc"></p>
        <div class="st-opts" id="st-opts"></div>
        <div class="st-buy">
          <span class="pr" id="st-price">{P(16)}</span>
          <span class="step" role="group" aria-label="How many"><button type="button" data-d="-1" aria-label="One fewer">−</button><output id="st-n">1</output><button type="button" data-d="1" aria-label="One more">+</button></span>
          <button class="btn" type="button" id="st-add"><span>Add, ₪16</span></button>
        </div>
        <p class="st-in" id="st-in" aria-live="polite"></p>
        <ul class="facts" aria-label="About ordering">
          <li>All ingredients are Badatz Eida HaChareidis.</li><li>Order 24 to 48 hours ahead.</li>
        </ul>
      </div>
    </div>
  </section>

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
            <ul class="blist" id="sum-list"><li><span>Your basket is empty. Pick a bake above.</span></li></ul>
            <p class="err" id="e-items"></p>
            <a class="more lnk" href="#items">Add more</a>
          </div>
          <div class="card ostep" data-s="2" hidden>
            <h2>Delivery or pickup</h2>
            <div class="ful" role="radiogroup" aria-label="Delivery or pickup"><label class="opt"><input type="radio" name="ful" value="delivery" checked>Delivery</label><label class="opt"><input type="radio" name="ful" value="pickup">Pickup</label></div>
            <div id="w-addr"><label class="f" for="addr">Delivery address</label><input class="fld" id="addr" autocomplete="street-address" maxlength="160" placeholder="Street, number, neighbourhood"><p class="err" id="e-addr"></p><p class="hint">We deliver in Jerusalem and more. We confirm the fee on WhatsApp.</p></div>
            <div id="w-when"><label class="f" for="when" id="when-l">Delivery day</label><input class="fld" id="when" type="date"><p class="hint" id="h-pick" hidden>We send the pickup address on WhatsApp.</p><p class="hint" id="h-when">We bake to order: choose a day at least 24 hours ahead. Closed for Shabbat and holidays: those days cannot be chosen.</p><p class="err" id="e-when"></p></div>
          </div>
          <div class="card ostep" data-s="3" hidden>
            <h2>Your details</h2>
            <div id="w-me"><label class="f" for="me">Your name</label><input class="fld" id="me" autocomplete="name" maxlength="80"><p class="err" id="e-me"></p></div>
            <div id="w-ph"><label class="f" for="ph">Your phone</label><input class="fld" id="ph" type="tel" autocomplete="tel" maxlength="30"><p class="err" id="e-ph"></p></div>
            <label class="f" for="note">Anything else</label>
            <textarea class="fld" id="note" maxlength="500"></textarea>
            <p class="hint">Pay with cash, bit or bank transfer.</p>
          </div>
        </div>
        <aside class="card sum" id="c-items" aria-live="polite">
          <h3>Your order</h3>
          <ul id="sum-mini"><li><span>Nothing yet</span></li></ul>
          <p class="sum-where" id="sum-where" hidden></p>
          <div class="total"><span>Total</span><span id="total">₪0</span></div>
          <button class="btn" id="send" type="submit"><span>Continue to delivery</span></button>
          <button class="back" id="back" type="button" hidden>Back</button>
          <p class="note" id="send-note">Next: how you get it and the day.</p>
          <p class="sent" id="sent" role="status" hidden></p>
          <a class="keep lnk" href="#items">Keep shopping</a>
        </aside>
      </div>
    </div>
  </section>
  </form>
'''
SHOP_JS = '<script>\n' + open('gen/shop.js', encoding='utf8').read() + '</script>\n'
SITE.write('shop', 'Shop · Bake away doughnuts, cakes, challah and cheesecakes',
           'Order Bake away doughnuts from ₪16, cream doughnuts ₪18, cakes, challos, cinnamon buns, cheesecakes and babka. Order 24 to 48 hours ahead; delivery in Jerusalem and more, confirmed on WhatsApp. Pay with cash, bit or bank transfer.', OG, SHOP, SHOP_JS); finish('shop')

# ---- contact ----
CONTACT = SITE.page_head('Contact', 'Order, ask a question, or tell us where to deliver.') + f'''  <section class="sec" style="padding-block: 1.5rem 1.5rem" aria-label="How to reach us">
    <div class="wrap">
      <div class="contact-tiles">
        <div class="tile"><h3>WhatsApp</h3><p><a class="lnk" href="https://wa.me/972583233995" target="_blank" rel="noopener">+972 58-323-3995</a></p></div>
        <div class="tile"><h3>Email</h3><p><a class="lnk" href="mailto:malkyballon@gmail.com">malkyballon@gmail.com</a></p></div>
      </div>
    </div>
  </section>
  <section class="sec get" aria-labelledby="h-get2" style="padding-block: 1.5rem 2rem">
    <div class="wrap">
      <h2 id="h-get2">Delivery, payment and ordering ahead</h2>
      <div class="tiles">
        <div class="tile"><h3>Delivery</h3><p>We deliver in Jerusalem and more. We confirm the fee and your day on WhatsApp.</p></div>
        <div class="tile"><h3>Payment</h3><p>Cash, bit or bank transfer.</p></div>
        <div class="tile"><h3>Order ahead</h3><p>Order 24 to 48 hours ahead. All ingredients are Badatz Eida HaChareidis.</p></div>
      </div>
    </div>
  </section>
'''
import dataclasses
dataclasses.replace(SITE, contacts=[]).write('contact', 'Contact · Bake away', 'WhatsApp +972 58-323-3995 or email malkyballon@gmail.com. Bake away, Jerusalem: order 24 to 48 hours ahead, delivery in Jerusalem and more.', OG, CONTACT); finish('contact')
_c = open('contact.html', encoding='utf8').read(); open('contact.html', 'w', encoding='utf8').write(_c.replace('\n        <p></p>', ''))   # the contact close band has no numbers: no empty paragraph
print('built')
