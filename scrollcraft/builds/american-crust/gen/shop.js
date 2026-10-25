(function () {
  var BIN = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  // The order is written out on WhatsApp to +1 732 503 1703 (their flyer). Two doughs, prices from their listing.
  var WA = '17325031703', GIG = '4ed30fc8-206a-42bd-85d9-36067c442350';
  var API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:8001/api' : '/api';
  var P = {
    bagel: { id: 'c071ddf18cff', name: 'American style bagel dough', sub: '6 pre shaped bagels', full: 'American style bagel dough, 6 pre shaped bagels', price: 30, makes: 'Makes 6 bagels', per: 6,
      desc: 'Make fresh American tasting bagels straight from your home. Just follow our simple instructions and enjoy.', room: 'bagel', use: 'bagel-use', useImg: 'assets/baked-bagels.webp', useLabel: 'Show everything bagels', one: 'bagel dough' },
    pizza: { id: 'f0651cac7342', name: 'Classic American pizza dough', sub: '100% parve', full: 'Classic American pizza dough, 100% parve', price: 27, makes: 'Makes 2 personal pies (500 g)', per: 2,
      desc: 'Meat pizza or classic American pie, this dough is sure to impress.', room: 'pizza', use: 'pizza-use', useImg: 'assets/pizza-tubs.webp', useLabel: 'Show the tubs in a row', one: 'pizza dough' }
  };
  var saved = window.siteBasket.get(), q = {};
  Object.keys(P).forEach(function (k) { q[k] = Math.max(0, Math.min(20, +saved[k] || 0)); });
  var sel = 'bagel', n = 1, step = 1;
  var stage = document.getElementById('doughs'), stN = document.getElementById('st-n'), stAdd = document.getElementById('st-add'), stIn = document.getElementById('st-in');
  var useBtn = document.getElementById('st-use'), useImg = document.getElementById('st-use-img'), imgs = stage.querySelectorAll('.st-ph > img[data-p]'), using = false;
  function money(x) { return '₪' + x; }
  function label() { stAdd.lastElementChild.textContent = 'Add' + (n > 1 ? ' ' + n : '') + ', ' + money(n * P[sel].price); stN.textContent = n; stIn.textContent = q[sel] ? 'In your basket: ' + q[sel] + ' × ' + P[sel].name : ''; }
  function photo() { var want = using ? P[sel].use : sel; [].forEach.call(imgs, function (i) { i.classList.toggle('on', i.dataset.p === want); }); }
  function show(k) {
    sel = k; n = 1; using = false; stage.dataset.room = P[k].room; photo();
    useBtn.setAttribute('aria-label', P[k].useLabel); useImg.src = P[k].useImg;
    [].forEach.call(stage.querySelectorAll('.st-pick button'), function (b) { b.setAttribute('aria-pressed', b.dataset.p === k ? 'true' : 'false'); });
    document.getElementById('st-name').textContent = P[k].name; document.getElementById('st-sub').textContent = P[k].sub; document.getElementById('st-desc').textContent = P[k].desc;
    document.getElementById('st-price').innerHTML = '<span class="sym">₪</span>' + P[k].price;
    document.getElementById('st-makes').textContent = P[k].makes;
    [].forEach.call(stage.querySelectorAll('[data-for]'), function (li) { li.style.visibility = li.dataset.for === k ? '' : 'hidden'; li.setAttribute('aria-hidden', li.dataset.for === k ? 'false' : 'true'); });   // hidden, not removed, so the page below never moves   // Premium quality and Fresh and ready to use are on the pizza flyer only
    label();
  }
  stage.querySelector('.st-pick').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) show(b.dataset.p); });
  useBtn.addEventListener('click', function () {   // an action button whose label says what happens next (no pressed state)
    using = !using; photo();
    useBtn.setAttribute('aria-label', using ? 'Show the dough' : P[sel].useLabel); useImg.src = using ? (sel === 'bagel' ? 'assets/bagel-dough.webp' : 'assets/pizza-dough.webp') : P[sel].useImg;
  });
  stage.querySelector('.st-buy .step').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; n = Math.max(1, Math.min(20, n + (+b.dataset.d))); label(); });
  stAdd.addEventListener('click', function () {
    var a = n; q[sel] = Math.min(20, q[sel] + n); n = 1; update(); check(false); label();
    window.siteToast('Added: ' + a + ' × ' + P[sel].name); stAdd.classList.add('added'); setTimeout(function () { stAdd.classList.remove('added'); }, 900);
  });
  // Tzvi 22 Oct: delivery is 25 shekels in Ramat Eshkol and surrounding areas, and the server adds it to every delivery order; further away the fee is confirmed on WhatsApp
  var DEL = 25, farEl = document.getElementById('far');
  function far() { return farEl.checked; }
  function pick() { return document.querySelector('input[name=ful]:checked').value === 'pickup'; }
  function fee() { return total() && !pick() && !far() ? DEL : 0; }
  function grand() { return total() + fee(); }
  function total() { var t = 0; for (var k in q) t += q[k] * P[k].price; return t; }
  function bakes() {
    var b = q.bagel * P.bagel.per, p = q.pizza * P.pizza.per, parts = [];
    if (b) parts.push(b + ' bagels'); if (p) parts.push(p + ' personal pies');   // the basket counts what you will bake, from their own "6 bagels" and "2 personal pies"
    return parts.length ? 'Your basket bakes ' + parts.join(' and ') + '.' : '';
  }
  var send = document.getElementById('send');
  function update() {
    var html = '', mini = '';
    for (var k in q) if (q[k]) {
      html += '<li class="bl"><span>' + P[k].name + '<span class="step sm"><button type="button" data-k="' + k + '" data-d="-1" aria-label="One fewer ' + P[k].name + '">−</button><output>' + q[k] + '</output><button type="button" data-k="' + k + '" data-d="1" aria-label="One more ' + P[k].name + '">+</button></span></span><span class="bl-r">' + money(q[k] * P[k].price) + '<button type="button" class="rm" data-rm="' + k + '" aria-label="Remove ' + P[k].name + ' from the basket">' + BIN + '</button></span></li>';
      mini += '<li><span>' + q[k] + ' × ' + P[k].name + '</span><span>' + money(q[k] * P[k].price) + '</span></li>';
    }
    document.getElementById('sum-list').innerHTML = html || '<li><span>Your basket is empty. Pick a dough above.</span></li>';
    document.getElementById('sum-mini').innerHTML = mini || '<li><span>Nothing yet</span></li>';
    var bk = bakes(), bel = document.getElementById('bakes'); bel.hidden = !bk; document.getElementById('bakes-t').textContent = bk;
    if (total() && !pick()) mini += far() ? '<li><span>Delivery</span><span>fee confirmed on WhatsApp</span></li>' : '<li><span>Delivery</span><span>' + money(DEL) + '</span></li>';
    document.getElementById('sum-mini').innerHTML = mini || '<li><span>Nothing yet</span></li>';
    document.getElementById('total').textContent = money(grand());
    var s = {}; for (var k2 in q) if (q[k2]) s[k2] = q[k2]; window.siteBasket.set(s);
    var bar = document.querySelector('#bar .p'), cnt = q.bagel + q.pizza;
    if (bar) bar.innerHTML = total() ? '<b>Basket, ' + money(total()) + '</b>' + cnt + ' dough' + (cnt > 1 ? 's' : '') : '<b>From ₪27</b>American bagel and pizza dough';
    var bb = document.querySelector('#bar .btn'); if (bb) { bb.textContent = 'Order'; bb.setAttribute('href', '#order'); }
    drawStep();
  }
  function v(id) { return document.getElementById(id).value.trim(); }
  function mark(id, msg) { var w = document.getElementById('w-' + id) || document.getElementById('c-' + id); if (w) w.classList.toggle('bad', !!msg); document.getElementById('e-' + id).textContent = msg || ''; }
  // Shabbat and holidays (the business ticks "closed for Shabbat"): the server refuses a delivery whose midday falls inside a closure
  // (backend/routes/marketplace/shabbat.py, orders.py), so the same days are refused here. The closures come from the order form;
  // if they cannot be loaded, Saturdays are still refused.
  var closures = [];
  function loadClosures() { loaded = true; fetch(API + '/marketplace/order-form/' + GIG).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    var sc = j && j.business && j.business.shabbat_closing; closures = (sc && sc.closures) || []; check(false); drawStep();
  }).catch(function () {}); }
  var loaded = false;   // fetched the first time the delivery step opens
  function closedDay(iso) {
    if (!iso) return false;
    if (new Date(iso + 'T12:00').getDay() === 6) return true;
    return closures.some(function (c) {
      var sd = c.start.slice(0, 10), st = c.start.slice(11, 16), ed = c.end.slice(0, 10), et = c.end.slice(11, 16);
      return (sd < iso || (sd === iso && st <= '12:00')) && (iso < ed || (iso === ed && et > '12:00'));
    });
  }
  var CLOSED = 'Closed for Shabbat or a holiday. Choose another day.';
  function check(show, upto) {
    var ok = true, e; upto = upto || 3;
    e = total() ? '' : 'Add a dough to your basket'; if (e) ok = false; if (show || !e) mark('items', e);
    if (upto < 2) return ok;
    e = pick() || v('addr') ? '' : 'Where should we deliver?'; if (e) ok = false; if (show || !e) mark('addr', e);
    e = !v('when') ? 'Choose the day' : closedDay(v('when')) ? CLOSED : ''; if (e) ok = false; if (show || !e || closedDay(v('when'))) mark('when', e);
    if (upto < 3) return ok;
    e = v('me') ? '' : 'Your name, please'; if (e) ok = false; if (show || !e) mark('me', e);
    e = /\d{9,}/.test(v('ph').replace(/\D/g, '')) ? '' : 'A phone number we can reach you on'; if (e) ok = false; if (show || !e) mark('ph', e);
    return ok;
  }
  ['addr', 'when', 'me', 'ph'].forEach(function (id) { document.getElementById(id).addEventListener('input', function () { check(false); drawStep(); }); });
  var note = document.getElementById('note');
  note.addEventListener('input', function () { var cs = getComputedStyle(note), lh = parseFloat(cs.lineHeight) || 22, bd = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth), ex = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + bd; note.style.height = 'auto'; note.style.height = Math.min(note.scrollHeight + bd, 4 * lh + ex) + 'px'; });
  document.getElementById('when').min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  function dayName(opt) { return new Date(v('when') + 'T12:00').toLocaleDateString('en-GB', opt); }
  [].forEach.call(document.querySelectorAll('input[name=ful]'), function (i) { i.addEventListener('change', function () { update(); }); });
  farEl.addEventListener('change', function () { update(); });
  var sending = false;
  function save(notes) {
    var ls = []; for (var k in q) if (q[k]) ls.push({ product_id: P[k].id, qty: q[k] });
    var post = fetch(API + '/marketplace/order-form/' + GIG + '/orders', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lines: ls, fulfilment: pick() ? 'pickup' : 'delivery', city: pick() ? undefined : 'jerusalem', address: pick() ? undefined : v('addr'), date: v('when'), customer_name: v('me'), customer_phone: v('ph'), notes: notes }) })
      .then(function (r) { return r.json().then(function (j) { return r.ok ? j : { error: (typeof j.detail === 'string' && j.detail) || 'It could not be saved.' }; }, function () { return r.ok ? null : { error: 'It could not be saved.' }; }); }).catch(function () { return null; });
    return Promise.race([post, new Promise(function (res) { setTimeout(function () { res(null); }, 5000); })]);
  }
  document.getElementById('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    if (step < 3) { if (!check(true, step)) { var bad1 = document.querySelector('.ostep:not([hidden]) .bad .fld'); if (bad1) bad1.focus(); return; } go(step + 1, true); return; }
    if (!check(true)) { for (var s1 = 1; s1 <= 3; s1++) if (!check(false, s1)) { check(true, s1); go(s1, true); break; } var bad = document.querySelector('.ostep:not([hidden]) .bad .fld'); if (bad) bad.focus(); return; }
    var out = ['Hi American Crust, I would like to order:'];
    for (var k in q) if (q[k]) out.push('• ' + q[k] + ' × ' + P[k].full + ' (' + money(q[k] * P[k].price) + ')');
    if (v('note')) out.push('Notes: ' + v('note'));
    if (pick()) { out.push('Total: ' + money(grand())); out.push('Pickup in Sanhedria (please send me the exact address)'); out.push('Pickup day: ' + dayName({ weekday: 'long', day: 'numeric', month: 'long' })); }
    else { if (far()) { out.push('Delivery: fee confirmed on WhatsApp (further away)'); out.push('Total: ' + money(total()) + ' plus delivery'); } else { out.push('Delivery: ' + money(DEL)); out.push('Total: ' + money(grand())); }
    out.push('Delivery to: ' + v('addr')); out.push('Delivery day: ' + dayName({ weekday: 'long', day: 'numeric', month: 'long' })); }
    out.push('Name: ' + v('me') + ', ' + v('ph'));
    var text = out.join('\n'), notes = [v('note'), 'Sent from the American Crust page by WhatsApp'].filter(Boolean).join('\n');
    sending = true; send.setAttribute('aria-busy', 'true');
    var tab = window.open('', '_blank');
    save(notes).then(function (saved) {   // saved first (rules 3k); if saving fails WhatsApp still opens
      if (saved && saved.track_url) text += '\n\nFollow the order: ' + saved.track_url;
      var url = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text);
      if (tab) tab.location.href = url; else location.href = url;
      sending = false; send.removeAttribute('aria-busy');
      var first = v('me').split(/\s+/)[0], sent = document.getElementById('sent'); sent.textContent = 'Thanks, ' + first + '. Your order is open in WhatsApp. Send the message there so we get it.' + (saved && saved.error ? ' It was not saved on the site: ' + saved.error : ''); sent.hidden = false;
    });
  });
  document.getElementById('sum-list').addEventListener('click', function (e) {
    var r = e.target.closest('button[data-rm]'); if (r) { q[r.dataset.rm] = 0; update(); check(false); label(); return; }
    var b = e.target.closest('button[data-k]'); if (!b) return; q[b.dataset.k] = Math.max(0, Math.min(20, q[b.dataset.k] + (+b.dataset.d))); update(); check(false); label();
  });
  // the steps: one screen each; the browser's back button goes back a step (#order, #order-2, #order-3)
  var STEP_BTN = ['', 'Continue to delivery or pickup', 'Continue to your details', ''], STEP_NOTE = ['', 'Next: delivery or pickup, and the day.', 'Next: your name and phone.', 'Opens WhatsApp with your order written out, to send to American Crust.'];
  function drawStep() {
    if (step > 1 && !loaded) loadClosures();
    [].forEach.call(document.querySelectorAll('.ostep'), function (el) { el.hidden = +el.dataset.s !== step; });
    [].forEach.call(document.querySelectorAll('#steps li'), function (li, i) { li.className = i + 1 < step ? 'is-done' : i + 1 === step ? 'is-now' : ''; if (i + 1 === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
    var pk = pick(); document.getElementById('w-addr').hidden = pk; document.getElementById('h-pick').hidden = !pk; document.getElementById('when-l').textContent = pk ? 'Pickup day' : 'Delivery day';
    var day = v('when') ? dayName({ weekday: 'long' }) : '';
    send.lastElementChild.textContent = step < 3 ? STEP_BTN[step] : (total() ? (day ? 'Send for ' + day : 'Send order on WhatsApp') + ', ' + money(grand()) : 'Send order on WhatsApp');
    send.classList.toggle('idle', !check(false, step));
    document.getElementById('send-note').textContent = STEP_NOTE[step];
    document.getElementById('back').hidden = step === 1;
    var where = document.getElementById('sum-where'); where.hidden = step < 3 || (!pick() && !v('addr'));
    if (!where.hidden) where.textContent = (pick() ? 'Pickup in Sanhedria' : 'To ' + v('addr')) + (v('when') ? ', ' + dayName({ weekday: 'short', day: 'numeric', month: 'short' }) : '');
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
  show(P[qs.get('dough')] ? qs.get('dough') : 'bagel'); update();
  var m0 = /#order-(\d)/.exec(location.hash); if (m0) go(+m0[1], false);
})();
