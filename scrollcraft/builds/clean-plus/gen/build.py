"""Clean Plus. Run from this folder: python gen/build.py (or from gen/).
Writes index.html, book.html, contact.html, site.css, site.js, gift.js, prices.json.
Every fact is from the owner's listing (src/record.json) or flyer (src/owner/p01.jpg)."""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
os.chdir(ROOT)
sys.path.insert(0, '../../starter')
import sitekit as kit

P = kit.price
PRICE = 325                      # the listing's one price: Weekly cleaning 4 hours, ILS
TIER = 'Weekly cleaning 4 hours'
GIG = '8d8bb8e8-1571-45ce-a6e9-5b177b83561e'
WA = '+972 50-423-2291'          # the listing's WhatsApp (flyer's 058 number asked, question 1)
ARW = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4"/></svg>'
HOUSE = '<svg class="house" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/></svg>'
def icon(paths):
    return f'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{paths}</svg>'
I_CAL = icon('<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>')
I_USER = icon('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>')
I_SHIELD = icon('<path d="M12 3 4.5 6v6c0 4.5 3.2 7.8 7.5 9 4.3-1.2 7.5-4.5 7.5-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>')
I_BAG = icon('<path d="M5 8h14l-1.2 12.5H6.2z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>')
I_DEEP = icon('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>')
I_ONCE = icon('<path d="M3 10.5 12 3l9 7.5V21H3z"/><path d="M12 11v5M9.5 13.5h5"/>')

# ---------- css and js from the starter ----------
css = open('../../starter/site.css', encoding='utf8').read()
cut = css.index('/* ── BELOW HERE')
head = css[:cut]
head = re.sub(r'  --ground:.*?--line: #E5E5E5;',
              '  --ground: #FFFFFF; --surface: #EFF3FE; --ink: #1B2137; --soft: #4B5368; --accent: #3062E5; --accent-ink: #FFFFFF; --line: #D9E1F5;\n  --accent-deep: #2149B8; --gold: #E8A03A; --on-dark: #8FAEFF;',
              head, flags=re.S)
head = head.replace('--font-head: Georgia, serif; --font-body: system-ui, sans-serif;', "--font-head: 'Plus Jakarta Sans', system-ui, sans-serif; --font-body: 'Public Sans', system-ui, sans-serif;")
head = head.replace('--r: 16px;', '--r: 18px;')
head = head.replace('html { scroll-behavior: smooth; }', 'html { scroll-behavior: smooth; overflow-x: clip; } body { overflow-x: clip; }')
own = open('gen/own.css', encoding='utf8').read()
open('site.css', 'w', encoding='utf8').write(head + css[cut:].split('\n')[0] + '\n' + own)
js = open('../../starter/site.js', encoding='utf8').read().replace('CHANGE-ME-basket-v1', 'clean-plus-v1')
open('site.js', 'w', encoding='utf8').write(js)
open('gift.js', 'w', encoding='utf8').write(open('../../starter/gift.js', encoding='utf8').read())
open('prices.json', 'w', encoding='utf8').write(json.dumps({TIER: {'was': PRICE, 'sym': '₪'}}, ensure_ascii=False, indent=2) + '\n')

SITE = kit.Site(
    name='Clean Plus', short='Clean Plus', slug='clean-plus',
    pages=[('index', 'Home'), ('book', 'Build your plan'), ('contact', 'Contact')],
    contacts=[kit.Contact('whatsapp-only', WA)],
    fonts='family=Plus+Jakarta+Sans:wght@700;800&family=Public+Sans:wght@400;600',
    cta=('book.html', 'Build your plan'), bar=(f'₪{PRICE} a visit', 'Weekly, 4 hours'),
    place='Jerusalem', close_title='A clean home every week, on the day you choose.',
    mark_html=HOUSE, count=False,
    about='Weekly home cleaning all around Jerusalem.',
    ordering=('How it works', ['Pick your day and what you need', 'We confirm on WhatsApp', 'All around Jerusalem']),
    ld_type='HouseCleaningService',
    ld_extra={'areaServed': 'Jerusalem', 'makesOffer': {'@type': 'Offer', 'name': TIER, 'price': PRICE, 'priceCurrency': 'ILS'}})

# ---------- the plan board (CP-X1): four weeks, Sunday to Friday; without a script it shows weekly Tuesdays ----------
DAYS = [('sun', 'Sun'), ('mon', 'Mon'), ('tue', 'Tue'), ('wed', 'Wed'), ('thu', 'Thu'), ('fri', 'Fri')]
def cell(w, d, lab):
    visit = '<span class="visit" data-l="4 hours"><i class="booked" aria-hidden="true"></i><span class="vl">4 hours</span></span>' if d == 'tue' else ''
    return f'<button type="button" class="day" data-w="{w}" data-d="{d}" aria-label="{lab}, week {w + 1}"><span class="dn" aria-hidden="true"></span>{visit}</button>'
GRID = ''.join(f'<div class="wk" role="group" aria-label="Week {w + 1}">' + ''.join(cell(w, d, lab) for d, lab in
              [(d, {'sun': 'Sunday', 'mon': 'Monday', 'tue': 'Tuesday', 'wed': 'Wednesday', 'thu': 'Thursday', 'fri': 'Friday'}[d]) for d, _ in DAYS]) + '</div>' for w in range(4))
PILLS = [('week', 'Every week'), ('2weeks', 'Every <span class="lg">two</span><span class="sm">2</span> weeks'), ('once', 'Just once')]
BOARD = f'''<div class="board" id="board" aria-labelledby="board-h">
          <div class="board-top"><h2 id="board-h">Your plan</h2><p class="month" id="month" aria-hidden="true"></p></div>
          <div class="pills" role="radiogroup" aria-label="How often">{''.join(f'<button type="button" role="radio" class="pill" data-often="{v}" aria-checked="{"true" if v == "week" else "false"}">{t}</button>' for v, t in PILLS)}<span class="glide" aria-hidden="true"></span></div>
          <div class="cal" id="cal">
            <div class="wk head" aria-hidden="true">{''.join(f'<span>{t}</span>' for _, t in DAYS)}</div>
            {GRID}
          </div>
          <p class="hint">Tap a day to move your visit.</p>
          <p class="sentence" id="sentence" aria-live="polite">Every Tuesday, 4 hours, <b>{P(PRICE)} a visit</b>.</p>
          <ul class="lines" id="lines" aria-live="polite"></ul>
          <a class="btn" id="board-go" href="book.html?often=week&amp;day=tue">Build your plan <span class="arw" aria-hidden="true">→</span></a>
        </div>'''

# the flyer's six tiles, in its words; four of them change the plan (a toggle), two are what every visit is
OPTS = [
    ('weekly', I_CAL, 'Weekly visits', 'Every week, every two weeks or just once. Choose it on your plan.', ''),
    ('same', I_USER, 'Same cleaner every week', 'Want someone who knows your home? Just ask.', 'Ask for the same cleaner'),
    ('pro', I_SHIELD, 'Professional cleaners', 'Experienced, reliable and carefully selected.', ''),
    ('sup', I_BAG, 'Equipment and supplies', "Don't have them? We can bring them.", 'Ask us to bring them'),
    ('deep', I_DEEP, 'Deep cleaning', 'For move-ins, after renovations or a full reset.', 'Make it a deep clean'),
    ('once', I_ONCE, 'One-time cleaning', 'Before Shabbat, holidays or guests.', 'Make it one time'),
]
def opt(k, ic, name, line, act):
    btn = f'<button type="button" class="toggle" data-opt="{k}" aria-pressed="false"><span class="tk" aria-hidden="true"></span><span class="tl">{act}</span></button>' if act else ''
    return f'<li class="o o-{k}"><span class="oi">{ic}</span><h3>{name}</h3><p>{line}</p>{btn}</li>'
OPTIONS = f'''<div class="pick" id="pick">
          <h2 id="h-pick">Pick what fits your home</h2>
          <p class="lede">Each option you choose goes onto your plan above and the line below, ready to send on WhatsApp.</p>
          <ul class="otiles">{''.join(opt(*o) for o in OPTS)}</ul>
          <div class="pick-plan"><p class="sentence" id="pick-sentence" aria-live="polite">Every Tuesday, 4 hours, <b>{P(PRICE)} a visit</b>.</p><ul class="lines" id="pick-lines"></ul>
          <a class="btn" id="pick-go" href="book.html?often=week&amp;day=tue">Build your plan <span class="arw" aria-hidden="true">→</span></a></div>
        </div>'''

OPENING = f'''  <section class="open" id="open" aria-labelledby="h1">
    <div class="open-ph">
      {kit.picture('assets/room-wide.webp', 'A bright, tidy Jerusalem living room with a big window onto stone buildings', 1920, 1080, tall='assets/room-tall.webp', tall_wh=(1080, 1920), first=True).replace('(max-aspect-ratio: 1/1)', '(max-width: 600px) and (max-aspect-ratio: 1/1)')}
    </div>
    <div class="wrap open-grid">
      <div class="hero">
        <p class="kick">Home cleaning · Jerusalem</p>
        <h1 id="h1">Home cleaning,<br><span class="em">your way.</span></h1>
        <p class="sub">Weekly home cleaning all around Jerusalem. Four hours, {P(PRICE)}.</p>
        <div class="hero-act">
          <a class="btn" href="book.html">Build your plan <span class="arw" aria-hidden="true">→</span></a>
          {kit.facts([f'Weekly, 4 hours, {P(PRICE)}', 'All around Jerusalem', f'WhatsApp {WA}'])}
        </div>
      </div>
      <aside class="board-col" aria-label="Your cleaning plan">
        {BOARD}
      </aside>
    </div>
  </section>
  <section class="sec picks" id="pick-sec" aria-labelledby="h-pick">
    <div class="wrap">
      {OPTIONS}
    </div>
  </section>
'''

PRICE_SEC = f'''  <section class="sec cost" id="cost" aria-labelledby="h-cost">
    <div class="wrap cost-grid">
      <div class="pcard">
        <p class="kick">Weekly cleaning</p>
        <p class="amt"><span class="big">{P(PRICE)}</span><span class="unit">a visit<br>4 hours</span></p>
        <h2 id="h-cost">Four hours of cleaning every week for {P(PRICE)}</h2>
        <p>Deep, one-time and every-two-weeks cleans are priced for your home on WhatsApp.</p>
        <a class="btn" href="book.html">Build your plan <span class="arw" aria-hidden="true">→</span></a>
      </div>
      <div class="steps">
        <h2 id="h-steps">Your plan in three steps</h2>
        <ol class="plain">
          <li><b>Pick your day and what you need</b><span>On the plan at the top of this page or on Build your plan.</span></li>
          <li><b>Send it on WhatsApp</b><span>Your plan is written out for you, ready to send to {WA}.</span></li>
          <li><b>We confirm your first visit</b><span>On WhatsApp, anywhere in Jerusalem.</span></li>
        </ol>
      </div>
    </div>
  </section>
'''

SITE.write('index', 'Clean Plus · Weekly home cleaning in Jerusalem',
           f'Home cleaning, your way. Weekly home cleaning all around Jerusalem, 4 hours for ₪{PRICE}. Build your plan and send it on WhatsApp.',
           'og.webp', OPENING + PRICE_SEC + kit.gallery('From our cleans') + kit.faq('Your questions'),
           '<script>\n' + open('gen/board.js', encoding='utf8').read() + '\n</script>\n')

# ---------- plan: the request that writes its own plan (3x.9) ----------
def chips(name, opts, label_id, kind='radio'):
    role = 'radiogroup' if kind == 'radio' else 'group'
    return f'<div class="opts" role="{role}" aria-labelledby="{label_id}">' + ''.join(
        f'<label class="opt"><input type="{kind}" name="{name}" value="{v}"><span class="box">{t}</span></label>' for v, t in opts) + '</div>'
KINDS = [('regular', f'Regular visits'), ('deep', 'Deep cleaning'), ('once', 'One-time cleaning'), ('other', 'Something else')]
OFTEN = [('week', 'Every week'), ('2weeks', 'Every two weeks')]
EXTRA = [('same', 'The same cleaner each visit'), ('sup', 'Bring equipment and supplies')]
WDAY = [(d, {'sun': 'Sunday', 'mon': 'Monday', 'tue': 'Tuesday', 'wed': 'Wednesday', 'thu': 'Thursday', 'fri': 'Friday'}[d]) for d, _ in DAYS] + [('any', 'Any day')]
# start times that fit a 4-hour visit inside the listing's 9:00 to 17:00, on its 90-minute grid (the dashboard needs one)
PART = [('09:00', '9:00'), ('10:30', '10:30'), ('12:00', '12:00')]
STEPBAR = '<ol class="osteps" aria-label="Plan steps">' + ''.join(
    f'<li class="{"is-now" if i == 1 else ""}"{" aria-current=\"step\"" if i == 1 else ""}><button type="button" data-go="{i}">Step {i}: {t}</button></li>'
    for i, t in [(1, 'Your plan'), (2, 'When and where'), (3, 'Your details')]) + '</ol>'
PLAN = SITE.page_head('Build your plan', 'Choose what you need. Your plan is written out as you go, ready to send on WhatsApp.') + f'''  <section class="sec req" id="book" aria-label="Your plan">
    <form class="wrap form" id="form" novalidate>
      <div>
        {STEPBAR}
        <div class="card ostep" data-s="1">
          <h2>Your plan</h2>
          <div id="w-kind"><p class="f" id="kind-l">What kind of clean?</p>{chips('kind', KINDS, 'kind-l')}<p class="err" id="e-kind"></p></div>
          <div id="w-often" class="keep"><p class="f" id="often-l">How often?</p>{chips('often', OFTEN, 'often-l')}<p class="err" id="e-often"></p></div>
          <div id="w-extra"><p class="f" id="extra-l">Anything to add? (optional)</p>{chips('extra', EXTRA, 'extra-l', 'checkbox')}</div>
        </div>
        <div class="card ostep" data-s="2" hidden>
          <h2>When and where</h2>
          <div id="w-wday" class="keep"><p class="f" id="wday-l">Which day of the week?</p>{chips('wday', WDAY, 'wday-l')}<p class="err" id="e-wday"></p></div>
          <div id="w-day"><label class="f" for="day" id="day-l">The first day you would like</label><input class="fld" id="day" name="day" type="date"><p class="err" id="e-day"></p></div>
          <div id="w-part"><p class="f" id="part-l">Start time (the visit is 4 hours)</p>{chips('part', PART, 'part-l')}<p class="err" id="e-part"></p></div>
          <div id="w-where"><label class="f" for="where">Your neighbourhood in Jerusalem</label><input class="fld" id="where" name="where" type="text" autocomplete="address-level3" maxlength="80" placeholder="For example Baka, Katamon, Ramot"><p class="err" id="e-where"></p></div>
        </div>
        <div class="card ostep" data-s="3" hidden>
          <h2>Your details</h2>
          <div id="w-me"><label class="f" for="me">Your name</label><input class="fld" id="me" name="name" type="text" autocomplete="name" maxlength="80"><p class="err" id="e-me"></p></div>
          <div id="w-ph"><label class="f" for="ph">Your phone</label><input class="fld" id="ph" name="tel" type="tel" autocomplete="tel" inputmode="tel" maxlength="30"><p class="err" id="e-ph"></p></div>
          <label class="f" for="note">Anything we should know about your home? (optional)</label><textarea class="fld" id="note" name="note" rows="3" maxlength="400"></textarea>
          <div id="mir-code"></div><script>window.MirCode=window.MirCode||{{mount:function(){{}},refresh:function(){{}},code:function(){{return null}},after:function(n){{return n}},text:function(){{return ""}}}};</script>
        </div>
      </div>
      <aside class="card sum" aria-labelledby="sum-h">
        <h2 id="sum-h">Your plan</h2>
        <p class="para" id="para" aria-live="polite">Choose the kind of clean, and your plan is written here.</p>
        <ul class="lines" id="sum-lines"></ul>
        <p class="total" id="total-line">Weekly, 4 hours <b>{P(PRICE)} a visit</b></p>
        <p class="status" id="status" role="status" aria-live="polite"></p>
        <button class="btn" id="send" type="submit"><span id="send-l">Continue to when and where</span></button>
        <button class="back" id="back" type="button" hidden>Back</button>
        <p class="note" id="send-note">Nothing to pay on this page.</p>
      </aside>
    </form>
  </section>
'''
PLAN_JS = open('gen/plan.js', encoding='utf8').read().replace('__GIG__', GIG).replace('__TIER__', TIER).replace('__PRICE__', str(PRICE))
SITE.write('book', 'Build your plan · Clean Plus',
           f'Every week, every two weeks or just once, on the day you choose. Weekly 4 hours ₪{PRICE}. Sent to Clean Plus on WhatsApp.',
           'og.webp', PLAN + SITE.gift_section(), '<script>\n' + PLAN_JS + '\n</script>\n<script src="gift.js"></script>\n')

# ---------- contact ----------
CONTACT = SITE.page_head('Talk to us on WhatsApp', 'Tell us what you need, and we will build the right plan with you.') + f'''  <section class="sec contact" aria-label="How to reach us">
    <div class="wrap contact-grid">
      <div class="card"><h2>Write to us</h2><p>{SITE.contacts[0].html()}</p><p>For plans, questions and changes to a visit.</p></div>
      <div class="card"><h2>Where we clean</h2><p>All around Jerusalem.</p></div>
      <div class="card"><h2>The price</h2><p>Weekly cleaning, 4 hours: {P(PRICE)} a visit.</p><p>Other cleans are priced on WhatsApp. <a href="book.html">Build your plan</a></p></div>
    </div>
  </section>
'''
SITE.write('contact', 'Contact · Clean Plus',
           f'WhatsApp Clean Plus on {WA} for weekly home cleaning all around Jerusalem.',
           'og.webp', CONTACT)

# finishing touches every page shares
for pg in ('index', 'book', 'contact'):
    t = open(pg + '.html', encoding='utf8').read()
    t = t.replace('<span class="arw" aria-hidden="true">→</span>', '<span class="arw" aria-hidden="true"><i class="ln"></i>' + ARW + '</span>')
    t = t.replace('<span>Clean Plus</span></a>\n  <nav', '<span class="nm">Clean <b>Plus</b></span></a>\n  <nav', 1)
    t = t.replace('<link rel="stylesheet" href="site.css">', '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700;800&text=%E2%82%AA&display=swap" rel="stylesheet">\n<link rel="stylesheet" href="site.css">', 1)
    t = t.replace('<meta name="viewport"', '<meta name="site-category" content="service">\n<meta name="offers" content="weekly home cleaning">\n<meta name="viewport"', 1)
    open(pg + '.html', 'w', encoding='utf8').write(t)
print('built')
