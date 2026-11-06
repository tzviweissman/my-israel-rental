"""Finest Cuts: home, shop (the feast and the order on one page), contact. Run from the build folder: python gen/build.py
Facts only from src/record.json and the owner's flyer src/owner/p01.jpg. Name on the page is their logo's, Finest Cuts."""
import shutil
import sys

sys.path.insert(0, '../../starter')
sys.stdout.reconfigure(encoding='utf-8')
import sitekit as kit

PHONE = '+972 58 715 3901'
MAIL = 'finestcutsisrael@gmail.com'
LOGO = '<img src="assets/logo.webp" alt="" width="40" height="40">'
SITE = kit.Site(
    name='Finest Cuts', short='Finest Cuts', slug='finest-cut',
    pages=[('index', 'Home'), ('shop', 'Shop'), ('contact', 'Contact')],
    contacts=[kit.Contact('whatsapp', PHONE), kit.Contact('email', MAIL)],
    fonts='family=Secular+One&family=Rubik:wght@400;500;700',
    cta=('shop.html?add=feast#order', 'Order the feast'), bar=('$215', 'XL chicken board'),
    place='Jerusalem', close_title='The crunch you crave, delivered.', close_extra='Finest Cuts', mark_html=LOGO,
    about='Gourmet American schnitzel boards. Enhance your table or someone else’s.',
    ordering=('Ordering', ['Delivery throughout Jerusalem', 'Elsewhere in Israel: message us', 'Under the hashgacha of Rabbi Weiner']),
    ld_type='FoodEstablishment', ld_extra={'areaServed': 'Jerusalem', 'servesCuisine': 'American schnitzel'})
OG = 'og.webp'
P = kit.price


def write(page, title, desc, body, tail=''):
    SITE.write(page, title, desc, OG, body, tail)
    f = f'{page}.html'
    s = open(f, encoding='utf8').read().replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="site-category" content="food-shop">', 1)
    s = s.replace(' <span class="arw" aria-hidden="true">→</span>', '')   # no arrows: the button's own hover is the light
    open(f, 'w', encoding='utf8').write(s)


CHAPTERS = [(1, '1 of 4 types of chicken'), (2, '2 of 4 types of chicken'), (3, '3 of 4 types of chicken'), (4, '4 of 4 types of chicken'), (5, '3 sauces')]
HOME = f'''  <section class="open" id="board" aria-labelledby="h-open">
    <div class="stage" id="stage">
      <div class="scene" id="scene">
        <picture>
          <source media="(max-aspect-ratio: 1/1)" srcset="assets/board-tall.webp" width="1400" height="3111">
          <img id="board-img" src="assets/board-wide.webp" width="3200" height="1800" fetchpriority="high" alt="The Finest Cuts XL chicken board from above on black stone: 4 types of chicken around 3 cups of sauce">
        </picture>
        {''.join(f'<i class="dim" data-i="{i}" aria-hidden="true"></i>' for i, _ in CHAPTERS)}
      </div>
      <div class="words w0 on" id="w0">
        <h1 id="h-open">The crunch you crave</h1>
        <p class="ln">Gourmet American schnitzel boards, delivered throughout Jerusalem.</p>
        <a class="btn" href="{SITE.cta[0]}">{SITE.cta[1]}</a>
        <ul class="btn-facts">
          <li>{P(215, 'USD')} the XL board</li>
          <li>Delivery throughout Jerusalem</li>
          <li>Under the hashgacha of Rabbi Weiner</li>
        </ul>
      </div>
      <ol class="chaps" aria-label="What is on the board">
        {''.join(f'<li data-i="{i}">{t}</li>' for i, t in CHAPTERS)}
      </ol>
      <div class="words w6" id="w6">
        <h2>Ultimate Feast</h2>
        <p class="pr-row"><span class="pr">{P(215, 'USD')}</span><span class="unit">XL chicken board with 4 types of chicken and 3 sauces</span></p>
        <a class="btn" href="{SITE.cta[0]}" tabindex="-1">{SITE.cta[1]}</a>
      </div>
    </div>
  </section>

  <section class="kband" aria-label="Kosher">
    <div class="wrap">
      <img src="assets/seal.webp" alt="The kashrut seal printed on our flyer" width="72" height="72" loading="lazy">
      <p>Kosher, under the hashgacha of Rabbi Weiner</p>
    </div>
  </section>

  <section class="sec state" aria-labelledby="h-state">
    <div class="wrap">
      <h2 id="h-state" class="rev">Feast in style.</h2>
      <p class="rev">Tastefully tender. Presented to impress.</p>
    </div>
  </section>

  <section class="sec feast" id="feast" aria-labelledby="h-feast">
    <div class="wrap">
      <h2 id="h-feast" class="rev">Enhance your table</h2>
      <div data-mir-catalog data-href="shop.html?add={{name}}" data-other="" data-out="Out of stock right now, message us">
        <div data-mir-list>
          <article class="fc rev">
            <div class="ph"><img src="assets/board.webp" alt="The Ultimate Feast from above" width="1400" height="1120" loading="lazy"></div>
            <div class="info">
              <h3>Ultimate Feast</h3>
              <p class="pr-row"><span class="pr">{P(215, 'USD')}</span><span class="unit">XL chicken board</span></p>
              <a class="btn" href="{SITE.cta[0]}">{SITE.cta[1]}</a>
            </div>
          </article>
        </div>
        <template data-mir-group><div data-f="items"></div></template>
        <template data-mir-item>
          <article class="fc">
            <div class="ph"><img data-f="img" alt="" width="1400" height="1120" loading="lazy"></div>
            <div class="info">
              <h3 data-f="name"></h3>
              <p class="pr-row"><span class="pr" data-f="price"></span><span class="unit">XL chicken board</span></p>
              <a class="btn" data-f="link">{SITE.cta[1]}</a>
            </div>
          </article>
        </template>
      </div>
    </div>
  </section>

  <section class="numsec" aria-label="What is on the board">
    <div class="wrap">
      <dl class="nums" id="nums">
        <div><dt>XL</dt><dd>chicken board</dd></div>
        <div><dt>4</dt><dd>types of chicken</dd></div>
        <div><dt>3</dt><dd>sauces</dd></div>
      </dl>
      <i class="numline" id="numline" aria-hidden="true"></i>
    </div>
  </section>

  <section class="sec who" id="who" data-who="mine" aria-labelledby="h-who">
    <div class="wrap who-grid">
      <div class="who-ph">
        <img class="on" data-w="mine" src="assets/basket.webp" alt="Crisp chicken with white sauce in a wire basket beside jars of our sauces" width="680" height="510" loading="lazy">
        <img data-w="else" src="assets/strips.webp" alt="Crisp chicken strips on a board with a cut lemon" width="640" height="380" loading="lazy">
      </div>
      <div class="who-t">
        <h2 id="h-who">Whose table is it for?</h2>
        <div class="seg" role="group" aria-label="Whose table">
          <i class="thumb" aria-hidden="true"></i>
          <button type="button" data-w="mine" aria-pressed="true">Your table</button>
          <button type="button" data-w="else" aria-pressed="false">Someone else’s</button>
        </div>
        <div class="who-c">
          <div class="on" data-w="mine"><p>Perfect for all occasions, including a Shabbos seuda, Purim, Sukkos and Chanukah.</p></div>
          <div data-w="else"><p>Send your child in yeshiva or seminary, or those who live across the world, a taste of home.</p></div>
        </div>
        <a class="btn" id="who-go" href="{SITE.cta[0]}">{SITE.cta[1]}</a>
      </div>
    </div>
  </section>

  <section class="sec how" aria-labelledby="h-how">
    <div class="wrap how-grid">
      <h2 id="h-how" class="rev">How your order works</h2>
      <ol class="how-l">
        <li class="rev"><b>Choose how many</b>Tell us whose table it is for.</li>
        <li class="rev"><b>Choose the day and the address</b>We deliver throughout Jerusalem. Elsewhere in Israel, message us first.</li>
        <li class="rev"><b>Send it</b>Your order is saved with a link to follow it, and comes to us on WhatsApp written out.</li>
      </ol>
    </div>
  </section>
''' + kit.gallery('From our kitchen')

HOME_TAIL = '<script src="open.js"></script>\n'
write('index', 'Finest Cuts · Chicken boards delivered in Jerusalem',
      'The crunch you crave, delivered. Gourmet American schnitzel boards in Jerusalem: an XL board with 4 types of chicken and 3 sauces, $215.',
      HOME, HOME_TAIL)

SHOP = f'''  <form id="form" novalidate>
  <section class="pstage" id="feast" aria-labelledby="h-shop">
    <div class="wrap st-grid">
      <div class="st-ph"><img src="assets/board.webp" alt="The Ultimate Feast from above: 4 types of chicken around 3 cups of sauce" width="1400" height="1120" fetchpriority="high"></div>
      <div class="st-info">
        <h1 id="h-shop">Ultimate Feast</h1>
        <p class="st-desc">XL chicken board with 4 types of chicken and 3 sauces. Tastefully tender, presented to impress.</p>
        <p class="pr-row"><span class="pr">{P(215, 'USD')}</span><span class="unit">the XL board</span></p>
        <div class="st-buy">
          <span class="step" role="group" aria-label="How many"><button type="button" data-d="-1" aria-label="One fewer">−</button><output id="st-n">1</output><button type="button" data-d="1" aria-label="One more">+</button></span>
          <button class="btn" type="button" id="st-add"><span>Add, $215</span></button>
        </div>
        <p class="st-in" id="st-in" aria-live="polite"></p>
        <ul class="st-facts">
          <li>Delivery throughout Jerusalem</li>
          <li>Under the hashgacha of Rabbi Weiner</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="sec" id="order" aria-labelledby="h-basket">
    <div class="wrap">
      <ol class="osteps" id="steps" aria-label="Order steps">
        <li class="is-now" aria-current="step"><button type="button" data-go="1"><img src="assets/cup-a.webp" alt="" width="40" height="40">Step 1: Your basket</button></li>
        <li><button type="button" data-go="2"><img src="assets/cup-b.webp" alt="" width="40" height="40">Step 2: When and where</button></li>
        <li><button type="button" data-go="3"><img src="assets/cup-c.webp" alt="" width="40" height="40">Step 3: Your details</button></li>
      </ol>
      <div class="form">
        <div>
          <div class="card ostep" data-s="1">
            <h2 id="h-basket">Your basket</h2>
            <ul class="blist" id="sum-list"></ul>
            <p class="err" id="e-items" role="alert"></p>
            <a class="lnk" href="#feast">Back to the feast</a>
          </div>
          <div class="card ostep" data-s="2" hidden>
            <h2>When and where</h2>
            <fieldset class="ful"><legend>Whose table is it for?</legend>
              <label class="opt"><input type="radio" name="who" value="mine" checked>Your table</label>
              <label class="opt"><input type="radio" name="who" value="else">Someone else’s</label></fieldset>
            <div id="w-to" hidden><label class="f" for="to">Their name</label><input class="fld" id="to" autocomplete="off" maxlength="80"><p class="err" id="e-to" role="alert"></p></div>
            <fieldset class="ful"><legend>Where is it going?</legend>
              <label class="opt"><input type="radio" name="place" value="jer" checked>In Jerusalem</label>
              <label class="opt"><input type="radio" name="place" value="far">Elsewhere in Israel</label></fieldset>
            <p class="hint" id="h-far" hidden>We confirm on WhatsApp whether we can reach you.</p>
            <div id="w-addr"><label class="f" for="addr">Delivery address</label><input class="fld" id="addr" autocomplete="street-address" maxlength="160" placeholder="Street, number, neighbourhood"><p class="err" id="e-addr" role="alert"></p></div>
            <div id="w-when"><label class="f" for="when">Delivery day</label><input class="fld" id="when" type="date"><p class="err" id="e-when" role="alert"></p><button class="lnk nextday" id="when-next" type="button" hidden></button></div>
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
          <div class="total"><span>Total</span><span id="total">$0</span></div>
          <button class="btn" id="send" type="submit"><span>Continue to when and where</span></button>
          <button class="back" id="back" type="button" hidden>Back</button>
          <p class="note" id="send-note">Next: the day and the address.</p>
          <p class="sent" id="sent" role="status" hidden></p>
        </aside>
      </div>
    </div>
  </section>
  </form>
''' + SITE.gift_section()
SHOP_TAIL = '<script src="gift.js"></script>\n<script src="shop.js"></script>\n'
write('shop', 'Shop · Ultimate Feast, Finest Cuts',
      'Order the Ultimate Feast: an XL chicken board with 4 types of chicken and 3 sauces, $215. Delivery throughout Jerusalem, under Rabbi Weiner.',
      SHOP, SHOP_TAIL)

CONTACT = SITE.page_head('Talk to us', 'Order, ask a question, or ask whether we can reach your address.') + f'''  <section class="sec c-sec" aria-label="How to reach us">
    <div class="wrap c-grid">
      <div class="c-t">
        <div class="tile"><h2>WhatsApp or call</h2><p><a class="lnk" href="https://wa.me/972587153901" target="_blank" rel="noopener">{PHONE}</a></p></div>
        <div class="tile"><h2>Email</h2><p><a class="lnk" href="mailto:{MAIL}">{MAIL}</a></p></div>
        <div class="tile"><h2>Delivery</h2><p>Throughout Jerusalem. Elsewhere in Israel, message us for more information.</p></div>
        <div class="tile k"><img src="assets/seal.webp" alt="The kashrut seal printed on our flyer" width="72" height="72" loading="lazy"><div><h2>Kosher</h2><p>Under the hashgacha of Rabbi Weiner.</p></div></div>
      </div>
      <div class="c-ph"><img src="assets/basket.webp" alt="Crisp chicken with white sauce in a wire basket beside jars of our sauces" width="680" height="510" fetchpriority="high"></div>
    </div>
  </section>
''' + kit.faq('Your questions')
write('contact', 'Contact · Finest Cuts, Jerusalem',
      'WhatsApp or call Finest Cuts on +972 58 715 3901, or email us. Delivery throughout Jerusalem; elsewhere in Israel, message us for more information.',
      CONTACT)

for f in ('gift.js',):
    shutil.copy(f'../../starter/{f}', f)
print('written')
