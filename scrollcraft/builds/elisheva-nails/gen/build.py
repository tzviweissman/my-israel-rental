# Writes Nails by Elisheva's pages (Home, Book, Contact): one menu bar and one
# footer (page rules 3k). Run from the build folder.
# Facts, all hers: the listing (services, prices, times, hours, Romema,
# WhatsApp +44 7871 822590, email) and her flyer (Luxe Nail Studio, Nails by
# Elisheva, gel nails, French nails, nail art, located in Romema, 4+ years
# experience, text +972 53 348 4521, the EB monogram). Photos: her own.
import json

PAGES = [('index', 'Home'), ('book', 'Book'), ('contact', 'Contact')]
WA = '447871822590'
OG = 'https://myisraelrental.com/pages/elisheva-brandeis/assets/'
# shades named by what they look like; each is her own photo of that colour
SHADES = [
    ('milky', 'Milky white', '#F4EFEE', 'milky.webp', 'Milky white gel nails on a client'),
    ('bubblegum', 'Bubblegum pink', '#F3A9C6', 'bubblegum.webp', 'Bubblegum pink gel nails'),
    ('sheer', 'Sheer pink', '#EDBDB6', 'sheer.webp', 'Sheer pink gel nails on a client'),
    ('nude', 'Soft nude', '#E7C4B5', 'nude-2.webp', 'Soft nude gel nails on a client'),
    ('ruby', 'Ruby red', '#8F1D2B', 'ruby.webp', 'Ruby red gel nails holding two gel polish bottles'),
    ('blue', 'With a touch of blue', '#AFCBE8', 'blue.webp', 'Nude gel nails with light blue accent nails'),
]
SERVICES = [
    ('gel', 'Gel Nails', 90, 45, 'Gel colour on your natural nails.'),
    ('gel-removal', 'Gel nails with removal', 110, 60, 'Your old gel taken off, then a new gel colour.'),
    ('art', 'Nail art, French or gradient nails', 110, 60, 'French tips, a gradient, or nail art.'),
    ('removal', 'Gel removal', 40, 25, 'Gel taken off, nothing new put on.'),
]
HOURS = [('Sunday', '10:00 to 13:00'), ('Monday', '10:00 to 19:00'), ('Tuesday', '10:00 to 19:00'), ('Wednesday', '10:00 to 19:00'),
         ('Thursday', '10:00 to 19:00'), ('Friday', '10:00 to 13:00'), ('Shabbat', 'Closed')]


def head(page, title, desc, img):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{OG}{img}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,500;0,6..96,600;1,6..96,500&family=Outfit:wght@400;500;600&family=Parisienne&display=swap" rel="stylesheet">
<link rel="stylesheet" href="site.css">
</head>
<body class="no-js" data-page="{page}">
'''


def header(page):
    cur = ' aria-current="page"'
    links = ''.join(f'<a href="{p}.html"{cur if p == page else ""}>{t}</a>' for p, t in PAGES)
    return f'''<header class="top" id="top">
  <a class="mark" href="index.html" aria-label="Nails by Elisheva, home"><img src="assets/logo.webp" alt="" width="240" height="287"><span>Nails by Elisheva</span></a>
  <nav class="nav" id="nav" aria-label="Nails by Elisheva">{links}</nav>
  <div class="top-r">
    <a class="btn-line" href="book.html">Book</a>
    <button class="menu-btn" id="menu-btn" type="button" aria-expanded="false" aria-controls="nav">Menu</button>
  </div>
</header>
<main>
'''


FOOT_LINKS = ' · '.join(f'<a href="{p}.html">{t}</a>' for p, t in PAGES)
FOOTER = f'''  <section class="close" aria-label="Book with Elisheva">
    <div class="wrap">
      <div>
        <h2>Book your nails</h2>
        <p>WhatsApp or call <a href="https://wa.me/{WA}" target="_blank" rel="noopener">+44 7871 822590</a><br>Text <a href="sms:+972533484521">+972 53 348 4521</a></p>
      </div>
      <a class="btn" href="book.html">Book a time <span class="arw" aria-hidden="true">→</span></a>
    </div>
    <p class="giant" aria-hidden="true">Nails by Elisheva</p>
  </section>
</main>
<footer class="foot"><nav aria-label="Pages">{FOOT_LINKS}</nav>Luxe Nail Studio, Romema, Jerusalem · on <a href="/">MyIsraelRental</a>, free to list, no commission</footer>

<div class="bar" id="bar" aria-hidden="true">
  <p class="p"><b>Gel nails ₪90</b>Romema, Jerusalem</p>
  <a class="btn" href="book.html" tabindex="-1">Book</a>
</div>
<script src="site.js"></script>
'''

chips = ''.join(f'<button class="shade" type="button" data-k="{k}" style="--c:{c}" aria-pressed="{"true" if i == 0 else "false"}" aria-label="{n}"></button>' for i, (k, n, c, f, a) in enumerate(SHADES))
HERO = f'''  <section class="hero" id="open" aria-labelledby="h-open">
    <div class="tint" aria-hidden="true"></div>
    <p class="ghost" aria-hidden="true">Elisheva</p>
    <div class="wrap">
      <div class="h-text">
        <p class="caps">Luxe Nail Studio · Romema, Jerusalem</p>
        <h1 id="h-open">Gel nails, French nails and nail art<span class="script">by Elisheva</span></h1>
        <p class="lede">More than four years of experience. Gel from ₪90, in about 45 minutes.</p>
      </div>
      <div class="h-pick">
        <div class="shades">
          <p class="caps">Tap a shade</p>
          <div class="chips" id="chips">{chips}</div>
          <p class="shade-name" id="shade-name" aria-live="polite">{SHADES[0][1]}</p>
        </div>
        <div class="act">
          <a class="btn" href="book.html" id="book-shade">Book this shade <span class="arw" aria-hidden="true">→</span></a>
          <p class="proof"><b>From ₪90</b><br>Sunday to Friday</p>
        </div>
      </div>
      <div class="frame" id="frame">
        <img class="cur" src="assets/{SHADES[0][3]}" alt="{SHADES[0][4]}" width="1000" height="1250" fetchpriority="high">
        <span class="tag">My work, on a client</span>
      </div>
    </div>
  </section>
'''
HERO_JS = '<script>\nvar SHADES = ' + json.dumps([{'k': k, 'n': n, 'f': f, 'a': a, 'c': c} for k, n, c, f, a in SHADES]) + ''';
// The opening: tap a shade and her photo of nails in that colour opens out
// from the chip as a circle. Untouched, it moves to the next shade every few
// seconds until the visitor chooses. Photos are hers; only the reveal moves.
(function () {
  var frame = document.getElementById('frame'), name = document.getElementById('shade-name'), book = document.getElementById('book-shade'), hero = document.getElementById('open');
  document.body.style.setProperty('--tint', SHADES[0].c); document.body.style.setProperty('--tmix', '52%'); document.body.style.setProperty('--sweep', /^#[ef]/i.test(SHADES[0].c) ? '' : SHADES[0].c);
  var chips = [].slice.call(document.querySelectorAll('#chips .shade')), at = 0, auto = true, timer = 0, seq = 0, lastDone = 0;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // every photo loaded and decoded up front, so a switch never waits or pops in half-drawn
  var ready = {}; SHADES.forEach(function (s) { var i = new Image(); i.src = 'assets/' + s.f; ready[s.f] = i.decode ? i.decode().catch(function () {}) : Promise.resolve(); });
  function show(i, from) {
    if (i === at) return;
    at = i; var me = ++seq;
    chips.forEach(function (c, j) { c.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
    name.textContent = SHADES[i].n;
    document.body.style.setProperty('--tint', SHADES[i].c); document.body.style.setProperty('--tmix', /^#[0-9a-c]/i.test(SHADES[i].c) ? '30%' : '52%');  /* a deep shade washes lighter, so small text stays readable */ document.body.style.setProperty('--sweep', /^#[ef]/i.test(SHADES[i].c) ? '' : SHADES[i].c);
    book.href = 'book.html?shade=' + SHADES[i].k;
    // one photo stays underneath (cur); each switch spreads a new photo over it. A tap during a switch
    // spreads over the one still spreading, never ignored and never a flash; when a spread ends the
    // photo underneath takes its picture (already decoded) and the spread layer goes.
    var cur = frame.querySelector('img.cur');
    var r = frame.getBoundingClientRect(), cx = 50, cy = 100;
    if (from) { var c = from.getBoundingClientRect(); cx = ((c.left + c.width / 2 - r.left) / r.width) * 100; cy = ((c.top + c.height / 2 - r.top) / r.height) * 100; }
    // start the spread on the photo's edge nearest the chip, so the whole reveal is seen, not its last instant
    cx = Math.max(0, Math.min(100, cx)); cy = Math.max(0, Math.min(100, cy));
    var img = document.createElement('img');
    img.className = 'next'; img.src = 'assets/' + SHADES[i].f; img.alt = ''; img.width = 1000; img.height = 1250; img.dataset.seq = me;
    img.style.setProperty('--cx', cx + '%'); img.style.setProperty('--cy', cy + '%');
    frame.insertBefore(img, frame.querySelector('.tag'));
    var done = function () {
      // the photo underneath becomes this one, so taking the layer away changes nothing on screen
      if (cur && me > lastDone) { lastDone = me; cur.src = img.src; cur.alt = SHADES[i].a; }
      requestAnimationFrame(function () { img.remove(); });
    };
    if (reduce) { if (cur) { cur.src = img.src; cur.alt = SHADES[i].a; } img.remove(); return; }
    ready[SHADES[i].f].then(function () { requestAnimationFrame(function () { requestAnimationFrame(function () { img.classList.add('on'); setTimeout(done, 1350); }); }); });
  }
  chips.forEach(function (c, i) { c.addEventListener('click', function () { auto = false; clearInterval(timer); show(i, c); }); });
  if (!reduce) timer = setInterval(function () { if (auto && !document.hidden) show((at + 1) % SHADES.length, chips[(at + 1) % SHADES.length]); }, 3200);
})();
</script>
'''

svc_rows = ''.join(f'''        <div class="svc-row rev"><div><h3>{n}</h3><p>{d}</p></div><div class="price"><span class="sym">₪</span>{p}<small>about {m} minutes</small></div><a class="btn-line" href="book.html?service={k}">Book</a></div>
''' for k, n, p, m, d in SERVICES)
SERVICES_SEC = f'''  <section class="sec" id="services" aria-labelledby="h-svc">
    <div class="wrap">
      <p class="caps rev">Services and prices</p>
      <h2 id="h-svc" class="rev">What I do</h2>
      <div class="svc">
{svc_rows}      </div>
    </div>
  </section>
'''
WORK = [('white.webp', 'White gel nails on a client, hands on a towel'), ('pink-2.webp', 'Pale pink gel nails on a client'),
        ('white-2.webp', 'White gel nails on a client'), ('bubblegum.webp', 'Bubblegum pink gel nails'), ('studio.webp', 'The studio: a gel lamp and a row of gel colours')]
work_figs = ''.join(f'<figure class="rev"><img src="assets/{f}" alt="{a}" width="1000" height="1250" loading="lazy"></figure>' for f, a in WORK)
WORK_SEC = f'''  <section class="sec work" id="work" aria-labelledby="h-work" data-mir-gallery data-max="12">
    <div class="wrap">
      <p class="caps rev">Recent work</p>
      <h2 id="h-work" class="rev">Nails done in the studio</h2>
      <div class="work-grid" data-mir-photos>{work_figs}</div>
      <template data-mir-photo><figure><img data-f="img" alt=""></figure></template>
    </div>
  </section>
'''
CLOSED = ' class="closed"'
hours_li = ''.join(f'<li{CLOSED if h == "Closed" else ""}><span>{d}</span><span>{h}</span></li>' for d, h in HOURS)
VISIT = f'''  <section class="sec" id="visit" aria-labelledby="h-visit">
    <div class="wrap">
      <h2 id="h-visit" class="rev">Where and when</h2>
      <div class="visit">
        <div class="card rev"><h3>Opening hours</h3><ul class="hours">{hours_li}</ul></div>
        <div class="card rev"><h3>The studio</h3><p>Romema, Jerusalem.</p><p>WhatsApp or call <a href="https://wa.me/{WA}" target="_blank" rel="noopener">+44 7871 822590</a></p><p>Text <a href="sms:+972533484521">+972 53 348 4521</a></p><a class="btn" href="book.html" style="margin-top:1rem;color:#fff">Book a time <span class="arw" aria-hidden="true">→</span></a></div>
      </div>
    </div>
  </section>
'''

DESC = 'Nails by Elisheva, Luxe Nail Studio in Romema, Jerusalem. Gel nails ₪90, gel with removal ₪110, nail art, French or gradient nails ₪110, gel removal ₪40. More than four years of experience.'


def write(name, title, desc, img, body, tail=''):
    html = head(name, title, desc, img) + header(name) + body + FOOTER + tail + '</body>\n</html>\n'
    open(f'{name}.html', 'w', encoding='utf8').write(html)


write('index', 'Nails by Elisheva · Gel nails and nail art in Romema, Jerusalem', DESC, 'milky.webp', HERO + SERVICES_SEC + WORK_SEC + VISIT, HERO_JS)

svc_opts = ''.join(f'<label class="opt"><input type="radio" name="svc" value="{k}"><span class="box"><span><b>{n}</b><br><small>about {m} minutes</small></span><span class="p"><span class="sym">₪</span>{p}</span></span></label>' for k, n, p, m, d in SERVICES)
shade_opts = ''.join(f'<button class="shade" type="button" data-k="{k}" style="--c:{c}" aria-pressed="false" aria-label="{n}"></button>' for k, n, c, f, a in SHADES)
# The booking page as a product page (Tzvi, 20 Oct 2026: "use the new product page rules for ... the
# nails one"; docs/inspo/product-pages-2026-10-20): her work big on a stage that takes the shade you
# pick, the service, price and time beside it with "+" facts, the saving shown where there is one,
# then the day, time and details on the same page.
stage_imgs = ''.join(f'<img class="{"on" if i == 0 else ""}" data-k="{k}" src="assets/{f}" alt="{a}" width="1000" height="1250"{" fetchpriority=\"high\"" if i == 0 else " loading=\"lazy\""}>' for i, (k, n, c, f, a) in enumerate(SHADES))
BOOK = f'''  <form id="form" novalidate>
  <section class="stage" id="pick" aria-labelledby="h-book">
    <div class="wrap st-grid">
      <div class="st-ph">{stage_imgs}<span class="st-cap" id="st-cap">Milky white, my work</span></div>
      <div class="st-info">
        <p class="caps">Book · Romema, Jerusalem</p>
        <h1 id="h-book"><span id="st-name">Book your nails</span></h1>
        <p class="st-facts">More than four years of experience · Sunday to Friday</p>
        <p class="st-price" id="st-price" hidden></p>
        <p class="st-save" id="st-save" hidden></p>
        <div class="card-in" id="w-svc"><p class="f">What would you like?</p><div class="opts" id="svcs">{svc_opts}</div><p class="err" id="e-svc"></p></div>
        <div class="card-in"><p class="f">Colour <span class="hint">(optional)</span></p><div class="chips small" id="bshades">{shade_opts}</div><p class="shade-name" id="bshade-name"></p></div>
      </div>
    </div>
  </section>
  <section class="sec" id="book" aria-label="Day, time and your details" style="padding-top:clamp(1.5rem,4vw,2.5rem)">
    <div class="wrap">
      <div class="form">
        <div>
          <div class="card">
            <h3>When</h3>
            <div id="w-day"><label class="f" for="day">Day</label><input class="fld" id="day" type="date"><p class="err" id="e-day"></p></div>
            <div id="w-time"><p class="f" id="time-l">Time</p><div class="times" id="times" role="radiogroup" aria-labelledby="time-l"><p class="hint">Choose a day first.</p></div><p class="err" id="e-time"></p></div>
          </div>
          <div class="card">
            <h3>Your details</h3>
            <div id="w-me"><label class="f" for="me">Your name</label><input class="fld" id="me" autocomplete="name" maxlength="80"><p class="err" id="e-me"></p></div>
            <div id="w-ph"><label class="f" for="ph">Your phone</label><input class="fld" id="ph" type="tel" autocomplete="tel" maxlength="30"><p class="err" id="e-ph"></p></div>
            <label class="f" for="note">Anything else</label><textarea class="fld" id="note" maxlength="400"></textarea>
          </div>
        </div>
        <aside class="card sum" aria-live="polite">
          <h3>Your booking</h3>
          <ul id="sum"><li><span>Nothing chosen yet</span></li></ul>
          <div class="total"><span>Total</span><span id="total">₪0</span></div>
          <button class="btn" id="send" type="submit"><span>Send on WhatsApp</span></button>
          <p class="note">Opens WhatsApp with your booking written out. The time is yours once I confirm it.</p>
        </aside>
      </div>
    </div>
  </section>
  </form>
'''
BOOK_JS = '<script>\nvar SERVICES = ' + json.dumps({k: {'n': n, 'p': p, 'm': m} for k, n, p, m, d in SERVICES}) + ';\nvar SHADES = ' + json.dumps({k: n for k, n, c, f, a in SHADES}) + ';\nvar SHADE_C = ' + json.dumps({k: c for k, n, c, f, a in SHADES}) + ';\n' + open('gen/book.js', encoding='utf8').read() + '</script>\n'
write('book', 'Book · Nails by Elisheva', 'Book gel nails, nail art or gel removal with Elisheva in Romema, Jerusalem. Sent on WhatsApp.', 'milky.webp', BOOK, BOOK_JS)

write('contact', 'Contact · Nails by Elisheva', 'WhatsApp or call +44 7871 822590, text +972 53 348 4521. Luxe Nail Studio, Romema, Jerusalem.', 'studio.webp', f'''  <header class="page-head"><div class="wrap">
    <h1>Say <span class="script">hello</span></h1>
    <p class="lede">Bookings and questions on WhatsApp, by phone or by email.</p>
  </div></header>
  <section class="sec" style="padding-top:clamp(2rem,5vw,3rem)" aria-label="How to reach me">
    <div class="wrap">
      <div class="contact-grid">
        <div class="card rev"><h3>WhatsApp or call</h3><p><a href="https://wa.me/{WA}" target="_blank" rel="noopener">+44 7871 822590</a></p><a class="btn" href="book.html">Book a time <span class="arw" aria-hidden="true">→</span></a></div>
        <div class="card rev"><h3>Text and email</h3><p>Text <a href="sms:+972533484521">+972 53 348 4521</a></p><p><a href="mailto:elishevaberlinger@gmail.com">elishevaberlinger@gmail.com</a></p></div>
        <div class="card rev"><h3>Where</h3><p>Luxe Nail Studio, Romema, Jerusalem.</p></div>
      </div>
    </div>
  </section>
''' + VISIT.replace('<h2 id="h-visit" class="rev">Where and when</h2>', '<h2 id="h-visit" class="rev">Opening hours</h2>'))
print('written')
