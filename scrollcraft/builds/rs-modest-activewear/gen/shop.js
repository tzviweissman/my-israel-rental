(function () {
  var BIN = '__BIN__';
  var API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:8001/api' : '/api', GIG = 'ffb66390-ee89-48c0-9b8d-f707057d64e4', PID = 'ea1f611a64ef', WA = '972546152968', NAME = 'Premium Modest Sports Skirt', PRICE = 320, MAX = 10;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saved = window.siteBasket.get(), qty = Math.max(0, Math.min(MAX, +saved.skirt || 0)), n = 1, step = 1, how = 'collect';
  function $(id) { return document.getElementById(id); }
  function v(id) { return $(id).value.trim(); }

  // ── the stage: one photo at a time, the others one tap away
  var ph = $('st-ph');
  function show(p) {
    [].forEach.call(ph.querySelectorAll('img'), function (i) { i.classList.toggle('on', i.dataset.p === p); });
    [].forEach.call(document.querySelectorAll('.st-th button'), function (b) { b.setAttribute('aria-pressed', b.dataset.p === p ? 'true' : 'false'); });
  }
  document.querySelector('.st-th').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) show(b.dataset.p); });

  var stN = $('st-n'), stAdd = $('st-add'), stIn = $('st-in');
  function label() { stAdd.firstElementChild.textContent = 'Add ' + (n === 1 ? 'to basket' : n + ' to basket') + ', ₪' + n * PRICE; stN.textContent = n;
    stIn.textContent = qty ? 'In your basket: ' + qty + (qty === 1 ? ' skirt' : ' skirts') + '. You write your size and colour in the note there.' : 'You write your size and colour in the note in your basket.'; }
  document.querySelector('.st-buy .step').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; n = Math.max(1, Math.min(MAX, n + (+b.dataset.d))); label(); });

  // a short note that slides in at the top and leaves by itself
  var toast = document.createElement('div'), toastT = 0; toast.className = 'toast'; toast.setAttribute('role', 'status');
  toast.innerHTML = '<span class="tk" aria-hidden="true"></span><span class="tt"></span>'; document.body.appendChild(toast);
  function say(msg) { toast.lastChild.textContent = msg; toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { toast.classList.remove('show'); }, 2200); }

  // the touch: the skirt flies along an arc into the RS bag in the menu bar (21st "Add to basket", a tile flying into the cart along a curve), and the bag's handle gives
  function target() {
    var c = [document.querySelector('.top .btn-line'), document.querySelector('#bar.on .btn'), $('menu-btn')];
    for (var i = 0; i < c.length; i++) if (c[i] && c[i].offsetParent !== null) { var r = c[i].getBoundingClientRect(); if (r.width && r.top > -2 && r.top < innerHeight) return c[i]; }
    return null;
  }
  function dip(t) { if (!t) return; t.classList.remove('dip'); void t.offsetWidth; t.classList.add('dip'); setTimeout(function () { t.classList.remove('dip'); }, 700); }
  function fly() {
    var t = target(); if (!t) return;
    if (reduce || !stAdd.animate) { dip(t); return; }
    var a = stAdd.getBoundingClientRect(), b = (t.querySelector('.bagi') || t).getBoundingClientRect();
    var x0 = a.left + a.width / 2, y0 = a.top + a.height / 2, x1 = b.left + b.width / 2, y1 = b.top + b.height / 2, cx = (x0 + x1) / 2, cy = Math.min(y0, y1) - 140;
    var el = document.createElement('div'); el.className = 'fly'; el.innerHTML = '<img alt="" src="assets/' + (document.querySelector('.st-ph img.on') || { dataset: { p: 'skirts' } }).dataset.p + '.webp">'; document.body.appendChild(el);
    var kf = [], N = 18, i;
    for (i = 0; i <= N; i++) { var u = i / N, e = u * u * (3 - 2 * u), m = 1 - e, x = m * m * x0 + 2 * m * e * cx + e * e * x1, y = m * m * y0 + 2 * m * e * cy + e * e * y1, s = 1 - .72 * e;
      kf.push({ transform: 'translate(' + (x - 28) + 'px,' + (y - 33) + 'px) scale(' + s + ') rotate(' + (e * -14) + 'deg)', opacity: i === N ? .2 : 1 }); }
    var an = el.animate(kf, { duration: 780, easing: 'linear', fill: 'forwards' });
    an.onfinish = function () { el.remove(); dip(t); };
  }
  stAdd.addEventListener('click', function () {
    var added = n; qty = Math.min(MAX, qty + n); n = 1; update(); check(false); label(); fly();
    say('Added: ' + added + ' × ' + NAME);
  });

  // ── the basket, in steps
  var send = $('send');
  function total() { return qty * PRICE; }
  function update() {
    var html = qty ? '<li class="bl"><span class="bl-n">' + NAME + '<span class="step sm" role="group" aria-label="How many"><button type="button" data-d="-1" aria-label="One fewer ' + NAME + '">−</button><output>' + qty + '</output><button type="button" data-d="1" aria-label="One more ' + NAME + '">+</button></span></span><span class="bl-r">₪' + qty * PRICE + '<button type="button" class="rm" data-rm="1" aria-label="Remove ' + NAME + ' from the basket">' + BIN + '</button></span></li>' : '<li class="bl"><span>Your basket is empty. Add the skirt above.</span></li>';
    $('sum-list').innerHTML = html;
    $('w-sc').hidden = !qty;
    $('sum-mini').innerHTML = qty ? '<li><span>' + qty + ' × ' + NAME + '</span><span>₪' + qty * PRICE + '</span></li>' : '<li><span>Nothing yet</span></li>';
    $('total').textContent = '₪' + total();
    window.siteBasket.set(qty ? { skirt: qty } : {});
    var bar = document.querySelector('#bar .p'), barBtn = document.querySelector('#bar .btn');
    if (barBtn) { barBtn.textContent = 'Basket'; barBtn.setAttribute('href', '#order'); }
    if (bar) bar.innerHTML = qty ? '<b>Basket, ₪' + total() + '</b>' + qty + (qty === 1 ? ' skirt' : ' skirts') : '<b>₪320</b>Premium Modest Sports Skirt';
    stIn.textContent = qty ? 'In your basket: ' + qty + (qty === 1 ? ' skirt' : ' skirts') + '. You write your size and colour in the note there.' : 'You write your size and colour in the note in your basket.';
    drawStep();
  }
  function mark(id, msg) { var w = $('w-' + id) || $('c-' + id); if (w) w.classList.toggle('bad', !!msg); $('e-' + id).textContent = msg || ''; }
  function check(show, upto) {
    var ok = true, e; upto = upto || 3;
    e = qty ? '' : 'Add the skirt to your basket'; if (e) ok = false; if (show || !e) mark('items', e);
    e = !qty || v('sc') ? '' : 'Tell us the size and colour you want'; if (e) ok = false; if (show || !e) mark('sc', e);
    if (upto < 2) return ok;
    e = how ? '' : 'Choose collect or delivery'; if (e) ok = false; if (show || !e) mark('how', e);
    e = v('when') ? '' : 'Choose the day'; if (e) ok = false; if (show || !e) mark('when', e);
    e = how !== 'deliver' || v('addr') ? '' : 'Where should we deliver?'; if (e) ok = false; if (show || !e) mark('addr', e);
    if (upto < 3) return ok;
    e = v('me') ? '' : 'Your name, please'; if (e) ok = false; if (show || !e) mark('me', e);
    e = /\d{9,}/.test(v('ph').replace(/\D/g, '')) ? '' : 'A phone number we can reach you on'; if (e) ok = false; if (show || !e) mark('ph', e);
    return ok;
  }
  ['sc', 'when', 'addr', 'me', 'ph'].forEach(function (id) { $(id).addEventListener('input', function () { check(false); drawStep(); }); });
  $('opts').addEventListener('change', function (e) { if (e.target.name === 'how') { how = e.target.value; $('w-addr').hidden = how !== 'deliver'; check(false); drawStep(); } });
  var note = $('note');
  note.addEventListener('input', function () { var cs = getComputedStyle(note), lh = parseFloat(cs.lineHeight) || 22, bd = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth), ex = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + bd;
    note.style.height = 'auto'; note.style.height = Math.min(note.scrollHeight + bd, 4 * lh + ex) + 'px'; });
  // quantity and removal in the basket
  $('sum-list').addEventListener('click', function (e) {
    var r = e.target.closest('button[data-rm]'); if (r) { qty = 0; update(); check(false); label(); return; }
    var b = e.target.closest('button[data-d]'); if (!b) return; qty = Math.max(0, Math.min(MAX, qty + (+b.dataset.d))); update(); check(false); label();
  });

  var STEP_BTN = ['', 'Continue to collecting', 'Continue to your details', ''], STEP_NOTE = ['', 'Next: collecting from the store.', 'Next: your name and phone.', 'Opens WhatsApp with your order written out, to send to RS Modest Activewear.'];
  function drawStep() {
    [].forEach.call(document.querySelectorAll('.ostep'), function (el) { el.hidden = +el.dataset.s !== step; });
    [].forEach.call(document.querySelectorAll('#steps li'), function (li, i) { li.className = i + 1 < step ? 'is-done' : i + 1 === step ? 'is-now' : ''; if (i + 1 === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
    send.firstElementChild.textContent = step < 3 ? STEP_BTN[step] : (total() ? 'Send order on WhatsApp, ₪' + total() : 'Send order on WhatsApp');
    send.classList.toggle('idle', !check(false, step));
    $('send-note').textContent = STEP_NOTE[step];
    $('back').hidden = step === 1;
    var where = $('sum-where'); where.hidden = step < 3 || !how;
    if (!where.hidden) where.textContent = how === 'collect' ? 'Collect from 31 King George Street, Jerusalem' : 'Delivery to ' + v('addr');
  }
  function go(s, push) {
    if (s > 1 && !check(false, s - 1)) s = 1; if (s > 2 && !check(false, 2)) s = 2;
    step = s; drawStep();
    if (push) { history.pushState({ step: s }, '', s === 1 ? '#order' : '#order-' + s); $('order').scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }); var f = document.querySelector('.ostep:not([hidden]) .fld'); if (f && s > 1 && !f.closest('[hidden]')) setTimeout(function () { f.focus({ preventScroll: true }); }, 350); }
  }
  $('when').min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  var sending = false;
  // saved to her shop first (a tracking link), then WhatsApp; if saving fails WhatsApp still opens (rule 3k)
  function save(notes) {
    var post = fetch(API + '/marketplace/order-form/' + GIG + '/orders', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lines: [{ product_id: PID, qty: qty }], fulfilment: 'pickup', date: v('when'), customer_name: v('me'), customer_phone: v('ph'), notes: notes }) })
      .then(function (r) { if (!r.ok) throw new Error('order not saved: ' + r.status); return r.json(); }).catch(function (err) { console.error(err); return null; });
    return Promise.race([post, new Promise(function (res) { setTimeout(function () { res(null); }, 5000); })]);
  }
  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    if (step < 3) { if (!check(true, step)) { var bad1 = document.querySelector('.ostep:not([hidden]) .bad .fld'); if (bad1) bad1.focus(); return; } go(step + 1, true); return; }
    if (!check(true)) { for (var s1 = 1; s1 <= 3; s1++) if (!check(false, s1)) { check(true, s1); go(s1, true); break; } var bad = document.querySelector('.ostep:not([hidden]) .bad .fld'); if (bad) bad.focus(); return; }
    var out = ['Hi RS Modest Activewear, I would like to order:', '• ' + qty + ' × ' + NAME + ' (₪' + qty * PRICE + ')', '   Size and colour: ' + v('sc')];
    if (v('note')) out.push('Notes: ' + v('note'));
    out.push('Total: ₪' + total());
    out.push(how === 'collect' ? 'Collect from the store at King George 31' : 'Deliver to: ' + v('addr'));
    out.push('For: ' + new Date(v('when') + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }));
    out.push('Name: ' + v('me') + ', ' + v('ph'));
    var notes = ['Size and colour: ' + v('sc'), v('note'), 'Sent from the RS Modest Activewear page by WhatsApp'].filter(Boolean).join('\n');
    sending = true; send.setAttribute('aria-busy', 'true');
    var label = send.firstElementChild.textContent; send.firstElementChild.textContent = 'Sending';
    var tab = window.open('', '_blank');
    save(notes).then(function (saved) {
      var text = out.join('\n');
      if (saved && saved.track_url) text += '\n\nFollow the order: ' + saved.track_url;
      var url = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text);
      if (tab) tab.location.href = url; else location.href = url;
      sending = false; send.removeAttribute('aria-busy'); send.firstElementChild.textContent = label;
      var first = v('me').split(/\s+/)[0], sent = $('sent'); sent.textContent = 'Thanks, ' + first + '. Your order is open in WhatsApp. Send the message there so we get it.'; sent.hidden = false;
    });
  });
  addEventListener('popstate', function () { var m = /#order-(\d)/.exec(location.hash); go(m ? +m[1] : 1, false); });
  $('back').addEventListener('click', function () { history.back(); });
  $('steps').addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b && +b.dataset.go < step) go(+b.dataset.go, true); });
  label(); update();
  var m0 = /#order-(\d)/.exec(location.hash); if (m0) go(+m0[1], false);
})();
