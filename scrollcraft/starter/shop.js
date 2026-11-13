// The shop, from the starter (12 Nov 2026; tested on Gifted Israel and Gremier Coffee): category chips, the product sheet,
// one optional add-on, and the order in three steps, saved to MyIsraelRental before WhatsApp opens (rules 3k). Write it
// with sitekit.shop_page(); the WhatsApp number, the listing and the business's name come from #order's data.
(function () {
  var CAT = window.CAT, by = CAT.by, money = CAT.money;
  var BIN = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ORD = document.getElementById('order').dataset, WA = ORD.wa, GIG = ORD.gig, NAME = ORD.name, ADDON = ORD.addon || '';
  var FIRST_DAYS = +(ORD.leadDays || 1);
  var API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:8001/api' : '/api';
  var byName = {}; CAT.items.forEach(function (it) { byName[it.name.toLowerCase()] = it; });
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── category chips: go to that group, nothing below moves ──
  function groupOf(c) { return document.querySelector('#cat .grp[data-c="' + c + '"]'); }
  function jump(c, smooth) { var g = groupOf(c); if (g) g.scrollIntoView({ block: 'start', behavior: smooth && !reduce ? 'smooth' : 'auto' }); }
  document.getElementById('filters').addEventListener('click', function (e) { var b = e.target.closest('.chip'); if (b) jump(b.dataset.c, true); });

  // ── the product sheet ──
  var sheet = document.getElementById('sheet'), cur = null, n = 1;
  function open(it) {
    cur = it; n = 1;
    var img = document.getElementById('sh-img'); img.src = 'assets/p/' + it.id + '.webp'; img.alt = it.name; img.width = it.w; img.height = it.h;
    document.getElementById('sh-name').textContent = it.name;
    document.getElementById('sh-pr').innerHTML = (it.size === 'from' ? 'from ' : '') + money(it.price) + (it.was ? ' <s>' + money(it.was) + '</s>' : '');
    document.getElementById('sh-size').textContent = it.size === 'from' ? 'Built for your guest count' : it.size;
    document.getElementById('sh-desc').textContent = it.desc;
    label();
    sheet.showModal(); document.body.style.overflow = 'hidden';
    history.replaceState(null, '', '?p=' + it.id + location.hash);
  }
  function label() {
    document.getElementById('sh-n').textContent = n;
    var b = document.getElementById('sh-add');
    b.lastElementChild.textContent = cur.out ? 'Out of stock' : 'Add' + (n > 1 ? ' ' + n : '') + ', ' + money(n * cur.price);
    b.disabled = !!cur.out;
  }
  function close() { if (sheet.open) sheet.close(); }
  sheet.addEventListener('close', function () { document.body.style.overflow = ''; history.replaceState(null, '', location.pathname + location.hash); });
  document.getElementById('sh-x').addEventListener('click', close);
  sheet.addEventListener('click', function (e) { if (e.target === sheet) close(); });
  sheet.querySelector('.step').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; n = Math.max(1, Math.min(20, n + (+b.dataset.d))); label(); });
  document.getElementById('sh-add').addEventListener('click', function () { CAT.add(cur.id, n); q[cur.id] = window.siteBasket.get()[cur.id]; update(); close(); });
  // a phone bottom sheet closes by swiping it down, as well as by its Close button (rules 3e.17)
  var y0 = null;
  sheet.addEventListener('touchstart', function (e) { y0 = sheet.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
  sheet.addEventListener('touchend', function (e) { if (y0 !== null && e.changedTouches[0].clientY - y0 > 90) close(); y0 = null; });
  document.getElementById('cat').addEventListener('click', function (e) {
    if (e.target.closest('[data-add]')) return;
    var a = e.target.closest('.pc-a'); if (!a) return;
    var it = by[a.dataset.id] || byName[((a.querySelector('[data-f="name"]') || {}).textContent || '').trim().toLowerCase()];
    if (!it) return; e.preventDefault(); open(it);
  });

  // any Add button (gc.js puts it in the basket) refreshes the order below
  document.addEventListener('click', function (e) { if (e.target.closest('[data-add]')) setTimeout(function () { q = fromBasket(); update(); }, 0); });

  // ── the basket and the order steps ──
  function fromBasket() { var s = window.siteBasket.get(), o = {}; Object.keys(s).forEach(function (k) { if (by[k]) o[k] = Math.max(0, Math.min(20, +s[k] || 0)); }); return o; }
  var declined = false;
  var no = document.getElementById('addon-no'); if (no) no.addEventListener('click', function () { declined = true; update(); });
  var q = fromBasket(), step = 1, send = document.getElementById('send');
  function pickup() { return document.querySelector('input[name=ful]:checked').value === 'pickup'; }
  function total() { var t = 0; for (var k in q) t += q[k] * CAT.unit(k); return t; }
  function update() {
    var html = '', mini = '';
    for (var k in q) if (q[k]) {
      var nm = CAT.label(k);
      html += '<li class="bl"><span><span>' + nm + '</span><span class="step sm"><button type="button" data-k="' + k + '" data-d="-1" aria-label="One fewer ' + nm + '">−</button><output>' + q[k] + '</output><button type="button" data-k="' + k + '" data-d="1" aria-label="One more ' + nm + '">+</button></span></span><span class="bl-r">' + money(q[k] * CAT.unit(k)) + '<button type="button" class="rm" data-rm="' + k + '" aria-label="Remove ' + nm + ' from the basket">' + BIN + '</button></span></li>';
      mini += '<li><span>' + q[k] + ' × ' + nm + '</span><span>' + money(q[k] * CAT.unit(k)) + '</span></li>';
    }
    document.getElementById('sum-list').innerHTML = html || '<li><span>Your basket is empty. Choose something above to add it.</span></li>';
    if (total()) mini += pickup() ? '<li><span>Pickup</span><span>free</span></li>' : '<li><span>Delivery</span><span>fee confirmed on WhatsApp</span></li>';
    document.getElementById('sum-mini').innerHTML = mini || '<li><span>Nothing yet</span></li>';
    document.getElementById('total').textContent = money(total());
    // one real add-on before ordering (3j.2): #order's data-addon, offered once the basket has something and not it, gone once added or declined
    var ad = document.getElementById('addon');
    if (ad) ad.hidden = !ADDON || !total() || !!q[ADDON] || declined;
    var s = {}; for (var k2 in q) if (q[k2]) s[k2] = q[k2]; window.siteBasket.set(s);
    drawStep();
  }
  function v(id) { return document.getElementById(id).value.trim(); }
  function mark(id, msg) { var w = document.getElementById('w-' + id) || document.getElementById('c-' + id); if (w) w.classList.toggle('bad', !!msg); document.getElementById('e-' + id).textContent = msg || ''; }
  // regular delivery takes 2 to 5 days (their site), so the first day offered is two days from now; no Shabbat
  function iso(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  var first = new Date(Date.now() + FIRST_DAYS * 864e5); if (first.getDay() === 6) first = new Date(first.getTime() + 864e5);
  var minDay = iso(first), when = document.getElementById('when');
  when.min = minDay; if (!when.value) when.value = minDay;
  function check(show, upto) {
    var ok = true, e; upto = upto || 3;
    e = total() ? '' : 'Add something to your basket'; if (e) ok = false; if (show || !e) mark('items', e);
    if (upto < 2) return ok;
    e = pickup() || v('addr') ? '' : 'Where should we deliver?'; if (e) ok = false; if (show || !e) mark('addr', e);
    var sat = v('when') && new Date(v('when') + 'T12:00').getDay() === 6;
    e = !v('when') ? 'Choose the day' : v('when') < minDay ? 'The first day we can do is ' + new Date(minDay + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : sat ? 'We do not deliver on Shabbat. Choose another day' : ''; if (e) ok = false; if (show || !e) mark('when', e);
    document.getElementById('first-day').hidden = !(v('when') && v('when') < minDay);
    if (upto < 3) return ok;
    e = v('me') ? '' : 'Your name, please'; if (e) ok = false; if (show || !e) mark('me', e);
    e = /\d{9,}/.test(v('ph').replace(/\D/g, '')) ? '' : 'A phone number we can reach you on'; if (e) ok = false; if (show || !e) mark('ph', e);
    return ok;
  }
  document.getElementById('first-day').addEventListener('click', function () { when.value = minDay; check(false); drawStep(); });
  ['addr', 'when', 'me', 'ph'].forEach(function (id) { document.getElementById(id).addEventListener('input', function () { check(false); drawStep(); }); });
  function dayName(opt) { return new Date(v('when') + 'T12:00').toLocaleDateString('en-GB', opt); }
  [].forEach.call(document.querySelectorAll('input[name=ful]'), function (i) { i.addEventListener('change', function () { update(); }); });
  function itemised() { var out = []; for (var k in q) if (q[k]) out.push('• ' + q[k] + ' × ' + CAT.label(k) + ' (' + money(q[k] * CAT.unit(k)) + ')'); return out; }
  function save(notes) {
    var ls = []; for (var k in q) if (q[k]) ls.push({ product_id: k, qty: q[k] });
    var post = fetch(API + '/marketplace/order-form/' + GIG + '/orders', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lines: ls, fulfilment: pickup() ? 'pickup' : 'delivery', address: pickup() ? undefined : v('addr'), date: v('when'), customer_name: v('me'), customer_phone: v('ph'), notes: notes }) })
      .then(function (r) { return r.json().then(function (j) { return r.ok ? j : null; }, function () { return null; }); }).catch(function () { return null; });
    return Promise.race([post, new Promise(function (res) { setTimeout(function () { res(null); }, 5000); })]);
  }
  var sending = false;
  document.getElementById('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    if (step < 3) { if (!check(true, step)) { var b1 = document.querySelector('.ostep:not([hidden]) .bad .fld'); if (b1) b1.focus(); return; } go(step + 1, true); return; }
    if (!check(true)) { for (var s1 = 1; s1 <= 3; s1++) if (!check(false, s1)) { check(true, s1); go(s1, true); break; } var bad = document.querySelector('.ostep:not([hidden]) .bad .fld'); if (bad) bad.focus(); return; }
    var out = ['Hi ' + NAME + ', I would like to order:'].concat(itemised());
    if (v('note')) out.push('Notes: ' + v('note'));
    out.push('Total: ' + money(total()) + (pickup() ? '' : ' (delivery fee to be confirmed)'));
    out.push(pickup() ? 'Pickup (please send me the address)' : 'Delivery to: ' + v('addr'));
    out.push((pickup() ? 'Pickup day: ' : 'Delivery day: ') + dayName({ weekday: 'long', day: 'numeric', month: 'long' }));
    out.push('Name: ' + v('me') + ', ' + v('ph'));
    var text = out.join('\n'), notes = itemised().concat([v('note'), 'Sent from the ' + NAME + ' site by WhatsApp']).filter(Boolean).join('\n');
    sending = true; send.setAttribute('aria-busy', 'true');
    var tab = window.open('', '_blank');
    save(notes).then(function (ok) {   // saved first (rules 3k); if saving fails WhatsApp still opens
      if (ok && ok.track_url) text += '\n\nFollow the order: ' + ok.track_url;
      var url = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text);
      if (tab) tab.location.href = url; else location.href = url;
      sending = false; send.removeAttribute('aria-busy');
      var sent = document.getElementById('sent'); sent.textContent = 'Thanks, ' + v('me').split(/\s+/)[0] + '. Your order is open in WhatsApp. Send the message there so we get it.'; sent.hidden = false;
    });
  });
  document.getElementById('sum-list').addEventListener('click', function (e) {
    var r = e.target.closest('button[data-rm]'); if (r) { q[r.dataset.rm] = 0; update(); check(false); return; }
    var b = e.target.closest('button[data-k]'); if (!b) return; q[b.dataset.k] = Math.max(0, Math.min(20, q[b.dataset.k] + (+b.dataset.d))); update(); check(false);
  });
  var STEP_BTN = ['', 'Continue to delivery or pickup', 'Continue to your details', ''],
    STEP_NOTE = ['', 'Next: delivery or pickup, and the day.', 'Next: your name and phone.', 'Opens WhatsApp with your order written out, to send to ' + NAME + '.'];
  function drawStep() {
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
    if (push) { history.pushState({ step: s }, '', location.search + (s === 1 ? '#order' : '#order-' + s)); document.getElementById('order').scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }); var f = document.querySelector('.ostep:not([hidden]) .fld'); if (f && s > 1) setTimeout(function () { f.focus({ preventScroll: true }); }, 350); }
  }
  addEventListener('popstate', function () { var m = /#order-(\d)/.exec(location.hash); go(m ? +m[1] : 1, false); });
  document.getElementById('back').addEventListener('click', function () { history.back(); });
  document.getElementById('steps').addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b && +b.dataset.go < step) go(+b.dataset.go, true); });

  var qs = new URLSearchParams(location.search);
  if (qs.get('c')) addEventListener('load', function () { jump(qs.get('c'), false); });
  update();
  var m0 = /#order-(\d)/.exec(location.hash); if (m0) go(+m0[1], false);
  var pick = by[qs.get('p')] || byName[(qs.get('add') || '').toLowerCase()];
  if (pick) open(pick);
})();
