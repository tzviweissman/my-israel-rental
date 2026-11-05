"""RBS Cleaning. Run from this folder: python build.py
Writes ../index.html, ../book.html, ../contact.html, ../site.css, ../site.js.
Every fact is from the owner's listing (src/record.json) or flyer (src/owner/p01.jpg)."""
import os, re, sys
sys.path.insert(0, '../../../starter'); sys.path.insert(0, '../../starter')
import sitekit as kit

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
os.chdir(ROOT)
P = kit.price
ARW = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4"/></svg>'
CHECK = '<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8"/></svg>'
# the broom from the RBS logo, as one line icon (BRAND.md)
BROOM = '<svg class="broom" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 3l-7.5 7.5"/><path d="M9.5 9.5l5 5"/><path d="M9.5 9.5C7 9 4.5 10.5 3 13l8 8c2.5-1.5 4-4 3.5-6.5"/><path d="M6.5 16.5L5 18M9 18.5l-1.5 1.5"/></svg>'

# ---------- css and js ----------
css = open('../../starter/site.css', encoding='utf8').read()
cut = css.index('/* ── BELOW HERE')
head = css[:cut]
head = re.sub(r'  --ground:.*?--line: #E5E5E5;',
              '  --ground: #FFFFFF; --surface: #EEF6FB; --ink: #0D2241; --soft: #4A5A6E; --accent: #27622A; --accent-ink: #FFFFFF; --line: #D6E4EE;\n  --sky: #6CC2E3; --leaf: #8FD18F;',
              head, flags=re.S)
head = head.replace('--font-head: Georgia, serif; --font-body: system-ui, sans-serif;', "--font-head: 'Secular One', system-ui, sans-serif; --font-body: 'Alef', system-ui, sans-serif;")
head = head.replace('--r: 16px;', '--r: 14px;')
head = head.replace('html { scroll-behavior: smooth; }', 'html { scroll-behavior: smooth; overflow-x: clip; } body { overflow-x: clip; }')
own = open('gen/own.css', encoding='utf8').read()
open('site.css', 'w', encoding='utf8').write(head + css[cut:].split('\n')[0] + '\n' + own)
js = open('../../starter/site.js', encoding='utf8').read().replace('CHANGE-ME-basket-v1', 'rbs-cleaning-v1').replace('scrollY > vh * .5 &&', 'scrollY > (document.getElementById("film") ? document.getElementById("film").offsetHeight - vh * .7 : vh * .5) &&')
open('site.js', 'w', encoding='utf8').write(js)
open('gift.js', 'w', encoding='utf8').write(open('../../starter/gift.js', encoding='utf8').read())
open('film.js', 'w', encoding='utf8').write(open('../../starter/film.js', encoding='utf8').read())

AREAS = ['RBS', 'Beit Shemesh', 'The surrounding moshavim', 'Jerusalem', 'Ashdod']
SITE = kit.Site(
    name='RBS Cleaning', short='RBS Cleaning', slug='daniel',
    pages=[('index', 'Home'), ('book', 'Get a free quote'), ('contact', 'Contact')],
    contacts=[kit.Contact('whatsapp-only', '053-526-9002')],
    fonts='family=Secular+One&family=Alef:wght@400;700',
    cta=('book.html', 'Get a free quote'), bar=('₪400', 'Basic home clean'),
    place='Beit Shemesh', close_title='A clean home, streak-free windows.',
    mark_html=BROOM, count=False,
    about='Home cleaning in Beit Shemesh and the surrounding areas: regular, deep and post-construction, and windows.',
    ordering=('Where we clean', AREAS),
    ld_type='LocalBusiness',
    ld_extra={'areaServed': AREAS, 'makesOffer': {'@type': 'Offer', 'name': 'Basic home clean', 'price': 400, 'priceCurrency': 'ILS'}})

# ---------- home ----------
N_FRAMES = len(os.listdir('assets/film/d'))
OPENING = f'''  <section class="film" id="film" data-frames="{N_FRAMES}" data-src="assets/film" data-video="assets/film/opening-{{k}}.mp4" data-marks="0.04,0.87" aria-label="RBS Cleaning, home cleaning in Beit Shemesh">
    <div class="stage">
      <canvas aria-hidden="true"></canvas>
      <picture class="room">
        <source media="(max-aspect-ratio: 4/5)" srcset="assets/room-tall.webp" width="648" height="1152">
        <img src="assets/room-wide.webp" alt="A bright, clean living room with large windows onto green hills" width="1920" height="1080" fetchpriority="high">
      </picture>
      <div class="wrap hero">
        <h1>Your home,<br><span class="em">crystal clear.</span></h1>
        <p class="sub">Home cleaning in Beit Shemesh and the surrounding areas.</p>
        <div>
          <a class="btn" href="book.html">Get a free quote <span class="arw" aria-hidden="true">→</span></a>
          <ul class="btn-facts"><li>Basic home clean {P(400)}</li><li>Regular cleaning weekly, every two weeks or monthly</li><li>WhatsApp 053-526-9002</li></ul>
        </div>
      </div>
    </div>
  </section>
'''

SERVICES = [
    ('regular', 'Regular cleaning', 'Weekly, every two weeks or monthly', ['Homes and apartments']),
    ('deep', 'Deep and post-construction', 'A comprehensive, detailed clean', ['Moving in or out', 'After renovations']),
    ('windows', 'Window cleaning', 'Streak-free, crystal clear', ['Inside and outside']),
    ('manage', 'Apartment management', 'Tell us about your apartment and we will quote it', []),
]
def tile(k, name, line, pts, cls):
    li = ''.join(f'<li>{CHECK}{p}</li>' for p in pts)
    return f'''<li class="svc {cls}"><h3>{name}</h3><p class="svc-l">{line}</p><ul class="pts">{li}</ul><a class="more" href="book.html?svc={k}">Get a free quote {ARW}</a></li>'''
tiles = ''.join(tile(*s, c) for s, c in zip(SERVICES, ['half', 'half', 'half', 'half']))
WHAT = f'''  <section class="sec what" id="what" aria-labelledby="h-what">
    <div class="wrap">
      <div class="what-h"><h2 id="h-what" class="rev">What we clean</h2>
      <p class="lede rev">Regular, deep and post-construction cleans, windows and apartment management.</p></div>
      <ul class="bento rev">
        <li class="svc price" aria-labelledby="h-basic">
          <div class="amt">{P(400)}</div>
          <h3 id="h-basic">Basic home clean</h3>
          <p class="svc-l">Every other clean is quoted for your home, free.</p>
          <a class="btn" href="book.html?svc=basic">Get a free quote <span class="arw" aria-hidden="true">→</span></a>
        </li>
        {tiles}
      </ul>
    </div>
  </section>
'''

STEPS = f'''  <section class="sec how" id="how" aria-labelledby="h-how">
    <div class="wrap how-grid">
      <div>
        <h2 id="h-how" class="rev">How a quote works</h2>
        <p class="lede rev">Tell us about your home on the next page. Your request is written out as you go, so nothing is left out.</p>
        <a class="btn-line rev" href="book.html">Get a free quote</a>
      </div>
      <ol class="zig rev">
        <li><b>Choose the clean</b><span>Regular, deep or post-construction, windows or apartment management.</span></li>
        <li><b>Tell us about the home</b><span>Its size, where it is, and the day that suits you.</span></li>
        <li><b>We send a free quote</b><span>On WhatsApp, from 053-526-9002.</span></li>
      </ol>
    </div>
  </section>
'''

AREAS_BAND = f'''  <section class="areas" id="areas" aria-labelledby="h-areas">
    <div class="wrap areas-in">
      <h2 id="h-areas" class="rev">Where we clean</h2>
      <ul class="places rev">{''.join(f'<li>{a}</li>' for a in AREAS)}</ul>
    </div>
  </section>
'''

SITE.write('index', 'RBS Cleaning · Home cleaning in Beit Shemesh',
           'Regular, deep, post-construction and window cleaning in Beit Shemesh, RBS and the surrounding areas. Basic home clean ₪400, free quotes on WhatsApp.',
           'og.webp', OPENING + WHAT + STEPS + AREAS_BAND + kit.gallery('From our cleans'), '<script src="film.js"></script>\n')

# ---------- book: the request form that writes its own summary (rules 3x.9) ----------
def chips(name, opts, label_id):
    return f'<div class="opts" role="radiogroup" aria-labelledby="{label_id}">' + ''.join(
        f'<label class="opt"><input type="radio" name="{name}" value="{v}"><span class="box">{t}</span></label>' for v, t in opts) + '</div>'
KINDS = [('basic', 'Basic home clean, ₪400'), ('regular', 'Regular cleaning'), ('deep', 'Deep and post-construction'),
         ('windows', 'Window cleaning'), ('manage', 'Apartment management'), ('other', 'Something else')]
SIDES = [('both', 'Inside and outside'), ('in', 'Inside only'), ('out', 'Outside only'), ('unsure', 'I am not sure')]
OFTEN = [('weekly', 'Every week'), ('biweekly', 'Every two weeks'), ('monthly', 'Every month'), ('once', 'Just once')]
HOME = [('apartment', 'An apartment'), ('house', 'A house'), ('other', 'Something else')]
ROOMS = [('2', '1 to 2 rooms'), ('3', '3 rooms'), ('4', '4 rooms'), ('5', '5 rooms'), ('6', '6 or more'), ('unsure', 'I am not sure')]
WHERE = [(a, a) for a in AREAS] + [('Other', 'Somewhere else')]
PART = [('morning', 'Morning'), ('afternoon', 'Afternoon'), ('any', 'Any time')]
STEPBAR = lambda n: '<ol class="osteps" aria-label="Request steps">' + ''.join(
    f'<li class="{"is-done" if i < n else "is-now" if i == n else ""}"{" aria-current=\"step\"" if i == n else ""}><button type="button" data-go="{i}">Step {i}: {t}</button></li>'
    for i, t in [(1, 'The clean'), (2, 'Where and when'), (3, 'Your details')]) + '</ol>'
BOOK = SITE.page_head('Get a free quote', 'Choose what you need. Your request is written out as you go, ready to send to us on WhatsApp.') + f'''  <section class="sec req" id="book" aria-label="Your request">
    <form class="wrap form" id="form" novalidate>
      <div>
        {STEPBAR(1)}
        <div class="card ostep" data-s="1">
          <h2>The clean</h2>
          <div id="w-kind"><p class="f" id="kind-l">What would you like cleaned?</p>{chips('kind', KINDS, 'kind-l')}<p class="err" id="e-kind"></p></div>
          <div id="w-home"><p class="f" id="home-l">The home</p>{chips('home', HOME, 'home-l')}<p class="err" id="e-home"></p></div>
          <div id="w-rooms"><p class="f" id="rooms-l">How many rooms?</p>{chips('rooms', ROOMS, 'rooms-l')}<p class="err" id="e-rooms"></p></div>
          <div class="slot"><div id="w-often" class="keep"><p class="f" id="often-l">How often?</p>{chips('often', OFTEN, 'often-l')}<p class="err" id="e-often"></p></div><div id="w-sides" class="keep"><p class="f" id="sides-l">Which side of the windows?</p>{chips('sides', SIDES, 'sides-l')}<p class="err" id="e-sides"></p></div></div>
        </div>
        <div class="card ostep" data-s="2" hidden>
          <h2>Where and when</h2>
          <div id="w-where"><p class="f" id="where-l">Where is it?</p>{chips('where', WHERE, 'where-l')}<p class="err" id="e-where"></p></div>
          <div id="w-day"><label class="f" for="day">The day you would like</label><input class="fld" id="day" name="day" type="date"><p class="err" id="e-day"></p></div>
          <div id="w-part"><p class="f" id="part-l">Time of day</p>{chips('part', PART, 'part-l')}<p class="err" id="e-part"></p></div>
        </div>
        <div class="card ostep" data-s="3" hidden>
          <h2>Your details</h2>
          <div id="w-me"><label class="f" for="me">Your name</label><input class="fld" id="me" name="name" type="text" autocomplete="name" maxlength="80"><p class="err" id="e-me"></p></div>
          <div id="w-ph"><label class="f" for="ph">Your phone</label><input class="fld" id="ph" name="tel" type="tel" autocomplete="tel" inputmode="tel" maxlength="30"><p class="err" id="e-ph"></p></div>
          <label class="f" for="note">Anything we should know? (optional)</label><textarea class="fld" id="note" name="note" rows="3" maxlength="400"></textarea>
        </div>
      </div>
      <aside class="card sum" aria-labelledby="sum-h">
        <h2 id="sum-h">Your request</h2>
        <p class="para" id="para" aria-live="polite">Choose what you would like cleaned, and your request is written here.</p>
        <p class="pr"><b>Basic home clean {P(400)}</b>. Every other clean gets a free quote.</p>
        <p class="total" id="total-line">Basic home clean <b>{P(400)}</b></p>
        <p class="status" id="status" role="status" aria-live="polite"></p>
        <button class="btn" id="send" type="submit"><span id="send-l">Continue to where and when</span></button>
        <button class="back" id="back" type="button" hidden>Back</button>
        <p class="note" id="send-note">Nothing to pay on this page.</p>
      </aside>
    </form>
  </section>
'''
GIG = '32f63e57-42b7-48c3-ba9a-d8e16dbae6e1'
BOOK_JS = open('gen/book.js', encoding='utf8').read().replace('__GIG__', GIG)
SITE.write('book', 'Get a free quote · RBS Cleaning',
           'Tell us what to clean, where and when. Your request is written out as you choose and sent to RBS Cleaning on WhatsApp for a free quote.',
           'og.webp', BOOK + SITE.gift_section(), '<script>\n' + BOOK_JS + '\n</script>\n<script src="gift.js"></script>\n')

# ---------- contact ----------
CONTACT = SITE.page_head('Talk to us', 'WhatsApp us for a free quote or to book a clean.') + f'''  <section class="sec contact" aria-label="How to reach us">
    <div class="wrap contact-grid">
      <div class="card"><h2>WhatsApp</h2><p>{SITE.contacts[0].html()}</p><p>For free quotes and appointments.</p></div>
      <div class="card"><h2>Where we clean</h2><p>{'<br>'.join(AREAS)}</p></div>
      <div class="card"><h2>The price</h2><p>Basic home clean {P(400)}.</p><p>Every other clean is quoted free. <a href="book.html">Get a free quote</a></p></div>
    </div>
  </section>
''' + kit.faq('Your questions')
SITE.write('contact', 'Contact · RBS Cleaning',
           'WhatsApp RBS Cleaning on 053-526-9002 for free quotes and appointments in Beit Shemesh, RBS, Jerusalem and Ashdod.',
           'og.webp', CONTACT)

# finishing touches every page shares
LOGO = '<span class="rbs">RBS</span> <span>Cleaning</span>'
for pg in ('index', 'book', 'contact'):
    t = open(pg + '.html', encoding='utf8').read()
    t = t.replace('<span class="arw" aria-hidden="true">→</span>', '<span class="arw" aria-hidden="true">' + ARW + '</span>')
    t = t.replace('<span>RBS Cleaning</span></a>\n  <nav', f'{LOGO}</a>\n  <nav', 1)
    t = t.replace('https://wa.me/0535269002', 'https://wa.me/972535269002')  # the kit keeps the leading 0 of a local number
    t = t.replace('<meta name="viewport"', '<meta name="site-category" content="service">\n<meta name="viewport"', 1)
    open(pg + '.html', 'w', encoding='utf8').write(t)
print('built')
