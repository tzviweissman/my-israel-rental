(function () {
  var BIN = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var KR = window.KR, ITEMS = KR.ITEMS;
  // The order is written out on WhatsApp to +972 53-485-7841 (her listing). Prices from her listing (site.js holds the menu).
  var WA = '972534857841', GIG = 'a0b6c98c-011c-4c2e-a09e-e7ff646c81eb';
  var API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:8001/api' : '/api';
  var DESC = 'A deluxe peanut chew board, made at home in Jerusalem.';
  ITEMS.luxe.desc = DESC; ITEMS.luxe.img = 'luxe';
  var saved = window.siteBasket.get(), q = {};
  Object.keys(saved).forEach(function (k) { if (ITEMS[k]) q[k] = Math.max(0, Math.min(20, +saved[k] || 0)); });
  var sel = 'luxe', n = 1, step = 1;
  var stage = document.getElementById('items'), stN = document.getElementById('st-n'), stAdd = document.getElementById('st-add'), stIn = document.getElementById('st-in');
  var phWrap = document.getElementById('st-ph'), pick = document.getElementById('st-pick');
  function money(x) { return '$' + x; }
  function photo() { [].forEach.call(phWrap.querySelectorAll('img'), function (i) { i.classList.toggle('on', i.dataset.p === sel); }); }
  function label() {
    var it = ITEMS[sel], u = it.price;
    stAdd.disabled = !!it.out;
    stAdd.lastElementChild.textContent = it.out ? 'Out of stock' : 'Add' + (n > 1 ? ' ' + n : '') + ', ' + money(n * u); stN.textContent = n;
    stIn.textContent = q[sel] ? 'In your basket: ' + q[sel] + ' × ' + it.one : '';
    stAdd.setAttribute('aria-label', it.out ? it.name + ' is out of stock' : 'Add ' + n + ' × ' + it.one + ' to your order, ' + money(n * u));
  }
  function show(k) {
    sel = k; n = 1; photo();
    [].forEach.call(pick.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', b.dataset.p === k ? 'true' : 'false'); });
    document.getElementById('st-name').textContent = ITEMS[k].name; document.getElementById('st-desc').textContent = ITEMS[k].desc || '';
    document.getElementById('st-price').innerHTML = '<span class="sym">$</span>' + ITEMS[k].price;
    label();
  }
  pick.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) show(b.dataset.p); });
  stage.querySelector('.st-buy .step').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; n = Math.max(1, Math.min(20, n + (+b.dataset.d))); label(); });
  stAdd.addEventListener('click', function () {
    var a = n, k = sel; q[k] = Math.min(20, (q[k] || 0) + n); n = 1; update(); check(false); label();
    window.siteToast('Added: ' + a + ' × ' + ITEMS[k].one); stAdd.classList.add('added'); setTimeout(function () { stAdd.classList.remove('added'); }, 900);
  });

  // more products she adds to her shop show here by themselves: a photo, a name, a price and Add
  function loadShop() {
    fetch(API + '/marketplace/order-form/' + GIG).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      var ps = (j && j.products) || []; if (!ps.length) return;
      ps.forEach(function (p) {
        if (!p.id || !p.name || !(+p.price > 0) || (p.currency && p.currency !== 'USD')) return;
        if (p.id === ITEMS.luxe.id) { ITEMS.luxe.out = p.in_stock === false; return; }
        ITEMS[p.id] = { id: p.id, name: p.name, one: p.name, price: +p.price, desc: p.description || '', out: p.in_stock === false };
        if (p.image) { var im = document.createElement('img'); im.dataset.p = p.id; im.src = p.image; im.alt = p.name; im.width = 1448; im.height = 1086; im.loading = 'lazy'; phWrap.appendChild(im); }
        var b = document.createElement('button'); b.type = 'button'; b.className = 'chipb'; b.dataset.p = p.id; b.setAttribute('aria-pressed', 'false'); b.textContent = p.name; pick.appendChild(b);
      });
      pick.hidden = pick.children.length < 2; update(); label();
    }).catch(function () {});
  }

  function total() { var t = 0; for (var k in q) t += q[k] * KR.unit(k); return t; }
  var send = document.getElementById('send');
  function update() {
    var html = '', mini = '';
    for (var k in q) if (q[k]) {
      var nm = ITEMS[k].one;
      html += '<li class="bl"><span>' + nm + '<span class="step sm"><button type="button" data-k="' + k + '" data-d="-1" aria-label="One fewer ' + nm + '">−</button><output>' + q[k] + '</output><button type="button" data-k="' + k + '" data-d="1" aria-label="One more ' + nm + '">+</button></span></span><span class="bl-r">' + money(q[k] * KR.unit(k)) + '<button type="button" class="rm" data-rm="' + k + '" aria-label="Remove ' + nm + ' from the basket">' + BIN + '</button></span></li>';
      mini += '<li><span>' + q[k] + ' × ' + nm + '</span><span>' + money(q[k] * KR.unit(k)) + '</span></li>';
    }
    document.getElementById('sum-list').innerHTML = html || '<li><span>Your basket is empty. Add a board above.</span></li>';
    document.getElementById('sum-mini').innerHTML = mini || '<li><span>Nothing yet</span></li>';
    document.getElementById('total').textContent = money(total());
    var s = {}; for (var k2 in q) if (q[k2]) s[k2] = q[k2]; window.siteBasket.set(s);
    var bb = document.querySelector('#bar .btn'); if (bb) bb.setAttribute('href', '#order');
    drawStep();
  }
  function v(id) { return document.getElementById(id).value.trim(); }
  function mark(id, msg) { var w = document.getElementById('w-' + id) || document.getElementById('c-' + id); if (w) w.classList.toggle('bad', !!msg); document.getElementById('e-' + id).textContent = msg || ''; }
  var today = new Date(), minDay = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  document.getElementById('when').min = minDay;
  // arrives filled in (rules 3k.8): tomorrow, the first day we can promise while her lead time is unknown (OWNER-QUESTIONS 6); a pick is never overwritten
  if (!document.getElementById('when').value) { var tm = new Date(today.getTime() - today.getTimezoneOffset() * 60000 + 864e5); document.getElementById('when').value = tm.toISOString().slice(0, 10); }
  var firstDay = document.getElementById('when').value || minDay;
  function nextDay() {
    var el = document.getElementById('e-when'), d = new Date(firstDay + 'T12:00');
    el.textContent = 'That day has passed. The first day we can do is ' + d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }) + '. ';
    var b = document.createElement('button'); b.type = 'button'; b.className = 'lnk'; b.textContent = 'Choose ' + d.toLocaleDateString('en-GB', { weekday: 'long' });
    b.addEventListener('click', function () { var w = document.getElementById('when'); w.value = firstDay; w.dispatchEvent(new Event('input')); w.focus(); });
    el.appendChild(b);
  }
  function check(show, upto) {
    var ok = true, e; upto = upto || 3;
    e = total() ? '' : 'Add a board to your basket'; if (e) ok = false; if (show || !e) mark('items', e);
    if (upto < 2) return ok;
    e = !v('when') ? 'Choose a day' : v('when') < firstDay ? 'That day has passed.' : ''; if (e) ok = false; if (show || !e) mark('when', e);
    if (e && (show || !e) && v('when')) nextDay();   // rules 3u.2: say so and offer the first day we can do, never change the pick quietly
    if (upto < 3) return ok;
    e = v('me') ? '' : 'Your name, please'; if (e) ok = false; if (show || !e) mark('me', e);
    e = /\d{9,}/.test(v('ph').replace(/\D/g, '')) ? '' : 'A phone number we can reach you on'; if (e) ok = false; if (show || !e) mark('ph', e);
    return ok;
  }
  ['when', 'me', 'ph'].forEach(function (id) { document.getElementById(id).addEventListener('input', function () { check(false); drawStep(); }); });
  var note = document.getElementById('note');
  note.addEventListener('input', function () { var cs = getComputedStyle(note), lh = parseFloat(cs.lineHeight) || 22, bd = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth), ex = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + bd; note.style.height = 'auto'; note.style.height = Math.min(note.scrollHeight + bd, 4 * lh + ex) + 'px'; });
  function dayName(opt) { return new Date(v('when') + 'T12:00').toLocaleDateString('en-GB', opt); }
  var sending = false;
  function itemised() { var out = []; for (var k in q) if (q[k]) out.push('• ' + q[k] + ' × ' + ITEMS[k].one + ' (' + money(q[k] * KR.unit(k)) + ')'); return out; }
  // saved first (rules 3k): the order reaches her dashboard and the customer gets a tracking link; how it is collected is agreed on WhatsApp
  function save(notes) {
    var ls = []; for (var k in q) if (q[k]) ls.push({ product_id: ITEMS[k].id, qty: q[k] });
    var post = fetch(API + '/marketplace/order-form/' + GIG + '/orders', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lines: ls, fulfilment: 'pickup', date: v('when'), customer_name: v('me'), customer_phone: v('ph'), notes: notes }) })
      .then(function (r) { return r.json().then(function (j) { return r.ok ? j : null; }, function () { return null; }); }).catch(function () { return null; });
    return Promise.race([post, new Promise(function (res) { setTimeout(function () { res(null); }, 5000); })]);
  }
  document.getElementById('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    if (step < 3) { if (!check(true, step)) { var bad1 = document.querySelector('.ostep:not([hidden]) .bad .fld'); if (bad1) bad1.focus(); return; } go(step + 1, true); return; }
    if (!check(true)) { for (var s1 = 1; s1 <= 3; s1++) if (!check(false, s1)) { check(true, s1); go(s1, true); break; } var bad = document.querySelector('.ostep:not([hidden]) .bad .fld'); if (bad) bad.focus(); return; }
    var out = ['Hi Krysp, I would like to order:'].concat(itemised());
    out.push('Total: ' + money(total()));
    out.push('Preferred day: ' + dayName({ weekday: 'long', day: 'numeric', month: 'long' }));
    if (v('note')) out.push('Note: ' + v('note'));
    out.push('Name: ' + v('me') + ', ' + v('ph'));
    var text = out.join('\n'), notes = itemised().concat(['Preferred day: ' + v('when'), v('note'), 'How it is collected or delivered: to be agreed on WhatsApp', 'Sent from the Krysp page by WhatsApp']).filter(Boolean).join('\n');
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
  var STEP_BTN = ['', 'Continue to when and where', 'Continue to your details', ''], STEP_NOTE = ['', 'Next: the day you would like and a note.', 'Next: your name and phone.', 'Opens WhatsApp with your order written out, to send to Krysp.'];
  function drawStep() {
    [].forEach.call(document.querySelectorAll('.ostep'), function (el) { el.hidden = +el.dataset.s !== step; });
    [].forEach.call(document.querySelectorAll('#steps li'), function (li, i) { li.className = i + 1 < step ? 'is-done' : i + 1 === step ? 'is-now' : ''; if (i + 1 === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
    var day = v('when') ? dayName({ weekday: 'long' }) : '';
    send.lastElementChild.textContent = step < 3 ? STEP_BTN[step] : (total() ? (day ? 'Send for ' + day : 'Send order on WhatsApp') + ', ' + money(total()) : 'Send order on WhatsApp');
    send.classList.toggle('idle', !check(false, step));
    document.getElementById('send-note').textContent = STEP_NOTE[step];
    document.getElementById('back').hidden = step === 1;
    var where = document.getElementById('sum-where'); where.hidden = step < 3 || !v('when');
    if (!where.hidden) where.textContent = 'Preferred day: ' + dayName({ weekday: 'short', day: 'numeric', month: 'short' });
  }
  function go(s, push) {
    if (s > 1 && !check(false, s - 1)) s = 1; if (s > 2 && !check(false, 2)) s = 2;
    step = s; drawStep();
    if (push) { history.pushState({ step: s }, '', s === 1 ? '#order' : '#order-' + s); document.getElementById('order').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); var f = document.querySelector('.ostep:not([hidden]) .fld'); if (f && s > 1) setTimeout(function () { f.focus({ preventScroll: true }); }, 350); }
  }
  addEventListener('popstate', function () { var m = /#order-(\d)/.exec(location.hash); go(m ? +m[1] : 1, false); });
  document.getElementById('back').addEventListener('click', function () { history.back(); });
  document.getElementById('steps').addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b && +b.dataset.go < step) go(+b.dataset.go, true); });
  pick.hidden = true;
  show('luxe'); update(); loadShop();
  // a link from the home page's board tile (?add=Luxe) puts that board in the basket
  var want = new URLSearchParams(location.search).get('add');
  if (want) Object.keys(ITEMS).forEach(function (k) { if (ITEMS[k].name.toLowerCase() === want.toLowerCase() && !ITEMS[k].out) { q[k] = Math.max(q[k] || 0, 1); show(k); update(); } });
  var m0 = /#order-(\d)/.exec(location.hash); if (m0) go(+m0[1], false);
})();
