"""Writes KasherMyBnb's other pages (Tzvi, 12 Oct 2026: a small website with
ordering pages like an online shop). One header and footer for all of them,
so they read as one site. Every fact and price is theirs: our record, their
listing (two services and their add-ons) and their flyer. Run from the build
folder: python gen/pages.py
"""
import os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARROW = '<span class="sw"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>'
OK = '<svg class="ok" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'


def btn(label, href, extra=''):
    return f'<a class="btn" href="{href}"{extra}><span class="lb">{label}</span><span class="ab" aria-hidden="true">{ARROW}</span></a>'


def page(name, title, desc, body, scripts='', order=False):
    menu = '' if order else '''
    <ul class="menu">
      <li><a href="index.html">Home</a></li>
      <li><a href="kitchen.html">Whole kitchen</a></li>
      <li><a href="pots.html">Pots and cutlery</a></li>
    </ul>'''
    cta = '' if order else btn('Book', 'book.html')
    foot = '' if order else f'''
<footer class="foot">
  <span>KasherMyBnb, kitchen kashering in Jerusalem and across Israel, since 2019</span>
  <nav><a href="index.html">Home</a><a href="kitchen.html">Whole kitchen</a><a href="pots.html">Pots and cutlery</a><a href="book.html">Book</a><a href="https://myisraelrental.com/businesses">Listed on MyIsraelRental</a></nav>
</footer>'''
    html = f'''<!doctype html>
<!-- KasherMyBnb, {name}. Written by gen/pages.py; facts from BRIEF.md only. -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="icon" href="assets/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="site.css">
</head>
<body>
<header class="bar">
  <a class="brand" href="index.html"><img src="assets/logo.png" alt="">KasherMyBnb</a>{menu}
  {cta}
</header>
{body}
{foot}
<script src="site.js"></script>
{scripts}
</body>
</html>
'''
    open(os.path.join(HERE, name), 'w', encoding='utf-8').write(html)


def icon(d):
    return f'<span class="ic"><svg viewBox="0 0 24 24">{d}</svg></span>'


I = {
    'oven': '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M7 6h.01M11 6h.01"/><rect x="7" y="12" width="10" height="6" rx="1"/>',
    'stove': '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><circle cx="8" cy="16" r="3"/><circle cx="16" cy="16" r="3"/>',
    'micro': '<rect x="2" y="5" width="20" height="14" rx="2"/><rect x="5" y="8" width="10" height="8" rx="1"/><path d="M18 9v.01M18 12v.01M18 15v.01"/>',
    'counter': '<path d="M2 10h20M4 10v10M20 10v10M8 14h8"/><path d="M6 6h12"/>',
    'sink': '<path d="M3 13h18v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z"/><path d="M12 13V5a2 2 0 0 1 4 0"/>',
    'plate': '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 17v2M17 17v2M8 12h8"/>',
    'pot': '<path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M2 10h20M9 6h6"/>',
    'fork': '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-2 2-2 6 0 8v10"/>',
    'ladle': '<path d="M14 3v10"/><path d="M9 13h10a5 5 0 0 1-10 0z"/>',
    'pan': '<circle cx="9" cy="13" r="6"/><path d="M15 13h7"/>',
    'x': '<path d="M6 6l12 12M18 6L6 18"/>',
}

# ------------------------------------------------------------------ kitchen
page('kitchen.html', 'Whole kitchen kashering · KasherMyBnb',
     'Kitchen kashering in Jerusalem and across Israel: oven, stovetop, microwave, countertops, sinks and hot plate, $350, about 2 hours. Expert mashgichim, cRc guidelines.',
     f'''
<main>
  <section class="hero">
    <div class="wrap grid">
      <div>
        <p class="eyebrow">Whole kitchen</p>
        <h1>Your kitchen, kashered <em>oven to sink.</em></h1>
        <p class="lede">We kasher your kitchen so you can settle in with confidence, knowing it is fully prepared, strictly kosher, and ready to use.</p>
        <div class="tag"><b>$350</b><span>about 2 hours, Jerusalem price</span></div>
        <div class="act">
          {btn('Book a kitchen', 'book.html?s=kitchen')}
          <a class="link" href="#included">See what is included</a>
        </div>
        <ul class="sure">
          <li>{OK}Done by expert mashgichim, cRc guidelines followed</li>
          <li>{OK}Since 2019, in Jerusalem and across Israel</li>
          <li>{OK}No payment on this site. We confirm the day with you first.</li>
        </ul>
      </div>
      <figure class="shot" style="margin:0">
        <img src="assets/kitchen.webp" width="1600" height="900" alt="A rental kitchen: oven, stovetop, sink and countertops">
        <span class="legend"><span class="pin"><i>{OK}</i>Oven and racks</span><span class="pin"><i>{OK}</i>Stovetop</span><span class="pin"><i>{OK}</i>Sinks and faucets</span></span>
      </figure>
    </div>
  </section>

  <section class="sec" id="included">
    <div class="wrap split">
      <div class="split-l">
        <p class="eyebrow">What we kasher</p>
        <h2>Six parts of the kitchen, one price.</h2>
        <p class="sub">Everything you cook and wash up on, done in one visit.</p>
        <div class="extras">
          <div class="extra"><div><b>Oven cleaning and kashering</b><small>Add it when you book.</small></div><span class="amt">+$40</span></div>
          <a class="extra" href="pots.html"><div><b>Pots, cutlery and utensils</b><small>Not part of the kitchen. See what we can kasher.</small></div><span class="amt">$180</span></a>
        </div>
      </div>
      <ul class="checks">
        <li><b>Oven</b><span>With its racks.</span></li>
        <li><b>Stovetop</b><span>Electric or gas.</span></li>
        <li><b>Microwave</b><span>As part of the kitchen.</span></li>
        <li><b>Countertops</b><span>Kashered, and covered.</span></li>
        <li><b>Sinks and faucets</b><span>Sinks with their faucets.</span></li>
        <li><b>Hot plate</b><span>As part of the kitchen.</span></li>
      </ul>
    </div>
  </section>

  <section class="sec">
    <div class="wrap">
      <p class="eyebrow">Good to know</p>
      <h2>Before you book</h2>
      <dl class="facts">
        <div><dt>Who it is for</dt><dd>Guests in Airbnb apartments and vacation rentals, homeowners moving into a new home, property managers, and anyone preparing for Pesach.</dd></div>
        <div><dt>Not included</dt><dd>Pots, pans and cutlery. We kasher pots and cutlery as a <a href="pots.html">separate service</a>.</dd></div>
        <div><dt>Where</dt><dd>Jerusalem and across Israel. Prices are for Jerusalem; elsewhere there may be a fee for the distance, which we tell you before the day.</dd></div>
        <div><dt>How it goes</dt><dd>Choose what you need and when. We confirm the day and time with you on WhatsApp, come, and kasher the kitchen.</dd></div>
        <div><dt>Language</dt><dd>English and Hebrew.</dd></div>
      </dl>
    </div>
  </section>

  <section class="sec">
    <div class="wrap">
      <div class="close">
        <div><h2>Your kitchen, ready to use.</h2><p>$350, about 2 hours. You choose a day; we confirm it with you on WhatsApp.</p></div>
        {btn('Book a kitchen', 'book.html?s=kitchen')}
      </div>
    </div>
  </section>
</main>''')

# --------------------------------------------------------------------- pots
page('pots.html', 'Pots, cutlery and utensils · KasherMyBnb',
     'Kashering pots (stainless steel), cutlery and kitchen utensils in Jerusalem and across Israel, $180, about 1 hour. A new frying pan on request, $15.',
     f'''
<main>
  <section class="hero">
    <div class="wrap grid">
      <div>
        <p class="eyebrow">Pots, cutlery and utensils</p>
        <h1>Your pots and cutlery, <em>kashered.</em></h1>
        <p class="lede">Bring your own pots, cutlery and kitchen utensils into a kosher kitchen. We kasher them in one visit, with the kitchen or on their own.</p>
        <div class="tag"><b>$180</b><span>about 1 hour, Jerusalem price</span></div>
        <div class="act">
          {btn('Book pots and cutlery', 'book.html?s=pots')}
          <a class="link" href="#can">What we can kasher</a>
        </div>
        <ul class="sure">
          <li>{OK}Done by expert mashgichim, cRc guidelines followed</li>
          <li>{OK}With the whole kitchen, or on its own</li>
          <li>{OK}No payment on this site. We confirm the day with you first.</li>
        </ul>
      </div>
      <figure class="shot" style="margin:0">
        <img src="assets/pots.webp" width="1200" height="1200" alt="Steel pots, cutlery and kitchen utensils">
      </figure>
    </div>
  </section>

  <section class="sec" id="can">
    <div class="wrap split">
      <div class="split-l">
        <p class="eyebrow">What we kasher</p>
        <h2>What we can kasher</h2>
        <div class="extras">
          <div class="extra"><div><b>A new frying pan</b><small>Provided on request. Add it when you book.</small></div><span class="amt">$15</span></div>
          <a class="extra" href="kitchen.html"><div><b>The whole kitchen</b><small>Oven, stovetop, microwave, countertops, sinks, hot plate.</small></div><span class="amt">$350</span></a>
        </div>
      </div>
      <div class="split-r">
        <ul class="checks">
          <li><b>Pots</b><span>Stainless steel pots.</span></li>
          <li><b>Cutlery</b><span>Knives, forks and spoons.</span></li>
          <li><b>Kitchen utensils</b><span>The tools you cook with.</span></li>
        </ul>
        <h3>What cannot be kashered</h3>
        <p class="sub">Some things cannot be made kosher this way. We tell you plainly, and offer what we can.</p>
        <ul class="checks is-no">
          <li><b>Pots of other materials</b><span>Only stainless steel pots can be kashered.</span></li>
          <li><b>Frying pans</b><span>Frying pans cannot be kashered.</span></li>
        </ul>
      </div>
    </div>
  </section>

  <section class="sec">
    <div class="wrap">
      <div class="close">
        <div><h2>Pots and cutlery, ready to use.</h2><p>$180, about 1 hour. Add the kitchen on the next step if you need it.</p></div>
        {btn('Book pots and cutlery', 'book.html?s=pots')}
      </div>
    </div>
  </section>
</main>''')

# ------------------------------------------------------------ the order pages
SUM = '''<aside class="sum" aria-label="Your order">
        <div class="who"><img src="assets/logo.png" alt=""><div><b>KasherMyBnb</b><small>Kitchen kashering since 2019</small></div></div>
        <ul class="lines" data-lines></ul>
        <div class="total"><span>Total</span><b data-total>$0</b></div>
        <p class="fine" data-fee hidden>Outside Jerusalem there may be a fee for the distance. We tell you before the day.</p>
        <ul class="promise">
          <li>''' + OK + '''Nothing to pay on this site</li>
          <li>''' + OK + '''We confirm the day with you on WhatsApp</li>
          <li>''' + OK + '''Expert mashgichim, cRc guidelines</li>
        </ul>
      </aside>'''


def steps(n):
    names = [('book.html', 'Choose'), ('book-details.html', 'When and where'), ('book-review.html', 'Review and send')]
    out = []
    for i, (href, label) in enumerate(names, 1):
        cls = 'is-done' if i < n else 'is-now' if i == n else ''
        inner = f'<a class="st" href="{href}">Step {i}: <span>{label}</span></a>' if i < n else f'<span class="st">Step {i}: <span>{label}</span></span>'
        out.append(f'<li class="{cls}"' + (' aria-current="step"' if i == n else '') + f'>{inner}</li>')
    return '<ol class="steps" aria-label="Booking steps">' + ''.join(out) + '</ol>'


def dock(label, href, id_, extra=''):
    return f'''<div class="dock"><div><small>Total</small><b data-total>$0</b></div>{btn(label, href, f' id="{id_}"' + extra)}</div>'''


page('book.html', 'Book · KasherMyBnb', 'Choose what we kasher: the whole kitchen, pots and cutlery, or both.', f'''
<main class="order">
  <div class="wrap">
    {steps(1)}
    <div class="cols">
      <section class="pane">
        <h1>What should we kasher?</h1>
        <p class="sub">Choose one or both. You can change anything before you send it.</p>
        <div class="q">
          <div class="pick">
            <button type="button" class="opt" data-svc="kitchen" aria-pressed="false">
              <span class="chk">{OK}</span>
              <span class="top"><b>Whole kitchen</b><span class="amt">$350</span></span>
              <small>About 2 hours</small>
              <ul><li>{OK}Oven with racks, stovetop</li><li>{OK}Microwave, hot plate</li><li>{OK}Countertops, sinks and faucets</li></ul>
            </button>
            <button type="button" class="opt" data-svc="pots" aria-pressed="false">
              <span class="chk">{OK}</span>
              <span class="top"><b>Pots, cutlery and utensils</b><span class="amt">$180</span></span>
              <small>About 1 hour</small>
              <ul><li>{OK}Stainless steel pots</li><li>{OK}Cutlery</li><li>{OK}Kitchen utensils</li></ul>
            </button>
          </div>
        </div>
        <div class="q" id="addons" hidden>
          <h2>Add to your order</h2>
          <div class="pick">
            <button type="button" class="opt row" data-add="oven" aria-pressed="false" hidden>
              <span class="chk">{OK}</span>
              <span><b>Oven cleaning and kashering</b><br><small>An extra cleaning of the oven.</small></span><span class="amt">+$40</span>
            </button>
            <button type="button" class="opt row" data-add="pan" aria-pressed="false">
              <span class="chk">{OK}</span>
              <span><b>A new frying pan</b><br><small>Frying pans cannot be kashered.</small></span><span class="amt">$15</span>
            </button>
          </div>
        </div>
        <div class="next">
          {btn('Continue', 'book-details.html', ' id="go"')}
          <span class="sub" id="why" style="margin:0">Choose what we kasher to continue.</span>
        </div>
      </section>
      {SUM}
    </div>
  </div>
</main>
{dock('Continue', 'book-details.html', 'go2')}''', '''<script>
(function () {
  var o = KMB.load();
  var s = new URLSearchParams(location.search).get('s');
  if (s === 'kitchen' || s === 'pots') { o[s] = true; KMB.save(o); }
  function paint() {
    document.querySelectorAll('[data-svc]').forEach(function (b) { b.setAttribute('aria-pressed', String(!!o[b.dataset.svc])); });
    var any = o.kitchen || o.pots;
    document.getElementById('addons').hidden = !any;
    document.querySelector('[data-add="oven"]').hidden = !o.kitchen;
    if (!o.kitchen) o.oven = false;
    document.querySelector('[data-add="oven"]').setAttribute('aria-pressed', String(!!o.oven));
    document.querySelector('[data-add="pan"]').setAttribute('aria-pressed', String(o.pans > 0));
    ['go', 'go2'].forEach(function (id) { document.getElementById(id).setAttribute('aria-disabled', String(!any)); });
    document.getElementById('why').hidden = any;
    KMB.save(o); KMB.paint(o);
  }
  document.querySelectorAll('[data-svc]').forEach(function (b) { b.addEventListener('click', function () { o[b.dataset.svc] = !o[b.dataset.svc]; paint(); }); });
  document.querySelector('[data-add="oven"]').addEventListener('click', function () { o.oven = !o.oven; paint(); });
  document.querySelector('[data-add="pan"]').addEventListener('click', function () { o.pans = o.pans > 0 ? 0 : 1; paint(); });
  paint();
})();
</script>''', order=True)

page('book-details.html', 'When and where · KasherMyBnb', 'When and where we kasher, and how we reach you.', f'''
<main class="order">
  <div class="wrap">
    {steps(2)}
    <div class="cols">
      <form class="pane" id="f" novalidate>
        <h1>When and where?</h1>
        <p class="sub">Tell us the day you would like. We confirm the day and time with you on WhatsApp.</p>
        <div class="q">
          <h2>Which day would suit you?</h2>
          <div class="two">
            <div class="field" id="f-date"><label for="date">Day</label><input id="date" type="date" required><span class="err" id="dateErr">Choose a day (not Shabbos).</span></div>
          </div>
        </div>
        <div class="q">
          <h2>What time of day?</h2>
          <div class="chips" role="group" aria-label="Time of day">
            <button type="button" class="chip" data-time="any" aria-pressed="false">Any time</button>
            <button type="button" class="chip" data-time="morning" aria-pressed="false">Morning</button>
            <button type="button" class="chip" data-time="afternoon" aria-pressed="false">Afternoon</button>
            <button type="button" class="chip" data-time="evening" aria-pressed="false">Evening</button>
          </div>
        </div>
        <div class="q">
          <h2>Where is the kitchen?</h2>
          <div class="chips" role="group" aria-label="Where">
            <button type="button" class="chip" data-place="jerusalem" aria-pressed="false">Jerusalem</button>
            <button type="button" class="chip" data-place="elsewhere" aria-pressed="false">Elsewhere in Israel</button>
          </div>
          <div class="note" id="feeNote" hidden><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg><span>Prices are for Jerusalem. Elsewhere there may be a fee for the distance; we tell you before the day.</span></div>
          <div class="two" style="margin-top:0.85rem">
            <div class="field" id="f-city" hidden><label for="city">Town or city</label><input id="city" autocomplete="address-level2"><span class="err">Which town or city?</span></div>
            <div class="field"><label for="address">Neighbourhood or street <span style="font-weight:400;color:var(--sc-ink-soft)">(optional)</span></label><input id="address" autocomplete="street-address"></div>
          </div>
          <span class="err" id="placeErr" style="color:var(--roof);font-size:.88rem" hidden>Choose where the kitchen is.</span>
        </div>
        <div class="q">
          <h2>How do we reach you?</h2>
          <div class="two">
            <div class="field" id="f-name"><label for="name">Your name</label><input id="name" autocomplete="name" required><span class="err">Add your name.</span></div>
            <div class="field" id="f-phone"><label for="phone">WhatsApp or phone</label><input id="phone" type="tel" autocomplete="tel" inputmode="tel" required><span class="err">Add a number we can reach you on.</span></div>
          </div>
        </div>
        <div class="q">
          <div class="field"><label for="notes">Anything we should know? <span style="font-weight:400;color:var(--sc-ink-soft)">(optional)</span></label><textarea id="notes" placeholder="For example: a gas stove, getting ready for Pesach, the day you arrive"></textarea></div>
        </div>
        <div class="next">
          {btn('Review your booking', 'book-review.html', ' id="go"')}
          <a class="back" href="book.html">Back</a>
        </div>
      </form>
      {SUM}
    </div>
  </div>
</main>
{dock('Review', 'book-review.html', 'go2')}''', '''<script>
(function () {
  var o = KMB.load();
  if (!o.kitchen && !o.pots) { location.replace('book.html'); return; }
  var $ = function (id) { return document.getElementById(id); };
  var d = new Date(); d.setDate(d.getDate() + 1);
  $('date').min = d.toISOString().slice(0, 10);
  ['date', 'city', 'address', 'name', 'phone', 'notes'].forEach(function (k) {
    $(k).value = o[k] || '';
    $(k).addEventListener('input', function () { o[k] = $(k).value.trim(); var f = $('f-' + k); if (f) f.classList.remove('is-bad'); KMB.save(o); KMB.paint(o); });
  });
  function paint() {
    document.querySelectorAll('[data-time]').forEach(function (b) { b.setAttribute('aria-pressed', String(o.time === b.dataset.time)); });
    document.querySelectorAll('[data-place]').forEach(function (b) { b.setAttribute('aria-pressed', String(o.place === b.dataset.place)); });
    $('f-city').hidden = o.place !== 'elsewhere';
    $('feeNote').hidden = o.place !== 'elsewhere';
    KMB.save(o); KMB.paint(o);
  }
  document.querySelectorAll('[data-time]').forEach(function (b) { b.addEventListener('click', function () { o.time = b.dataset.time; paint(); }); });
  document.querySelectorAll('[data-place]').forEach(function (b) { b.addEventListener('click', function () { o.place = b.dataset.place; $('placeErr').hidden = true; paint(); }); });
  function check(e) {
    var bad = [];
    // No Shabbos bookings: their calendar has no Saturday hours.
    if (!o.date || new Date(o.date + 'T12:00:00').getDay() === 6) bad.push('f-date');
    if (!o.name || o.name.length < 2) bad.push('f-name');
    if (!o.phone || o.phone.replace(/\\D/g, '').length < 7) bad.push('f-phone');
    if (o.place === 'elsewhere' && !o.city) bad.push('f-city');
    bad.forEach(function (id) { $(id).classList.add('is-bad'); });
    $('placeErr').hidden = !!o.place;
    if (bad.length || !o.place) {
      e.preventDefault();
      var first = bad.length ? $(bad[0]).querySelector('input') : document.querySelector('[data-place]');
      first.focus({ preventScroll: true }); first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }
  $('go').addEventListener('click', check); $('go2').addEventListener('click', check);
  paint();
})();
</script>''', order=True)

page('book-review.html', 'Review and send · KasherMyBnb', 'Check your booking and send it to KasherMyBnb on WhatsApp.', f'''
<main class="order">
  <div class="wrap">
    {steps(3)}
    <div class="cols">
      <section class="pane">
        <h1>Check and send</h1>
        <p class="sub">Your booking goes to KasherMyBnb on WhatsApp, written out. Press send there.</p>
        <dl class="facts" id="rev"></dl>
        <div class="next">
          {btn('Send on WhatsApp', '#', ' id="send" target="_blank" rel="noopener"')}
          <a class="back" href="book-details.html">Back</a>
        </div>
        <div class="q">
          <h2>What happens next</h2>
          <ol class="items" style="grid-template-columns:repeat(3,minmax(0,1fr))">
            <li><span class="ic"><svg viewBox="0 0 24 24"><path d="M4 20l1.5-4.5A8 8 0 1 1 8.5 19z"/></svg></span><b>You send it</b><span>WhatsApp opens with your booking written out.</span></li>
            <li><span class="ic"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg></span><b>We confirm</b><span>We agree the day and time with you there.</span></li>
            <li><span class="ic"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><b>We kasher</b><span>We come, and your kitchen is ready to use.</span></li>
          </ol>
        </div>
      </section>
      {SUM}
    </div>
  </div>
</main>
{dock('Send', '#', 'send2', ' target="_blank" rel="noopener"')}''', '''<script>
(function () {
  var o = KMB.load();
  if (!o.kitchen && !o.pots) { location.replace('book.html'); return; }
  if (!o.name || !o.phone || !o.date || !o.place) { location.replace('book-details.html'); return; }
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var rows = [
    ['What', KMB.lines(o).map(function (x) { return esc(x[0]); }).join('<br>') + '<br><a class="link" href="book.html">Change</a>'],
    ['When', esc(KMB.when(o)) + '<br><a class="link" href="book-details.html">Change</a>'],
    ['Where', esc(KMB.where(o)) + (o.place === 'elsewhere' ? '<br><small style="color:var(--sc-ink-soft)">There may be a fee for the distance. We tell you before the day.</small>' : '')],
    ['Your name', esc(o.name)], ['Reach you on', esc(o.phone)]
  ];
  if (o.notes) rows.push(['Notes', esc(o.notes)]);
  document.getElementById('rev').innerHTML = rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('');
  var href = KMB.waLink(o);
  ['send', 'send2'].forEach(function (id) {
    var a = document.getElementById(id);
    a.href = href;
    a.addEventListener('click', function () { setTimeout(function () { location.href = 'book-sent.html'; }, 600); });
  });
  KMB.paint(o);
})();
</script>''', order=True)

page('book-sent.html', 'Booking sent · KasherMyBnb', 'Your booking request is on its way to KasherMyBnb.', f'''
<main class="order">
  <div class="wrap" style="max-width:44rem">
    <section class="pane" style="text-align:center;padding:clamp(2rem,5vw,3.5rem)">
      <div style="width:64px;height:64px;border-radius:50%;background:var(--sc-accent);display:grid;place-items:center;margin:0 auto"><svg viewBox="0 0 24 24" style="width:30px;height:30px;stroke:#fff;stroke-width:3;fill:none;stroke-linecap:round;stroke-linejoin:round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
      <h1 style="margin-top:1.25rem">Thank you</h1>
      <p class="sub" style="margin-inline:auto;max-width:30rem">Once you press send in WhatsApp, your booking reaches us. We confirm the day and time with you there.</p>
      <ul class="lines" data-lines style="text-align:left;margin-top:1.5rem;border-top:1px solid var(--line)"></ul>
      <div class="total" style="max-width:100%"><span>Total</span><b data-total>$0</b></div>
      <p class="sub" style="margin-top:1.5rem">WhatsApp did not open? <a class="link" id="again" href="#" target="_blank" rel="noopener">Send it again</a></p>
      <p style="margin-top:1.5rem"><a class="back" href="index.html">Back to KasherMyBnb</a></p>
    </section>
  </div>
</main>''', '''<script>
(function () {
  var o = KMB.load();
  KMB.paint(o);
  if (o.kitchen || o.pots) document.getElementById('again').href = KMB.waLink(o);
})();
</script>''', order=True)
print('written')
