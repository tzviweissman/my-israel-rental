(function () {
  var BIN = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  // the order is written out on WhatsApp to +972 58 729 8718 (the number on her listing)
  var WA = '972587298718', GIG = 'cbf66136-5504-4bf9-9c41-837cc9bd2d37';
  // Every order is saved to MyIsraelRental before WhatsApp opens (page rules 3k). The ids are the listing's own
  // products, named exactly as the listing names them (added 22 Oct 2026 by add_site_products.py).
  var API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:8001/api' : '/api';
  var PID = { small: '55113012e889', medium: 'c94a66979f24', large: 'a549851e62aa', xl: '7d53c8ac348a' };
  var SIZES = [['small', 'Small', 300], ['medium', 'Medium', 400], ['large', 'Large', 500], ['xl', 'Extra large', 850]];
  var BY = {}; SIZES.forEach(function (s, i) { BY[s[0]] = { i: i, name: s[1], price: s[2] }; });
  function P(n) { return '<span class="sym">₪</span>' + n; }
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saved = window.siteBasket.get(), qs = new URLSearchParams(location.search);
  var q = {}; SIZES.forEach(function (s) { q[s[0]] = Math.max(0, Math.min(20, +saved[s[0]] || 0)); });
  if (qs.toString()) history.replaceState(null, '', location.pathname + location.hash);

  // ── the stage: one size at a time, its own photo through shutter slats; quantity and the price in the button
  var stage = document.getElementById('sizes'), ph = stage.querySelector('.st-ph'), bl = window.lsBlinds(ph), sel = 'small', n = 1;
  var stAdd = document.getElementById('st-add'), stN = document.getElementById('st-n'), stIn = document.getElementById('st-in');
  function label() { stAdd.firstElementChild.innerHTML = 'Add ' + (n === 1 ? (/^[AEIOU]/i.test(BY[sel].name) ? 'an ' : 'a ') + BY[sel].name : n + ' × ' + BY[sel].name) + ', ' + P(n * BY[sel].price); stN.textContent = n;
    stIn.textContent = q[sel] ? 'In your basket: ' + q[sel] + ' × ' + BY[sel].name : ''; stage.querySelector('[data-d="-1"]').disabled = n <= 1; }
  // decode every size photo up front, so a wipe never starts on an undecoded picture (check-motion JUMP, 22 Oct 2026)
  [].forEach.call(ph.querySelectorAll('img.sl'), function (i) { if (i.decode) i.decode().catch(function () {}); });
  var ROOM = { small: '#F8D4D0', medium: '#FCE2B4', large: '#EAD6E4', xl: '#DBE8BF' };
  function show(k) {
    sel = k; stage.style.setProperty('--room', ROOM[k]); bl.go(BY[k].i);
    [].forEach.call(stage.querySelectorAll('.st-pick button'), function (b) { b.setAttribute('aria-pressed', b.dataset.k === k ? 'true' : 'false'); });
    document.getElementById('st-name').textContent = BY[k].name; document.getElementById('st-price').innerHTML = P(BY[k].price);
    n = 1; label();
  }
  stage.querySelector('.st-pick').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) show(b.dataset.k); });
  stage.querySelector('.st-buy .step').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; n = Math.max(1, Math.min(20, n + (+b.dataset.d))); label(); });
  var toast = document.createElement('div'), toastT = 0; toast.className = 'toast'; toast.setAttribute('role', 'status');
  toast.innerHTML = '<span class="tt"></span>'; document.body.appendChild(toast);
  function say(msg) { toast.firstChild.textContent = msg; toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { toast.classList.remove('show'); }, 2200); }
  stAdd.addEventListener('click', function () {
    var added = n, k = sel; q[k] = Math.min(20, q[k] + n); n = 1;
    // the button shrinks to a round tick, then comes back (B30)
    if (!reduce) { stAdd.style.width = stAdd.offsetWidth + 'px'; void stAdd.offsetWidth; stAdd.classList.add('added'); stAdd.style.width = '54px'; setTimeout(function () { stAdd.classList.remove('added'); stAdd.style.width = ''; }, 1000); }
    var visible = [].filter.call(ph.querySelectorAll('.sl'), function (i) { return i.style.visibility !== 'hidden' && i.style.zIndex === '2'; })[0] || ph.querySelector('.sl');
    window.lsFly(visible); update(); check(false); label(); say('Added: ' + added + ' × ' + BY[k].name);
  });

  function total() { var t = 0; SIZES.forEach(function (s) { t += q[s[0]] * s[2]; }); return t; }
  function count() { var c = 0; SIZES.forEach(function (s) { c += q[s[0]]; }); return c; }
  var send = document.getElementById('send');
  function update() {
    var html = '', mini = '';
    SIZES.forEach(function (s) { var k = s[0]; if (!q[k]) return;
      html += '<li class="bl"><span>' + s[1] + ' platter<span class="step sm"><button type="button" data-k="' + k + '" data-d="-1" aria-label="One fewer ' + s[1] + '">−</button><output>' + q[k] + '</output><button type="button" data-k="' + k + '" data-d="1" aria-label="One more ' + s[1] + '">+</button></span></span><span class="bl-r">' + P(q[k] * s[2]) + '<button type="button" class="rm" data-rm="' + k + '" aria-label="Remove ' + s[1] + ' from the basket">' + BIN + '</button></span></li>';
      mini += '<li><span>' + q[k] + ' × ' + s[1] + '</span><span>' + P(q[k] * s[2]) + '</span></li>'; });
    document.getElementById('sum-list').innerHTML = html || '<li><span>Your basket is empty. Pick a size above.</span></li>';
    document.getElementById('sum-mini').innerHTML = mini || '<li><span>Nothing yet</span></li>';
    document.getElementById('total').innerHTML = P(total());
    drawStep();
    var b = {}; SIZES.forEach(function (s) { if (q[s[0]]) b[s[0]] = q[s[0]]; }); window.siteBasket.set(b);
    var bar = document.querySelector('#bar .p'), barBtn = document.querySelector('#bar .btn');
    if (barBtn) { barBtn.textContent = total() ? 'Basket' : 'Order'; barBtn.setAttribute('href', total() ? '#order' : '#sizes'); }
    if (bar) { var parts = []; SIZES.forEach(function (s) { if (q[s[0]]) parts.push(q[s[0]] + ' ' + s[1]); }); bar.innerHTML = total() ? '<b>Basket, ' + P(total()) + '</b>' + parts.join(', ') : '<b>From ' + P(300) + '</b>Four platter sizes'; }
  }
  function v(id) { return document.getElementById(id).value.trim(); }
  function mark(id, msg) { var w = document.getElementById('w-' + id) || document.getElementById('c-' + id); if (w) w.classList.toggle('bad', !!msg); document.getElementById('e-' + id).textContent = msg || ''; }
  function check(show, upto) {
    var ok = true, e; upto = upto || 3;
    e = total() ? '' : 'Add a platter to your basket'; if (e) ok = false; if (show || !e) mark('items', e);
    if (upto < 2) return ok;
    e = v('when') ? '' : 'Choose the day'; if (e) ok = false; if (show || !e) mark('when', e);
    e = v('time') ? '' : 'What time suits you?'; if (e) ok = false; if (show || !e) mark('time', e);
    e = v('addr') ? '' : 'Where should it go?'; if (e) ok = false; if (show || !e) mark('addr', e);
    if (upto < 3) return ok;
    e = v('me') ? '' : 'Your name, please'; if (e) ok = false; if (show || !e) mark('me', e);
    e = /\d{9,}/.test(v('ph').replace(/\D/g, '')) ? '' : 'A phone number we can reach you on'; if (e) ok = false; if (show || !e) mark('ph', e);
    return ok;
  }
  ['when', 'time', 'addr', 'me', 'ph'].forEach(function (id) { document.getElementById(id).addEventListener('input', function () { check(false); drawStep(); }); });
  document.getElementById('when').min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  function day(long) { return new Date(v('when') + 'T12:00').toLocaleDateString('en-GB', long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' }); }
  document.getElementById('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (step < 3) { if (!check(true, step)) { var bad1 = document.querySelector('.ostep:not([hidden]) .bad .fld'); if (bad1) bad1.focus(); return; } go(step + 1, true); return; }
    if (!check(true)) { for (var s1 = 1; s1 <= 3; s1++) if (!check(false, s1)) { check(true, s1); go(s1, true); break; } var bad = document.querySelector('.ostep:not([hidden]) .bad .fld'); if (bad) bad.focus(); return; }
    var out = ['Hi Ls Fruit Platter, I would like to order:'];
    SIZES.forEach(function (s) { if (q[s[0]]) out.push('• ' + q[s[0]] + ' × ' + s[1] + ' platter (₪' + q[s[0]] * s[2] + ')'); });
    out.push('Total: ₪' + total());
    out.push('Day: ' + day(true)); out.push('Time: ' + v('time')); out.push('Where: ' + v('addr'));
    if (v('note')) out.push('Notes: ' + v('note'));
    out.push('Name: ' + v('me') + ', ' + v('ph'));
    var ls = []; SIZES.forEach(function (s) { if (q[s[0]]) ls.push({ product_id: PID[s[0]], qty: q[s[0]] }); });
    var notes = ['Time: ' + v('time'), v('note'), 'Sent from the Ls Fruit Platter page by WhatsApp'].filter(Boolean).join('\n');
    if (send.getAttribute('aria-busy') === 'true') return;
    send.setAttribute('aria-busy', 'true');
    var label = send.firstElementChild.innerHTML; send.firstElementChild.textContent = 'Sending';
    // the WhatsApp tab opens now, inside the tap, so pop-up blockers allow it; it is filled once the order is saved
    var tab = window.open('', '_blank');
    var post = fetch(API + '/marketplace/order-form/' + GIG + '/orders', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lines: ls, fulfilment: 'delivery', city: 'jerusalem', address: v('addr'), date: v('when'), customer_name: v('me'), customer_phone: v('ph'), notes: notes }) })
      .then(function (r) { return r.ok ? r.json() : r.text().then(function (t) { console.warn('Order not saved', r.status, t); return null; }); })
      .catch(function (err) { console.warn('Order not saved', err); return null; });
    Promise.race([post, new Promise(function (res) { setTimeout(function () { res(null); }, 5000); })]).then(function (saved) {
      var text = out.join('\n');
      if (saved && saved.track_url) text += '\n\nFollow the order: ' + saved.track_url;
      var url = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text);
      if (tab) tab.location.href = url; else location.href = url;
      send.removeAttribute('aria-busy'); send.firstElementChild.innerHTML = label;
      var first = v('me').split(/\s+/)[0], sent = document.getElementById('sent'); sent.textContent = 'Thank you, ' + first + '. Your order is open in WhatsApp. Send the message there so we get it.'; sent.hidden = false;
    });
  });
  document.getElementById('sum-list').addEventListener('click', function (e) {
    var r = e.target.closest('button[data-rm]'); if (r) { q[r.dataset.rm] = 0; update(); check(false); label(); return; }
    var b = e.target.closest('button[data-k]'); if (!b) return; q[b.dataset.k] = Math.max(0, Math.min(20, q[b.dataset.k] + (+b.dataset.d))); update(); check(false); label();
  });
  // ── the steps: one screen each; the browser's back button goes back a step (#order, #order-2, #order-3)
  var step = 1, STEP_BTN = ['', 'Continue to when and where', 'Continue to your details', ''], STEP_NOTE = ['', 'Next: the day, the time and the address.', 'Next: your name and phone.', 'Opens WhatsApp with your order written out, to send to Ls Fruit Platter.'];
  function drawStep() {
    [].forEach.call(document.querySelectorAll('.ostep'), function (el) { el.hidden = +el.dataset.s !== step; });
    [].forEach.call(document.querySelectorAll('#steps li'), function (li, i) { li.className = i + 1 < step ? 'is-done' : i + 1 === step ? 'is-now' : ''; if (i + 1 === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
    send.firstElementChild.innerHTML = step < 3 ? STEP_BTN[step] : (total() ? 'Send order on WhatsApp, ' + P(total()) : 'Send order on WhatsApp');
    send.classList.toggle('idle', !check(false, step));
    document.getElementById('send-note').textContent = STEP_NOTE[step];
    document.getElementById('back').hidden = step === 1;
    var where = document.getElementById('sum-where'); where.hidden = step < 3 || !v('addr');
    if (!where.hidden) where.textContent = v('addr') + (v('when') ? ', ' + day(false) : '') + (v('time') ? ', ' + v('time') : '');
  }
  function go(s, push) {
    if (s > 1 && !check(false, s - 1)) s = 1; if (s > 2 && !check(false, 2)) s = 2;
    step = s; drawStep();
    if (push) { history.pushState({ step: s }, '', s === 1 ? '#order' : '#order-' + s); document.getElementById('order').scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }); var f = document.querySelector('.ostep:not([hidden]) .fld'); if (f && s > 1) setTimeout(function () { f.focus({ preventScroll: true }); }, 350); }
  }
  addEventListener('popstate', function () { var m = /#order-(\d)/.exec(location.hash); go(m ? +m[1] : 1, false); });
  document.getElementById('back').addEventListener('click', function () { history.back(); });
  document.getElementById('steps').addEventListener('click', function (e) {
    var b = e.target.closest('[data-go]'); if (!b) return; var t = +b.dataset.go;
    if (t < step) { go(t, true); return; }
    if (t === step) return;
    // forward: as far as the filled-in steps allow; the first step with something missing shows what
    var s = step; while (s < t && check(false, s)) s++;
    if (s < t) { check(true, s); go(s, s !== step); var bad = document.querySelector('.ostep:not([hidden]) .bad .fld'); if (bad) bad.focus(); return; }
    go(s, true);
  });
  show(BY[qs.get('size')] ? qs.get('size') : 'small');
  // "Add" on a home page card arrives here with the size and add=1: it is already in the basket
  if (qs.get('add') === '1' && BY[qs.get('size')]) { q[sel] = Math.min(20, q[sel] + 1); label(); say('Added: 1 × ' + BY[sel].name); }
  update();
  var m0 = /#order-(\d)/.exec(location.hash); if (m0) go(+m0[1], false);
})();
