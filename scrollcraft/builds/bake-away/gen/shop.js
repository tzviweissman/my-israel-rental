(function () {
  var BIN = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var BA = window.BA, ITEMS = BA.ITEMS;
  // The order is written out on WhatsApp to +972 58-323-3995 (her card). Prices from her listing (site.js holds the menu).
  var WA = '972583233995', GIG = '4bfcede3-77c9-4a4a-8848-99afc8f55970';
  var API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:8001/api' : '/api';
  // her shop products, loaded 28 Oct 2026 by gen/catalog/load_products.py (fixed ids)
  var PID = { dn: 'badoughnut01', cream: 'bacreamdn001', diy: 'badiykit0001', tray: 'batraycake01', challah: 'bachallah001', buns: 'bacinnabun01', cakes: 'bacake000001', mini: 'baminichee01', cheese: 'bacheesecak1', babka: 'babakba00001' };
  var INFO = {
    dn: { desc: 'Glazed doughnuts, milky or parve. Choose the kind and the flavour.', img: 'dn' },
    cream: { desc: 'A very wide variety of doughnuts.', img: 'cream' },
    diy: { desc: '8 mini cake doughnuts, icings and topping.' }, tray: { desc: '24 pieces of cake.' }, challah: { desc: 'Baked at home.' },
    buns: { desc: '6 cinnamon buns.' }, cakes: { desc: 'Marble, honey or mocca. Choose your cake.' }, mini: { desc: '12 no-bake mini cheesecakes.' },
    cheese: { desc: 'A variety of cheesecakes with chocolate, caramel and more.' }, babka: { desc: 'Baked at home.' }
  };
  var CAKES = [['marble', 'Marble'], ['honey', 'Honey'], ['mocca', 'Mocca']];
  var saved = window.siteBasket.get(), q = {};
  Object.keys(saved).forEach(function (k) { if (ITEMS[k.split('~')[0]]) q[k] = Math.max(0, Math.min(20, +saved[k] || 0)); });
  var sel = 'dn', pick = { kind: 'milky', fl: 'p05', cake: 'marble' }, n = 1, step = 1;
  var stage = document.getElementById('items'), stN = document.getElementById('st-n'), stAdd = document.getElementById('st-add'), stIn = document.getElementById('st-in'), opts = document.getElementById('st-opts');
  var imgs = [].slice.call(document.querySelectorAll('#st-ph > img'));
  function money(x) { return '₪' + x; }
  function key() { return sel === 'dn' ? 'dn~' + pick.kind + '~' + pick.fl : sel === 'cakes' ? 'cakes~' + pick.cake : sel; }
  function photo() {
    var want = sel === 'dn' ? 'dn:' + pick.fl : sel;
    imgs.forEach(function (i) { i.classList.toggle('on', i.dataset.p === 'dn' ? want === 'dn:' + i.dataset.f : i.dataset.p === want); });
  }
  function label() {
    var u = ITEMS[sel].price;
    stAdd.lastElementChild.textContent = 'Add' + (n > 1 ? ' ' + n : '') + ', ' + money(n * u); stN.textContent = n;
    stIn.textContent = q[key()] ? 'In your basket: ' + q[key()] + ' × ' + BA.label(key()) : '';
    stAdd.setAttribute('aria-label', 'Add ' + n + ' × ' + BA.label(key()) + ' to your order, ' + money(n * u));
  }
  function drawOpts() {
    var h = '';
    if (sel === 'dn') {
      h += '<div class="g"><p class="grp-l" id="o-k">Milky or parve</p><div class="seg" role="group" aria-labelledby="o-k">' +
        ['milky', 'parve'].map(function (k) { return '<button type="button" data-o="kind" data-v="' + k + '" aria-pressed="' + (pick.kind === k) + '">' + (k === 'milky' ? 'Milky' : 'Parve') + '</button>'; }).join('') + '</div></div>';
      h += '<div class="g"><p class="grp-l" id="o-f">Flavour</p><div class="fl" role="group" aria-labelledby="o-f">' +
        BA.FL.map(function (f) { return '<button type="button" data-o="fl" data-v="' + f[0] + '" aria-pressed="' + (pick.fl === f[0]) + '" aria-label="' + f[1] + '"><img src="assets/dn-' + f[0] + '.webp" alt="" width="62" height="52"></button>'; }).join('') + '</div><p class="fl-n" id="fl-n">' + BA.flavour(pick.fl) + '</p></div>';
    } else if (sel === 'cakes') {
      h += '<div class="g"><p class="grp-l" id="o-c">Flavour</p><div class="seg" role="group" aria-labelledby="o-c">' +
        CAKES.map(function (c) { return '<button type="button" data-o="cake" data-v="' + c[0] + '" aria-pressed="' + (pick.cake === c[0]) + '">' + c[1] + '</button>'; }).join('') + '</div></div>';
    } else h = '<p class="none">Nothing to choose here.</p>';
    opts.innerHTML = h;
  }
  function show(k) {
    sel = k; n = 1; photo(); drawOpts();
    [].forEach.call(document.querySelectorAll('#st-pick button'), function (b) { b.setAttribute('aria-pressed', b.dataset.p === k ? 'true' : 'false'); });
    document.getElementById('st-name').textContent = ITEMS[k].name; document.getElementById('st-desc').textContent = INFO[k].desc;
    document.getElementById('st-price').innerHTML = '<span class="sym">₪</span>' + ITEMS[k].price;
    label();
  }
  document.getElementById('st-pick').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) show(b.dataset.p); });
  opts.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-o]'); if (!b) return;
    pick[b.dataset.o] = b.dataset.v; n = 1;
    [].forEach.call(opts.querySelectorAll('button[data-o="' + b.dataset.o + '"]'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    var fn = document.getElementById('fl-n'); if (fn) fn.textContent = BA.flavour(pick.fl);
    photo(); label();
  });
  stage.querySelector('.st-buy .step').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; n = Math.max(1, Math.min(20, n + (+b.dataset.d))); label(); });
  stAdd.addEventListener('click', function () {
    var a = n, k = key(); q[k] = Math.min(20, (q[k] || 0) + n); n = 1; update(); check(false); label();
    window.siteToast('Added: ' + a + ' × ' + BA.label(k)); stAdd.classList.add('added'); setTimeout(function () { stAdd.classList.remove('added'); }, 900);
  });
  // delivery is in Jerusalem and more and its fee is not known, so it is confirmed on WhatsApp and never added to the total
  function pickup() { return document.querySelector('input[name=ful]:checked').value === 'pickup'; }
  function total() { var t = 0; for (var k in q) t += q[k] * BA.unit(k); return t; }
  var send = document.getElementById('send');
  function update() {
    var html = '', mini = '';
    for (var k in q) if (q[k]) {
      var nm = BA.label(k);
      html += '<li class="bl"><span>' + nm + '<span class="step sm"><button type="button" data-k="' + k + '" data-d="-1" aria-label="One fewer ' + nm + '">−</button><output>' + q[k] + '</output><button type="button" data-k="' + k + '" data-d="1" aria-label="One more ' + nm + '">+</button></span></span><span class="bl-r">' + money(q[k] * BA.unit(k)) + '<button type="button" class="rm" data-rm="' + k + '" aria-label="Remove ' + nm + ' from the basket">' + BIN + '</button></span></li>';
      mini += '<li><span>' + q[k] + ' × ' + nm + '</span><span>' + money(q[k] * BA.unit(k)) + '</span></li>';
    }
    document.getElementById('sum-list').innerHTML = html || '<li><span>Your basket is empty. Pick a bake above.</span></li>';
    if (total() && !pickup()) mini += '<li><span>Delivery</span><span>fee confirmed on WhatsApp</span></li>';
    document.getElementById('sum-mini').innerHTML = mini || '<li><span>Nothing yet</span></li>';
    document.getElementById('total').textContent = money(total());
    var s = {}; for (var k2 in q) if (q[k2]) s[k2] = q[k2]; window.siteBasket.set(s);
    var bb = document.querySelector('#bar .btn'); if (bb) { bb.textContent = 'Order'; bb.setAttribute('href', '#order'); }
    drawStep();
  }
  function v(id) { return document.getElementById(id).value.trim(); }
  function mark(id, msg) { var w = document.getElementById('w-' + id) || document.getElementById('c-' + id); if (w) w.classList.toggle('bad', !!msg); document.getElementById('e-' + id).textContent = msg || ''; }
  // Shabbat and holidays (she ticks "closed for Shabbat"): the server refuses a delivery whose midday falls inside a closure, so the same days
  // are refused here. The closures come from the order form; if they cannot be loaded, Saturdays are still refused.
  var closures = [], loaded = false;
  function loadClosures() { loaded = true; fetch(API + '/marketplace/order-form/' + GIG).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    var sc = j && j.business && j.business.shabbat_closing; closures = (sc && sc.closures) || []; check(false); drawStep();
  }).catch(function () {}); }
  function closedDay(iso) {
    if (!iso) return false;
    if (new Date(iso + 'T12:00').getDay() === 6) return true;
    return closures.some(function (c) {
      var sd = c.start.slice(0, 10), st = c.start.slice(11, 16), ed = c.end.slice(0, 10), et = c.end.slice(11, 16);
      return (sd < iso || (sd === iso && st <= '12:00')) && (iso < ed || (iso === ed && et > '12:00'));
    });
  }
  var CLOSED = 'Closed for Shabbat or a holiday. Choose another day.';
  // she asks for 24 to 48 hours: the earliest day is the one 24 hours from now
  var earliest = new Date(Date.now() + 864e5), minDay = new Date(earliest.getTime() - earliest.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  document.getElementById('when').min = minDay;
  function check(show, upto) {
    var ok = true, e; upto = upto || 3;
    e = total() ? '' : 'Add a bake to your basket'; if (e) ok = false; if (show || !e) mark('items', e);
    if (upto < 2) return ok;
    e = pickup() || v('addr') ? '' : 'Where should we deliver?'; if (e) ok = false; if (show || !e) mark('addr', e);
    e = !v('when') ? 'Choose the day' : v('when') < minDay ? 'Please order at least 24 hours ahead' : closedDay(v('when')) ? CLOSED : ''; if (e) ok = false; if (show || !e || closedDay(v('when'))) mark('when', e);
    if (upto < 3) return ok;
    e = v('me') ? '' : 'Your name, please'; if (e) ok = false; if (show || !e) mark('me', e);
    e = /\d{9,}/.test(v('ph').replace(/\D/g, '')) ? '' : 'A phone number we can reach you on'; if (e) ok = false; if (show || !e) mark('ph', e);
    return ok;
  }
  ['addr', 'when', 'me', 'ph'].forEach(function (id) { document.getElementById(id).addEventListener('input', function () { check(false); drawStep(); }); });
  var note = document.getElementById('note');
  note.addEventListener('input', function () { var cs = getComputedStyle(note), lh = parseFloat(cs.lineHeight) || 22, bd = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth), ex = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + bd; note.style.height = 'auto'; note.style.height = Math.min(note.scrollHeight + bd, 4 * lh + ex) + 'px'; });
  function dayName(opt) { return new Date(v('when') + 'T12:00').toLocaleDateString('en-GB', opt); }
  [].forEach.call(document.querySelectorAll('input[name=ful]'), function (i) { i.addEventListener('change', function () { update(); }); });
  var sending = false;
  function itemised() { var out = []; for (var k in q) if (q[k]) out.push('• ' + q[k] + ' × ' + BA.label(k) + ' (' + money(q[k] * BA.unit(k)) + ')'); return out; }
  function save(notes) {
    var ls = []; for (var k in q) if (q[k]) ls.push({ product_id: PID[k.split('~')[0]], qty: q[k] });
    var post = fetch(API + '/marketplace/order-form/' + GIG + '/orders', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lines: ls, fulfilment: pickup() ? 'pickup' : 'delivery', city: pickup() ? undefined : 'jerusalem', address: pickup() ? undefined : v('addr'), date: v('when'), customer_name: v('me'), customer_phone: v('ph'), notes: notes }) })
      .then(function (r) { return r.json().then(function (j) { return r.ok ? j : null; }, function () { return null; }); }).catch(function () { return null; });
    return Promise.race([post, new Promise(function (res) { setTimeout(function () { res(null); }, 5000); })]);
  }
  document.getElementById('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    if (step < 3) { if (!check(true, step)) { var bad1 = document.querySelector('.ostep:not([hidden]) .bad .fld'); if (bad1) bad1.focus(); return; } go(step + 1, true); return; }
    if (!check(true)) { for (var s1 = 1; s1 <= 3; s1++) if (!check(false, s1)) { check(true, s1); go(s1, true); break; } var bad = document.querySelector('.ostep:not([hidden]) .bad .fld'); if (bad) bad.focus(); return; }
    var out = ['Hi Bake away, I would like to order:'].concat(itemised());
    if (v('note')) out.push('Notes: ' + v('note'));
    out.push('Total: ' + money(total()) + (pickup() ? '' : ' (delivery fee to be confirmed)'));
    if (pickup()) { out.push('Pickup (please send me the address)'); out.push('Pickup day: ' + dayName({ weekday: 'long', day: 'numeric', month: 'long' })); }
    else { out.push('Delivery to: ' + v('addr')); out.push('Delivery day: ' + dayName({ weekday: 'long', day: 'numeric', month: 'long' })); }
    out.push('Name: ' + v('me') + ', ' + v('ph'));
    var text = out.join('\n'), notes = itemised().concat([v('note'), 'Sent from the Bake away page by WhatsApp']).filter(Boolean).join('\n');
    sending = true; send.setAttribute('aria-busy', 'true');
    var tab = window.open('', '_blank');
    save(notes).then(function (saved) {   // saved first (rules 3k); if saving fails WhatsApp still opens
      if (saved && saved.track_url) text += '\n\nFollow the order: ' + saved.track_url;
      var url = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text);
      if (tab) tab.location.href = url; else location.href = url;
      sending = false; send.removeAttribute('aria-busy');
      var first = v('me').split(/\s+/)[0], sent = document.getElementById('sent'); sent.textContent = 'Thanks, ' + first + '. Your order is open in WhatsApp. Send the message there so we get it.'; sent.hidden = false;
    });
  });
  document.getElementById('sum-list').addEventListener('click', function (e) {
    var r = e.target.closest('button[data-rm]'); if (r) { q[r.dataset.rm] = 0; update(); check(false); label(); return; }
    var b = e.target.closest('button[data-k]'); if (!b) return; q[b.dataset.k] = Math.max(0, Math.min(20, q[b.dataset.k] + (+b.dataset.d))); update(); check(false); label();
  });
  // the steps: one screen each; the browser's back button goes back a step (#order, #order-2, #order-3)
  var STEP_BTN = ['', 'Continue to delivery or pickup', 'Continue to your details', ''], STEP_NOTE = ['', 'Next: delivery or pickup, and the day.', 'Next: your name and phone.', 'Opens WhatsApp with your order written out, to send to Bake away.'];
  function drawStep() {
    if (step > 1 && !loaded) loadClosures();
    [].forEach.call(document.querySelectorAll('.ostep'), function (el) { el.hidden = +el.dataset.s !== step; });
    [].forEach.call(document.querySelectorAll('#steps li'), function (li, i) { li.className = i + 1 < step ? 'is-done' : i + 1 === step ? 'is-now' : ''; if (i + 1 === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
    var pk = pickup(); document.getElementById('w-addr').hidden = pk; document.getElementById('h-pick').hidden = !pk; document.getElementById('when-l').textContent = pk ? 'Pickup day' : 'Delivery day';
    var day = v('when') ? dayName({ weekday: 'long' }) : '';
    send.lastElementChild.textContent = step < 3 ? STEP_BTN[step] : (total() ? (day ? 'Send for ' + day : 'Send order on WhatsApp') + ', ' + money(total()) : 'Send order on WhatsApp');
    send.classList.toggle('idle', !check(false, step));
    document.getElementById('send-note').textContent = STEP_NOTE[step];
    document.getElementById('back').hidden = step === 1;
    var where = document.getElementById('sum-where'); where.hidden = step < 3 || (!pickup() && !v('addr'));
    if (!where.hidden) where.textContent = (pickup() ? 'Pickup' : 'To ' + v('addr')) + (v('when') ? ', ' + dayName({ weekday: 'short', day: 'numeric', month: 'short' }) : '');
  }
  function go(s, push) {
    if (s > 1 && !check(false, s - 1)) s = 1; if (s > 2 && !check(false, 2)) s = 2;
    step = s; drawStep();
    if (push) { history.pushState({ step: s }, '', s === 1 ? '#order' : '#order-' + s); document.getElementById('order').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); var f = document.querySelector('.ostep:not([hidden]) .fld'); if (f && s > 1) setTimeout(function () { f.focus({ preventScroll: true }); }, 350); }
  }
  addEventListener('popstate', function () { var m = /#order-(\d)/.exec(location.hash); go(m ? +m[1] : 1, false); });
  document.getElementById('back').addEventListener('click', function () { history.back(); });
  document.getElementById('steps').addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b && +b.dataset.go < step) go(+b.dataset.go, true); });
  var qs = new URLSearchParams(location.search);
  show(INFO[qs.get('item')] ? qs.get('item') : 'dn'); update();
  var m0 = /#order-(\d)/.exec(location.hash); if (m0) go(+m0[1], false);
})();
