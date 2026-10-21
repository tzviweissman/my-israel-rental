"""(Since 21 Oct 2026 order-src.html is edited by hand, with the site review changes; do not rerun make_order_src.py over it.) Writes gen/order-src.html for The Brown Box from The Gift Boutique's order
page: their colours and words, shekels, Jerusalem delivery, and the bowl and
gift-box choices (each bowl's flavour and two extras, each box's muffins)."""
import io

s = io.open('../gift-boutique/gen/catalog/order-src.html', encoding='utf8').read()


def sub(a, b):
    global s
    assert s.count(a) == 1, (a[:70], s.count(a))
    s = s.replace(a, b)


sub("""  The Gift Boutique, order.html (Tzvi, 14 Oct 2026: "make an order page to
  order more easily so it send all the details to whatsapp"). Pick gifts and
  quantities, say who it is for and where it goes, and one button opens
  WhatsApp with the whole order written out. Nothing is paid or stored here.
  The gifts come from their shop when the site serves the page
  (#mir-live-products, frontend/server.js), else from the list below.""", """  The Brown Box, order.html (from The Gift Boutique's order page, 15 Oct
  2026). Pick from their menu, choose each bowl and its two extras and each
  box's muffins, say where it goes, and one button saves the order on their
  board and opens WhatsApp with it all written out. Nothing is paid here.
  The menu comes from their shop when the site serves the page
  (#mir-live-products, frontend/server.js), else from the list below.""")
sub("<title>Order a gift · The Gift Boutique</title>", "<title>Order · The Brown Box</title>")
sub('<meta name="description" content="Choose your gifts, say who they are for and where they are going, and send the order to The Gift Boutique on WhatsApp. Delivered across Israel.">',
    '<meta name="description" content="Order acai bowls, acai boards, brunch gift boxes, snacks and drinks from The Brown Box, delivered across Jerusalem. Kosher.">')
sub("family=Cinzel:wght@500;600;700&family=Jost:wght@400;500;600", "family=Bona+Nova:wght@400;700&family=Heebo:wght@400;500;700")
sub("""    --night: #0E0C09; --ivory: #F6F0E4; --ivory-2: #EDE4D2; --ink: #1D1912; --soft: #5B5244;
    --gold: #D4AA40; --gold-hi: #F2CD6A; --gold-ink: #7A5A10; --on-night-soft: #CFC6B5;
    --line-ivory: #DCCFB6; --line-night: #3A3226; --err: #9B2C1F;""", """    /* The Brown Box: their brown for the dark ground, their menu's cream, the
       acai for the accent (names kept from the page this was made from) */
    --night: #4A2E17; --ivory: #F3EADB; --ivory-2: #EADCC4; --ink: #3A2513; --soft: #5C4431;
    --gold: #FBF6EE; --gold-hi: #FFFFFF; --gold-ink: #6E2A57; --on-night-soft: #E8D9C2;
    --line-ivory: #D9C6A8; --line-night: #6A4A2E; --err: #9B2C1F;""")
sub("--font-head: 'Cinzel', 'Times New Roman', serif; --font-body: 'Jost', system-ui, sans-serif;",
    "--font-head: 'Bona Nova', Georgia, serif; --font-body: 'Heebo', system-ui, sans-serif;")
sub("""  .btn::after { content: ""; position: absolute; inset: 0; background: linear-gradient(100deg, transparent 35%, rgb(255 255 255 / .55) 50%, transparent 65%); translate: -120% 0; }
  .btn:hover { background: var(--gold-hi); }
  .btn:hover::after { translate: 120% 0; transition: translate 650ms var(--out); }""", """  .btn::after { display: none; }
  .btn:hover { background: var(--gold-hi); }""")
sub(".items li.has { background: linear-gradient(90deg, rgb(212 170 64 / .12), transparent 70%); }", ".items li.has { background: rgb(110 42 87 / .06); }")
sub(".add:hover { background: var(--gold); border-color: var(--gold); color: var(--night); }", ".add:hover { background: var(--gold-ink); border-color: var(--gold-ink); color: #fff; }")
sub("box-shadow: 0 0 0 3px rgb(212 170 64 / .3);", "box-shadow: 0 0 0 3px rgb(110 42 87 / .2);")
sub(".items .ph { width: 64px; height: 64px; border-radius: 26%; overflow: hidden; background: var(--ivory-2); }",
    ".items .ph { width: 64px; height: 64px; border-radius: 50%; overflow: hidden; background: #fff; }")
sub(""".items .ph img { width: 100%; height: 100%; object-fit: cover; scale: 1.08; }""", """.items .ph img { width: 100%; height: 100%; object-fit: cover; }
  /* each bowl and box gets its own choices, under its row */
  .cfg { grid-column: 1 / -1; display: grid; gap: .7rem; padding: .2rem 0 .3rem; }
  .cfg:empty { display: none; }
  .cfg .one { background: #fff; border: 1px solid var(--line-ivory); border-radius: 14px; padding: .8rem .9rem; }
  .cfg .one > b { display: block; font-weight: 700; font-size: .95rem; margin-bottom: .2rem; }
  .cfg .lbl { font-size: .85rem; color: var(--soft); margin: .5rem 0 .35rem; }
  .cfg .row { display: flex; flex-wrap: wrap; gap: .4rem; }
  .cfg button.c { min-height: 40px; padding: 0 .85rem; border-radius: 999px; border: 1px solid var(--line-ivory); background: var(--ivory); color: var(--ink); font: 400 .92rem/1 var(--font-body); cursor: pointer; }
  .cfg button.c[aria-pressed="true"] { background: var(--gold-ink); border-color: var(--gold-ink); color: #fff; }
  .cfg button.c:disabled { opacity: .45; cursor: not-allowed; }
  .cfg button.c:active:not(:disabled) { transform: scale(.96); }""")
sub(""".sum h2 { font-size: 1.15rem; color: var(--gold); }""", """.sum h2 { font-size: 1.15rem; color: #fff; }""")
sub(""".sum .tot b { font: 600 1.5rem/1 var(--font-body); color: var(--gold); }""", """.sum .tot b { font: 700 1.5rem/1 var(--font-body); color: #fff; }""")
sub(""".sum .btn { width: 100%; }""", """.sum .btn { width: 100%; background: #fff; color: var(--night); }""")
sub(""".sum .why { margin: .8rem 0 0; color: var(--gold-hi); font-size: .9rem; min-height: 1.4em; }""", """.sum .why { margin: .8rem 0 0; color: #F3C9E2; font-size: .9rem; min-height: 1.4em; }""")
sub(""".sum .wa-line a { color: var(--gold-hi); }""", """.sum .wa-line a { color: #fff; }""")
sub(""".dock b { font: 600 1.2rem/1.2 var(--font-body); color: var(--gold); }""", """.dock b { font: 700 1.2rem/1.2 var(--font-body); color: #fff; }
    .dock .btn { background: #fff; color: var(--night); }""")
sub("""background: rgb(14 12 9 / .96); border-top""", """background: rgb(74 46 23 / .97); border-top""")
sub(""".bar { position: sticky; top: 0; z-index: 50; height: var(--bar-h); background: rgb(14 12 9 / .94);""", """.bar { position: sticky; top: 0; z-index: 50; height: var(--bar-h); background: rgb(74 46 23 / .97);""")
sub(""".brand { display: flex; align-items: center; gap: .65rem; text-decoration: none; color: var(--gold); min-height: 44px; }
  .brand img { width: 40px; height: 40px; }""", """.brand { display: flex; align-items: center; gap: .65rem; text-decoration: none; color: #fff; min-height: 44px; }
  .brand img { width: 40px; height: 40px; border-radius: 50%; }""")
sub(".brand span { font: 600 1rem/1 var(--font-head); letter-spacing: .08em; white-space: nowrap; }", ".brand span { font: 700 1.1rem/1 var(--font-head); letter-spacing: .03em; white-space: nowrap; }")
sub(".bar .back:hover { color: var(--gold-hi); }", ".bar .back:hover { color: #fff; }")
sub("background: var(--night); color: var(--gold); font: 600 1rem/1 var(--font-head); flex: none; }", "background: var(--night); color: #fff; font: 700 1rem/1 var(--font-head); flex: none; }")
sub(""":focus-visible { outline: 3px solid var(--gold); outline-offset: 3px; }""", """:focus-visible { outline: 3px solid var(--gold-ink); outline-offset: 3px; }""")
# markup
sub("""    <a class="brand" href="index.html" aria-label="The Gift Boutique, home"><img src="assets/logo.webp" alt="" width="40" height="40"><span>THE GIFT BOUTIQUE</span></a>
    <a class="back" href="index.html#prices"><span class="lg">Back to the collection</span><span class="sm">Collection</span></a>""", """    <a class="brand" href="index.html" aria-label="The Brown Box, home"><img src="assets/logo.webp" alt="" width="40" height="40"><span>The Brown Box</span></a>
    <a class="back" href="index.html#menu"><span class="lg">Back to the menu</span><span class="sm">Menu</span></a>""")
sub("""    <h1>Order a gift</h1>
    <p>Choose your gifts and tell us where they are going. The button sends it all to us on WhatsApp, and we confirm the order and the delivery fee with you there.</p>""", """    <h1>Order</h1>
    <p>Choose from the menu and tell us where it is going. The button sends it all to us on WhatsApp, and we confirm the order and the delivery fee with you there.</p>""")
sub("""        <h2 id="s1"><span class="n">1</span>Your gifts</h2>
        <p class="hint">Prices in US dollars, as in our catalogue.</p>""", """        <h2 id="s1"><span class="n">1</span>Your order</h2>
        <p class="hint">Every bowl comes with two extras of your choice.</p>""")
sub("""        <p class="hint">We deliver across Israel.</p>""", """        <p class="hint">We deliver throughout Jerusalem. The fee depends on the location.</p>""")
sub("""          <div data-need><label for="to">Who is it for?</label><input id="to" name="to" autocomplete="off"><p class="msg">Tell us who the gift is for.</p></div>
          <div data-need><label for="city">City</label><input id="city" name="city" autocomplete="address-level2"><p class="msg">Which city is it going to?</p></div>""", """          <div data-need><label for="city">Neighbourhood</label><input id="city" name="city" autocomplete="off"><p class="msg">Which neighbourhood of Jerusalem?</p></div>
          <div><label for="to">Who is it for? <small>(if it is a gift)</small></label><input id="to" name="to" autocomplete="off"></div>""")
sub("""<label for="tophone">Their phone <small>(optional, for the delivery)</small></label>""", """<label for="tophone">Their phone <small>(if it is a gift)</small></label>""")
sub("""<label for="card">Message for the card <small>(optional)</small></label>""", """<label for="card">Message for the card <small>(optional, for a gift)</small></label>""")
sub("""      <p class="empty" id="empty">No gifts chosen yet.</p>""", """      <p class="empty" id="empty">Nothing chosen yet.</p>""")
sub("""<div class="tot"><span>Gifts</span><b id="total">$0</b></div>
      <p class="note">Delivery is added on WhatsApp once we know the city. You pay us directly; nothing is paid on this page.</p>""", """<div class="tot"><span>Before delivery</span><b id="total">₪0</b></div>
      <p class="note">Delivery is added on WhatsApp once we know the neighbourhood. You pay us directly, by cash, Zelle, Israeli bank transfer, or credit card with a 4% charge; nothing is paid on this page.</p>""")
sub("""      <p class="saved">Your order is also saved with The Gift Boutique on MyIsraelRental, with a link to follow it.</p>
      <p class="wa-line">Or message us: <a href="https://wa.me/972535386042" target="_blank" rel="noopener">+972 53-538-6042</a></p>""", """      <p class="saved">Your order is also saved with The Brown Box on MyIsraelRental, with a link to follow it.</p>
      <p class="wa-line">Or message us: <a href="https://wa.me/972533452048" target="_blank" rel="noopener">+972 53-345-2048</a></p>""")
sub("""  <div><small>Gifts, before delivery</small><b id="dtotal">$0</b></div>""", """  <div><small>Before delivery</small><b id="dtotal">₪0</b></div>""")
# script
sub("var WA = '972535386042';", "var WA = '972533452048';")
sub("var g = p.group || 'More gifts';", "var g = p.group || 'More from The Brown Box';")
sub("var low = 0, ranged = false, ask = false, cur = 'USD';", "var low = 0, ranged = false, ask = false, cur = 'ILS';")
sub("if (!chosen().length) missing.push('choose a gift');", "if (!chosen().length) missing.push('choose from the menu');")
sub("L.push('Gifts total: ' + totals().text + ', plus delivery');", "L.push('Total: ' + totals().text + ', plus delivery');")
sub("""    L.push('For: ' + v('to') + (v('tophone') ? ', ' + v('tophone') : ''));
    L.push('Address: ' + v('addr') + ', ' + v('city'));""", """    if (v('to')) L.push('For: ' + v('to') + (v('tophone') ? ', ' + v('tophone') : ''));
    L.push('Address: ' + v('addr') + ', ' + v('city') + ', Jerusalem');""")
sub("""    var notes = ['For: ' + v('to') + (v('tophone') ? ', ' + v('tophone') : '')];""", """    var notes = choices().slice();
    if (v('to')) notes.push('For: ' + v('to') + (v('tophone') ? ', ' + v('tophone') : ''));""")
sub("""  update();
  if (add && chosen().length) {""", """  update();
  var bowl = new URLSearchParams(location.search).get('bowl');
  if (bowl && BOWLS[bowl]) products.forEach(function (p) { if (cfg[p._k]) cfg[p._k].forEach(function (c) { if (c.kind === 'bowl') c.bowl = bowl; }); });
  update();
  if (add && chosen().length) {""")
# the choices: drawn under each row, read into the message and the totals
sub("""  function drawCtl(p) {
    var ctl = p._ctl; ctl.textContent = '';
    if (!p.in_stock) return;
    var n = q[p._k] || 0;""", """  // Bowls and gift boxes: one set of choices per unit, kept when the count
  // changes. Bowl: flavour (build your own +6) and exactly two extras
  // (almond butter +5). Gift box: two muffins.
  var BOWLS = { classic: 'Classic', tropical: 'Tropical', sunrise: 'Sunrise', superfruit: 'Superfruit', own: 'Build your own (+₪6)' };
  var EXTRAS = ['Natural peanut butter', 'Silan', 'Honey', 'Pareve chocolate spread', 'Milchig chocolate spread', 'Chia seeds', 'Flax seeds', 'Coconut flakes', 'Almond butter (+₪5)'];
  var MUFFINS = ['Oatmeal chocolate chip', 'Blueberry sourdough'];
  var TOPPINGS = ['Banana', 'Green apple', 'Kiwi', 'Frozen blueberry', 'Frozen mango', 'Frozen pineapple', 'Dates', 'Chocolate chips', 'Super granola'];
  var cfg = {};
  function kindOf(p) { var n = (p.name || '').toLowerCase(); return n === 'acai bowl' ? 'bowl' : /gift box/.test(n) ? 'box' : null; }
  function bowlsIn(p) { return /large gift box/i.test(p.name) ? 2 : /gift box/i.test(p.name) ? 1 : 0; }
  function sync(p) {
    var k = kindOf(p), n = q[p._k] || 0;
    if (!k) return;
    var a = cfg[p._k] || (cfg[p._k] = []);
    while (a.length < n) a.push(k === 'bowl' ? { kind: 'bowl', bowl: 'classic', ex: [], top: [] } : { kind: 'box', muf: [], bowls: Array.from({ length: bowlsIn(p) }, function () { return 'classic'; }) });
    a.length = n;
  }
  function extraCost() {
    var c = 0;
    products.forEach(function (p) { (cfg[p._k] || []).forEach(function (u) { if (u.kind === 'bowl') { if (u.bowl === 'own') c += 6; if (u.ex.indexOf('Almond butter (+₪5)') >= 0) c += 5; } }); });
    return c;
  }
  function choices() {
    var out = [];
    products.forEach(function (p) {
      (cfg[p._k] || []).forEach(function (u, i) {
        if (u.kind === 'bowl') out.push(p.name + ' ' + (i + 1) + ': ' + BOWLS[u.bowl].replace(' (+₪6)', '') + ' bowl' + (u.bowl === 'own' ? ' (' + (u.top.length === 4 ? u.top.join(', ') : 'toppings not chosen yet') + ')' : '') + (u.ex.length ? ', extras: ' + u.ex.join(' and ').replace(/ \\(\\+₪5\\)/, '') : ', extras: not chosen yet'));
        else out.push(p.name + ' ' + (i + 1) + ': ' + (u.bowls.length ? u.bowls.map(function (b) { return BOWLS[b].replace(' (+₪6)', '') + ' bowl'; }).join(' and ') + ', ' : '') + 'muffins: ' + (u.muf.length ? u.muf.join(' and ') : 'not chosen yet'));
      });
    });
    return out;
  }
  function chip(label, on, dis, fn) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'c'; b.textContent = label;
    b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.disabled = !!dis; b.onclick = fn; return b;
  }
  function drawCfg(p) {
    var box = p._cfg; if (!box) return; box.textContent = '';
    (cfg[p._k] || []).forEach(function (u, i) {
      var one = document.createElement('div'); one.className = 'one';
      var t = document.createElement('b'); t.textContent = (u.kind === 'bowl' ? 'Bowl ' : (p.name.replace(/^./, function (c) { return c.toUpperCase(); }) + ' ')) + (i + 1); one.appendChild(t);
      function row(label, items, isOn, dis, fn) {
        var l = document.createElement('p'); l.className = 'lbl'; l.textContent = label; one.appendChild(l);
        var r = document.createElement('div'); r.className = 'row'; r.setAttribute('role', 'group'); r.setAttribute('aria-label', label);
        items.forEach(function (it) { r.appendChild(chip(it[1], isOn(it[0]), dis(it[0]), function () { fn(it[0]); update(); })); });
        one.appendChild(r);
      }
      var bowlItems = Object.keys(BOWLS).map(function (k) { return [k, BOWLS[k]]; });
      if (u.kind === 'bowl') {
        row('Which bowl', bowlItems, function (k) { return u.bowl === k; }, function () { return false; }, function (k) { u.bowl = k; });
        if (u.bowl === 'own') row('Four toppings', TOPPINGS.map(function (e) { return [e, e]; }), function (e) { return u.top.indexOf(e) >= 0; },
          function (e) { return u.top.length >= 4 && u.top.indexOf(e) < 0; },
          function (e) { var j = u.top.indexOf(e); if (j >= 0) u.top.splice(j, 1); else if (u.top.length < 4) u.top.push(e); });
        row('Two extras', EXTRAS.map(function (e) { return [e, e]; }), function (e) { return u.ex.indexOf(e) >= 0; },
          function (e) { return u.ex.length >= 2 && u.ex.indexOf(e) < 0; },
          function (e) { var j = u.ex.indexOf(e); if (j >= 0) u.ex.splice(j, 1); else if (u.ex.length < 2) u.ex.push(e); });
      } else {
        u.bowls.forEach(function (b, j) {
          row(u.bowls.length > 1 ? 'Bowl ' + (j + 1) : 'Which bowl', bowlItems.filter(function (x) { return x[0] !== 'own'; }), function (k) { return u.bowls[j] === k; }, function () { return false; }, function (k) { u.bowls[j] = k; });
        });
        row('Two muffins', [[0, MUFFINS[0] + ' ×2'], [1, MUFFINS[1] + ' ×2'], [2, 'One of each']],
          function (m) { return u.m === m; }, function () { return false; },
          function (m) { u.m = m; u.muf = m === 2 ? [MUFFINS[0], MUFFINS[1]] : [MUFFINS[m], MUFFINS[m]]; });
      }
      box.appendChild(one);
    });
  }

  function drawCtl(p) {
    sync(p); drawCfg(p);
    var ctl = p._ctl; ctl.textContent = '';
    if (!p.in_stock) return;
    var n = q[p._k] || 0;""")
sub("""      li.appendChild(ph); li.appendChild(mid); li.appendChild(ctl);
      ul.appendChild(li);
      p._li = li; p._ctl = ctl;""", """      li.appendChild(ph); li.appendChild(mid); li.appendChild(ctl);
      if (kindOf(p)) { var cf = document.createElement('div'); cf.className = 'cfg'; li.appendChild(cf); p._cfg = cf; }
      ul.appendChild(li);
      p._li = li; p._ctl = ctl;""")
# mini bowls: at least 8
sub("""      a.onclick = function () { q[p._k] = 1; update();""", """      a.onclick = function () { q[p._k] = min(p); update();""")
sub("""    minus.onclick = function () { q[p._k] = n - 1; if (!q[p._k]) delete q[p._k]; update(); };""", """    minus.onclick = function () { q[p._k] = n - 1 < min(p) ? 0 : n - 1; if (!q[p._k]) delete q[p._k]; update(); };""")
sub("""  var chosen = function () {""", """  function min(p) { return /mini/i.test(p.name) ? 8 : 1; }
  var chosen = function () {""")
sub("""    plus.disabled = n >= 20;""", """    plus.disabled = n >= 40;""")
sub("""    return { text: (ranged ? 'from ' : '') + money(low, cur) + (ask ? ' + price on request' : ''), low: low, cur: cur };""", """    low += extraCost();
    return { text: (ranged ? 'from ' : '') + money(low, cur) + (ask ? ' + price on request' : ''), low: low, cur: cur };""")
sub("""    L.push('Total: ' + totals().text + ', plus delivery');""", """    choices().forEach(function (c) { L.push('   ' + c); });
    L.push('Total: ' + totals().text + ', plus delivery');""")
# missing choices block sending, said plainly
sub("""    if (!chosen().length) missing.push('choose from the menu');""", """    if (!chosen().length) missing.push('choose from the menu');
    if (choices().some(function (c) { return /not chosen yet/.test(c); })) missing.push('the toppings, extras and muffins for each bowl and box');""")
# ?add= mini bowls start at 8
sub("""if (add && p.in_stock && p.name === add && q[i] == null) q[i] = 1; });""", """if (add && p.in_stock && p.name.toLowerCase() === add.toLowerCase() && q[i] == null) q[i] = /mini/i.test(p.name) ? 8 : 1; });""")
# the summary shows what the add-ons cost, so its lines add up to the total
sub("""    var t = totals().text;
    document.getElementById('total').textContent = t;""", """    if (extraCost() > 0) {
      var xl = document.createElement('li'); var xa = document.createElement('span'); xa.textContent = 'Build your own and almond butter';
      var xb = document.createElement('span'); xb.textContent = '+' + money(extraCost(), 'ILS'); xl.appendChild(xa); xl.appendChild(xb); lines.appendChild(xl);
    }
    var t = totals().text;
    document.getElementById('total').textContent = t;""")
sub(".sum .saved { margin: .8rem 0 0; color: var(--on-night-soft); font-size: .85rem; }", ".sum .saved { margin: .8rem 0 0; color: var(--on-night-soft); font-size: .9rem; }")
io.open('gen/order-src.html', 'w', encoding='utf8', newline='').write(s)
print('order-src.html written')
