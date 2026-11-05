"""Aaron Dovid's site: kumzits and guitar lessons, Jerusalem. Run from the build folder: python gen/build.py
Every fact is from src/record.json (the business and its two listings) or his two flyers (src/owner)."""
import sys; sys.path.insert(0, '../../starter'); import sitekit as kit  # noqa: E401

PICK = ('<svg class="pick" viewBox="0 0 20 24" width="18" height="22" aria-hidden="true">'
        '<path d="M10 23C5 17 1 11 1 6.5 1 3 4.5 1 10 1s9 2 9 5.5C19 11 15 17 10 23z" fill="currentColor"/></svg>')

SITE = kit.Site(
    name='Aaron Dovid, kumzits and guitar lessons', short='Aaron Dovid', slug='aaron-kaluszyner',
    pages=[('index', 'Home'), ('lessons', 'Guitar lessons'), ('book', 'Book'), ('contact', 'Contact')],
    contacts=[kit.Contact('whatsapp', '053-419-3420'), kit.Contact('email', 'musicnchizuk@gmail.com')],
    fonts='family=Suez+One&family=Alef:wght@400;700',
    cta=('book.html', 'Book'), bar=('Kumzits ₪1,200', 'Guitar lessons ₪100 for 40 minutes'),
    place='Jerusalem', close_title='Book your kumzits or your first lesson', mark_html=PICK, count=False,
    about='Kumzitzes for your event and guitar lessons, in Jerusalem.',
    ordering=('Booking', ['Choose a kumzits or a lesson, a day and a time', 'Your request is saved and opens WhatsApp to Aaron',
                          'Sunday to Thursday, 9:00 to 17:00']),
    ld_type='LocalBusiness',
    ld_extra={'areaServed': 'Jerusalem', 'makesOffer': [
        {'@type': 'Offer', 'name': 'Kumzits', 'price': 1200, 'priceCurrency': 'ILS'},
        {'@type': 'Offer', 'name': 'Music Lessons, 40 minutes', 'price': 100, 'priceCurrency': 'ILS'}]})

HEAD_EXTRA = '<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 24%27%3E%3Cpath fill=%27%23B4470F%27 d=%27M10 23C5 17 1 11 1 6.5 1 3 4.5 1 10 1s9 2 9 5.5C19 11 15 17 10 23z%27/%3E%3C/svg%3E">' + '<meta name="site-category" content="events">\n'
_head = SITE.head
SITE.head = lambda page, title, desc, og: _head(page, title, desc, og).replace('<link rel="stylesheet" href="site.css">', HEAD_EXTRA + '<link rel="stylesheet" href="site.css">')

OCCASIONS = [('bar-mitzvah', 'Bar Mitzvah'), ('chuppah', 'Chuppah'), ('bris', 'Bris Milah'), ('other', 'Any other occasion'), ('kumzits', 'Just a kumzits')]

# ── Home ──
OPENING = f'''  <section class="open" id="open" aria-labelledby="h-open">
    <canvas class="strings" id="strings" aria-hidden="true"></canvas>
    <div class="open-in wrap">
      <div class="open-card">
        <p class="label" data-arrive="1">Aaron Dovid · Jerusalem</p>
        <h1 id="h-open" data-arrive="1">A kumzits for your<br><span class="rot" data-words="Bar Mitzvah|Chuppah|Bris Milah|simcha"></span></h1>
        <div class="open-act" data-arrive="4">
          <a class="btn" href="book.html?svc=kumzits"><span>Book</span><i class="twang" aria-hidden="true"></i></a>
          <ul class="btn-facts"><li>Kumzits {kit.price('1,200')}</li><li>Guitar lessons {kit.price(100)}</li><li>Online lessons too</li></ul>
        </div>
      </div>
    </div>
    <button class="sound" id="sound" type="button" aria-pressed="false">Sound off</button>
  </section>
'''

KUMZITS = f'''  <section class="sec dark occ" id="kumzits" aria-labelledby="h-occ">
    <div class="wrap occ-grid">
      <div class="occ-l">
        <h2 id="h-occ" class="rev">Book your kumzits</h2>
        <p class="lede rev">For your event, Bar Mitzvah, Chuppah, Bris Milah, or any other occasion. Just looking to have a kumzits? Reach out and book yours.</p>
        <p class="price rev"><b>{kit.price('1,200')}</b><span>a kumzits</span></p>
        <p class="vid rev">To see videos of previous kumzitzes, <a href="https://wa.me/972534193420?text=Hi%20Aaron%2C%20could%20you%20send%20me%20videos%20of%20previous%20kumzitzes%3F" target="_blank" rel="noopener">ask Aaron on WhatsApp</a>.</p>
      </div>
      <ol class="occ-list" aria-label="Choose your occasion">
        {''.join(f'<li><a class="occ-row" href="book.html?svc=kumzits&amp;occasion={k}" data-occ="{n}"><span>{n}</span><i aria-hidden="true">→</i></a></li>' for k, n in OCCASIONS)}
      </ol>
    </div>
  </section>
'''

LESSONS = f'''  <section class="sec stone lessons" id="lessons" aria-labelledby="h-les">
    <div class="wrap">
      <h2 id="h-les" class="rev">Guitar lessons, relaxed and patient</h2>
      <p class="lede rev">For beginners and anyone who wants to improve their playing, personalised to each person's level. Chords, songs, strumming, and how to enjoy playing guitar.</p>
      <ol class="lpg">
        <li class="rev"><b>Learn</b><span>Build strong foundations</span></li>
        <li class="rev"><b>Play</b><span>Your favourite songs</span></li>
        <li class="rev"><b>Grow</b><span>At your own pace</span></li>
      </ol>
      <div class="les-foot rev">
        <p class="price"><b>{kit.price(100)}</b><span>for 40 minutes, in person or online</span></p>
        <a class="btn-line" href="lessons.html">About the lessons</a>
      </div>
    </div>
  </section>
'''

HOW = '''  <section class="sec how" id="how" aria-labelledby="h-how">
    <div class="wrap">
      <h2 id="h-how" class="rev">How booking works</h2>
      <ol class="steps">
        <li class="rev"><b>1</b><h3>Choose</h3><p>A kumzits or a lesson, then a day and a time from Aaron's calendar.</p></li>
        <li class="rev"><b>2</b><h3>Send</h3><p>Your request is saved on MyIsraelRental and WhatsApp opens with it written out.</p></li>
        <li class="rev"><b>3</b><h3>Hear back</h3><p>Aaron replies to confirm the details with you directly.</p></li>
      </ol>
    </div>
  </section>
'''

SITE.write('index', 'Aaron Dovid · Kumzits and guitar lessons, Jerusalem',
           'Book a kumzits for your Bar Mitzvah, Chuppah, Bris Milah or any occasion, ₪1,200. Guitar lessons ₪100 for 40 minutes, online too.',
           'og.jpg', OPENING + KUMZITS + LESSONS + HOW + kit.gallery('From our kumzitzes') + kit.faq('Your questions'),
           '<script src="strings.js"></script>\n')

# ── Lessons ──
LES_PAGE = SITE.page_head('Guitar lessons and mentoring', 'Lessons are relaxed, patient, and personalised to each person\'s level.') + f'''  <section class="sec les-two" aria-label="Two ways to learn">
    <div class="wrap two">
      <article class="opt rev">
        <h2>Guitar lessons</h2>
        <p>For beginners and anyone who wants to improve their playing. We can learn chords, songs, strumming, and how to enjoy playing guitar.</p>
        <p class="price"><b>{kit.price(100)}</b><span>for 40 minutes</span></p>
        <a class="btn-line" href="book.html?svc=lesson">Book a lesson</a>
      </article>
      <article class="opt rev">
        <h2>Guitar and mentoring</h2>
        <p>More than just a guitar lesson. A relaxed time to play guitar, talk, and have someone there to listen and connect with. A great option for someone who would benefit from both music and a supportive mentor.</p>
        <p class="price ask"><b>Ask for the price</b></p>
        <a class="btn-line" href="book.html?svc=mentor">Book guitar and mentoring</a>
      </article>
    </div>
  </section>
  <section class="sec stone lessons" aria-labelledby="h-lpg">
    <div class="wrap">
      <h2 id="h-lpg" class="rev">Learn. Play. Grow.</h2>
      <ol class="lpg">
        <li class="rev"><b>Learn</b><span>Build strong foundations</span></li>
        <li class="rev"><b>Play</b><span>Your favourite songs</span></li>
        <li class="rev"><b>Grow</b><span>At your own pace</span></li>
      </ol>
      <p class="lede rev">Now offering online lessons, as well as in person in Jerusalem.</p>
    </div>
  </section>
'''
SITE.write('lessons', 'Guitar lessons in Jerusalem and online · Aaron Dovid',
           'Relaxed, patient guitar lessons for beginners and up, ₪100 for 40 minutes, in Jerusalem or online. Guitar and mentoring too.',
           'og.jpg', LES_PAGE)

# ── Book: one request in three steps, the summary written as you fill it (rules 3k.7, 3x.9, 3x.10) ──
chips = ''.join(f'<label class="chip"><input type="radio" name="occ" value="{n}"><span>{n}</span></label>' for _, n in OCCASIONS)
BOOK = SITE.page_head('Book Aaron', 'A kumzits for your event, or a guitar lesson. Choose, pick a day, and send.') + f'''  <section class="sec book-sec" id="book" aria-label="Your booking">
    <div class="wrap">
      <ol class="osteps" aria-label="Steps">
        <li data-go="1"><span>Step 1: What</span></li><li data-go="2"><span>Step 2: When and where</span></li><li data-go="3"><span>Step 3: Your details</span></li>
      </ol>
      <form class="form" id="form" novalidate>
        <div class="fcol">
          <fieldset class="ostep card" data-s="1">
            <legend>What would you like?</legend>
            <div class="svcs" id="w-svc">
              <label class="svc"><input type="radio" name="svc" value="kumzits"><span class="svc-in"><b>Kumzits</b><span>For your event or simcha</span><em>{kit.price('1,200')}</em></span></label>
              <label class="svc"><input type="radio" name="svc" value="lesson"><span class="svc-in"><b>Guitar lesson</b><span>40 minutes, in person or online</span><em>{kit.price(100)}</em></span></label>
              <label class="svc"><input type="radio" name="svc" value="mentor"><span class="svc-in"><b>Guitar and mentoring</b><span>Play, talk and connect</span><em class="ask">Ask for the price</em></span></label>
            </div>
            <p class="err" id="e-svc" aria-live="polite"></p>
            <div class="sub" id="occ-box" hidden>
              <p class="f" id="l-occ">Which occasion?</p>
              <div class="chips" role="radiogroup" aria-labelledby="l-occ" id="w-occ">{chips}</div>
              <p class="err" id="e-occ" aria-live="polite"></p>
            </div>
            <div class="sub" id="how-box" hidden>
              <p class="f" id="l-how">In person or online?</p>
              <div class="chips" role="radiogroup" aria-labelledby="l-how"><label class="chip"><input type="radio" name="how" value="in person" checked><span>In person</span></label><label class="chip"><input type="radio" name="how" value="online"><span>Online</span></label><label class="chip"><input type="radio" name="how" value="not sure yet"><span>Not sure yet</span></label></div>
            </div>
          </fieldset>
          <fieldset class="ostep card" data-s="2" hidden>
            <legend>When and where?</legend>
            <div id="w-day"><label class="f" for="day">Day</label><input class="fld" type="date" id="day" name="day" required>
            <p class="err" id="e-day" aria-live="polite"></p></div>
            <div id="w-time"><p class="f" id="l-time">Time</p><div class="times" id="times" role="radiogroup" aria-labelledby="l-time"></div>
            <p class="hint" id="t-hint"></p><p class="err" id="e-time" aria-live="polite"></p></div>
            <div id="w-place"><label class="f" for="place">Where is the event? <span class="opt-l">(optional)</span></label><input class="fld" id="place" name="place" autocomplete="address-level2" placeholder="Neighbourhood or town">
            <label class="f" for="guests">About how many people? <span class="opt-l">(optional)</span></label><input class="fld" id="guests" name="guests" type="number" min="1" inputmode="numeric"></div>
          </fieldset>
          <fieldset class="ostep card" data-s="3" hidden>
            <legend>Your details</legend>
            <div id="w-me"><label class="f" for="me">Your name</label><input class="fld" id="me" name="name" autocomplete="name" required><p class="err" id="e-me" aria-live="polite"></p></div>
            <div id="w-ph"><label class="f" for="ph">Phone</label><input class="fld" id="ph" name="tel" type="tel" autocomplete="tel" inputmode="tel" required><p class="err" id="e-ph" aria-live="polite"></p></div>
            <label class="f" for="note">Anything Aaron should know? <span class="opt-l">(optional)</span></label><textarea class="fld" id="note" name="note" rows="1"></textarea>
          </fieldset>
          <div class="nav-row"><button class="btn-line" type="button" id="back" hidden>Back</button></div>
        </div>
        <aside class="sum card" id="sum" aria-label="Your request">
          <h2>Your request</h2>
          <p class="sum-p" id="sum-p" aria-live="polite">Choose a kumzits or a lesson to start.</p>
          <p class="total"><span>Price</span><b id="total">·</b></p>
          <button class="btn send" id="send" type="submit"><span id="send-l">Continue to day and time</span></button>
          <p class="hint" id="send-note">Opens WhatsApp with your request written out.</p>
          <p class="status" id="status" role="status" aria-live="polite"></p>
        </aside>
      </form>
    </div>
  </section>
'''
SITE.write('book', 'Book a kumzits or a guitar lesson · Aaron Dovid',
           'Choose a kumzits (₪1,200) or a guitar lesson (₪100, 40 minutes), pick a day and a time, and send your request to Aaron.',
           'og.jpg', BOOK + SITE.gift_section(), '<script src="book.js"></script>\n<script src="gift.js"></script>\n')

# ── Contact ──
CONTACT = SITE.page_head('Talk to Aaron', 'Questions about a kumzits or lessons, or to see videos of previous kumzitzes.') + f'''  <section class="sec contact" aria-label="Contact">
    <div class="wrap two">
      <div class="card rev">
        <h2>Reach Aaron</h2>
        <p>{SITE.contacts_html()}</p>
      </div>
      <div class="card rev">
        <h2>When and where</h2>
        <p>Jerusalem, and lessons online.</p>
        <p>Booking times: Sunday to Thursday, 9:00 to 17:00.</p>
      </div>
    </div>
  </section>
'''
SITE.write('contact', 'Contact Aaron Dovid · Kumzits and guitar lessons',
           'WhatsApp or call Aaron Dovid on 053-419-3420 about a kumzits or guitar lessons in Jerusalem.',
           'og.jpg', CONTACT)
PRELOAD = ('<link rel="preload" as="image" href="assets/wall-wide.webp" media="(min-aspect-ratio: 9/10)" fetchpriority="high">'
           '<link rel="preload" as="image" href="assets/wall-tall.webp" media="(max-aspect-ratio: 9/10)" fetchpriority="high">')
# Alef has no arrow: every → (the kit's too) becomes the same small drawn one (3o.5)
ARROW = '<svg class="arw-i" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
for page in ('index', 'lessons', 'book', 'contact'):
    html = open(f'{page}.html', encoding='utf8').read().replace('→', ARROW).replace('wa.me/0534193420', 'wa.me/972534193420')
    if page == 'index':  # the opening picture loads first (3x.8)
        html = html.replace('<link rel="stylesheet" href="site.css">', PRELOAD + '<link rel="stylesheet" href="site.css">')
    open(f'{page}.html', 'w', encoding='utf8').write(html)
print('wrote index, lessons, book, contact')
