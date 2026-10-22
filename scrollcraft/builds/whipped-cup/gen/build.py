# Writes The Whipped Cup's four pages (Home, Menu, Order, Contact) with one
# menu bar and one footer (page rules 3k). Run from the build folder.
# Facts: her listing (description, the Try It Duo), her menu card
# (src/owner/gallery-1.jpg: flavours, prices, packages, "each jar makes 3-4
# coffees", "delivered fresh to your door every week", +1 929 993 6768), her
# email. Photos: her own two (src/owner).
PAGES = [('index', 'Home'), ('shop', 'Shop'), ('contact', 'Contact')]  # one shop page: menu and order together (rules 3k)
WA = '19299936768'
OG = 'assets/'  # relative: publish-page.mjs rewrites it to the business's own /pages/<slug>/assets/ (22 Oct review: a stale owner path was here)


def head(page, title, desc, img):
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="site-category" content="food-shop">
<meta name="description" content="{desc}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{OG}{img}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;800&family=Fraunces:ital,opsz,wght,SOFT@0,9..144,500..700,100;1,9..144,500,100&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700&family=Heebo:wght@400;500;700&display=swap&text=%E2%82%AA" rel="stylesheet">  <!-- only ₪, which the site's own fonts do not have (scripts/check-site.mjs GLYPH) -->
<link rel="stylesheet" href="site.css">
</head>
<body class="no-js" data-page="{page}">
'''


def header(page):
    cur = ' aria-current="page"'
    links = ''.join(f'<a href="{p}.html"{cur if p == page else ""}>{t}</a>' for p, t in PAGES)
    return f'''<header class="top" id="top">
  <a class="mark" href="index.html" aria-label="The Whipped Cup, home"><span class="badge" aria-hidden="true">TWC</span>The Whipped Cup</a>
  <nav class="nav" id="nav" aria-label="The Whipped Cup">{links}</nav>
  <div class="top-r">
    <a class="btn-line" href="shop.html#order">Basket<span class="count" id="count" hidden></span></a>
    <a class="btn top-order" href="shop.html">Order your jars</a>
    <button class="menu-btn" id="menu-btn" type="button" aria-expanded="false" aria-controls="nav">Menu</button>
  </div>
</header>
<main>
'''


FOOT_LINKS_COL = ''.join(f'<a href="{p}.html">{t}</a>' for p, t in PAGES)
FOOTER = f'''  <section class="close" aria-label="Order from The Whipped Cup">
    <div class="wrap">
      <div>
        <h2>Your cup, your cloud.</h2>
        <p>WhatsApp <a href="https://wa.me/{WA}" target="_blank" rel="noopener">+1 929 993 6768</a> · <a href="mailto:thewhippedcup@gmail.com">thewhippedcup@gmail.com</a></p>
      </div>
      <a class="btn" href="shop.html">Order your jars <span class="arw" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8h11M9 4l4 4-4 4"/></svg></span></a>
    </div>
    <p class="giant" aria-hidden="true">The Whipped Cup</p>
  </section>
</main>
<footer class="foot">
  <div class="foot-cols">
    <nav aria-label="Pages"><h3>Pages</h3>{FOOT_LINKS_COL}</nav>
    <div><h3>Contact</h3><a href="https://wa.me/{WA}" target="_blank" rel="noopener">WhatsApp +1 929 993 6768</a><a href="mailto:thewhippedcup@gmail.com">thewhippedcup@gmail.com</a></div>
    <div><h3>Where</h3><span>Ramat Eshkol, Jerusalem</span><span>Kosher certified</span><span>Delivered fresh to your door</span></div>
  </div>
  <p class="foot-legal">The Whipped Cup, on <a href="/">MyIsraelRental</a>, free to list, no commission</p>
</footer>

<div class="bar" id="bar" aria-hidden="true">
  <p class="p"><b>From ₪40 a jar</b>Each jar makes 3 to 4 coffees</p>
  <a class="btn" href="shop.html" tabindex="-1">Order your jars</a>
</div>
<script src="site.js"></script>
'''

# her photos of each flavour (her listing's product photos, 19 Oct 2026). Every thumbnail is ONE jar of
# that flavour, and each flavour has its own big photo, which shows when you point at or tap its row
# (Tzvi, 20 Oct 2026: Classic showed one jar and the others four; pointing at Caramel changed nothing).
# One master photo per flavour, all the same: one jar standing on coffee beans (her own photos; the
# caramel and vanilla jars lay on the beans, shot from above, so their photos are turned upright).
# The thumbnail is cut from the same master (rules 3o, one look per product).
FLAVS = [('classic', 'Classic Cloud', 'Original whipped coffee', 40, 'jar-classic.webp', '50% 50%', 'jar-classic.webp', 'A jar of Classic Cloud on coffee beans'),
         ('caramel', 'Caramel Cloud', 'Whipped coffee and caramel', 48, 'jar-caramel.webp', '50% 50%', 'jar-caramel.webp', 'A jar of Caramel Cloud on coffee beans'),
         ('vanilla', 'Vanilla Cloud', 'Whipped coffee and vanilla', 48, 'jar-vanilla.webp', '50% 50%', 'jar-vanilla.webp', 'A jar of Vanilla Cloud on coffee beans')]
FLAV_HTML = ''.join(f'''          <div class="flav rev{' on' if i == 0 else ''}" data-flav="{k}" tabindex="0" aria-label="{n}, show the photo"><img class="thumb" src="assets/{c}" alt="A jar of {n}" width="500" height="1111" loading="lazy"><h3>{n}</h3><div class="price">₪{p}<small>a jar</small></div><p>{d}</p><a class="btn-line add" href="shop.html?jar={k}" data-jar="{k}">Add</a></div>
''' for i, (k, n, d, p, c, pos, big, alt) in enumerate(FLAVS))
BIG_HTML = ''.join(f'''          <img class="big{' on' if i == 0 else ''}" data-flav="{k}" src="assets/{big}" alt="{alt}" width="500" height="1111" loading="lazy">
''' for i, (k, n, d, p, c, pos, big, alt) in enumerate(FLAVS))
FLAVOURS = f'''  <section class="sec" id="flavours" aria-labelledby="h-flav">
    <div class="wrap">
      <div class="flav-grid">
        <div class="photo rev">
{BIG_HTML}        </div>
        <div class="flav-side">
          <h2 id="h-flav" class="rev">Three <span class="pink">flavours</span> of whipped coffee</h2>
          <p class="lede rev">Handcrafted and fresh. Each jar makes 3 to 4 coffees.</p>
          <div class="flavs">
{FLAV_HTML}          </div>
        </div>
      </div>
    </div>
  </section>
'''
FLAV_JS = '''<script>
(function () {
  var rows = [].slice.call(document.querySelectorAll('.flav[data-flav]')), bigs = [].slice.call(document.querySelectorAll('.flav-grid .big'));
  function show(k) { rows.forEach(function (r) { r.classList.toggle('on', r.dataset.flav === k); }); bigs.forEach(function (b) { b.classList.toggle('on', b.dataset.flav === k); }); }
  rows.forEach(function (r) {
    r.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') show(r.dataset.flav); });
    r.addEventListener('focusin', function () { show(r.dataset.flav); });
    r.addEventListener('click', function (e) { if (!e.target.closest('a')) show(r.dataset.flav); });
  });
})();
</script>
'''

PACKS = [('bundle', 'Cloud Bundle', '6 jars · Monthly', 'Any 6 jars, mix and match', 220, True),
         ('assorted', 'Assorted', '4 jars · Weekly', 'A mix of all three flavours', 155, False),
         ('one', 'One Flavour', '4 jars · Weekly', 'One flavour, 4 jars', 148, False),
         ('duo', 'Try It Duo', '2 jars · Starter', '2 jars, any flavours', 75, False)]


def was(k):
    # the same jars bought one by one at the lowest single price (₪40), so the saving is always true.
    # Assorted shows none (22 Oct 2026): at ₪38.75 a jar it is dearer a jar than the Duo (₪37.50), and a
    # bigger option only shows a saving when it beats every smaller one.
    return {'duo': 2 * 40, 'one': 4 * 40, 'assorted': 0, 'bundle': 6 * 40}[k]


def pct(k, p):
    # percent off, rounded DOWN to a whole number (Tzvi, 22 Oct 2026)
    return (was(k) - p) * 100 // was(k)


def pack_html(k, n, meta, allows, p, lead):
    save = ''  # her menu says "save 30+ ₪", but six Classic jars are ₪240: asked her (message-to-rena.md)
    # one layout for all four (22 Oct review): the same square photo on the left, the name and what it allows
    # in the middle, the price and Choose in one column on the right; only the tab and the % badge differ
    own = {'bundle': ('iced.webp', 1170, 1213), 'assorted': ('trio-flowers.webp', 934, 1122),
           'one': ('jar-classic.webp', 500, 1111), 'duo': ('bottles.webp', 1023, 1537)}[k]  # her own photos, one in each tile
    pic = f'<img class="pic" src="assets/{own[0]}" alt="" width="{own[1]}" height="{own[2]}" loading="lazy">'
    tab = '<span class="tab">Best value</span>' if lead else ''
    w = was(k)
    badge = f'<span class="save-b">{pct(k, p)}% off</span>' if w else ''
    wasp = f'<s class="was" aria-label="instead of ₪{w}">₪{w}</s> ' if w else ''
    return f'''        <article class="pack has-pic{' best' if lead else ''} rev">{tab}{pic}<div><p class="meta">{meta}</p><h3>{n}</h3><span class="allows">{allows}</span>{badge}</div>
          <div class="row"><span class="price">{wasp}₪{p}{save}</span><a class="btn-line" href="shop.html?pack={k}" data-pack="{k}">Choose</a></div></article>
'''


PACKAGES = '''  <section class="sec packs" id="packages" aria-labelledby="h-packs">
    <div class="wrap">
      <div class="packs-head"><h2 id="h-packs" class="rev">Weekly packages</h2>
      <p class="lede rev">Delivered fresh to your door every week.</p></div>
      <div class="bento">
''' + ''.join(pack_html(*x) for x in PACKS) + '''      </div>
    </div>
  </section>
'''
KOSHER = '''  <div class="kosher"><div class="wrap"><span><b>Kosher certified</b></span><span>Handcrafted and fresh in Ramat Eshkol, Jerusalem</span></div></div>
'''
STEPS = '''  <section class="sec" aria-labelledby="h-how">
    <div class="wrap">
      <h2 id="h-how" class="rev">How do you <span class="pink">use it?</span></h2>
      <p class="lede rev">Instant coffee whipped into a thick, creamy cloud, ready in your fridge.</p>
      <ol class="steps">
        <li class="rev"><h3>Fill your glass with ice</h3></li>
        <li class="rev"><h3>Pour in cold milk</h3></li>
        <li class="rev"><h3>Add whipped coffee as desired</h3><p>Each jar makes 3 to 4 coffees.</p></li>
      </ol>
    </div>
  </section>
'''

HERO = f'''  <section class="hero" id="open" aria-labelledby="h-open">
    <div class="wrap">
      <div>
        <p class="kick">Ramat Eshkol · Jerusalem</p>
        <h1 id="h-open">Whipped coffee <span class="pink">in a jar</span>, made fresh in Jerusalem</h1>
        <p class="lede">Cloud-like Dalgona coffee, hand-whipped to order in small batches and delivered to your door.</p>
        <div class="act">
          <a class="btn" href="shop.html">Order your jars <span class="arw" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8h11M9 4l4 4-4 4"/></svg></span></a>
          <p class="proof"><b>From ₪40</b> a jar<br>Kosher certified</p>
        </div>
      </div>
      <div class="cloud" id="cloud">
        <svg viewBox="0 0 560 500" role="img" aria-label="An iced whipped coffee in the sun, in front of a row of The Whipped Cup jars">
          <defs><clipPath id="puffs">
            <circle cx="160" cy="300" r="118"/><circle cx="285" cy="215" r="150"/><circle cx="415" cy="285" r="122"/>
            <circle cx="225" cy="372" r="112"/><circle cx="355" cy="380" r="112"/><circle cx="478" cy="368" r="76"/><circle cx="88" cy="372" r="78"/>
          </clipPath></defs>
          <g id="shadow" fill="#F9DAE0" transform="translate(14 18)">
            <circle cx="160" cy="300" r="118"/><circle cx="285" cy="215" r="150"/><circle cx="415" cy="285" r="122"/>
            <circle cx="225" cy="372" r="112"/><circle cx="355" cy="380" r="112"/><circle cx="478" cy="368" r="76"/><circle cx="88" cy="372" r="78"/>
          </g>
          <image href="assets/iced.webp" x="-10" y="40" width="580" height="601" preserveAspectRatio="xMidYMid slice" clip-path="url(#puffs)"/>
        </svg>
        <span class="tag t1" data-m="1">Each jar makes 3 to 4 coffees</span>
        <span class="tag t2" data-m="-1.2">Your cup, your cloud</span>
      </div>
    </div>
  </section>
'''

HERO_JS = '''<script>
// The opening (an event, not a still): the cloud puffs into being one puff at
// a time, her photo inside it; then each puff breathes a little, leans with
// the mouse, and the cloud grows as the page scrolls. Her photo is never changed.
(function () {
  var puffs = [].slice.call(document.querySelectorAll('#puffs circle')), shadow = [].slice.call(document.querySelectorAll('#shadow circle'));
  var tags = [].slice.call(document.querySelectorAll('.cloud .tag')), cloud = document.getElementById('cloud');
  var base = puffs.map(function (c) { return { x: +c.getAttribute('cx'), y: +c.getAttribute('cy'), r: +c.getAttribute('r') }; });
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, t0 = performance.now(), mx = 0, my = 0, sx = 0, sy = 0;
  addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; } }, { passive: true });
  var back = function (t) { t = Math.min(1, Math.max(0, t)); var s = 1.6; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
  function frame(now) {
    var t = (now - t0) / 1000; sx += (mx - sx) * .06; sy += (my - sy) * .06;
    var p = Math.min(1, Math.max(0, scrollY / innerHeight));
    base.forEach(function (b, i) {
      var grow = reduce ? 1 : back((t - .15 - i * .11) / .7);
      var breathe = reduce ? 0 : Math.sin(t * 1.3 + i * 1.7) * 2.5;
      var r = Math.max(0, b.r * grow + breathe + p * 40);
      var x = b.x + sx * (i % 2 ? 10 : -8), y = b.y + sy * (i % 2 ? -6 : 8);
      puffs[i].setAttribute('r', r.toFixed(1)); puffs[i].setAttribute('cx', x.toFixed(1)); puffs[i].setAttribute('cy', y.toFixed(1));
      shadow[i].setAttribute('r', r.toFixed(1)); shadow[i].setAttribute('cx', x.toFixed(1)); shadow[i].setAttribute('cy', y.toFixed(1));
    });
    tags.forEach(function (g, i) {
      var k = reduce ? 1 : back((t - 1.1 - i * .15) / .5), m = +g.dataset.m;
      g.style.transform = 'translate(' + (-sx * 22 * m) + 'px,' + (-sy * 16 * m) + 'px) scale(' + k + ')';
    });
    if (!reduce || t < 2) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
</script>
'''

DESC = 'Handcrafted whipped coffee in a jar, made fresh in Ramat Eshkol, Jerusalem. Classic, Caramel and Vanilla Cloud from ₪40, weekly packages from ₪75. Kosher certified, delivered to your door.'


# the contact page already shows the contact cards, so its footer is only the page links (22 Oct review)
_c = FOOTER.index('<div><h3>Contact</h3>'); _e = FOOTER.index('  </div>' + chr(10) + '  <p class="foot-legal">')
FOOTER_LITE = FOOTER[:FOOTER.index('  <section class="close"')] + '</main>' + chr(10) + FOOTER[FOOTER.index('<footer class="foot">'):_c] + FOOTER[_e:]


def write(name, title, desc, img, body, tail=''):
    html = head(name, title, desc, img) + header(name) + body + (FOOTER_LITE if name == 'contact' else FOOTER) + tail + '</body>\n</html>\n'
    open(f'{name}.html', 'w', encoding='utf8').write(html)


ROOM = {'classic': '#E6D2BE', 'caramel': '#F0C48C', 'vanilla': '#F8DDE4'}  # one colour room per flavour, from the jar's own label and filling


def panel(k, n, d, p, img, alt):
    return f'''      <article class="room" data-flav="{k}" style="--rc:{ROOM[k]}"><div class="room-pic"><img src="assets/{img}" alt="{alt}" width="500" height="1111" loading="lazy"></div>
        <div class="room-cap"><h3>{n}</h3><p>{d}</p><div class="cap-r"><span class="price">&#8362;{p}<small>a jar</small></span><a class="btn-line add" href="shop.html?jar={k}" data-jar="{k}">Add</a></div></div></article>
'''
FPANELS = ''.join(panel(k, n, d, p, c, alt) for (k, n, d, p, c, pos, big, alt) in FLAVS)
BTN = '''<a class="btn" href="shop.html">Order your jars <span class="arw" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8h11M9 4l4 4-4 4"/></svg></span></a>'''
WORLD_FLAV = f'''  <section class="rooms" id="flavours" aria-labelledby="h-flav">
    <div class="wrap">
      <h2 id="h-flav" class="wtitle">Three flavours of whipped coffee</h2>
      <div class="room-row">
{FPANELS}      </div>
    </div>
  </section>
'''
WORLD_WINDOWS = f'''  <section class="story" id="fresh" aria-labelledby="h-fresh">
    <div class="wrap story-in">
      <div class="story-words">
        <h2 id="h-fresh">Made fresh in Ramat Eshkol</h2>
        <p>Handcrafted and fresh. Kosher certified.</p>
        {BTN}
      </div>
      <div class="story-pics"><img src="assets/caramel-window.webp" alt="Four jars of Caramel Cloud on a sunny window sill in Jerusalem" width="1160" height="1122" loading="lazy"><img src="assets/vanilla-window.webp" alt="Four jars of The Whipped Cup on a table by a window" width="986" height="1122" loading="lazy"></div>
    </div>
  </section>
'''
WORLD_CLOSE = f'''  <section class="door" id="door" aria-labelledby="h-door">
    <div class="wrap">
      <div class="door-top">
        <div class="story-pics"><img src="assets/bottles.webp" alt="Two jars of The Whipped Cup tied with ribbon on pink linen" width="1023" height="1537" loading="lazy"><img src="assets/trio-flowers.webp" alt="Jars of Vanilla Cloud and Classic Cloud among roses" width="934" height="1122" loading="lazy"></div>
        <div class="story-words">
          <h2 id="h-door">Delivered fresh to your door</h2>
          <p>Weekly packages from &#8362;75.</p>
          {BTN}
        </div>
      </div>
      <dl class="trust">
        <div><dt>Where</dt><dd>Ramat Eshkol, Jerusalem</dd></div>
        <div><dt>Delivery</dt><dd>Delivered fresh to your door every week</dd></div>
        <div><dt>Kosher</dt><dd>Certified</dd></div>
        <div><dt>Each jar</dt><dd>Makes 3 to 4 coffees</dd></div>
      </dl>
    </div>
  </section>
'''

import sys; sys.path.insert(0, 'gen'); import wow, cups
write('index', 'The Whipped Cup · Whipped coffee in a jar, Jerusalem', DESC, 'caramel-window.webp',
      wow.SKY + WORLD_FLAV + cups.CUPS + WORLD_WINDOWS + PACKAGES + WORLD_CLOSE, wow.SKY_JS + cups.CUPS_JS)

import shop
write('shop', 'Shop · The Whipped Cup', 'Classic Cloud ₪40, Caramel Cloud and Vanilla Cloud ₪48 a jar; weekly packages from ₪75. Order on WhatsApp from The Whipped Cup, Ramat Eshkol, Jerusalem.', 'jar-caramel.webp', shop.SHOP, shop.SHOP_JS)
for old in ('menu', 'order'):
    open(old + '.html', 'w', encoding='utf8').write(shop.REDIRECT)

write('contact', 'Contact · The Whipped Cup', 'WhatsApp +1 929 993 6768 or email thewhippedcup@gmail.com. Whipped coffee in a jar from Ramat Eshkol, Jerusalem.', 'bottles.webp',
      f'''  <header class="page-head"><div class="wrap">
    <h1>Say <span class="pink">hello</span></h1>
    <p class="lede">Orders and questions on WhatsApp or by email.</p>
  </div></header>
  <section class="sec" style="padding-top:clamp(2rem,5vw,3rem)" aria-label="How to reach us">
    <div class="wrap">
      <div class="contact-grid">
        <div class="card rev"><h3>WhatsApp</h3><p><a href="https://wa.me/{WA}" target="_blank" rel="noopener">+1 929 993 6768</a></p><p>The quickest way to order.</p><a class="btn" href="shop.html">Order your jars <span class="arw" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8h11M9 4l4 4-4 4"/></svg></span></a></div>
        <div class="card rev"><h3>Email</h3><p><a href="mailto:thewhippedcup@gmail.com">thewhippedcup@gmail.com</a></p></div>
        <div class="card rev"><h3>Where</h3><p>Ramat Eshkol, Jerusalem.</p><p>Delivered fresh to your door.</p><p>Kosher certified.</p></div>
      </div>
    </div>
  </section>
''')
print('written')
