# RS Modest Activewear: Home, Shop, Contact. Run from the build folder:  python gen/build.py
import sys, os
sys.path.insert(0, '../../starter'); sys.path.insert(0, 'gen')
import sitekit as kit

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

# site.css = the structure from the starter (gen/base.css) + this business's own parts (gen/own.css)
open('site.css', 'w', encoding='utf8').write(open('gen/base.css', encoding='utf8').read() + open('gen/own.css', encoding='utf8').read())

SITE = kit.Site(
    name='RS Modest Activewear', short='RS Modest Activewear', slug='rs-modest-activewear',
    pages=[('index', 'Home'), ('shop', 'Shop'), ('contact', 'Contact')],
    contacts=[kit.Contact('whatsapp-only', '+972 54 615 2968'), kit.Contact('email', 'ravitandshifra@gmail.com')],
    fonts='family=Marcellus&family=Hanken+Grotesk:wght@400;500;600;700&family=Heebo:wght@500;700',
    cta=('shop.html#order', 'Basket'), bar=('₪320', 'Premium Modest Sports Skirt'),
    place='King George 31, Jerusalem', close_title='Visit us at King George 31', close_extra='RS')

BAG = '<span class="bagi" aria-hidden="true"><svg viewBox="0 0 20 22"><path class="hand" d="M6 8V5.5a4 4 0 0 1 8 0V8"/><rect class="body" x="2" y="8" width="16" height="13" rx="1"/></svg></span>'
MAPS = 'https://www.google.com/maps/search/?api=1&query=King+George+31+Jerusalem'
ARW = '<span class="arw" aria-hidden="true">→</span>'
ARW_SVG = '<svg viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6"/></svg>'
UP_SVG = '<svg viewBox="0 0 24 24"><path d="M12 20V5M6 11l6-6 6 6"/></svg>'


def post(page: str, shop_link: bool = True) -> None:
    """The bag in the menu bar (the touch), and the main action's own wording on the closing band and phone bar."""
    s = open(f'{page}.html', encoding='utf8').read()
    s = s.replace('<a class="btn-line" href="shop.html#order">Basket', '<a class="btn-line" href="shop.html#order">' + BAG + 'Basket')
    s = s.replace(f'<a class="btn" href="shop.html#order">Basket {ARW}</a>', f'<a class="btn" href="shop.html">Shop the skirt {ARW}</a>')
    if page == 'shop':
        s = s.replace(f'<a class="btn" href="shop.html">Shop the skirt {ARW}</a>', f'<a class="btn" href="#skirt">Back to the skirt <span class="arw" aria-hidden="true">' + UP_SVG + '</span></a>')
    if page != 'shop':
        s = s.replace('<a class="btn" href="shop.html#order" tabindex="-1">Basket</a>', '<a class="btn" href="shop.html" tabindex="-1">Shop the skirt</a>')
    s = s.replace('Shop the skirt <span class="arw"', 'Shop the skirt, <span class="sym">₪</span>320 <span class="arw"')
    s = s.replace('<span class="arw" aria-hidden="true">→</span>', '<span class="arw" aria-hidden="true">' + ARW_SVG + '</span>')
    # the phone bar's price is set in the body face so the shekel sign has a glyph
    s = s.replace('<p class="p"><b>₪320</b>', '<p class="p"><b><span class="sym">₪</span>320</b>')
    open(f'{page}.html', 'w', encoding='utf8').write(s)


# ── HOME ──────────────────────────────────────────────────────────────────
OPENING = f'''  <section class="open" id="open" aria-label="RS Modest Activewear">
    <div class="open-stage" id="stage">
      <div class="words">
        <div class="w1">
          <h1>Modest activewear in Jerusalem</h1>
          <p class="lede">Skirts with built-in leggings, at King George 31.</p>
          <div class="acts"><a class="btn" href="shop.html">Shop the skirt, {kit.price(320)}</a></div>
        </div>
        <div class="w2" id="w2" aria-hidden="true">
          <h2>Visit our store at 31 King George Street, Jerusalem</h2>
          <p class="lede">Skirts and activewear designed for movement and everyday wear.</p>
          <div class="acts"><a class="btn" href="shop.html" tabindex="-1">Shop the skirt, {kit.price(320)}</a><a class="lnk" href="{MAPS}" target="_blank" rel="noopener" tabindex="-1">Get directions</a></div>
        </div>
      </div>
      <div class="doorway" aria-hidden="true">
        <div class="room"><img src="assets/shop.webp" alt="" width="1800" height="2400" fetchpriority="high"></div>
        <div class="door l"><img src="assets/skirts.webp" alt="" width="1023" height="1209" fetchpriority="high"></div>
        <div class="door r"><img src="assets/skirts.webp" alt="" width="1023" height="1209" fetchpriority="high"></div>
        <div class="seam"></div>
      </div>
    </div>
  </section>
'''

PILLARS = '''  <section class="sec green pillars" id="about" aria-labelledby="h-about">
    <div class="wrap">
      <div>
        <h2 id="h-about" class="rev">Elegance, comfort and functionality</h2>
        <p class="lede rev">RS is a premium modest activewear brand for women. Stylish sports skirts and activewear, designed for movement and everyday wear.</p>
      </div>
      <div class="rail rev" aria-label="Elegance, comfort, functionality">
        <ul class="tags" id="tags">
          <li class="tag"><div class="card-t"><b>Elegance</b><i>RS</i></div></li>
          <li class="tag"><div class="card-t"><b>Comfort</b><i>RS</i></div></li>
          <li class="tag"><div class="card-t"><b>Functionality</b><i>RS</i></div></li>
        </ul>
      </div>
    </div>
  </section>
'''

SPOT = f'''  <section class="sec spot" id="skirt" aria-labelledby="h-skirt">
    <div class="wrap">
      <figure class="figure rev">
        <img src="assets/skirts.webp" alt="A black and a white RS sports skirt on a stone plinth beside an RS bag" width="1023" height="1209" loading="lazy">
        <button class="hot" type="button" style="left:55%;top:88%" aria-expanded="false" aria-label="Built-in leggings"><span>Built-in leggings</span></button>
      </figure>
      <div>
        <p class="caps rev">The skirt</p>
        <h2 id="h-skirt" class="rev">Premium Modest Sports Skirt</h2>
        <p class="lede rev">Premium sports skirt with built-in leggings.</p>
        <div class="ptag rev" aria-label="320 shekels">{kit.price(320)}</div>
        <ul class="facts rev">
          <li><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10l1.5 18h-5L12 10l-1.5 11h-5z"/></svg>Built-in leggings</li>
          <li><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="5" r="2"/><path d="M12 8v6M12 14l-4 6M12 14l4 6M6 11l6-3 6 3"/></svg>Designed for movement and everyday wear</li>
        </ul>
        <a class="btn rev" href="shop.html">Shop the skirt, {kit.price(320)}</a>
      </div>
    </div>
  </section>
'''

STORE = f'''  <section class="shotsec store" id="store" aria-labelledby="h-store">
    <img src="assets/shop.webp" alt="Inside the RS store: a rail of skirts beside the counter" width="1800" height="2400" loading="lazy">
    <div class="wrap">
      <div class="said">
        <h2 id="h-store" class="rev">Visit our store</h2>
        <p class="lede rev">Skirts and activewear designed for movement and everyday wear.</p>
        <a class="btn rev" href="shop.html">Shop the skirt, {kit.price(320)}</a>
      </div>
    </div>
  </section>
'''

DIPTYCH = f'''  <section class="shotsec dip2" id="visit" aria-labelledby="h-visit">
    <figure class="ph1"><img src="assets/sign.webp" alt="The RS sign in a green window frame" width="1109" height="1478" loading="lazy"></figure>
    <figure class="ph2"><img src="assets/bag.webp" alt="The white RS shopping bag with black ribbon handles" width="1109" height="1330" loading="lazy"></figure>
    <div class="wrap">
      <div class="said mid">
        <h2 id="h-visit" class="rev">31 King George Street</h2>
        <p class="lede rev">Jerusalem</p>
        <div class="acts rev"><a class="btn" href="shop.html">Shop the skirt, {kit.price(320)}</a><a class="lnk" href="{MAPS}" target="_blank" rel="noopener">Get directions</a></div>
      </div>
    </div>
  </section>
'''

OPEN_JS = '''<script>
(function () {
  var open = document.getElementById('open'), stage = document.getElementById('stage'), w2 = document.getElementById('w2');
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches, tick = 0;
  function ease(x) { return x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x); }
  function frame() {
    tick = 0; if (still) return;
    var r = open.getBoundingClientRect(), span = open.offsetHeight - stage.offsetHeight;
    var p = Math.min(1, Math.max(0, -r.top / (span * .85)));   // done at 85% of the pin, then a short hold
    var d = ease((p - .1) / .62), t = ease((p - .52) / .3);
    stage.style.setProperty('--d', d.toFixed(4)); stage.style.setProperty('--t', t.toFixed(4));
    var on = t > .6; w2.setAttribute('aria-hidden', on ? 'false' : 'true');
    [].forEach.call(w2.querySelectorAll('a'), function (a) { a.tabIndex = on ? 0 : -1; });
    [].forEach.call(stage.querySelectorAll('.w1 a'), function (a) { a.tabIndex = on ? -1 : 0; });
    stage.querySelector('.w1').style.visibility = t > .36 ? 'hidden' : 'visible'; w2.style.visibility = t < .45 ? 'hidden' : 'visible';
  }
  addEventListener('scroll', function () { if (!tick) tick = requestAnimationFrame(frame); }, { passive: true }); addEventListener('resize', frame); frame();

  // the hang tags swing when touched or pointed at (the rail itself hangs in as it comes into view)
  var tags = [].slice.call(document.querySelectorAll('.tag'));
  function swing(el) { el.classList.remove('sw'); void el.offsetWidth; el.classList.add('sw'); }
  tags.forEach(function (t) { t.addEventListener('pointerenter', function () { swing(t); }); t.addEventListener('click', function () { swing(t); }); });

  // the dot on the leggings
  var hot = document.querySelector('.hot');
  hot.addEventListener('click', function () { hot.setAttribute('aria-expanded', hot.getAttribute('aria-expanded') !== 'true'); });
  document.addEventListener('click', function (e) { if (!e.target.closest('.hot')) hot.setAttribute('aria-expanded', 'false'); });
})();
</script>
'''

SITE.write('index', 'RS Modest Activewear, women\'s clothing store on King George, Jerusalem',
           'Premium modest activewear for women. Sports skirts with built-in leggings, at 31 King George Street, Jerusalem.',
           'og.webp', OPENING + PILLARS + STORE + SPOT + DIPTYCH + kit.gallery('From the store'), OPEN_JS)
post('index')

# ── CONTACT ───────────────────────────────────────────────────────────────
CONTACT = f'''  <section class="sec" style="padding-top:clamp(1.5rem,3vw,2.5rem)" aria-label="How to reach us">
    <div class="wrap cgrid">
      <div class="rows">
        <div class="row rev"><h2>Visit</h2><p>31 King George Street, Jerusalem</p><a class="lnk" style="justify-self:start" href="{MAPS}" target="_blank" rel="noopener">Get directions</a></div>
        <div class="row rev"><h2>WhatsApp</h2><p><a class="lnk" href="https://wa.me/972546152968" target="_blank" rel="noopener">+972 54 615 2968</a></p></div>
        <div class="row rev"><h2>Email</h2><p><a class="lnk" href="mailto:ravitandshifra@gmail.com">ravitandshifra@gmail.com</a></p></div>
      </div>
      <figure class="shot rev" style="justify-self:end"><img src="assets/sign.webp" alt="The RS sign in a green window frame" width="1109" height="1478" loading="lazy"></figure>
    </div>
  </section>
'''
SITE.write('contact', 'Contact RS Modest Activewear, King George 31, Jerusalem',
           'Visit RS Modest Activewear at 31 King George Street, Jerusalem, or message us on WhatsApp.',
           'og.webp', SITE.page_head('Find us', 'Visit our store at 31 King George Street, Jerusalem, or message us on WhatsApp.') + CONTACT + kit.faq('Your questions'))
post('contact')

# ── SHOP ──────────────────────────────────────────────────────────────────
import shop
SITE.write('shop', 'Shop, Premium Modest Sports Skirt, RS Modest Activewear',
           'Premium Modest Sports Skirt with built-in leggings, ₪320. Order from RS Modest Activewear, King George 31, Jerusalem.',
           'og.webp', shop.SHOP, shop.SHOP_JS)
post('shop')
print('built')
