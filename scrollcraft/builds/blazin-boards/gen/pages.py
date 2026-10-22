"""Writes Blazin' Boards' other pages (Tzvi, 12 Oct 2026: a small website with
ordering pages like an online shop). One bar and footer for all of them.
Boards, prices and bottles come live from their listing (site.js); sizes and
contents from their own price list. Run from the build folder:
python gen/pages.py
"""
import os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
BAG = '<svg viewBox="0 0 24 24"><path d="M6 7h12l-1 13H7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>'


def page(name, title, desc, body, script='', order=False):
    menu = '''
  <ul class="menu">
    <li><a href="index.html">Home</a></li>
    <li><a href="boards.html">Every board</a></li>
    <li><a href="order.html">Your order</a></li>
  </ul>'''
    foot = '' if order else '''
<footer class="foot">
  <span>Blazin' Boards, premium meat boards in Jerusalem. Orders 48 hours ahead</span>
  <nav><a href="index.html">Home</a><a href="boards.html">Every board</a><a href="order.html">Order</a><a href="https://myisraelrental.com/businesses">Listed on MyIsraelRental</a></nav>
</footer>'''
    html = f'''<!doctype html>
<!-- Blazin' Boards, {name}. Written by gen/pages.py. -->
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="icon" href="assets/their-logo-small.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400;1,500&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="site.css">
</head>
<body>
<nav class="nav" aria-label="Blazin' Boards">
  <a class="nav__mark" href="index.html"><img src="assets/their-logo-small.png" alt="" width="120" height="120"> Blazin' Boards</a>{menu}
  <a class="cart" href="order.html" aria-label="Your order">{BAG}<span>Order</span><b data-count hidden>0</b></a>
</nav>
{body}
{foot}
<script src="site.js"></script>
{script}
</body>
</html>
'''
    open(os.path.join(HERE, name), 'w', encoding='utf-8').write(html)


PROMISE = f'''<ul class="promise">
          <li>{OK}<span>You pay us directly, by <span data-ways>card, Zelle or bank transfer</span>. Nothing is paid on this site.</span></li>
          <li>{OK}<span>We confirm your order with you first.</span></li>
          <li>{OK}<span>Orders 48 hours ahead.</span></li>
        </ul>'''


def summary(full=False):
    return f'''<aside class="summary" aria-label="Your order" aria-live="polite">
        <div class="who"><img src="assets/their-logo-small.png" alt="" width="44" height="44"><div><b>Your order</b><small>Blazin' Boards, Jerusalem</small></div></div>
        <ul class="lines" data-lines{' data-full' if full else ''}></ul>
        <div class="total"><span>Total</span><b data-total>$0</b></div>
        {PROMISE}
      </aside>'''


def steps(n):
    names = [('order.html', 'Your boards'), ('order-when.html', 'When and where'), ('order-details.html', 'Your details')]
    out = []
    for i, (href, label) in enumerate(names, 1):
        cls = 'is-done' if i < n else 'is-now' if i == n else ''
        inner = f'<a class="st" href="{href}">Step {i}: {label}</a>' if i < n else f'<span class="st">Step {i}: {label}</span>'
        out.append(f'<li class="{cls}"' + (' aria-current="step"' if i == n else '') + f'>{inner}</li>')
    return '<ol class="steps" aria-label="Order steps">' + ''.join(out) + '</ol>'


def dock(label, id_, href='#'):
    return f'<div class="dock"><div><small>Total</small><b data-total>$0</b></div><a class="cta" id="{id_}" href="{href}">{label}</a></div>'


# --------------------------------------------------------------- the shop
page('boards.html', "Every board · Blazin' Boards",
     "Every Blazin' Boards meat board, drawn to its real size, with its price and what is on it. Wine and whisky to add. Orders 48 hours ahead.",
     '''
<main>
  <header class="wrap shop-head">
    <p class="eyebrow">Every board</p>
    <h1>Every board, <em>drawn to its real size.</em></h1>
    <p>Premium meats, cooked and grilled to perfection. Two lines at each size: the Blazin' line adds chicken and sticky beef bites, the Premium Steak line is all steak. Prices in US dollars.</p>
    <p class="scale-note">Every board below is our own board, shown at its true size against the others. What goes on each one is listed under it.</p>
    <div class="chips filters" role="group" aria-label="Show">
      <button type="button" class="chip" data-show="all" aria-pressed="true">All boards</button>
      <button type="button" class="chip" data-show="blazin" aria-pressed="false">Blazin' line</button>
      <button type="button" class="chip" data-show="premium" aria-pressed="false">Premium Steak line</button>
      <button type="button" class="chip" data-show="special" aria-pressed="false">Specials</button>
    </div>
  </header>
  <section class="wrap" aria-label="The boards">
    <ul class="grid-boards" id="boards"><li class="bcard" style="padding:2rem;color:var(--soft)">Loading the boards…</li></ul>
    <p class="errline" id="err"></p>
  </section>
  <section class="sec" id="bottles-sec" hidden>
    <div class="wrap">
      <p class="eyebrow">Add a bottle</p>
      <h2>Wine and whisky, to go with your board.</h2>
      <ul class="bottles" id="bottles"></ul>
    </div>
  </section>
  <section class="sec">
    <div class="wrap">
      <p class="eyebrow">Good to know</p>
      <h2>Before you order</h2>
      <dl class="facts">
        <div><dt>Notice</dt><dd>Orders 48 hours ahead.</dd></div>
        <div><dt>Delivery</dt><dd>Collect in Jerusalem, or delivery across Israel. The delivery fee depends on the city; we confirm it on WhatsApp.</dd></div>
        <div><dt>On request</dt><dd>Gluten-free and soy-free boards.</dd></div>
        <div><dt>Paying</dt><dd>You pay us directly, by <span data-ways>card, Zelle or bank transfer</span>.</dd></div>
      </dl>
      <p style="margin-top:2rem"><a class="cta" href="order.html">Go to your order</a></p>
    </div>
  </section>
</main>''', '''<script>
(function () {
  var o = BB.load(), F = null, show = 'all';
  var PX = 4.6; /* one pixels-per-centimetre for every card, so the sizes compare */
  function card(p) {
    var q = o.cart[p.id] || 0;
    var stage = p.cm
      ? '<div class="stage"><img class="board" src="assets/board-cut-m.webp" alt="" width="1000" height="815" loading="lazy" style="width:' + (p.cm[1] * PX / 0.98).toFixed(0) + 'px"><span class="dims">' + p.cm[0] + ' × ' + p.cm[1] + ' cm</span></div>'
      : '<div class="stage"><span style="font-weight:700;color:var(--gold-text)">Size on request</span></div>';
    return '<li class="bcard' + (q ? ' is-in' : '') + '" data-line="' + p.line + '">' + BB.dealHtml(p) + stage
      + '<div class="body"><span class="line">' + BB.LINES[p.line] + '</span><h3>' + BB.esc(p.short) + '</h3>'
      + '<span class="price">' + BB.money(p.price, p.currency) + '</span>'
      + (p.what ? '<p class="what">' + BB.esc(p.what) + '</p>' : '')
      + (/Medium Blazin/.test(p.short) ? '<span class="start">A good place to start</span>' : '')
      + '<div class="add">' + (q
        ? '<span class="stepper"><button type="button" data-dec="' + p.id + '" aria-label="One fewer">−</button><output>' + q + '</output><button type="button" data-inc="' + p.id + '" aria-label="One more">+</button></span><a class="ghost" href="order.html">Order</a>'
        : '<button type="button" class="cta" data-inc="' + p.id + '">Add to order</button>')
      + '</div></div></li>';
  }
  function paint() {
    var boards = F.products.filter(function (p) { return p.board && (show === 'all' || p.line === show); });
    boards.sort(function (a, b) { return a.price - b.price; });
    document.getElementById('boards').innerHTML = boards.map(card).join('');
    var bottles = F.products.filter(function (p) { return !p.board; });
    document.getElementById('bottles-sec').hidden = !bottles.length;
    document.getElementById('bottles').innerHTML = bottles.map(function (p) {
      var on = (o.cart[p.id] || 0) > 0;
      return '<li class="bottle"><span><b>' + BB.esc(p.name) + '</b><span class="p">' + BB.money(p.price, p.currency) + '</span></span><button type="button" class="tg" data-bottle="' + p.id + '" aria-pressed="' + on + '">' + (on ? 'Added' : 'Add') + '</button></li>';
    }).join('');
    BB.paint(F, o);
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-inc],[data-dec],[data-bottle],[data-show]'); if (!t || !F) return;
    if (t.dataset.show) {
      var g = document.getElementById('boards'); g.style.minHeight = g.offsetHeight + 'px';
      show = t.dataset.show; document.querySelectorAll('[data-show]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === t)); });
      paint(); if (g.animate) g.animate([{ opacity: 0.85 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' }); return; }
    var id = t.dataset.inc || t.dataset.dec || t.dataset.bottle;
    var p = F.products.filter(function (x) { return x.id === id; })[0];
    var was = o.cart[id] || 0;
    if (t.dataset.inc) o.cart[id] = Math.min(20, was + 1);
    if (t.dataset.dec) o.cart[id] = Math.max(0, was - 1);
    if (t.dataset.bottle) o.cart[id] = was ? 0 : 1;
    if (!o.cart[id]) delete o.cart[id];
    BB.save(o); paint();
    if ((o.cart[id] || 0) > was) BB.toast((p ? p.short : 'Added') + ' added. Total ' + BB.money(BB.total(F, o), BB.cur(F)), 'order.html', 'Go to order');
  });
  BB.form().then(function (f) { F = f; paint(); }).catch(function () { document.getElementById('err').textContent = 'Could not load the boards. Please refresh the page.'; });
})();
</script>''')

# -------------------------------------------------------- step 1: the boards
page('order.html', "Your order · Blazin' Boards",
     "Order a Blazin' Boards meat board: pick the size, add a bottle, say when and where. Orders 48 hours ahead. You pay the business directly.",
     f'''
<main class="order">
  <div class="wrap">
    {steps(1)}
    <div class="cols">
      <section class="pane">
        <h1>Your <em>boards.</em></h1>
        <p class="sub">Add as many as you need. Prices in US dollars.</p>
        <ul class="cartlines" id="cartlines"></ul>
        <div class="q">
          <h2 id="pickTitle">Choose a board</h2>
          <button type="button" class="ghost" id="more" hidden aria-expanded="false" aria-controls="picks">Add another board</button>
          <table class="picks" id="picks" aria-label="Boards by size and line"></table>
          <p style="margin:.6rem 0 0"><a class="back" href="boards.html">See every board drawn to size</a></p>
        </div>
        <div class="q" id="bottlesQ" hidden>
          <h2>Add a bottle</h2>
          <ul class="bottles" id="bottles" style="grid-template-columns:repeat(2,minmax(0,1fr))"></ul>
        </div>
        <p class="errline" id="err"></p>
        <div class="next"><a class="cta" id="go" href="order-when.html">Continue</a><a class="back" href="boards.html">Keep looking</a></div>
      </section>
      {summary()}
    </div>
  </div>
</main>
{dock('Continue', 'go2', 'order-when.html')}''', '''<script>
(function () {
  var o = BB.load(), F = null, open = false;
  var area = function (p) { return p.cm ? p.cm[0] * p.cm[1] : 1e9; };
  document.getElementById('more').addEventListener('click', function () { open = true; paint(); document.getElementById('picks').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
  function paint() {
    var ls = BB.lines(F, o);
    document.getElementById('cartlines').innerHTML = ls.map(function (l) {
      return '<li><span class="thumb"><img src="assets/board-cut-m.webp" alt="" width="1000" height="815"></span><span><b>' + BB.esc(l.p.short) + '</b><small>' + (l.p.cm ? l.p.cm[0] + ' × ' + l.p.cm[1] + ' cm, ' : '') + BB.money(l.p.price, l.p.currency) + ' each</small></span>'
        + '<span class="stepper"><button type="button" data-dec="' + l.p.id + '" aria-label="One fewer">−</button><output>' + l.qty + '</output><button type="button" data-inc="' + l.p.id + '" aria-label="One more">+</button></span>'
        + '<span class="amt">' + BB.money(l.p.price * l.qty, l.p.currency) + '</span><button type="button" class="rm" data-rm="' + l.p.id + '" aria-label="Remove ' + BB.esc(l.p.short) + ' from the order"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/></svg></button></li>';
    }).join('');
    var boards = F.products.filter(function (p) { return p.board; });
    var rows = {};
    boards.forEach(function (p) { var k = p.cm ? p.cm.join('x') : p.short; (rows[k] = rows[k] || { a: area(p), cells: [] }).cells.push(p); });
    var keys = Object.keys(rows).sort(function (x, y) { return rows[x].a - rows[y].a; });
    var h = '<thead><tr><th>Size</th><th colspan="2">Boards</th></tr></thead><tbody>';
    keys.forEach(function (k) {
      var c = rows[k].cells.sort(function (a, b) { return (a.line === 'premium') - (b.line === 'premium'); });
      for (var i = 0; i < c.length; i += 2) {
        h += '<tr><td class="size">' + (i === 0 && c[0].cm ? c[0].cm[0] + ' × ' + c[0].cm[1] + ' cm' : '') + '</td>';
        [c[i], c[i + 1]].forEach(function (p) {
          if (!p) { h += '<td></td>'; return; }
          var on = (o.cart[p.id] || 0) > 0;
          h += '<td><button type="button" class="pick" data-toggle="' + p.id + '" aria-pressed="' + on + '"><span class="name" data-size="' + (p.cm ? p.cm[0] + ' × ' + p.cm[1] + ' cm' : '') + '">' + BB.esc(p.short) + '</span><span class="price">' + BB.money(p.price, p.currency) + '</span>' + (/Medium Blazin/.test(p.short) ? '<span class="start">A good place to start</span>' : '') + BB.dealHtml(p) + '</button></td>';
        });
        h += '</tr>';
      }
    });
    document.getElementById('picks').innerHTML = h + '</tbody>';
    var hasBoard = ls.some(function (l) { return l.p.board; });
    document.getElementById('pickTitle').hidden = hasBoard;
    document.getElementById('more').hidden = !hasBoard || open;
    document.getElementById('picks').hidden = hasBoard && !open;
    var bottles = F.products.filter(function (p) { return !p.board; });
    document.getElementById('bottlesQ').hidden = !bottles.length || !hasBoard;
    document.getElementById('bottles').innerHTML = bottles.map(function (p) {
      var on = (o.cart[p.id] || 0) > 0;
      return '<li class="bottle"><span><b>' + BB.esc(p.name) + '</b><span class="p">' + BB.money(p.price, p.currency) + '</span></span><button type="button" class="tg" data-bottle="' + p.id + '" aria-pressed="' + on + '">' + (on ? 'Added' : 'Add') + '</button></li>';
    }).join('');
    var ok = ls.some(function (l) { return l.p.board; });
    ['go', 'go2'].forEach(function (id) { document.getElementById(id).setAttribute('aria-disabled', String(!ok)); });
    BB.paint(F, o);
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-inc],[data-dec],[data-toggle],[data-bottle],[data-rm]'); if (!t || !F) return;
    var id = t.dataset.inc || t.dataset.dec || t.dataset.toggle || t.dataset.bottle || t.dataset.rm, was = o.cart[id] || 0;
    if (t.dataset.inc) o.cart[id] = Math.min(20, was + 1);
    if (t.dataset.dec) o.cart[id] = Math.max(0, was - 1);
    if (t.dataset.toggle || t.dataset.bottle) o.cart[id] = was ? 0 : 1;
    if (t.dataset.rm) o.cart[id] = 0;
    if (!o.cart[id]) delete o.cart[id];
    BB.save(o); paint();
  });
  BB.form().then(function (f) {
    F = f;
    // Arrived from a board on the home page: that board, in the order.
    var want = new URLSearchParams(location.search).get('board');
    if (want) { var w = F.products.filter(function (p) { return p.short === want; })[0]; if (w && !o.cart[w.id]) { o.cart[w.id] = 1; BB.save(o); } }
    paint();
  }).catch(function () { document.getElementById('err').textContent = 'Could not load the boards. Please refresh the page.'; });
})();
</script>''', order=True)

# ------------------------------------------------- step 2: when and where
page('order-when.html', "When and where · Blazin' Boards", 'Collect in Jerusalem or have it delivered, and the day you need it.', f'''
<main class="order">
  <div class="wrap">
    {steps(2)}
    <div class="cols">
      <section class="pane">
        <h1>When and <em>where?</em></h1>
        <p class="sub">We need 48 hours' notice.</p>
        <div class="q">
          <h2>Collect or deliver</h2>
          <div class="chips" role="group" aria-label="Collect or deliver">
            <button type="button" class="chip" data-ful="pickup" aria-pressed="true">Collect in Jerusalem</button>
            <button type="button" class="chip" data-ful="delivery" aria-pressed="false" hidden>Deliver to me</button>
          </div>
        </div>
        <div class="q">
          <h2>Which day?</h2>
          <div class="chips daychips" id="dayChips" role="group" aria-label="Earliest days"></div>
          <div class="two">
            <div class="field" id="f-date"><label for="date">Needed on</label><input type="date" id="date"><span class="hint">The earliest day is two days from today.</span><span class="err">Choose a day, two days from today or later, not Shabbos.</span></div>
            <div class="field" id="f-window" hidden><label for="window">Time</label><select id="window"></select></div>
          </div>
        </div>
        <div class="q" id="addrQ" hidden>
          <div class="field" id="f-address"><label for="address">Delivery address</label><input id="address" autocomplete="street-address" placeholder="Street, number, city, plus floor or entrance" maxlength="400"><span class="hint">The delivery fee depends on the city. We confirm it with you on WhatsApp before the day.</span><span class="err">Where should it go?</span></div>
          <div class="field" id="f-city" hidden><label for="city">City</label><select id="city"></select><span class="err">Choose the city it goes to.</span></div>
        </div>
        <p class="errline" id="err"></p>
        <div class="next"><a class="cta" id="go" href="order-details.html">Continue</a><a class="back" href="order.html">Back</a></div>
      </section>
      {summary(True)}
    </div>
  </div>
</main>
{dock('Continue', 'go2', 'order-details.html')}''', '''<script>
(function () {
  var o = BB.load(), F = null, $ = function (id) { return document.getElementById(id); };
  if (!BB.count(o)) { location.replace('order.html'); return; }
  var min = new Date(); min.setDate(min.getDate() + BB.NOTICE_DAYS);
  $('date').min = min.toISOString().slice(0, 10);
  $('date').value = o.date || ''; $('address').value = o.address || '';
  function windows() {
    var wins = [];
    if (o.date && F) {
      var wd = new Date(o.date + 'T12:00:00').getDay();
      wins = ((F.settings || {})[o.ful + '_windows'] || []).filter(function (w) { return parseInt(w.weekday, 10) === wd; });
    }
    $('f-window').hidden = !wins.length;
    $('window').innerHTML = wins.map(function (w) { var v = w.start + '|' + w.end; return '<option value="' + v + '"' + (o.window === v ? ' selected' : '') + '>' + w.start + ' to ' + w.end + '</option>'; }).join('');
    o.window = wins.length ? $('window').value : '';
  }
  function paint() {
    document.querySelectorAll('[data-ful]').forEach(function (b) { b.setAttribute('aria-pressed', String(o.ful === b.dataset.ful)); });
    $('addrQ').hidden = o.ful !== 'delivery';
    // A store that is not nationwide delivers only to its own cities, and the
    // order is refused without one (dead-ends audit, 12 Oct 2026).
    var B = (F && F.business) || {};
    $('f-city').hidden = !(F && !B.serves_nationwide && (B.areas || []).length);
    windows(); BB.save(o); if (F) BB.paint(F, o);
  }
  document.querySelectorAll('[data-ful]').forEach(function (b) { b.addEventListener('click', function () { o.ful = b.dataset.ful; paint(); }); });
  (function () {
    var box = $('dayChips'), d = new Date(min), n = 0, h = '';
    while (n < 4) { if (d.getDay() !== 6) { var v = d.toISOString().slice(0, 10); h += '<button type="button" class="chip" data-day="' + v + '" aria-pressed="false">' + d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + '</button>'; n++; } d.setDate(d.getDate() + 1); }
    box.innerHTML = h;
    box.addEventListener('click', function (e) { var t = e.target.closest('[data-day]'); if (!t) return; $('date').value = t.dataset.day; $('date').dispatchEvent(new Event('change')); });
    $('date').addEventListener('change', function () { box.querySelectorAll('[data-day]').forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.day === $('date').value)); }); });
  })();
  $('date').addEventListener('change', function () { o.date = $('date').value; $('f-date').classList.remove('is-bad'); paint(); });
  $('window').addEventListener('change', function () { o.window = $('window').value; BB.save(o); BB.paint(F, o); });
  $('address').addEventListener('input', function () { o.address = $('address').value.trim(); $('f-address').classList.remove('is-bad'); BB.save(o); if (F) BB.paint(F, o); });
  function check(e) {
    var bad = [];
    // No Shabbos: a kosher kitchen's boards, and the earliest day is 48 hours out.
    if (!o.date || o.date < $('date').min || new Date(o.date + 'T12:00:00').getDay() === 6) bad.push('f-date');
    if (o.ful === 'delivery' && (o.address || '').length < 5) bad.push('f-address');
    if (o.ful === 'delivery' && !$('f-city').hidden && !o.city) bad.push('f-city');
    bad.forEach(function (id) { $(id).classList.add('is-bad'); });
    if (bad.length) { e.preventDefault(); var el = $(bad[0]).querySelector('input, select'); el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }
  $('go').addEventListener('click', check); $('go2').addEventListener('click', check);
  BB.form().then(function (f) {
    F = f;
    var B = F.business || {}, areas = B.serves_nationwide ? [] : (B.areas || []);
    if (F.settings && F.settings.delivery_on && (B.serves_nationwide || areas.length)) document.querySelector('[data-ful="delivery"]').hidden = false;
    else o.ful = 'pickup';
    if (o.city && !areas.some(function (a) { return a.slug === o.city; })) o.city = '';
    $('city').innerHTML = '<option value="">Choose</option>' + areas.map(function (a) { return '<option value="' + a.slug + '"' + (o.city === a.slug ? ' selected' : '') + '>' + a.label + '</option>'; }).join('');
    $('city').addEventListener('change', function () { o.city = $('city').value; $('f-city').classList.remove('is-bad'); BB.save(o); });
    paint();
  });
  paint();
})();
</script>''', order=True)

# ---------------------------------------------------- step 3: your details
page('order-details.html', "Your details · Blazin' Boards", 'Your name, how to reach you and how you will pay. Then place your order.', f'''
<main class="order">
  <div class="wrap">
    {steps(3)}
    <div class="cols">
      <section class="pane">
        <h1>Your <em>details.</em></h1>
        <p class="sub">So we can confirm your order with you. We share it with no one else.</p>
        <div class="q two">
          <div class="field" id="f-name"><label for="name">Your name</label><input id="name" autocomplete="name" maxlength="120"><span class="err">Add your name.</span></div>
          <div class="field" id="f-phone"><label for="phone">Mobile</label><input id="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="05x-xxx-xxxx" maxlength="40"><span class="err">A mobile number, so we can confirm with you.</span></div>
        </div>
        <div class="q">
          <div class="field"><label for="email">Email, for your confirmation <span class="hint">(optional)</span></label><input id="email" type="email" autocomplete="email" maxlength="200"></div>
        </div>
        <div class="q">
          <div class="field"><label for="notes">Anything we should know? <span class="hint">(optional) Gluten-free and soy-free boards are available on request.</span></label><textarea id="notes" maxlength="1000"></textarea></div>
        </div>
        <div class="q" id="f-pay">
          <h2>How will you pay?</h2>
          <div class="chips" id="payBy" role="group" aria-label="How you will pay"></div>
          <p class="errline" id="payErr" hidden>Choose how you will pay.</p>
        </div>
        <dl class="rev" id="rev"></dl>
        <p class="errline" id="err"></p>
        <div class="next"><button type="button" class="cta" id="place">Place order</button><a class="back" href="order-when.html">Back</a></div>
      </section>
      {summary(True)}
    </div>
  </div>
</main>
<div class="dock"><div><small>Total</small><b data-total>$0</b></div><button type="button" class="cta" id="place2">Place order</button></div>''', '''<script>
(function () {
  var o = BB.load(), F = null, $ = function (id) { return document.getElementById(id); };
  if (!BB.count(o)) { location.replace('order.html'); return; }
  if (!o.date) { location.replace('order-when.html'); return; }
  ['name', 'phone', 'email', 'notes'].forEach(function (k) {
    $(k).value = o[k] || '';
    $(k).addEventListener('input', function () { o[k] = $(k).value.trim(); var f = $('f-' + k); if (f) f.classList.remove('is-bad'); BB.save(o); });
  });
  function paint() {
    $('payBy').innerHTML = (F.ways || []).map(function (w) { return '<button type="button" class="chip" data-pay="' + BB.esc(w) + '" aria-pressed="' + (o.payBy === w) + '">' + BB.esc(w.charAt(0).toUpperCase() + w.slice(1)) + '</button>'; }).join('');
    var ls = BB.lines(F, o);
    $('rev').innerHTML = '<div><dt>Your order</dt><dd>' + ls.map(function (l) { return (l.qty > 1 ? l.qty + ' × ' : '') + BB.esc(l.p.short); }).join('<br>') + '<br><a class="back" href="order.html">Change</a></dd></div>'
      + '<div><dt>When</dt><dd>' + BB.esc(BB.when(o)) + '<br><a class="back" href="order-when.html">Change</a></dd></div>'
      + '<div><dt>How</dt><dd>' + BB.esc(BB.where(o)) + '</dd></div>';
    var label = 'Place order, ' + BB.money(BB.total(F, o), BB.cur(F));
    $('place').textContent = label; $('place2').textContent = 'Place order';
    BB.paint(F, o);
  }
  $('payBy').addEventListener('click', function (e) { var b = e.target.closest('[data-pay]'); if (!b) return; o.payBy = b.dataset.pay; $('payErr').hidden = true; BB.save(o); paint(); });
  function place() {
    var bad = [];
    if (!o.name || o.name.length < 2) bad.push('f-name');
    if (!o.phone || o.phone.replace(/\\D/g, '').length < 9) bad.push('f-phone');
    bad.forEach(function (id) { $(id).classList.add('is-bad'); });
    $('payErr').hidden = !!o.payBy;
    if (bad.length || !o.payBy) { var first = bad.length ? $(bad[0]).querySelector('input') : $('payBy'); first.scrollIntoView({ block: 'center', behavior: 'smooth' }); if (first.focus) first.focus({ preventScroll: true }); return; }
    var win = null;
    if (o.window) { var w = o.window.split('|'); win = { weekday: new Date(o.date + 'T12:00:00').getDay(), start: w[0], end: w[1] }; }
    var body = {
      lines: BB.lines(F, o).map(function (l) { return { product_id: l.p.id, qty: l.qty }; }),
      fulfilment: o.ful, date: o.date, window: win, address: o.ful === 'delivery' ? o.address : null, city: o.ful === 'delivery' ? (o.city || null) : null,
      customer_name: o.name, customer_phone: o.phone, customer_email: o.email || null, notes: o.notes || '', pay_by: o.payBy
    };
    ['place', 'place2'].forEach(function (id) { $(id).disabled = true; $(id).classList.add('is-busy'); $(id).textContent = 'Placing your order'; });
    fetch(BB.API + '/marketplace/order-form/' + F.gig.id + '/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.detail || 'Could not place the order'); return j; }); })
      .then(function (j) {
        var done = { lines: BB.lines(F, o).map(function (l) { return [(l.qty > 1 ? l.qty + ' × ' : '') + l.p.short, BB.money(l.p.price * l.qty, l.p.currency)]; }),
          total: BB.money(j.total || BB.total(F, o), j.currency || BB.cur(F)), when: BB.when(o), how: BB.where(o), pay: o.payBy, track: BB.APP + '/orders/track/' + j.track_token };
        try { sessionStorage.setItem('bb-done', JSON.stringify(done)); } catch (e) { /* fine */ }
        o.cart = {}; BB.save(o);
        location.href = 'order-done.html';
      })
      .catch(function (e) {
        $('err').textContent = e.message;
        ['place', 'place2'].forEach(function (id) { $(id).disabled = false; $(id).classList.remove('is-busy'); }); paint();
      });
  }
  $('place').addEventListener('click', place); $('place2').addEventListener('click', place);
  BB.form().then(function (f) { F = f; paint(); }).catch(function () { $('err').textContent = 'Could not load your order. Please refresh the page.'; });
})();
</script>''', order=True)

# ---------------------------------------------------------------- placed
page('order-done.html', "Order placed · Blazin' Boards", "Your order is with Blazin&#39; Boards.", f'''
<main class="order">
  <div class="wrap" style="max-width:46rem">
    <section class="pane" style="text-align:center;padding:clamp(2rem,5vw,3.5rem)">
      <div style="width:64px;height:64px;border-radius:50%;background:var(--ox-1);display:grid;place-items:center;margin:0 auto"><svg viewBox="0 0 24 24" style="width:30px;height:30px;stroke:#fff;stroke-width:3;fill:none;stroke-linecap:round;stroke-linejoin:round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
      <h1 style="margin-top:1.2rem">Your order is with <em>Blazin' Boards.</em></h1>
      <p class="sub" style="max-width:32rem;margin-inline:auto">We confirm your order with you before the day. You pay us directly, by <span id="pay">the way you chose</span>.</p>
      <ul class="lines" id="doneLines" style="text-align:left;margin-top:1.5rem;border-top:1px solid var(--line)"></ul>
      <div class="total"><span>Total</span><b id="doneTotal"></b></div>
      <p style="margin-top:1.5rem"><a class="cta" id="track" href="#" target="_blank" rel="noopener">Follow your order</a></p>
      <p class="sub" style="margin-top:1rem">Keep that link: it shows where your order is.</p>
      <p style="margin-top:1.5rem"><a class="back" href="index.html">Back to Blazin' Boards</a></p>
    </section>
  </div>
</main>''', '''<script>
(function () {
  var d = null;
  try { d = JSON.parse(sessionStorage.getItem('bb-done') || 'null'); } catch (e) { d = null; }
  if (!d) { location.replace('index.html'); return; }
  document.getElementById('doneLines').innerHTML = d.lines.map(function (l) { return '<li><span>' + BB.esc(l[0]) + '</span><span>' + BB.esc(l[1]) + '</span></li>'; }).join('')
    + '<li class="meta"><span>When</span><span>' + BB.esc(d.when) + '</span></li><li class="meta"><span>How</span><span>' + BB.esc(d.how) + '</span></li>';
  document.getElementById('doneTotal').textContent = d.total;
  document.getElementById('pay').textContent = d.pay || 'the way you chose';
  document.getElementById('track').href = d.track;
})();
</script>''', order=True)
print('written')
