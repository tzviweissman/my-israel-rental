"""Noa Levi, Home Styling & Organizing. Run from this folder: python build.py
Writes ../index.html, ../book.html, ../contact.html, ../site.css, ../site.js."""
import os, re, sys
sys.path.insert(0, '../../../starter'); sys.path.insert(0, '../../starter')
import sitekit as kit

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
os.chdir(ROOT)

ARW = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4"/></svg>'
CHECK = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none"><path d="M3 8.5l3.2 3.2L13 4.8"/></svg>'
P = kit.price

# ---------- css and js ----------
css = open('../../starter/site.css', encoding='utf8').read()
cut = css.index('/* ── BELOW HERE')
head = css[:cut]
tokens = '''  --ground: #F7F2EC; --surface: #EFE9DF; --ink: #26301F; --soft: #556048; --accent: #34462B; --accent-ink: #FFFFFF; --line: #DDD6C8;
  --deep: #2B3626; --clay: #A5654A; --sage: #7E8C66;'''
head = re.sub(r'  --ground:.*?--line: #E5E5E5;', tokens, head, flags=re.S)
head = head.replace('--font-head: Georgia, serif; --font-body: system-ui, sans-serif;', "--font-head: 'Newsreader', 'Heebo', Georgia, serif; --font-body: 'Hanken Grotesk', 'Heebo', system-ui, sans-serif;")
head = head.replace('--r: 16px;', '--r: 10px;')
head = head.replace('html { scroll-behavior: smooth; }', 'html { scroll-behavior: smooth; overflow-x: clip; } body { overflow-x: clip; }')
own = open('gen/own.css', encoding='utf8').read()
open('site.css', 'w', encoding='utf8').write(head + css[cut:cut + 200].split('\n')[0] + '\n' * 0 + '\n' + own)

js = open('../../starter/site.js', encoding='utf8').read().replace('CHANGE-ME-basket-v1', 'noa-levi-v1')
open('site.js', 'w', encoding='utf8').write(js)

SITE = kit.Site(
    name='Noa Levi, Home Styling & Organizing', short='Noa Levi', slug='noa-levi-home-styling',
    pages=[('index', 'Home'), ('book', 'Book'), ('contact', 'Contact')],
    contacts=[kit.Contact('whatsapp', '+972 55 673 0875'), kit.Contact('email', 'noare2133@gmail.com')],
    fonts='family=Newsreader:opsz,wght@6..72,400;6..72,500&family=Hanken+Grotesk:wght@400;500;600;700&family=Heebo:wght@400;500;600;700',
    cta=('book.html', 'Book a session'), bar=('₪160 an hour', 'Jerusalem and Beit Shemesh'),
    place='Jerusalem and Beit Shemesh', close_title='A home you love, in order.',
    mark_html='<img src="assets/logo-mark.webp" alt="" width="46" height="38">', count=False,
    close_extra='Noa Levi')

# ---------- home ----------
OPENING = f'''  <section class="scene" id="scene" aria-label="Noa Levi, home styling and organizing">
    <div class="pin">
      <img class="hs-bg" data-crop-ok src="assets/ground.webp" alt="" width="1600" height="894" aria-hidden="true" fetchpriority="high">
      <div class="hs-copy">
        <h1><span class="l1">We organize your home.</span><span class="l2">You gain <span class="acc">peace of mind.</span></span></h1>
        <p class="sub">We sort, tidy and set up storage, so the result is easy to keep.</p>
        <div class="hs-actions"><a class="btn" href="book.html">Book a session</a></div>
      </div>
      <div class="hs-photo" data-clip-ok>
        <img src="assets/drawer-before.webp" alt="A clothes drawer packed with loose, crumpled clothes before the session" width="565" height="565" fetchpriority="high">
        <img class="hs-full" src="assets/drawer-after.webp" alt="" width="565" height="565" aria-hidden="true">
        <div class="hs-tiles" id="tiles" aria-hidden="true"></div>
        <p class="hs-chip" role="status"><span class="b">Before</span><span class="a">After</span></p>
      </div>
    </div>
  </section>
'''

SERVICES = [('closet', 'Closet organizing'), ('home', 'Home organizing'), ('styling', 'Home styling'), ('shopping', 'Personal shopping')]
svc_rows = ''.join(f'<li><a href="book.html?svc={k}">{n}<small>Book {ARW}</small></a></li>' for k, n in SERVICES)
BAND = f'''  <section class="band sec" id="what" aria-labelledby="h-what">
    <div class="wrap sec-in">
      <div>
        <p class="caps">How we work</p>
        <h2 id="h-what" class="hd rev">Practical, tidy and easy to use</h2>
        <div class="words rev">
          <p>When we come in to sort and organize, it is very important to us to focus on practicality and make sure the result is clean, tidy and easy to use.</p>
          <p>During the session itself, we bring along storage solutions and boxes tailored to your needs, ones that will help maintain the order over time.</p>
        </div>
        <ol class="steps3 rev"><li><i>01</i><b>Sort</b><span>Everything out, what stays and what goes.</span></li><li><i>02</i><b>Tidy</b><span>Clean and in order.</span></li><li><i>03</i><b>Set up storage</b><span>Boxes tailored to you, so it is easy to keep.</span></li></ol>
      </div>
      <div class="rev">
        <p class="caps">What we do</p>
        <ul class="svc-list">{svc_rows}</ul>
      </div>
    </div>
  </section>
'''

TILES = '''  <section class="sec tiles" id="rooms" aria-labelledby="h-rooms">
    <div class="wrap">
      <p class="caps">Rooms we sort</p>
      <h2 id="h-rooms" class="hd rev">Real rooms, sorted.</h2>
      <ul class="tile-row rev">
        <li class="t1"><a href="#work"><span class="t-n">01</span><img src="assets/pantry-after.webp" alt="A kitchen cupboard shelf with labelled jars in rows" width="1536" height="527" loading="lazy" style="object-position:70% 50%"><b>Kitchen cupboard</b><small>Loose bags into labelled jars</small></a></li>
        <li class="t2"><a href="#work"><span class="t-n">02</span><img src="assets/linen-after.webp" alt="A linen cupboard with towels and sheets folded in neat stacks" width="565" height="565" loading="lazy"><b>Linen cupboard</b><small>Towels and sheets in neat stacks</small></a></li>
        <li class="t3"><a href="#work"><span class="t-n">03</span><img src="assets/drawer-after.webp" alt="A clothes drawer with clothes rolled in separate compartments" width="565" height="565" loading="lazy"><b>Clothes drawer</b><small>Clothes rolled into compartments</small></a></li>
      </ul>
    </div>
  </section>
'''

ROOMS = [('pantry', 'Kitchen cupboard'), ('linen', 'Linen cupboard'), ('drawer', 'Clothes drawer')]
ALT = {'pantry': ('A kitchen cupboard shelf with loose bags of food', 'The same shelf with labelled jars in rows'),
       'linen': ('A linen cupboard with towels and bedding stacked unevenly', 'The same cupboard with towels and sheets folded in neat stacks'),
       'drawer': ('A clothes drawer packed with loose clothes', 'The same drawer with clothes rolled in separate compartments')}
rooms_btn = ''.join(f'<button class="room" type="button" data-room="{k}" aria-pressed="{"true" if i == 0 else "false"}">{n}</button>' for i, (k, n) in enumerate(ROOMS))
def img(k, which):
    return f'<img src="assets/{k}-{which}.webp" alt="{ALT[k][0 if which == "before" else 1]}" data-k="{k}" width="{1536 if k == "pantry" else 565}" height="{485 if k == "pantry" else 565}">'
def layer(k, i):
    return f'<div class="lay{" on" if i == 0 else ""}" data-k="{k}"><figure class="pn"><span class="chip">Before</span>{img(k, "before")}</figure><figure class="pn"><span class="chip">After</span>{img(k, "after")}</figure></div>'
layers = ''.join(layer(k, i) for i, (k, _) in enumerate(ROOMS))
WORK = f'''  <section class="sec work" id="work" aria-labelledby="h-work">
    <div class="wrap work-grid">
      <div>
        <p class="caps">Real before and after photos</p>
        <h2 id="h-work" class="hd rev">Before and after</h2>
        <div class="rooms rev" role="group" aria-label="Choose a room">{rooms_btn}</div>
      </div>
      <div class="rev">
        <div class="cmp" id="cmp" data-room="pantry">{layers}</div>
      </div>
    </div>
  </section>
'''

PRICING = f'''  <section class="pricing" id="price" aria-labelledby="h-price">
    <div class="wrap price-grid">
      <div class="rev"><h2 id="h-price" class="sr" style="position:absolute;left:-9999px">Price</h2><p class="tape"><b>{P(160)}</b><span>an hour</span></p></div>
      <ul class="facts rev">
        <li><b>Accessories not included</b>The hourly price is for the session.</li>
        <li><b>Jerusalem and Beit Shemesh</b>Where we work.</li>
        <li><b>09:00 to 23:00</b>Hours you can book.</li>
      </ul>
    </div>
  </section>
'''

OPENING_JS = '''<script>
(function () {
  var scene = document.getElementById('scene'), box = document.getElementById('tiles');
  if (!scene || !box) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var N = 4, tiles = [], seed = 7;
  function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  var photo = box.parentNode, chip = photo.querySelector('.hs-chip');
  for (var i = 0; i < N * N; i++) {
    var r = Math.floor(i / N), c = i % N, el = document.createElement('div');
    // her after photo has a blurred box (bottom right) that would show as grey smudges: no piece is cut from it, the whole picture fades in at the end
    if (c >= 1 && r >= 2) continue;
    el.className = 'tl'; el.style.left = c * 25 + '%'; el.style.top = r * 25 + '%';
    el.style.width = 'calc(25% + 1px)'; el.style.height = 'calc(25% + 1px)';
    el.style.backgroundPosition = (c * 100 / (N - 1)) + '% ' + (r * 100 / (N - 1)) + '%';
    box.appendChild(el);
    tiles.push({ el: el, sx: (rnd() - .5) * 2, sy: (rnd() - .5) * 2, rot: (rnd() - .5) * 34, d: rnd() * .35, c: c, r: r, x: 0, y: 0 });
  }
  var rect, S, intro = reduce ? 1 : 0, p = 0;
  function measure() { rect = box.getBoundingClientRect(); S = rect.width; tiles.forEach(function (t) {
    var w = S / N, ax = t.sx * S * .62, ay = t.sy * S * .62, left = rect.left + t.c * w, top = rect.top + t.r * w;
    // keep each scattered piece inside the window so nothing scrolls sideways
    // whole on the screen, tilted corners and the top bar included (R3h.20: pieces kept whole; 25 Oct 2026)
    var phone = innerWidth <= 800, m = S * .08, e = w * .2 + 8, bar = (document.querySelector('.top') || { offsetHeight: 64 }).offsetHeight;
    var minX = Math.max(-(left - e), -(left - (rect.left - m))), maxX = Math.min(innerWidth - e - (left + w), (rect.right + m) - (left + w));
    var minY = phone ? Math.max(-(top - bar - e), -(top - (rect.top - m))) : -(top - bar - e), maxY = phone ? Math.min(innerHeight - e - (top + w), (rect.bottom + m) - (top + w)) : innerHeight - e - (top + w);
    ax = Math.max(minX, Math.min(maxX, ax)); ay = Math.max(minY, Math.min(maxY, ay));
    // the Before label stays on the messy drawer: no piece starts on top of it
    var cr = chip.getBoundingClientRect(), pad = w * .2 + 10;
    function hit(x, y) { var L = left + x, T = top + y; return L + w + pad > cr.left && L - pad < cr.right && T + w + pad > cr.top && T - pad < cr.bottom; }
    if (hit(ax, ay)) {
      var tries = [[cr.right + pad - left, ay], [ax, cr.bottom + pad - top], [ax, cr.top - pad - w - top], [cr.left - pad - w - left, ay]];
      for (var k = 0; k < tries.length; k++) { var tx = tries[k][0], ty = tries[k][1]; if (tx >= minX && tx <= maxX && ty >= minY && ty <= maxY && !hit(tx, ty)) { ax = tx; ay = ty; break; } }
    }
    t.x = ax; t.y = ay; }); }
  function ease(x) { return 1 - Math.pow(1 - x, 3); }
  function draw() {
    var q = Math.min(1, p / .82);
    tiles.forEach(function (t) {
      var k = ease(Math.max(0, Math.min(1, (q - t.d) / .65))), k2 = 1 - k, fly = 1 + (1 - intro) * 2.4;
      t.el.style.transform = 'translate(' + (t.x * k2 * fly).toFixed(1) + 'px,' + (t.y * k2 * fly).toFixed(1) + 'px) rotate(' + (t.rot * k2).toFixed(2) + 'deg)';
      t.el.style.opacity = Math.min(1, intro * 1.4);
      t.el.style.setProperty('--lift', k2.toFixed(3));
    });
    photo.style.setProperty('--fill', Math.max(0, Math.min(1, (q - .65) / .35)).toFixed(3));
    box.style.visibility = q >= 1 ? 'hidden' : 'visible';
    scene.classList.toggle('is-done', p > .88);
  }
  function onScroll() {
    var top = scene.offsetTop, h = scene.offsetHeight - innerHeight;
    p = h > 0 ? Math.max(0, Math.min(1, (scrollY - top) / h)) : 1; draw();
  }
  measure();
  if (reduce) { p = 1; draw(); return; }
  draw();
  var t0 = performance.now();
  (function step(now) { intro = Math.min(1, (now - t0) / 1100); intro = 1 - Math.pow(1 - intro, 3); draw(); if (intro < 1) requestAnimationFrame(step); })(t0);
  addEventListener('scroll', function () { requestAnimationFrame(onScroll); }, { passive: true });
  addEventListener('resize', function () { measure(); onScroll(); });
  onScroll();

  // before and after: choose a room, both photos change
  var cmp = document.getElementById('cmp'), z = 2, cur = cmp.querySelector('.lay.on'), done = 0;
  [].forEach.call(cmp.querySelectorAll('img'), function (i) { if (i.decode) i.decode().catch(function () {}); });
  [].forEach.call(document.querySelectorAll('.room'), function (b) {
    b.addEventListener('click', function () {
      [].forEach.call(document.querySelectorAll('.room'), function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
      cmp.dataset.room = b.dataset.room;
      var target = cmp.querySelector('.lay[data-k="' + b.dataset.room + '"]');
      if (target === cur) return;
      // true crossfade: layers keep what they show; the new room fades in on top while the old stays fully visible underneath.
      // If the room asked for is still showing underneath (a quick second tap), the layer above it fades out instead.
      var lays = [].slice.call(cmp.querySelectorAll('.lay'));
      lays.forEach(function (l) { l.style.transition = 'none'; l.style.opacity = getComputedStyle(l).opacity; });
      var fade = +getComputedStyle(target).opacity > .99 ? cur : target;
      if (fade === target) { target.style.opacity = 0; }
      fade.style.zIndex = ++z; fade.classList.add('on'); target.classList.add('on'); void cmp.offsetWidth;
      fade.style.transition = ''; fade.style.opacity = fade === target ? 1 : 0; cur = target;
      clearTimeout(done); done = setTimeout(function () { if (cur !== target) return; lays.forEach(function (l) { if (l !== target) { l.style.transition = 'opacity 200ms ease-out'; l.style.opacity = 0; l.classList.remove('on'); } }); target.style.opacity = 1; }, 380);  // the old room fades out too: the new one's gaps and tilted corners showed it vanish in one frame
    });
  });
})();
</script>
'''

def pic(id_, src, w, h, alt, caps, h2, line, pos=''):
    return f'''  <section class="pic" id="{id_}" aria-labelledby="h-{id_}">
    <img src="{src}" alt="{alt}" width="{w}" height="{h}" loading="lazy" style="object-position:{pos or '50% 50%'}">
    <div class="wrap pic-in"><div>
      <p class="caps">{caps}</p>
      <h2 id="h-{id_}" class="hd rev">{h2}</h2>
      <p class="pic-line">{line}</p>
      <a class="btn" href="book.html">Book a session</a>
    </div></div>
  </section>
'''
PIC_A = pic('start', 'assets/pantry-before.webp', 1536, 485, 'A kitchen cupboard shelf with loose bags of food', 'Where we start', 'It starts here.', 'A kitchen cupboard, as we found it.', '100% 50%')
PIC_B = pic('after', 'assets/pantry-after.webp', 1536, 527, 'The same shelf with labelled jars in rows', 'Where we finish', 'And ends like this.', 'The same shelf, with boxes and jars that keep it tidy.', '100% 50%')

SITE.write('index', 'Noa Levi · Home styling and organizing in Jerusalem and Beit Shemesh',
           'Closet organizing, home organizing, home styling and personal shopping with Noa Levi in Jerusalem and Beit Shemesh. ₪160 an hour, accessories not included.',
           'og.webp', OPENING + TILES + BAND + WORK + PRICING + kit.gallery('From our sessions'), OPENING_JS)

# ---------- book ----------
svc_opts = ''.join(f'<label class="opt"><input type="radio" name="svc" value="{k}"><span class="box">{n}</span></label>' for k, n in SERVICES)
tray = '<i><b></b></i>' * 8
rolls = ''.join(f'<span>{i}</span>' for i in range(1, 9))
BOOK = f'''  <form id="form" novalidate>
  <section class="stage" id="pick" aria-labelledby="h-book">
    <div class="wrap st-grid">
      <div class="st-ph" id="stph" aria-label="Our work, before and after">
        <figure><p class="chip">Before</p><img class="on" data-k="drawer" src="assets/drawer-before.webp" alt="A clothes drawer packed with loose clothes" width="565" height="565"><img data-k="linen" src="assets/linen-before.webp" alt="A linen cupboard with towels and bedding stacked unevenly" width="560" height="630" loading="lazy"></figure>
        <figure><p class="chip">After</p><img class="on" data-k="drawer" src="assets/drawer-after.webp" alt="The same drawer with clothes rolled in separate compartments" width="565" height="565"><img data-k="linen" src="assets/linen-after.webp" alt="The same cupboard with towels and sheets folded in neat stacks" width="640" height="950" loading="lazy"></figure>
        <p class="st-cap" id="st-cap">Our work: a clothes drawer</p>
      </div>
      <div class="st-info">
        <ol class="osteps" aria-label="Booking steps"><li class="is-now" aria-current="step"><button type="button" data-go="1">Step 1: Your session</button></li><li><button type="button" data-go="2">Step 2: Day and time</button></li><li><button type="button" data-go="3">Step 3: Your details</button></li></ol>
        <h1 id="h-book">Book a session</h1>
        <p class="st-pr"><b>{P(160)}</b> an hour, accessories not included</p>
        <div id="w-svc"><p class="f" id="svc-l">What would you like?</p><div class="opts" id="svcs" role="radiogroup" aria-labelledby="svc-l">{svc_opts}</div><p class="err" id="e-svc"></p></div>
        <p class="f" id="hrs-l">How many hours?</p>
        <div class="hrs">
          <div class="stepper" role="group" aria-labelledby="hrs-l"><button type="button" id="h-dn" aria-label="One hour less">&minus;</button><div class="rollwin" aria-live="polite" aria-label="Hours"><div class="roll" id="roll">{rolls}</div></div><button type="button" id="h-up" aria-label="One hour more">+</button></div>
          <div class="tray" id="tray" aria-hidden="true">{tray}</div>
        </div>
        <div class="st-end"><button class="btn st-next" type="submit"><span id="next1">Continue to day and time</span></button></div>
      </div>
    </div>
  </section>
  <section class="sec after" id="book" aria-label="Day, time and your details" hidden>
    <div class="wrap">
      <ol class="osteps" aria-label="Booking steps"><li class="is-done"><button type="button" data-go="1">Step 1: Your session</button></li><li class="is-now" aria-current="step"><button type="button" data-go="2">Step 2: Day and time</button></li><li><button type="button" data-go="3">Step 3: Your details</button></li></ol>
      <div class="form">
        <div>
          <div class="card ostep" data-s="2">
            <h2>Day and time</h2>
            <p class="f" id="city-l">Where</p>
            <div class="opts" id="cities" role="radiogroup" aria-labelledby="city-l"><label class="opt"><input type="radio" name="city" value="Jerusalem"><span class="box">Jerusalem</span></label><label class="opt"><input type="radio" name="city" value="Beit Shemesh"><span class="box">Beit Shemesh</span></label></div><p class="err" id="e-city"></p>
            <div id="w-day"><label class="f" for="day" style="display:block;font-weight:600;font-size:.95rem;margin:.9rem 0 .35rem">Day</label><input class="fld" id="day" type="date"><p class="err" id="e-day"></p></div>
            <div id="w-time"><p class="f" id="time-l">Start time</p><div class="times" id="times" role="radiogroup" aria-labelledby="time-l"><p class="hint">Choose a day first.</p></div><p class="err" id="e-time"></p></div>
          </div>
          <div class="card ostep" data-s="3" hidden>
            <h2>Your details</h2>
            <div id="w-me"><label class="f" for="me" style="display:block;font-weight:600;font-size:.95rem;margin:.9rem 0 .35rem">Your name</label><input class="fld" id="me" autocomplete="name" maxlength="80"><p class="err" id="e-me"></p></div>
            <div id="w-ph"><label class="f" for="ph" style="display:block;font-weight:600;font-size:.95rem;margin:.9rem 0 .35rem">Your phone</label><input class="fld" id="ph" type="tel" autocomplete="tel" maxlength="30"><p class="err" id="e-ph"></p></div>
            <label class="f" for="note" style="display:block;font-weight:600;font-size:.95rem;margin:.9rem 0 .35rem">What needs organizing? (optional)</label><textarea class="fld" id="note" rows="1" maxlength="400"></textarea>
          </div>
        </div>
        <aside class="card sum" aria-live="polite">
          <h3 id="sum-h">Your session</h3>
          <ul id="sum"><li><span>Nothing chosen yet</span></li></ul>
          <div class="total"><span>Total</span><span id="total">₪0</span></div>
          <p class="assure">Nothing to pay on this page. We confirm your time on WhatsApp.</p>
          <div class="toast" id="toast" role="status" aria-live="polite" hidden>{CHECK}<p><b>Session written out</b>Press send in WhatsApp and we will confirm your time.</p></div>
          <button class="btn" id="send" type="submit" style="width:100%"><span id="send-l">Continue to your details</span></button>
          <button class="back" id="back" type="button">Back</button>
          <p class="note" id="send-note">Next: your name and phone.</p>
        </aside>
      </div>
    </div>
  </section>
  </form>
'''

BOOK_JS = r'''<script>
(function () {
  var WA = '972556730875', RATE = 160, MAXH = 8;
  var API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:8001/api' : '/api', GIG = '5885df8d-7bd6-43d9-af01-273ec2108a0b';
  var SERVICES = { closet: 'Closet organizing', home: 'Home organizing', styling: 'Home styling', shopping: 'Personal shopping' };
  var STAGE = { closet: 'drawer', home: 'linen', styling: null, shopping: null };
  var CAP = { drawer: "Our work: a clothes drawer", linen: "Our work: a linen cupboard" };
  var qs = new URLSearchParams(location.search), svc = SERVICES[qs.get('svc')] ? qs.get('svc') : '', hrs = 2, time = '', step = 1, phase = '';
  if (qs.toString()) history.replaceState(null, '', location.pathname);
  var $ = function (id) { return document.getElementById(id); };
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  var today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  $('day').min = today;
  function nice(d) { return new Date(d + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); }
  function v(id) { return ($(id).value || '').trim(); }
  function city() { var c = document.querySelector('input[name=city]:checked'); return c ? c.value : ''; }
  function hrLabel() { return hrs + (hrs === 1 ? ' hour' : ' hours'); }

  // the stage shows her work for the chosen service
  function drawStage() {
    if (!svc) return;
    // styling and shopping have no photos of their own: the drawer stays, and says it is our organizing work
    var k = STAGE[svc] || 'drawer';
    [].forEach.call(document.querySelectorAll('#stph img'), function (i) { i.classList.toggle('on', i.dataset.k === k); });
    $('st-cap').textContent = STAGE[svc] ? CAP[k] : 'Our organizing work: a clothes drawer';
  }
  // the hours: the digit rolls and the tray fills one compartment per hour
  function drawHours() {
    $('roll').style.transform = 'translateY(' + (-(hrs - 1) * 52) + 'px)'; [].forEach.call($('roll').children, function (s, i) { s.classList.toggle('on', i === hrs - 1); });
    [].forEach.call($('tray').children, function (c, i) { setTimeout(function () { c.classList.toggle('on', i < hrs); }, Math.abs(i - hrs) * 30); });
    $('h-dn').disabled = hrs <= 1; $('h-up').disabled = hrs >= MAXH;
    $('next1').textContent = 'Continue to day and time, ₪' + (RATE * hrs);
  }
  $('h-dn').addEventListener('click', function () { if (hrs > 1) { hrs--; time = ''; drawHours(); drawTimes(); update(); } });
  $('h-up').addEventListener('click', function () { if (hrs < MAXH) { hrs++; time = ''; drawHours(); drawTimes(); update(); } });
  [].forEach.call(document.querySelectorAll('#svcs input'), function (i) {
    i.checked = i.value === svc;
    i.addEventListener('change', function () { svc = i.value; drawStage(); update(); check(false); });
  });
  [].forEach.call(document.querySelectorAll('#cities input'), function (i) { i.addEventListener('change', function () { update(); check(false); }); });

  // start times in her hours, 09:00 to 23:00, so the session ends by 23:00
  function drawTimes() {
    var box = $('times'), d = $('day').value;
    if (!d) { box.innerHTML = '<p class="hint">Choose a day first.</p>'; return; }
    var out = [], len = hrs * 60;
    for (var m = 540; m + len <= 1380; m += 30) {
      if (d === today) { var now = new Date(); if (m <= now.getHours() * 60 + now.getMinutes() + 60) continue; }
      out.push(m);
    }
    if (!out.length) { box.innerHTML = '<p class="hint">No start times left that day. Choose another day.</p>'; time = ''; return; }
    if (out.map(hhmm).indexOf(time) < 0) time = '';
    box.innerHTML = out.map(function (m) { var t = hhmm(m); return '<label class="opt"><input type="radio" name="time" value="' + t + '"' + (t === time ? ' checked' : '') + '><span class="box">' + t + '</span></label>'; }).join('');
    [].forEach.call(box.querySelectorAll('input'), function (i) { i.addEventListener('change', function () { time = i.value; update(); check(false); }); });
  }
  $('day').addEventListener('change', function () { drawTimes(); update(); check(false); });

  function endOf(t) { var p = t.split(':'); return hhmm(+p[0] * 60 + +p[1] + hrs * 60); }
  function chg(n, what) { return step > n ? ' <button type="button" class="chg" data-go="' + n + '" aria-label="Change ' + what + '">Change</button>' : ''; }
  function update() {
    var rows = [], total = RATE * hrs;
    if (svc) rows.push('<li><span>' + SERVICES[svc] + chg(1, 'service') + '</span><span></span></li>');
    rows.push('<li><span>' + hrLabel() + ' at ₪' + RATE + chg(1, 'hours') + '</span><span>₪' + total + '</span></li>');
    if (city()) rows.push('<li><span>' + city() + chg(2, 'place') + '</span><span></span></li>');
    if (v('day') && time) rows.push('<li><span>' + nice(v('day')) + ', ' + time + ' to ' + endOf(time) + chg(2, 'day and time') + '</span><span></span></li>');
    $('sum').innerHTML = rows.join('');
    $('total').textContent = '₪' + total;
    if (step === 1) $('next1').textContent = 'Continue to day and time, ₪' + total;
    else if (step === 2) $('send-l').textContent = 'Continue to your details';
    else $('send-l').textContent = 'Send on WhatsApp, ₪' + total;
  }
  function mark(id, msg) { var w = $('w-' + id); if (w) w.classList.toggle('bad', !!msg); $('e-' + id).textContent = msg || ''; }
  function check(show, upto) {
    var ok = true, e; upto = upto || 3;
    e = svc ? '' : 'Choose what you would like'; if (e) ok = false; if (show || !e) mark('svc', e);
    if (upto < 2) return ok;
    e = city() ? '' : 'Choose where'; if (e) ok = false; if (show || !e) mark('city', e);
    e = v('day') ? '' : 'Choose a day'; if (e) ok = false; if (show || !e) mark('day', e);
    e = time ? '' : 'Choose a start time'; if (e) ok = false; if (show || !e) mark('time', e);
    if (upto < 3) return ok;
    e = v('me') ? '' : 'Your name, please'; if (e) ok = false; if (show || !e) mark('me', e);
    e = /\d{9,}/.test(v('ph').replace(/\D/g, '')) ? '' : 'A phone number we can reach you on'; if (e) ok = false; if (show || !e) mark('ph', e);
    return ok;
  }
  ['me', 'ph'].forEach(function (id) { $(id).addEventListener('input', function () { check(false); update(); }); });
  var note = $('note');
  note.addEventListener('input', function () { note.style.height = 'auto'; note.style.height = Math.min(note.scrollHeight + 3, 115) + 'px'; });
  var toastT = 0;
  function toast() { var t = $('toast'); clearTimeout(toastT); t.hidden = false; requestAnimationFrame(function () { requestAnimationFrame(function () { t.classList.add('in'); }); }); toastT = setTimeout(function () { t.classList.remove('in'); setTimeout(function () { t.hidden = true; }, 220); }, 2600); }
  function setSend() { var b = $('send'); b.disabled = phase === 'open'; b.setAttribute('aria-busy', phase === 'open' ? 'true' : 'false'); }

  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (phase) return;
    if (step < 3) { if (!check(true, step)) { var bad1 = document.querySelector('.bad .fld, .bad input'); if (bad1) bad1.focus(); return; } go(step + 1, true); return; }
    if (!check(true)) { for (var s1 = 1; s1 <= 3; s1++) if (!check(false, s1)) { check(true, s1); go(s1, true); break; } var bad = document.querySelector('.bad .fld, .bad input'); if (bad) bad.focus(); return; }
    var total = RATE * hrs, lines = ['Hi Noa, I would like to book:', '• ' + SERVICES[svc] + ', ' + hrLabel() + ' at ₪' + RATE + ' an hour', 'Where: ' + city(), 'When: ' + nice(v('day')) + ', ' + time + ' to ' + endOf(time)];
    if (v('note')) lines.push('To organize: ' + v('note'));
    lines.push('Total: ₪' + total + ' (accessories not included)', 'Name: ' + v('me') + ', ' + v('ph'));
    var text = lines.join('\n'), msg = lines.slice(1, -1).join('; ');
    phase = 'open'; setSend();
    // saved on MyIsraelRental first (page rules 3k); the WhatsApp tab opens first so the pop-up blocker allows it
    var tab = window.open('', '_blank');
    var post = fetch(API + '/marketplace/gigs/' + GIG + '/book', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tier_name: SERVICES[svc], preferred_date: v('day'), time_slot: time, guest_name: v('me'), contact_phone: v('ph'), message: msg, lang: 'en' }) })
      .then(function (r) { return r.ok ? r.json() : r.text().then(function (t) { console.warn('booking not saved', r.status, t); return null; }); })
      .catch(function (err) { console.warn('booking not saved', err); return null; });
    Promise.race([post, new Promise(function (res) { setTimeout(function () { res(null); }, 5000); })]).then(function (saved) {
      if (saved && saved.track_path) text += '\n\nFollow the booking: https://myisraelrental.com' + saved.track_path;
      var url = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text);
      if (tab) tab.location.href = url; else location.href = url;
    });
    toast();
    setTimeout(function () { phase = ''; setSend(); }, 1400);
  });

  var pick = $('pick'), book = $('book');
  function drawStep() {
    pick.hidden = step !== 1; book.hidden = step === 1;
    [].forEach.call(document.querySelectorAll('.ostep'), function (el) { el.hidden = +el.dataset.s !== step; });
    [].forEach.call(document.querySelectorAll('.osteps'), function (ol) { [].forEach.call(ol.children, function (li, i) { li.className = i + 1 < step ? 'is-done' : i + 1 === step ? 'is-now' : ''; if (i + 1 === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); }); });
    $('send-note').textContent = step === 2 ? 'Next: your name and phone.' : 'Opens WhatsApp with your session written out.';
    update();
  }
  function go(n, push) {
    if (n > 1 && !check(false, 1)) n = 1; if (n > 2 && !check(false, 2)) n = 2;
    step = n; drawStep();
    if (push) { history.pushState({ step: n }, '', n === 1 ? '#pick' : '#book-' + n); scrollTo({ top: 0, behavior: 'auto' }); var f = n === 1 ? document.querySelector('#svcs input:checked') : document.querySelector('.ostep:not([hidden]) .fld, .ostep:not([hidden]) input'); if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 200); }
  }
  addEventListener('popstate', function () { var m = /#book-(\d)/.exec(location.hash); go(m ? +m[1] : 1, false); });
  $('back').addEventListener('click', function () { history.back(); });
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b && +b.dataset.go < step) go(+b.dataset.go, true); });
  drawHours(); drawStage(); drawTimes(); update();
  var m0 = /#book-(\d)/.exec(location.hash); if (m0) go(+m0[1], false);
})();
</script>
'''
SITE.write('book', 'Book a session · Noa Levi, home styling and organizing',
           'Choose closet organizing, home organizing, home styling or personal shopping, how many hours, then a day and time. ₪160 an hour with Noa Levi.',
           'og.webp', BOOK, BOOK_JS)

# ---------- contact ----------
CONTACT = SITE.page_head('Say <span class="acc">hello</span>', 'Tell us what needs sorting, and when you would like us to come.') + f'''  <div class="wrap"><div class="contact-grid">
    <div class="card"><h2>Talk to us</h2><p>{SITE.contacts[0].html()}</p><p>{SITE.contacts[1].html()}</p></div>
    <div class="card"><h2>Where and when</h2><p>Jerusalem and Beit Shemesh</p><p>09:00 to 23:00</p></div>
    <div class="card"><h2>The price</h2><p>{P(160)} an hour, accessories not included.</p><p><a href="book.html">Book a session</a></p></div>
  </div></div>
''' + kit.faq('Your questions')
SITE.write('contact', 'Contact · Noa Levi, home styling and organizing',
           'WhatsApp or email Noa Levi about home styling and organizing in Jerusalem and Beit Shemesh.',
           'og.webp', CONTACT)
for pg in ('index','book','contact'):
    t=open(pg+'.html',encoding='utf8').read().replace('<span class="arw" aria-hidden="true">→</span>','<span class="arw" aria-hidden="true">'+ARW+'</span>')
    open(pg+'.html','w',encoding='utf8').write(t)
print('built')

# every page declares its category (rule 3t)
for _f in ('index.html', 'book.html', 'contact.html'):
    _h = open(_f, encoding='utf8').read()
    if 'site-category' not in _h:
        _h = _h.replace('<meta name="viewport"', '<meta name="site-category" content="service">\n<meta name="viewport"', 1)
        open(_f, 'w', encoding='utf8').write(_h)

# one footer with link columns on every page (rule 3t.4)
_FOOT = ('<footer class="foot foot-cols"><div class="fc"><b>Pages</b><a href="index.html">Home</a><a href="book.html">Book a session</a><a href="contact.html">Contact</a></div>'
         '<div class="fc"><b>Where</b><span>Jerusalem and Beit Shemesh</span><span>09:00 to 23:00</span></div>'
         '<div class="fc"><b>Contact</b><a href="https://wa.me/972556730875" target="_blank" rel="noopener">WhatsApp or call +972 55 673 0875</a><a href="mailto:noare2133@gmail.com">Email</a><span>Noa Levi, Home Styling &amp; Organizing &middot; on <a href="/">MyIsraelRental</a>, free to list, no commission</span></div></footer>')
for _f in ('index.html', 'book.html', 'contact.html'):
    _h = open(_f, encoding='utf8').read()
    _h = re.sub(r'<footer class="foot">.*?</footer>', lambda m: _FOOT, _h, count=1, flags=re.S)
    open(_f, 'w', encoding='utf8').write(_h)
