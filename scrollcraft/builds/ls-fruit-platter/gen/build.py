# Ls Fruit Platter: Home, Shop (the menu and the order on one page, in steps), Contact.
# Every word and number is from her record, her listing or her photos. Run from the build folder:
#   cd scrollcraft/builds/ls-fruit-platter && python gen/prep.py && python gen/css_patch.py && python gen/build.py
import sys
sys.path.insert(0, '../../starter')
import sitekit as kit

kit.KINDS['phone'] = ('Call', 'tel:+{d}', False)  # her logo shows a phone icon beside this number

K = 'Kosher, hechsher: <span lang="he" dir="rtl">בד"ץ העדה החרדית או שארית</span>'
SIZES = [('small', 'Small', 300), ('medium', 'Medium', 400), ('large', 'Large', 500), ('xl', 'Extra large', 850)]
SHORT = {'small': 'S', 'medium': 'M', 'large': 'L', 'xl': 'XL'}
NOPH = 'medium'  # no photo of the Medium platter is shown (see gen/prep.py): its tile is plain and says so
ALT = {
    'small': 'The Small platter: a round board with watermelon, red grapes, dates and pineapple',
    'large': 'The Large platter: a long wooden board of watermelon, grapes, lychees, pomegranate and melon',
    'xl': 'The Extra large platter: a very long board in rows of green grapes, watermelon, dates, pomegranate, dark grapes and kiwi',
}
def stage_img(i, k):
    if k == NOPH:
        return '<div class="sl noph" role="img" aria-label="No photo of the Medium platter yet"><img src="assets/mark.webp" width="200" height="200" alt=""><b>Photo to come</b></div>' + chr(10)
    hi = ' fetchpriority="high"' if i == 1 else ''
    return f'<img class="sl" src="assets/size-{i}.webp" width="1200" height="1200" alt="{ALT[k]}"{hi}>' + chr(10)
def thumb_img(i, k, w, h):
    if k == NOPH:
        return '<span class="noph-t" aria-hidden="true"><img src="assets/mark.webp" width="200" height="200" alt=""></span>'
    return f'<img src="assets/size-{i}-t.webp" width="520" height="390" alt="" loading="lazy">'
ARROW = '<svg class="go" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
TICK = '<svg class="tk" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
LEAF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19c3-4 6-7 10-9"/></svg>'
CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/></svg>'
CHAT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>'
STROKE = '<svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M3 8 C 38 2, 72 12, 112 6 S 178 4, 197 8"/></svg>'

SITE = kit.Site(
    name='Ls Fruit Platter', short='Ls Fruit Platter', slug='ls-fruit-platter',
    pages=[('index', 'Home'), ('shop', 'Shop'), ('contact', 'Contact')],
    contacts=[kit.Contact('whatsapp-only', '+972 58 729 8718'), kit.Contact('phone', '+972 52 714 6952')],
    fonts='family=Amatic+SC:wght@700&family=Open+Sans:wght@400;600;700',
    cta=('shop.html#sizes', 'Order'), bar=('From ₪300', 'Four platter sizes'),
    place='Jerusalem', close_title='Order a platter', close_extra='Ls Fruit Platter',
    mark_html='<img src="assets/mark.webp" width="38" height="38" alt="">')

# the closing band's arrow is drawn (Open Sans has no arrow glyph)
_orig_footer = SITE.footer
SITE.footer = lambda: _orig_footer().replace('<span class="arw" aria-hidden="true">→</span>', ARROW.replace('class="go"', 'class="go arw"'))
# the owner's gallery waits as a div, not a section, so it is not counted as a page section while it is empty
GALLERY = kit.gallery('From our <span class="hl">kitchen</span>').replace('<section class="sec gallery"', '<div class="sec gallery"').replace('</section>', '</div>')

# ───────────────────────── Home
imgs = ''.join(stage_img(i, k) for i, (k, _, _) in enumerate(SIZES, 1))
pills = ''.join(
    f'<button type="button" data-i="{i}" aria-pressed="{"true" if i == 0 else "false"}" aria-label="{n}">{SHORT[k]}</button>'
    for i, (k, n, _) in enumerate(SIZES))
OPENING = f'''  <section class="hero" aria-label="Fruit platters">
    <div class="hero-stage">
      <div class="hero-copy">
        <h1>Fresh, beautiful fruit platters</h1>
        <p class="lede">For your home and events in Jerusalem. Kosher.</p>
        <a class="btn" href="shop.html#sizes"><span>Order a platter, from {kit.price(300)}</span></a>
      </div>
      <figure class="hero-photo" id="hp" style="background:linear-gradient(90deg,#3A2347 0 14.28%,#D9483A 14.28% 28.57%,#F2C340 28.57% 42.85%,#8DB83A 42.85% 57.14%,#7A3B2A 57.14% 71.42%,#C62B45 71.42% 85.71%,#5FA24A 85.71%)">
{imgs}        <div class="cap"><p class="cap-t" aria-live="polite"><b id="cap-n">Small</b><span id="cap-p">{kit.price(300)}</span></p><div class="pills" role="group" aria-label="Platter size">{pills}</div></div>
      </figure>
    </div>
  </section>
  <div class="kosher"><div class="wrap">{CHECK}<span>{K}</span></div></div>
'''
rows = ''.join(
    f'''      <a class="row rev" href="shop.html?size={k}#sizes"><span class="th">{thumb_img(i, k, 520, 520)}</span><span class="nm">{n}</span><span class="dots" aria-hidden="true"></span><span class="pr">{kit.price(p)}</span>{ARROW}</a>
''' for i, (k, n, p) in enumerate(SIZES, 1))
SECTIONS = f'''  <section class="sec" id="sizes" aria-labelledby="h-sizes">
    <div class="wrap">
      <h2 id="h-sizes" class="rev">Four <span class="hl">sizes{STROKE}</span></h2>
      <div class="rows">
{rows}      </div>
    </div>
  </section>
  <div class="band"><img class="shut" src="assets/band.webp" width="2400" height="610" alt="The Extra large platter laid on its side: dark grapes, watermelon, melon, dates, pomegranate, kiwi and green grapes in rows" loading="lazy"></div>
  <section class="sec" id="how" aria-labelledby="h-how">
    <div class="wrap">
      <h2 id="h-how" class="rev">Order in three steps</h2>
      <ol class="how">
        <li class="rev"><span class="n" aria-hidden="true">1</span><h3>Choose the size</h3><p>Small, Medium, Large or Extra large, from {kit.price(300)} to {kit.price(850)}.</p></li>
        <li class="rev"><span class="n" aria-hidden="true">2</span><h3>Say when and where</h3><p>The day, the time and the address.</p></li>
        <li class="rev"><span class="n" aria-hidden="true">3</span><h3>Add your details</h3><p>Your name and phone. Your order opens in WhatsApp, ready to send.</p></li>
      </ol>
      <p class="how-cta"><a class="btn" href="shop.html#sizes"><span>Order a platter</span></a></p>
    </div>
  </section>
'''
HERO_JS = '''<script>
(function () {
  var S = [['Small', 300], ['Medium', 400], ['Large', 500], ['Extra large', 850]];
  var hero = document.querySelector('.hero'), fr = document.getElementById('hp'), bl = window.lsBlinds(fr);
  var pills = [].slice.call(document.querySelectorAll('.pills button')), capN = document.getElementById('cap-n'), capP = document.getElementById('cap-p');
  var AT = [.04, .33, .6, .88], CUT = [.2, .46, .72];
  function ui(i) {
    pills.forEach(function (b, k) { b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
    capN.textContent = S[i][0]; capP.innerHTML = '<span class="sym">₪</span>' + S[i][1];
  }
  function idx() {
    var span = hero.offsetHeight - innerHeight, p = Math.max(0, Math.min(1, -hero.getBoundingClientRect().top / span));
    return p < CUT[0] ? 0 : p < CUT[1] ? 1 : p < CUT[2] ? 2 : 3;
  }
  var last = 0;
  function sync() { var i = idx(); if (i !== last) { last = i; ui(i); bl.go(i); } }
  addEventListener('scroll', sync, { passive: true });
  pills.forEach(function (b) {
    b.addEventListener('click', function () {
      var i = +b.dataset.i, span = hero.offsetHeight - innerHeight;
      last = i; ui(i); bl.go(i);
      scrollTo({ top: hero.getBoundingClientRect().top + scrollY + span * AT[i], behavior: 'auto' });
    });
  });
  bl.first(1400); sync();
})();
</script>
'''
SITE.write('index', 'Ls Fruit Platter · Fruit platters in Jerusalem',
           'Fresh, beautiful fruit platters for your home and events in Jerusalem. Kosher. Four sizes from ₪300.',
           'og.webp', OPENING + SECTIONS + GALLERY, HERO_JS)

# ───────────────────────── Shop
IMGS = ''.join(stage_img(i, k) for i, (k, _, _) in enumerate(SIZES, 1))
PICKS = ''.join(
    f'''          <button type="button" data-k="{k}" aria-pressed="{"true" if i == 1 else "false"}">{thumb_img(i, k, 520, 520)}<span class="ring"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9"/></svg></span><span class="t"><b>{n}</b><i>{kit.price(p)}</i></span></button>
''' for i, (k, n, p) in enumerate(SIZES, 1))
SHOP = f'''  <form id="form" novalidate>
  <section class="stage" id="sizes" aria-labelledby="h-shop">
    <div class="wrap st-grid">
      <div class="st-ph">
{IMGS}      </div>
      <div class="st-info">
        <p class="kick">Shop · Fruit platters</p>
        <h1 id="h-shop"><span id="st-name">Small</span></h1>
        <p class="st-price"><span id="st-price">{kit.price(300)}</span> <small>a platter</small></p>
        <div class="st-buy">
          <span class="step" role="group" aria-label="How many platters"><button type="button" data-d="-1" aria-label="One fewer" disabled>−</button><output id="st-n">1</output><button type="button" data-d="1" aria-label="One more">+</button></span>
          <button class="btn" type="button" id="st-add"><span>Add a Small, {kit.price(300)}</span>{TICK}</button>
        </div>
        <p class="st-in" id="st-in" aria-live="polite"></p>
        <ul class="facts" aria-label="About every platter">
          <li>{LEAF}For your home and events</li>
          <li>{CHECK}{K}</li>
          <li>{CHAT}Your order opens in WhatsApp</li>
        </ul>
        <div class="st-pick" aria-label="Sizes">
{PICKS}        </div>
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
            <ul class="blist" id="sum-list"><li><span>Your basket is empty. Pick a size above.</span></li></ul>
            <p class="err" id="e-items"></p>
            <a class="more" href="#sizes">Add another size</a>
          </div>
          <div class="card ostep" data-s="2" hidden>
            <h2>When and where</h2>
            <div id="w-when"><label class="f" for="when">Day</label><input class="fld" id="when" type="date"><p class="err" id="e-when"></p></div>
            <div id="w-time"><label class="f" for="time">Time</label><input class="fld" id="time" maxlength="40" placeholder="For example 10:00"><p class="err" id="e-time"></p></div>
            <div id="w-addr"><label class="f" for="addr">Address or place</label><input class="fld" id="addr" autocomplete="street-address" maxlength="160" placeholder="Street, number, neighbourhood"><p class="err" id="e-addr"></p></div>
          </div>
          <div class="card ostep" data-s="3" hidden>
            <h2>Your details</h2>
            <div id="w-me"><label class="f" for="me">Your name</label><input class="fld" id="me" autocomplete="name" maxlength="80"><p class="err" id="e-me"></p></div>
            <div id="w-ph"><label class="f" for="ph">Your phone</label><input class="fld" id="ph" type="tel" autocomplete="tel" maxlength="30"><p class="err" id="e-ph"></p></div>
            <label class="f" for="note">Anything else</label>
            <textarea class="fld" id="note" maxlength="500"></textarea>
          </div>
        </div>
        <aside class="card sum" id="c-items" aria-live="polite">
          <h3>Your order</h3>
          <ul id="sum-mini"><li><span>Nothing yet</span></li></ul>
          <p class="sum-where" id="sum-where" hidden></p>
          <div class="total"><span>Total</span><span id="total">{kit.price(0)}</span></div>
          <button class="btn" id="send" type="submit"><span>Continue to when and where</span></button>
          <button class="back" id="back" type="button" hidden>Back</button>
          <p class="note" id="send-note">Next: the day, the time and the address.</p>
          <p class="sent" id="sent" role="status" hidden></p>
          <a class="keep" href="#sizes">Keep shopping</a>
        </aside>
      </div>
    </div>
  </section>
  </form>
'''
SHOP_JS = '<script>\n' + open('gen/shop.js', encoding='utf8').read() + '</script>\n'
SITE.write('shop', 'Shop · Ls Fruit Platter',
           'Fruit platters in four sizes, Small ₪300, Medium ₪400, Large ₪500 and Extra large ₪850. Order in three steps.',
           'og.webp', SHOP, SHOP_JS)

# ───────────────────────── Contact
CONTACT = f'''  <div class="wrap cards">
    <div class="cc"><h2>WhatsApp</h2><p>Order or ask a question.</p><a class="btn" href="https://wa.me/972587298718" target="_blank" rel="noopener"><span>+972 58 729 8718</span></a></div>
    <div class="cc"><h2>Call</h2><p>Call to ask or to order.</p><a class="btn-line" href="tel:+972527146952">+972 52 714 6952</a></div>
    <div class="cc"><h2>Paying</h2><p>Cash, Zelle or an Israeli bank transfer.</p><a class="btn-line" href="shop.html#sizes">See the sizes</a></div>
  </div>
'''
SITE.write('contact', 'Contact · Ls Fruit Platter', 'WhatsApp or call Ls Fruit Platter in Jerusalem to order a fruit platter.', 'og.webp',
           SITE.page_head('Say <span class="hl">hello</span>', 'Fresh, beautiful fruit platters, made with love.').replace('<h1>', '<h1 class="rev">') + CONTACT + kit.faq('Your questions'))

print('built')
