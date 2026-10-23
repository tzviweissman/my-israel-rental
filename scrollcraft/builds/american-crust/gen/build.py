"""American Crust: home, shop (menu and order on one page), contact. Run from the build folder:
python gen/build.py   (facts only from src/record.json and the owner's flyers; see message-to-owner.md)"""
import sys; sys.path.insert(0, '../../starter'); import sitekit as kit

kit.KINDS['textcall'] = ('Text or call', 'tel:+{d}', False)

SITE = kit.Site(
    name='American Crust', short='American Crust', slug='american-crust',
    pages=[('index', 'Home'), ('shop', 'Shop'), ('contact', 'Contact')],
    contacts=[kit.Contact('whatsapp-only', '+1 732 503 1703'), kit.Contact('textcall', '+972 55 336 2730')],
    fonts='family=League+Gothic&family=Barlow:wght@400;600;700&family=Heebo:wght@500;700&text=%E2%82%AA',
    cta=('shop.html#order', 'Order'), bar=('From ₪27', 'American bagel and pizza dough'),
    place='Jerusalem, ESTD 5786', close_title='Get yours today.', close_extra='American Crust',
    mark_html='<img src="assets/logo.webp" alt="" width="40" height="40">')
# the Google Fonts link above holds League Gothic and Barlow too: one request, the shekel sign from Heebo
SITE.fonts = 'family=League+Gothic&family=Barlow:wght@400;600;700&family=Heebo:wght@500;700'

TITLE = 'American Crust · American bagel and pizza dough, Jerusalem'
DESC = "The American bagel and pizza dough that you've been missing. Bagel dough ₪30, pizza dough ₪27, delivered in Ramat Eshkol and surrounding areas for ₪25."
OG = 'og.webp'

def finish(page):
    """site category meta (rule 3t) after the charset line"""
    f = f'{page}.html'
    s = open(f, encoding='utf8').read().replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="site-category" content="food-shop">', 1).replace('→</span>', '</span>')
    open(f, 'w', encoding='utf8').write(s)

P = kit.price
ICON = {
    'quality': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.4 6.8 19.2l1-5.9L3.5 9.2l5.9-.8z"/></svg>',
    'fresh': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5"/></svg>',
    'pareve': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
}

CARDS = f'''  <section class="buy" id="buy" aria-label="Our doughs">
    <div class="pcs">
      <article class="pc" data-tilt>
        <div class="ph"><img src="assets/bagel-dough.webp" alt="American style bagel dough: six pre shaped bagels in their tray" width="590" height="443" fetchpriority="high"></div>
        <div class="info">
          <h3>American style bagel dough</h3>
          <p class="sub">6 pre shaped bagels</p>
          <p class="mk">Makes 6 bagels</p>
          <div class="row"><span class="pr">{P(30)}</span><button class="btn" type="button" data-buy="bagel" aria-label="Add American style bagel dough to your order, ₪30"><i class="chip" aria-hidden="true"></i><span>Add</span></button></div>
        </div>
      </article>
      <article class="pc night" data-tilt>
        <div class="ph"><img src="assets/pizza-dough.webp" alt="Classic American pizza dough in its tub with the American Crust label" width="480" height="360" fetchpriority="high"></div>
        <div class="info">
          <h3>Classic American pizza dough</h3>
          <p class="sub">100% parve</p>
          <p class="mk">Makes 2 personal pies (500 g)</p>
          <div class="row"><span class="pr">{P(27)}</span><button class="btn" type="button" data-buy="pizza" aria-label="Add Classic American pizza dough to your order, ₪27"><i class="chip" aria-hidden="true"></i><span>Add</span></button></div>
        </div>
      </article>
    </div>
  </section>
'''

HOME = f'''  <section class="open" id="film" aria-labelledby="h-open">
    <div class="stage">
      <canvas id="cv" aria-hidden="true"></canvas>
      <div class="wrap">
        <h1 id="h-open"><span class="w w1">Boil.</span><span class="w w2">Bake.</span><span class="w w3">Brag.</span></h1>
        <div class="end">
          <p class="lede">The American bagel and pizza dough that you've been missing, delivered in Ramat Eshkol, Jerusalem, for ₪25.</p>
          <div class="go"><a class="btn" href="#buy">Order your dough</a><p class="from">Bagel dough ₪30<br>Pizza dough ₪27</p></div>
        </div>
      </div>
    </div>
  </section>
{CARDS}
  <section class="stores" aria-labelledby="h-stores">
    <div class="wrap">
      <h2 id="h-stores" class="rev">Now available in</h2>
      <ul class="st-list rev">
        <li>Express Market in Geula</li>
        <li>Arzai Makolets</li>
        <li>Good Market on Paran</li>
      </ul>
    </div>
  </section>

  <section class="sec bake" aria-labelledby="h-bake">
    <div class="wrap">
      <figure class="rev"><img src="assets/baked-wide.webp" alt="Everything bagels on baking paper" width="720" height="625" loading="lazy"></figure>
      <div class="rev">
        <h2 id="h-bake">America Just Landed in Your <span class="u">Kitchen</span>.</h2>
        <p class="t">Make fresh American tasting bagels straight from your home. Just follow our simple instructions and enjoy. For pizza, meat pizza or classic American pie, this dough is sure to impress.</p>
        <ul class="facts" aria-label="About our dough">
          <li>{ICON['pareve']}Pareve</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="sec get" aria-labelledby="h-get">
    <div class="wrap">
      <h2 id="h-get" class="rev">Delivery, payment and kosher</h2>
      <div class="tiles rev">
        <div class="tile"><h3>Delivery</h3><p>Delivery ₪25 in Ramat Eshkol and surrounding areas. Further away, the fee depends on where: we confirm it on WhatsApp.</p></div>
        <div class="tile"><h3>Payment</h3><p>Cash or Zelle.</p></div>
        <div class="tile"><h3>Kosher</h3><p>Pareve, with the hechsher of Rabbi Akiva Dershowitz.</p></div>
      </div>
    </div>
  </section>

  <section class="sec faq" id="faq" aria-labelledby="h-faq">
    <div class="wrap">
      <h2 id="h-faq">Your questions</h2>
      <div class="faq-list"><details class="faq-q" open><summary>Is your dough parve?</summary><p>Yes, our products are 100% parve.</p></details></div>
    </div>
  </section>
{kit.gallery('From our kitchen')}'''

HOME_JS = '''<script>
(function () {
  var NAMES = { bagel: 'American style bagel dough', pizza: 'Classic American pizza dough' };
  [].forEach.call(document.querySelectorAll('[data-buy]'), function (b) {
    b.addEventListener('click', function () {
      var k = b.dataset.buy, bk = window.siteBasket.get(); bk[k] = Math.min(20, (+bk[k] || 0) + 1); window.siteBasket.set(bk);
      window.siteToast('Added: ' + NAMES[k]); b.classList.add('added'); b.querySelector('span').textContent = 'Added'; setTimeout(function () { b.classList.remove('added'); b.querySelector('span').textContent = 'Add'; }, 1100);
    });
  });
  // the opening film (rule 3h), chosen by scroll as on The Brown Box (Tzvi: "once the video ends they cant see it again"):
  // 150 frames on a canvas, loaded in passes (every 8th, then 4th, 2nd, all) so it scrubs early and sharpens; each word
  // lights on its chapter (Boil from the start, Bake at 0.40, Brag at 0.59: the joins of gen/film.sh)
  var film = document.getElementById('film'), cv = document.getElementById('cv');
  if (film && cv) {
    var cx = cv.getContext('2d'), still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var kind = innerWidth <= 760 ? 'm' : 'd', N = 150, imgs = new Array(N), p = 0;
    var url = function (i) { return 'assets/film/' + kind + '/' + String(i + 1).padStart(4, '0') + '.webp'; };
    cv.style.background = '#141414 url(' + url(still ? N - 1 : 0) + ') center / cover no-repeat';
    var order = [], seen = {};
    [8, 4, 2, 1].forEach(function (st) { for (var i = 0; i < N; i += st) if (!seen[i]) { seen[i] = 1; order.push(i); } });
    if (still) order = [N - 1];
    (function next(k) {
      var batch = order.slice(k, k + 6), left = batch.length; if (!left) return;
      batch.forEach(function (i) { var im = new Image(); im.decoding = 'async'; im.onload = im.onerror = function () { if (im.naturalWidth) imgs[i] = im; if (--left === 0) { draw(); next(k + 6); } }; im.src = url(i); });
    })(0);
    var frameAt = function (q) { var f = Math.round(q * (N - 1)); for (var d = 0; d < N; d++) { if (imgs[f - d]) return imgs[f - d]; if (imgs[f + d]) return imgs[f + d]; } return null; };
    var draw = function () {
      var im = frameAt(still ? 1 : p); if (!im) return;
      var W = cv.width, H = cv.height, sc = Math.max(W / im.naturalWidth, H / im.naturalHeight), w = im.naturalWidth * sc, h = im.naturalHeight * sc;
      cx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
    };
    var size = function () { var d = Math.min(2, devicePixelRatio || 1); cv.width = cv.clientWidth * d; cv.height = cv.clientHeight * d; draw(); };
    var raf = 0;
    var paint = function () {
      raf = 0;
      var r = film.getBoundingClientRect(), span = film.offsetHeight - innerHeight;
      p = still ? 1 : Math.min(1, Math.max(0, -r.top / Math.max(1, span)));
      film.classList.toggle('c2', p >= .4); film.classList.toggle('c3', p >= .59);
      draw();
    };
    addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(paint); }, { passive: true });
    addEventListener('resize', size);
    size(); paint();
  }
  // tile T4: a product card tilts a few degrees toward the pointer (mouse only, never with reduced motion)
  if (matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches) {
    [].forEach.call(document.querySelectorAll('[data-tilt]'), function (c) {
      c.addEventListener('pointermove', function (e) { var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; c.style.transform = 'perspective(900px) rotateY(' + (x * 5).toFixed(2) + 'deg) rotateX(' + (-y * 5).toFixed(2) + 'deg)'; });
      c.addEventListener('pointerleave', function () { c.style.transform = ''; });
    });
  }
})();
</script>
'''

SITE.write('index', TITLE, DESC, OG, HOME, HOME_JS); finish('index')

# ---- shop: menu and order on one page (rules 3k) ----
SVG = lambda d: f'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="{d}"/></svg>'
SHOP = f'''  <form id="form" novalidate>
  <section class="stage" id="doughs" data-room="bagel" aria-labelledby="h-shop">
    <div class="wrap st-grid">
      <div class="st-ph">
        <img class="on" data-p="bagel" src="assets/bagel-dough.webp" alt="American style bagel dough: six pre shaped bagels in their tray" width="590" height="443" fetchpriority="high">
        <img data-p="pizza" src="assets/pizza-dough.webp" alt="Classic American pizza dough in its tub with the American Crust label" width="480" height="360">
        <img data-p="bagel-use" src="assets/baked-bagels.webp" alt="Everything bagels" width="760" height="760" loading="lazy">
        <img data-p="pizza-use" src="assets/pizza-tubs.webp" alt="Tubs of American Crust pizza dough in rows" width="1024" height="890" loading="lazy">
        <button type="button" class="st-use" id="st-use" aria-label="Show everything bagels"><img id="st-use-img" src="assets/baked-bagels.webp" alt="" width="64" height="64"></button>
      </div>
      <div class="st-info">
        <p class="kick">Shop · American Crust</p>
        <h1 id="h-shop"><span id="st-name">American style bagel dough</span></h1>
        <p class="sub2" id="st-sub">6 pre shaped bagels</p>
        <p class="st-desc" id="st-desc">Make fresh American tasting bagels straight from your home. Just follow our simple instructions and enjoy.</p>
        <p class="st-makes" id="st-makes">Makes 6 bagels</p>
        <p class="st-price"><span class="pr" id="st-price">{P(30)}</span></p>
        <div class="st-buy">
          <span class="step" role="group" aria-label="How many"><button type="button" data-d="-1" aria-label="One fewer">−</button><output id="st-n">1</output><button type="button" data-d="1" aria-label="One more">+</button></span>
          <button class="btn" type="button" id="st-add"><i class="chip" aria-hidden="true"></i><span>Add, ₪30</span></button>
        </div>
        <p class="st-in" id="st-in" aria-live="polite"></p>
        <ul class="facts st-facts" aria-label="About this dough">
          <li>{ICON['pareve']}Pareve, hechsher from Rabbi Akiva Dershowitz</li><li data-for="pizza">{ICON['quality']}Premium quality</li><li data-for="pizza">{ICON['fresh']}Fresh and ready to use</li>
        </ul>
        <div class="st-pick" aria-label="Our doughs">
          <button type="button" data-p="bagel" aria-pressed="true"><img src="assets/bagel-dough.webp" alt="" width="44" height="44"><span>Bagel dough<br>₪30</span></button>
          <button type="button" data-p="pizza" aria-pressed="false"><img src="assets/pizza-dough.webp" alt="" width="44" height="44"><span>Pizza dough<br>₪27</span></button>
        </div>
      </div>
    </div>
  </section>

  <section class="sec" id="order" aria-labelledby="h-basket">
    <div class="wrap">
      <ol class="osteps" id="steps" aria-label="Order steps">
        <li class="is-now" aria-current="step"><button type="button" data-go="1">Step 1: Your basket</button></li>
        <li><button type="button" data-go="2">Step 2: Delivery</button></li>
        <li><button type="button" data-go="3">Step 3: Your details</button></li>
      </ol>
      <div class="form">
        <div>
          <div class="card ostep" data-s="1">
            <h2 id="h-basket">Your basket</h2>
            <ul class="blist" id="sum-list"><li><span>Your basket is empty. Pick a dough above.</span></li></ul>
            <p class="bakes" id="bakes" hidden><i aria-hidden="true"></i><span id="bakes-t"></span></p>
            <p class="err" id="e-items"></p>
            <a class="more lnk" href="#doughs">Add more dough</a>
          </div>
          <div class="card ostep" data-s="2" hidden>
            <h2>Delivery</h2>
            <div id="w-addr"><label class="f" for="addr">Delivery address</label><input class="fld" id="addr" autocomplete="street-address" maxlength="160" placeholder="Street, number, neighbourhood"><p class="err" id="e-addr"></p><label class="opt far"><input type="checkbox" id="far">My address is further away (Ramot, RBS or elsewhere)</label><p class="hint">Delivery ₪25 in Ramat Eshkol and surrounding areas. Further away, the fee depends on where: we confirm it on WhatsApp.</p></div>
            <div id="w-when"><label class="f" for="when" id="when-l">Delivery day</label><input class="fld" id="when" type="date"><p class="hint" id="h-when">Closed for Shabbat and holidays: those days cannot be chosen.</p><p class="err" id="e-when"></p></div>
          </div>
          <div class="card ostep" data-s="3" hidden>
            <h2>Your details</h2>
            <div id="w-me"><label class="f" for="me">Your name</label><input class="fld" id="me" autocomplete="name" maxlength="80"><p class="err" id="e-me"></p></div>
            <div id="w-ph"><label class="f" for="ph">Your phone</label><input class="fld" id="ph" type="tel" autocomplete="tel" maxlength="30"><p class="err" id="e-ph"></p></div>
            <label class="f" for="note">Anything else</label>
            <textarea class="fld" id="note" maxlength="500"></textarea>
            <p class="hint">Pay with cash or Zelle.</p>
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
          <a class="keep lnk" href="#doughs">Keep shopping</a>
        </aside>
      </div>
    </div>
  </section>
  </form>
'''
SHOP_JS = '<script>\n' + open('gen/shop.js', encoding='utf8').read() + '</script>\n'
SITE.write('shop', 'Shop · American Crust bagel and pizza dough', 'Order American style bagel dough, 6 pre shaped bagels, ₪30, and classic American pizza dough, 100% parve, ₪27. Delivery ₪25 in Ramat Eshkol and surrounding areas.', OG, SHOP, SHOP_JS); finish('shop')

# ---- contact ----
CONTACT = SITE.page_head('Contact', 'Order, ask a question, or tell us where to deliver.') + f'''  <section class="sec" style="padding-block: 1.5rem 2.5rem" aria-label="How to reach us">
    <div class="wrap">
      <div class="contact-tiles">
        <div class="tile"><h3>WhatsApp</h3><p><a class="lnk" href="https://wa.me/17325031703" target="_blank" rel="noopener">+1 732 503 1703</a></p></div>
        <div class="tile"><h3>Text or call</h3><p><a class="lnk" href="tel:+972553362730">055 336 2730</a></p></div>
      </div>
    </div>
  </section>
  <section class="sec get" aria-labelledby="h-get2" style="padding-block: 2rem">
    <div class="wrap">
      <h2 id="h-get2">Delivery and payment</h2>
      <div class="tiles">
        <div class="tile"><h3>Delivery</h3><p>Delivery ₪25 in Ramat Eshkol and surrounding areas. Further away, the fee depends on where: we confirm it on WhatsApp.</p></div>
        <div class="tile"><h3>Payment</h3><p>Cash or Zelle.</p></div>
        <div class="tile"><h3>Now available in</h3><p>Express Market in Geula, Arzai Makolets and Good Market on Paran.</p></div>
      </div>
    </div>
  </section>
  <section class="sec faq" id="faq" aria-labelledby="h-faq">
    <div class="wrap">
      <h2 id="h-faq">Your questions</h2>
      <div class="faq-list"><details class="faq-q" open><summary>Is your dough parve?</summary><p>Yes, our products are 100% parve.</p></details></div>
    </div>
  </section>
'''
# the contact page shows the numbers once, in its tiles: its closing band keeps only the line and the button
import dataclasses
dataclasses.replace(SITE, contacts=[]).write('contact', 'Contact · American Crust', 'WhatsApp +1 732 503 1703, text or call 055 336 2730. American Crust bagel and pizza dough, Jerusalem.', OG, CONTACT); finish('contact')
_c = open('contact.html', encoding='utf8').read(); open('contact.html', 'w', encoding='utf8').write(_c.replace('\n        <p></p>', ''))   # the contact close band has no numbers: no empty paragraph
print('built')
