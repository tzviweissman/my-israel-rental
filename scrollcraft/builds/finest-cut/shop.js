// The Shop: the feast, the whole menu, and the order in three steps (rules 3k). Saved to MyIsraelRental first, then WhatsApp.
// Run once the page has parsed: the live site adds the listing's products (#mir-live-products) after this script.
document.addEventListener('DOMContentLoaded', function () {
  var BIN = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var WA = '972587153901', GIG = '134c5414-87d5-4d11-b15c-6167b6442648';
  var API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:8001/api' : '/api';
  // the feast, with the id the live order form gives it; the rest of the menu comes from the listing on the live site
  var F = { id: 'idx:0', name: 'Ultimate Feast', full: 'Ultimate Feast, XL chicken board with 4 types of chicken and 3 sauces', price: 215 };
  var ALL = [F];
  try {
    var live = JSON.parse(document.getElementById('mir-live-products').textContent || '[]');
    live.forEach(function (p) {
      if (!p.id || !(+p.price > 0) || p.price_kind === 'quote') return;
      if (p.name === F.name) { F.id = p.id; F.price = +p.price; return; }
      ALL.push({ id: p.id, name: p.name, full: p.name + (p.description ? ', ' + p.description : ''), price: +p.price, out: !p.in_stock });
    });
  } catch (e) { /* no live menu (served locally): the feast alone */ }
  function find(k) { return k === 'feast' ? F : ALL.filter(function (p) { return p.name === k; })[0]; }
  function key(p) { return p === F ? 'feast' : p.name; }
  function count() { var c = 0; for (var k in B) c += B[k]; return c; }
  var qs = new URLSearchParams(location.search), step = 1, n = 1, sending = false;
  var B = {}, saved0 = window.siteBasket.get();   // the basket: key (feast, or the product's name) to how many
  for (var k0 in saved0) { var p0 = find(k0); if (p0 && !p0.out) B[k0] = Math.max(0, Math.min(20, +saved0[k0] || 0)); }
  var a0 = qs.get('add') && find(qs.get('add'));
  if (a0 && !a0.out && !B[key(a0)]) B[key(a0)] = 1;   // a link that names an item adds it once, never again on reload
  var more = document.getElementById('more');
  if (more && ALL.length > 1) more.hidden = false;
  if (qs.get('for') === 'else') document.querySelector('input[name=who][value=else]').checked = true;

  var send = document.getElementById('send'), stN = document.getElementById('st-n'), stAdd = document.getElementById('st-add'), stIn = document.getElementById('st-in');
  var when = document.getElementById('when');
  function $(id) { return document.getElementById(id); }
  function v(id) { return $(id).value.trim(); }
  function money(x) { return '$' + x; }
  function total() { var t = 0; for (var k in B) t += B[k] * find(k).price; return t; }
  function lines() { return ALL.filter(function (p) { return B[key(p)] > 0; }); }
  function isElse() { return document.querySelector('input[name=who]:checked').value === 'else'; }
  function isFar() { return document.querySelector('input[name=place]:checked').value === 'far'; }
  function iso(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  function day(s, opt) { return new Date(s + 'T12:00').toLocaleDateString('en-GB', opt); }
  // Shabbat: no delivery on Saturdays. The lead time is not in the record, so the first day offered is tomorrow.
  function closed(s) { return !!s && new Date(s + 'T12:00').getDay() === 6; }
  function nextOpen(s) { var d = new Date(s + 'T12:00'); do { d.setDate(d.getDate() + 1); } while (d.getDay() === 6); return iso(d); }
  var today = iso(new Date());
  when.min = today; when.value = nextOpen(today);

  function label() { stAdd.lastElementChild.textContent = 'Add' + (n > 1 ? ' ' + n : '') + ', ' + money(n * F.price); stN.textContent = n; stIn.textContent = B.feast ? 'In your basket: ' + B.feast + ' × ' + F.name : ''; }
  document.querySelector('.st-buy .step').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; n = Math.max(1, Math.min(20, n + (+b.dataset.d))); label(); });
  stAdd.addEventListener('click', function () {
    var a = n; B.feast = Math.min(20, (B.feast || 0) + n); n = 1; update(); check(false); label();
    window.siteToast('Added: ' + a + ' × ' + F.name);
  });
  // a tile of the menu on this page adds one here instead of reloading the page
  if (more) more.addEventListener('click', function (e) {
    var a = e.target.closest('a[href*="add="]'); if (!a) return;
    var p = find(new URL(a.href, location.href).searchParams.get('add')); if (!p || p.out) return;
    e.preventDefault(); B[key(p)] = Math.min(20, (B[key(p)] || 0) + 1); update(); check(false); label();
    window.siteToast('Added: 1 × ' + p.name);
  });

  function mark(id, msg) { var w = $('w-' + id) || $('c-' + id); if (w) w.classList.toggle('bad', !!msg); $('e-' + id).textContent = msg || ''; }
  function check(show, upto) {
    var ok = true, e; upto = upto || 3;
    e = count() ? '' : 'Add something to your basket'; if (e) ok = false; if (show || !e) mark('items', e);
    if (upto < 2) return ok;
    e = !isElse() || v('to') ? '' : 'Whose table is it for?'; if (e) ok = false; if (show || !e) mark('to', e);
    e = v('addr') ? '' : 'Where should we deliver?'; if (e) ok = false; if (show || !e) mark('addr', e);
    var w = v('when'), next = $('when-next');
    e = !w ? 'Choose the day' : w < today ? 'That day has passed.' : closed(w) ? 'We do not deliver on Shabbat.' : '';
    if (e) ok = false; if (show || !e || closed(w)) mark('when', e);
    next.hidden = !(w && (closed(w) || w < today));
    if (!next.hidden) { next.dataset.d = closed(w) ? nextOpen(w) : nextOpen(today); next.textContent = 'Choose ' + day(next.dataset.d, { weekday: 'long', day: 'numeric', month: 'long' }); }
    if (upto < 3) return ok;
    e = v('me') ? '' : 'Your name, please'; if (e) ok = false; if (show || !e) mark('me', e);
    e = /\d{9,}/.test(v('ph').replace(/\D/g, '')) ? '' : 'A phone number we can reach you on'; if (e) ok = false; if (show || !e) mark('ph', e);
    return ok;
  }
  $('when-next').addEventListener('click', function () { when.value = this.dataset.d; check(false); drawStep(); });

  function update() {
    var ls = lines(), c = count();
    $('sum-list').innerHTML = ls.length
      ? ls.map(function (p) { var k = key(p), m = B[k]; return '<li class="bl"><span>' + p.name + '<span class="step sm"><button type="button" data-k="' + k + '" data-d="-1" aria-label="One fewer ' + p.name + '">−</button><output>' + m + '</output><button type="button" data-k="' + k + '" data-d="1" aria-label="One more ' + p.name + '">+</button></span></span><span class="bl-r">' + money(m * p.price) + '<button type="button" class="rm" data-k="' + k + '" data-rm="1" aria-label="Remove ' + p.name + ' from the basket">' + BIN + '</button></span></li>'; }).join('')
      : '<li><span>Your basket is empty. Add the feast above.</span></li>';
    $('sum-mini').innerHTML = ls.length ? ls.map(function (p) { return '<li><span>' + B[key(p)] + ' × ' + p.name + '</span><span>' + money(B[key(p)] * p.price) + '</span></li>'; }).join('') : '<li><span>Nothing yet</span></li>';
    $('total').textContent = money(total());
    var keep = {}; ls.forEach(function (p) { keep[key(p)] = B[key(p)]; }); B = keep; window.siteBasket.set(B);
    var bar = document.querySelector('#bar .p'), bb = document.querySelector('#bar .btn');
    if (bar && c) bar.innerHTML = '<b>Basket, ' + money(total()) + '</b>' + (ls.length === 1 ? c + ' × ' + ls[0].name : c + ' items');
    if (bb) bb.setAttribute('href', '#order');
    drawStep();
  }
  $('sum-list').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var k = b.dataset.k; if (!k) return;
    B[k] = b.dataset.rm ? 0 : Math.max(0, Math.min(20, (B[k] || 0) + (+b.dataset.d))); update(); check(false); label();
  });

  var BTN = ['', 'Continue to when and where', 'Continue to your details'], NOTE = ['', 'Next: the day and the address.', 'Next: your name and phone.', 'Opens WhatsApp with your order written out, to send to Finest Cuts.'];
  function drawStep() {
    [].forEach.call(document.querySelectorAll('.ostep'), function (el) { el.hidden = +el.dataset.s !== step; });
    [].forEach.call(document.querySelectorAll('#steps li'), function (li, i) {
      li.className = i + 1 < step ? 'is-done' : i + 1 === step ? 'is-now' : '';
      if (i + 1 === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    $('w-to').hidden = !isElse(); $('h-far').hidden = !isFar();
    send.lastElementChild.textContent = step < 3 ? BTN[step] : count() ? 'Send for ' + day(v('when') || nextOpen(today), { weekday: 'long' }) + ', ' + money(total()) : 'Send order on WhatsApp';
    send.classList.toggle('idle', !check(false, step));
    $('send-note').textContent = NOTE[step];
    $('back').hidden = step === 1;
    var where = $('sum-where'); where.hidden = step < 3 || !v('addr');
    if (!where.hidden) where.textContent = (isElse() && v('to') ? 'For ' + v('to') + ', to ' : 'To ') + v('addr') + ', ' + day(v('when'), { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function go(s, push) {
    if (s > 1 && !check(false, s - 1)) s = 1; if (s > 2 && !check(false, 2)) s = 2;
    step = s; drawStep();
    if (push) {
      history.pushState({ step: s }, '', s === 1 ? '#order' : '#order-' + s);
      $('order').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      var f = document.querySelector('.ostep:not([hidden]) input:not([type=radio]), .ostep:not([hidden]) textarea'); if (f && innerWidth > 800) f.focus({ preventScroll: true });
    }
  }
  addEventListener('popstate', function () { var m = /#order-(\d)/.exec(location.hash); go(m ? +m[1] : 1, false); });
  $('back').addEventListener('click', function () { history.back(); });
  $('steps').addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b && +b.dataset.go < step) go(+b.dataset.go, true); });
  ['to', 'addr', 'when', 'me', 'ph'].forEach(function (id) { $(id).addEventListener('input', function () { check(false); drawStep(); }); });
  [].forEach.call(document.querySelectorAll('input[name=who], input[name=place]'), function (i) { i.addEventListener('change', function () { check(false); drawStep(); }); });

  function save(notes) {
    var body = { lines: lines().map(function (p) { return { product_id: p.id, qty: B[key(p)] }; }), fulfilment: 'delivery', address: v('addr'), date: v('when'), customer_name: v('me'), customer_phone: v('ph'), notes: notes };
    if (!isFar()) body.city = 'jerusalem';
    var post = fetch(API + '/marketplace/order-form/' + GIG + '/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { return r.ok ? j : { error: (typeof j.detail === 'string' && j.detail) || 'It could not be saved.' }; }, function () { return r.ok ? null : { error: 'It could not be saved.' }; }); })
      .catch(function () { return { error: 'It could not be saved.' }; });
    return Promise.race([post, new Promise(function (res) { setTimeout(function () { res(null); }, 5000); })]);
  }
  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    if (step < 3) { if (!check(true, step)) { var b1 = document.querySelector('.ostep:not([hidden]) .bad .fld'); if (b1) b1.focus(); return; } go(step + 1, true); return; }
    if (!check(true)) { for (var s = 1; s <= 3; s++) if (!check(false, s)) { check(true, s); go(s, true); break; } var b2 = document.querySelector('.ostep:not([hidden]) .bad .fld'); if (b2) b2.focus(); return; }
    var whoLine = isElse() ? 'For: ' + v('to') + ' (someone else’s table)' : '';
    var farLine = isFar() ? 'Elsewhere in Israel: please confirm you can deliver' : '';
    var out = ['Hi Finest Cuts, I would like to order:'].concat(lines().map(function (p) { return '• ' + B[key(p)] + ' × ' + p.full + ' (' + money(B[key(p)] * p.price) + ')'; }), ['Total: ' + money(total())]);
    if (whoLine) out.push(whoLine);
    out.push('Delivery to: ' + v('addr')); if (farLine) out.push(farLine);
    out.push('Delivery day: ' + day(v('when'), { weekday: 'long', day: 'numeric', month: 'long' }));
    if (v('note')) out.push('Notes: ' + v('note'));
    out.push('Name: ' + v('me') + ', ' + v('ph'));
    var text = out.join('\n'), notes = [whoLine, farLine, v('note'), 'Sent from the Finest Cuts page by WhatsApp'].filter(Boolean).join('\n');
    sending = true; send.setAttribute('aria-busy', 'true');
    var tab = window.open('', '_blank');
    save(notes).then(function (saved) {   // saved first (rules 3k); if saving fails WhatsApp still opens
      if (saved && saved.track_url) text += '\n\nFollow the order: ' + saved.track_url;
      var url = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text);
      if (tab) tab.location.href = url; else location.href = url;
      sending = false; send.removeAttribute('aria-busy');
      var msg = $('sent'); msg.textContent = 'Thanks, ' + v('me').split(/\s+/)[0] + '. Your order is open in WhatsApp. Send the message there so we get it.' + (saved && saved.error ? ' It was not saved on the site: ' + saved.error : '');
      msg.hidden = false;
      B = {}; window.siteBasket.set({});
    });
  });

  // on this page the Order the feast links stay here: they add one if the basket is empty and go to the order
  [].forEach.call(document.querySelectorAll('.top .btn-line, .close .btn, .fcta'), function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); if (!count()) { B.feast = 1; update(); label(); } go(1, true); });
  });
  label(); update();
  var m0 = /#order-(\d)/.exec(location.hash); if (m0) go(+m0[1], false);
});
