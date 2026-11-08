"""Hadassah Prys's site: makeup artist, Jerusalem. Run from the build folder: python gen/build.py
Every fact is from src/record.json (the business and its one listing) or her flyer (src/owner/p02.jpg: the call number,
"Now in Jerusalem", "get ready to glow")."""
import json
import sys; sys.path.insert(0, '../../starter'); import sitekit as kit  # noqa: E401, E702

BULBS = json.load(open('gen/bulbs.json'))
LOGO = '<img class="logo" src="assets/logo.webp" width="560" height="217" alt="">'

SITE = kit.Site(
    name='Hadassah Prys, makeup artist', short='Hadassah Prys', slug='hadassah-prys',
    pages=[('index', 'Home'), ('book', 'Book'), ('contact', 'Contact')],
    contacts=[kit.Contact('whatsapp-only', '+44 7712 331169'), kit.Contact('call', '055-775-3535'), kit.Contact('email', 'hadassahmuartist@gmail.com')],
    fonts='family=Bellefair&family=Assistant:wght@400;600;700',
    cta=('book.html', 'Book'), bar=('Makeup ₪260', '60 minutes, lashes included'),
    place='Jerusalem', close_title='Get ready to glow', mark_html=LOGO, count=False,
    about='Your beauty, just elevated. Natural glam, radiant skin and makeup for every occasion.',
    ordering=('Booking', ['Choose a day and a time', 'Your request is saved and opens WhatsApp to Hadassah',
                          'Paying by cash, PayPal or BACS']),
    since=2021, ld_type='LocalBusiness',
    ld_extra={'areaServed': 'Israel', 'makesOffer': [{'@type': 'Offer', 'name': 'Makeup, 60 minutes, lashes included', 'price': 260, 'priceCurrency': 'ILS'}],
              'openingHours': ['Su-Th 09:00-19:00', 'Fr 09:00-13:00']})

HEAD_EXTRA = ('<meta name="offers" content="makeup">\n<meta name="site-category" content="beauty">\n'
              '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27%3E%3Ccircle cx=%2710%27 cy=%2710%27 r=%279%27 fill=%27%23A9334D%27/%3E%3C/svg%3E">\n')
_head = SITE.head
SITE.head = lambda page, title, desc, og: _head(page, title, desc, og).replace('<link rel="stylesheet" href="site.css">', HEAD_EXTRA + '<link rel="stylesheet" href="site.css">')


def room(cls, suffix, alt, extra=''):
    return (f'<picture class="{cls}"><source media="(max-width: 760px)" srcset="assets/room-tall{suffix}.webp" width="1118" height="1988">'
            f'<img src="assets/room-wide{suffix}.webp" width="2400" height="1350" alt="{alt}" data-crop-ok {extra}></picture>')


# ── Home ──
OPENING = f'''  <section class="open" id="open" aria-labelledby="h-open">
    <div class="room" id="room" data-wide='{json.dumps(BULBS["wide"], separators=(",", ":"))}' data-tall='{json.dumps(BULBS["tall"], separators=(",", ":"))}'>
      {room('off', '-off', '', 'aria-hidden="true"')}
      {room('lit', '', 'A makeup mirror with round bulbs on a pink table, a rose brush beside it', 'fetchpriority="high"')}
    </div>
    <div class="open-in wrap">
      <div class="open-words">
        <p class="label" data-arrive="1">Makeup by Hadassah Prys, Jerusalem</p>
        <h1 id="h-open" data-arrive="1">Get ready to glow</h1>
        <div class="open-act" data-arrive="4">
          <a class="btn" href="book.html"><span>Book</span></a>
          <ul class="btn-facts"><li>Makeup {kit.price(260)}</li><li>Lashes included</li><li>60 minutes</li></ul>
        </div>
      </div>
    </div>
    <button class="switch" id="switch" type="button" aria-pressed="true"><i aria-hidden="true"></i><span>Lights on</span></button>
  </section>
'''

PROMISE = f'''  <section class="sec promise" aria-labelledby="h-prom">
    <div class="wrap">
      <h2 id="h-prom" class="rev">Your beauty, just elevated.</h2>
      <div class="prom-grid">
        <p class="big-line rev">Natural glam, radiant skin and effortlessly beautiful makeup for every occasion.</p>
        <div class="since rev"><b>Since 2021</b><span>Hadassah Prys, makeup artist</span></div>
      </div>
    </div>
  </section>
'''

SERVICE = f'''  <section class="sec service" aria-labelledby="h-svc">
    <div class="wrap svc-grid">
      <img class="brush rev" src="assets/brush.webp" width="1100" height="1467" alt="A makeup brush with rose bristles and a copper band on a small stone stand" loading="lazy">
      <div class="svc-words">
        <h2 id="h-svc" class="rev">Makeup</h2>
        <p class="price rev"><b>{kit.price(260)}</b><span>for 60 minutes</span></p>
        <p class="why rev">Lashes are included in the price.</p>
        <dl class="facts rev">
          <div><dt>Look</dt><dd>Natural glam and radiant skin</dd></div>
          <div><dt>For</dt><dd>Every occasion</dd></div>
          <div><dt>Paying</dt><dd>Cash, PayPal or BACS</dd></div>
        </dl>
        <a class="btn-line rev" href="book.html">Choose a day and time</a>
      </div>
    </div>
  </section>
'''

WHEN = '''  <section class="sec when" aria-labelledby="h-when">
    <div class="wrap when-grid">
      <h2 id="h-when" class="rev">When and where</h2>
      <div class="when-col rev">
        <h3>By appointment</h3>
        <p class="row"><span>Sunday to Thursday</span><span>9:00 to 19:00</span></p>
        <p class="row"><span>Friday</span><span>9:00 to 13:00</span></p>
        <p class="row"><span>Shabbat</span><span>Closed</span></p>
      </div>
      <div class="when-col rev">
        <h3>Now in Jerusalem</h3>
        <p>Based in Jerusalem, and available across Israel.</p>
        <p>Hadassah speaks English.</p>
      </div>
    </div>
  </section>
'''

HOW = '''  <section class="sec how" aria-labelledby="h-how">
    <div class="wrap">
      <h2 id="h-how" class="rev">How booking works</h2>
      <ol class="steps">
        <li class="rev"><b>1</b><div><h3>Choose a time</h3><p>Pick a day and a time from Hadassah's hours.</p></div></li>
        <li class="rev"><b>2</b><div><h3>Send your request</h3><p>It is saved on MyIsraelRental and WhatsApp opens with it written out.</p></div></li>
        <li class="rev"><b>3</b><div><h3>Talk it over</h3><p>Send it on WhatsApp, and you can go over the details with Hadassah there.</p></div></li>
      </ol>
    </div>
  </section>
'''

SITE.write('index', 'Hadassah Prys · Makeup artist in Jerusalem',
           'Get ready to glow. Natural glam, radiant skin and makeup for every occasion. ₪260 for 60 minutes, lashes included.',
           'og.jpg', OPENING + PROMISE + SERVICE + WHEN + HOW + kit.gallery('From Hadassah\'s work') + kit.faq('Your questions'),
           '<script src="mirror.js"></script>\n')

# ── Book: one request in three steps, the summary written as you fill it (rules 3k.7, 3x.9, 3x.10) ──
BOOK = SITE.page_head('Book your makeup', 'Choose a day and a time, and send your request to Hadassah.') + f'''  <section class="sec book-sec" id="book" aria-label="Your booking">
    <div class="wrap">
      <ol class="osteps" aria-label="Steps">
        <li data-go="1"><span>Step 1: Day and time</span></li><li data-go="2"><span>Step 2: Occasion and where</span></li><li data-go="3"><span>Step 3: Your details</span></li>
      </ol>
      <form class="form" id="form" novalidate>
        <div class="fcol">
          <fieldset class="ostep card" data-s="1">
            <legend>Your makeup, and when</legend>
            <div class="svcs" id="w-svc">
              <label class="svc"><input type="radio" name="svc" value="makeup" checked><span class="svc-in"><b>Makeup</b><span>60 minutes, lashes included</span><em>{kit.price(260)}</em></span></label>
            </div>
            <div id="w-day"><label class="f" for="day">Day</label><input class="fld" type="date" id="day" name="day" required>
            <p class="err" id="e-day" aria-live="polite"></p></div>
            <div id="w-time"><p class="f" id="l-time">Time</p><div class="times" id="times" role="radiogroup" aria-labelledby="l-time"></div>
            <p class="hint" id="t-hint"></p><p class="err" id="e-time" aria-live="polite"></p></div>
          </fieldset>
          <fieldset class="ostep card" data-s="2" hidden>
            <legend>Occasion and where</legend>
            <label class="f" for="occ">What is the occasion? <span class="opt-l">(optional)</span></label>
            <input class="fld" id="occ" name="occasion" autocomplete="off">
            <label class="f" for="place">Where are you? <span class="opt-l">(optional)</span></label><input class="fld" id="place" name="place" autocomplete="address-level2">
          </fieldset>
          <fieldset class="ostep card" data-s="3" hidden>
            <legend>Your details</legend>
            <div id="w-me"><label class="f" for="me">Your name</label><input class="fld" id="me" name="name" autocomplete="name" required><p class="err" id="e-me" aria-live="polite"></p></div>
            <div id="w-ph"><label class="f" for="ph">Phone</label><input class="fld" id="ph" name="tel" type="tel" autocomplete="tel" inputmode="tel" required><p class="err" id="e-ph" aria-live="polite"></p></div>
            <label class="f" for="note">Anything Hadassah should know? <span class="opt-l">(optional)</span></label><textarea class="fld" id="note" name="note" rows="1"></textarea>
          </fieldset>
          <div class="nav-row"><button class="btn-line" type="button" id="back" hidden>Back</button></div>
        </div>
        <aside class="sum card" id="sum" aria-label="Your request">
          <h2>Your request</h2>
          <p class="sum-p" id="sum-p" aria-live="polite"></p>
          <p class="total"><span>Price</span><b id="total">{kit.price(260)}</b></p>
          <button class="btn send" id="send" type="submit"><span id="send-l">Continue to occasion</span></button>
          <p class="hint" id="send-note">Next: the occasion, if you would like to say.</p>
          <p class="status" id="status" role="status" aria-live="polite"></p>
        </aside>
      </form>
    </div>
  </section>
'''
SITE.write('book', 'Book your makeup · Hadassah Prys',
           'Book makeup with Hadassah Prys in Jerusalem: ₪260 for 60 minutes, lashes included. Choose a day and a time and send your request.',
           'og.jpg', BOOK + SITE.gift_section(), '<script src="book.js"></script>\n<script src="gift.js"></script>\n')

# ── Contact ──
CONTACT = SITE.page_head('Talk to Hadassah', 'Questions about your makeup, or a day that is not on the list.') + f'''  <section class="sec contact" aria-label="Contact">
    <div class="wrap two">
      <div class="card rev">
        <h2>Reach Hadassah</h2>
        <p>{SITE.contacts_html()}</p>
      </div>
      <div class="card rev">
        <h2>When and where</h2>
        <p>Sunday to Thursday, 9:00 to 19:00. Friday, 9:00 to 13:00. By appointment.</p>
        <p>Based in Jerusalem, and available across Israel.</p>
      </div>
    </div>
  </section>
'''
SITE.write('contact', 'Contact Hadassah Prys · Makeup artist in Jerusalem',
           'WhatsApp Hadassah Prys on +44 7712 331169, call 055-775-3535, or email. Makeup in Jerusalem and across Israel.',
           'og.jpg', CONTACT)

PRELOAD = ('<link rel="preload" as="image" href="assets/room-wide.webp" media="(min-width: 761px)" fetchpriority="high">'
           '<link rel="preload" as="image" href="assets/room-tall.webp" media="(max-width: 760px)" fetchpriority="high">')
ARROW = '<svg class="arw-i" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
for page in ('index', 'book', 'contact'):
    html = open(f'{page}.html', encoding='utf8').read().replace('→', ARROW).replace('tel:+0557753535', 'tel:+972557753535').replace('Call only, no WhatsApp', 'Call').replace('Call only ', 'Call ')
    if page == 'index':  # the opening picture loads first (3x.8)
        html = html.replace('<link rel="stylesheet" href="site.css">', PRELOAD + '<link rel="stylesheet" href="site.css">')
    open(f'{page}.html', 'w', encoding='utf8').write(html)
print('wrote index, book, contact')
