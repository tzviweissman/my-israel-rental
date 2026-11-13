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
  // a group by its data-c, else by its heading (the live catalogue's groups have no data-c); a jump shows everything
  function gName(g) { return g.dataset.c || ((g.querySelector('h2') || {}).textContent || '').trim(); }
  function groupOf(c) { return [].filter.call(document.querySelectorAll('#cat .grp:not(.grp-pop)'), function (g) { return gName(g) === c; })[0]; }
  function jump(c, smooth) { if (window.SHOP) SHOP.showAll(); var g = groupOf(c); if (g) g.scrollIntoView({ block: 'start', behavior: smooth && !reduce ? 'smooth' : 'auto' }); }
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
  // a card's − 1 + (catalog.js) changed the basket
  document.addEventListener('site:basket', function () { q = fromBasket(); update(); check(false); });

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
    // an empty basket is one line, not three steps and a total of 0 (shop research step 3, 13 Nov 2026)
    var empty = !Object.keys(s).length;
    document.getElementById('order').classList.toggle('is-empty', empty);
    if (empty && step > 1) step = 1;
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

// ── finding things in the shop (shop research steps 4 to 8, 13 Nov 2026) ──
// The layout follows the number of products: up to 6 big cards, 7 to 40 rows like the food apps, more than 40 two to a
// row with sort, "hide sold out" and Show more. Search from 20 items. The category row stays at the top and lights up
// where you are; past 4 categories an "All" button lists every one with its count. "Most ordered" shows only from real
// orders (#mir-popular: a JSON list of product ids or names, at least 3), never typed in.
(function () {
  var CAT = window.CAT, cat = document.getElementById('cat'), filters = document.getElementById('filters');
  if (!CAT || !cat || !filters) return;
  var HE = (document.documentElement.lang || '').indexOf('he') === 0, T = function (en, he) { return HE ? he : en; };
  var ORD = document.getElementById('order').dataset, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var STEP = 24, limit = STEP, query = '', hideOut = false;
  var byName = {}; CAT.items.forEach(function (it) { byName[it.name.toLowerCase()] = it; });
  var $$ = function (sel, root) { return [].slice.call((root || cat).querySelectorAll(sel)); };
  var groups = function () { return $$('.grp:not(.grp-pop)'); };
  var gName = function (g) { return g.dataset.c || ((g.querySelector('h2') || {}).textContent || '').trim(); };
  function itemOf(pc) {
    var a = pc.querySelector('[data-id]'), b = pc.querySelector('[data-add]');
    var id = (a && a.dataset.id) || (b && b.dataset.add);
    return (id && CAT.by[id]) || byName[((pc.querySelector('[data-f="name"]') || {}).textContent || '').trim().toLowerCase()];
  }
  function isOut(pc) { var it = itemOf(pc); return pc.classList.contains('is-out') || !!(it && it.out); }

  // the live catalogue (mir-catalog.js) draws cards from its template, which has no Add: give each one back
  function arm() {
    $$('.grp:not(.grp-pop) .pc').forEach(function (pc, i) {
      var it = itemOf(pc); if (!it) return;
      var a = pc.querySelector('.pc-a'); if (a && !a.dataset.id) a.dataset.id = it.id;
      if (!pc.dataset.o) pc.dataset.o = i;
      if (pc.querySelector('[data-add]') || isOut(pc)) return;
      var b = document.createElement('button'); b.className = 'btn btn-sm'; b.type = 'button'; b.dataset.add = it.id;
      b.textContent = T('Add', 'הוספה'); b.setAttribute('aria-label', T('Add ', 'הוספה: ') + it.name + ', ' + it.price);
      pc.appendChild(b);
    });
  }
  function sizeIt() {
    var n = $$('.grp:not(.grp-pop) .pc').length;
    cat.classList.remove('size-s', 'size-m', 'size-l');
    cat.classList.add(n <= 6 ? 'size-s' : n <= 40 ? 'size-m' : 'size-l');
    // one kind, or a handful of products: no category row
    filters.hidden = groups().length < 2 || n <= 6;
    return n;
  }

  // ── the category row: one line that stays at the top and lights up the kind you are looking at ──
  var chips = filters.querySelector('.chips');
  function drawChips() {
    var gs = groups();
    chips.innerHTML = '';
    if (gs.length > 4) {
      var all = document.createElement('button'); all.className = 'chip chip-all'; all.type = 'button';
      all.setAttribute('aria-haspopup', 'dialog');
      all.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span></span>';
      all.lastChild.textContent = T('All', 'הכל'); all.setAttribute('aria-label', T('All kinds', 'כל הסוגים'));
      chips.appendChild(all);
    }
    gs.forEach(function (g) {
      var c = document.createElement('button'); c.className = 'chip'; c.type = 'button'; c.dataset.c = gName(g); c.textContent = gName(g);
      chips.appendChild(c);
    });
  }
  var lit = null;
  function light() {
    if (filters.hidden) return;
    var line = filters.getBoundingClientRect().bottom + 12, now = null;
    groups().forEach(function (g) { if (!g.hidden && g.getBoundingClientRect().top <= line) now = g; });
    if (!now) now = groups().filter(function (g) { return !g.hidden; })[0];
    var name = now ? gName(now) : null; if (name === lit) return; lit = name;
    $$('.chip[data-c]', chips).forEach(function (c) {
      var on = c.dataset.c === name; c.classList.toggle('is-on', on);
      if (!on) { c.removeAttribute('aria-current'); return; }
      c.setAttribute('aria-current', 'true');
      // keep it in sight inside the row, without moving the page
      var r = c.getBoundingClientRect(), box = chips.getBoundingClientRect();
      if (r.left < box.left + 8) chips.scrollBy({ left: r.left - box.left - 24, behavior: reduce ? 'auto' : 'smooth' });
      else if (r.right > box.right - 8) chips.scrollBy({ left: r.right - box.right + 24, behavior: reduce ? 'auto' : 'smooth' });
    });
  }
  var tick = 0;
  addEventListener('scroll', function () { if (!tick) tick = requestAnimationFrame(function () { tick = 0; light(); }); }, { passive: true });

  // ── "All": every kind, with how many it has ──
  var kinds = document.createElement('dialog'); kinds.className = 'sheet kinds'; kinds.setAttribute('aria-labelledby', 'kinds-h');
  kinds.innerHTML = '<span class="grab" aria-hidden="true"></span><button class="sh-close" type="button">×</button><div class="sh-in"><h2 id="kinds-h"></h2><ul class="kinds-l"></ul></div>';
  kinds.querySelector('h2').textContent = T('Everything in the shop', 'כל מה שיש בחנות');
  kinds.querySelector('.sh-close').setAttribute('aria-label', T('Close', 'סגירה'));
  document.body.appendChild(kinds);
  function openKinds() {
    var ul = kinds.querySelector('.kinds-l'); ul.innerHTML = '';
    groups().forEach(function (g) {
      var li = document.createElement('li'), b = document.createElement('button'), n = $$('.pc', g).length;
      b.type = 'button'; b.dataset.c = gName(g); b.innerHTML = '<span></span><span class="n"></span>';
      b.firstChild.textContent = gName(g); b.lastChild.textContent = n;
      b.setAttribute('aria-label', gName(g) + ', ' + n + T(' items', ' פריטים'));
      if (gName(g) === lit) b.setAttribute('aria-current', 'true');
      li.appendChild(b); ul.appendChild(li);
    });
    kinds.showModal(); document.body.style.overflow = 'hidden';
  }
  kinds.addEventListener('close', function () { document.body.style.overflow = ''; });
  kinds.addEventListener('click', function (e) {
    if (e.target === kinds || e.target.closest('.sh-close')) { kinds.close(); return; }
    var b = e.target.closest('button[data-c]'); if (!b) return;
    kinds.close(); go(b.dataset.c);
  });
  filters.addEventListener('click', function (e) { if (e.target.closest('.chip-all')) openKinds(); });
  function go(name) {
    showAll();
    var g = groups().filter(function (x) { return gName(x) === name; })[0];
    if (g) g.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }

  // ── search, sort, sold out and Show more ──
  var tools = document.createElement('div'); tools.className = 'shop-tools';
  var none = document.createElement('p'); none.className = 'no-res'; none.setAttribute('role', 'status'); none.hidden = true;
  var more = document.createElement('button'); more.className = 'btn-line more'; more.type = 'button'; more.hidden = true;
  function buildTools(n) {
    tools.innerHTML = '';
    if (n >= 20) {
      var lab = document.createElement('label'); lab.className = 'sr-only'; lab.htmlFor = 'shop-q'; lab.textContent = T('Search the shop', 'חיפוש בחנות');
      var inp = document.createElement('input'); inp.type = 'search'; inp.id = 'shop-q'; inp.className = 'fld shop-q'; inp.autocomplete = 'off';
      inp.placeholder = T('Search ' + n + ' items', 'חיפוש ב-' + n + ' פריטים'); inp.setAttribute('enterkeyhint', 'search');
      inp.value = query;
      inp.addEventListener('input', function () { query = inp.value.trim().toLowerCase(); apply(); });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
      tools.append(lab, inp);
    }
    if (n > 40) {
      var row = document.createElement('div'); row.className = 'tools-row';
      var sl = document.createElement('label'); sl.className = 'sr-only'; sl.htmlFor = 'shop-sort'; sl.textContent = T('Sort', 'מיון');
      var sel = document.createElement('select'); sel.id = 'shop-sort'; sel.className = 'fld shop-sort';
      [['', T('Our order', 'הסדר שלנו')], ['up', T('Price, low to high', 'מחיר, מהנמוך לגבוה')], ['down', T('Price, high to low', 'מחיר, מהגבוה לנמוך')]]
        .forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; sel.appendChild(op); });
      sel.addEventListener('change', function () { sortBy(sel.value); });
      row.append(sl, sel);
      if ($$('.pc').some(isOut)) {
        var ch = document.createElement('label'); ch.className = 'chip';
        ch.innerHTML = '<input type="checkbox" id="shop-out"><span></span>'; ch.lastChild.textContent = T('Hide sold out', 'בלי מה שאזל');
        ch.firstChild.checked = hideOut;
        ch.firstChild.addEventListener('change', function (e) { hideOut = e.target.checked; apply(); });
        row.appendChild(ch);
      }
      tools.appendChild(row);
    }
    if (tools.childNodes.length) filters.before(tools); else tools.remove();
  }
  function priceOf(pc) { var it = itemOf(pc); return it ? it.price : 0; }
  function sortBy(how) {
    $$('.grp:not(.grp-pop) ul').forEach(function (ul) {
      var cs = $$('.pc', ul);
      cs.sort(function (a, b) { return how === 'up' ? priceOf(a) - priceOf(b) : how === 'down' ? priceOf(b) - priceOf(a) : a.dataset.o - b.dataset.o; });
      cs.forEach(function (c) { ul.appendChild(c); });
    });
    apply();
  }
  function showAll() { if (limit !== Infinity) { limit = Infinity; apply(); } }
  function apply() {
    var big = cat.classList.contains('size-l'), cap = big && !query ? limit : Infinity, shown = 0, matched = 0;
    groups().forEach(function (g) {
      var vis = 0;
      $$('.pc', g).forEach(function (pc) {
        var it = itemOf(pc), text = ((pc.textContent || '') + ' ' + (it ? it.desc || '' : '')).toLowerCase();
        var ok = (!query || text.indexOf(query) >= 0) && !(hideOut && isOut(pc));
        if (ok) { matched++; if (++shown > cap) ok = false; }
        pc.hidden = !ok; if (ok) vis++;
      });
      g.hidden = !vis;
    });
    var pop = cat.querySelector('.grp-pop'); if (pop) pop.hidden = !!query || hideOut;
    var left = matched - Math.min(matched, cap);
    more.hidden = !left; more.textContent = T('Show more (' + left + ' more)', 'להציג עוד (' + left + ')');
    none.hidden = matched > 0;
    if (!matched) {
      none.textContent = T('Nothing matches “' + query + '”. ', 'לא מצאנו “' + query + '”. ');
      var wa = document.createElement('a'); wa.href = 'https://wa.me/' + ORD.wa + '?text=' + encodeURIComponent(T('Hi, do you have ', 'היי, יש לכם ') + query + '?');
      wa.target = '_blank'; wa.rel = 'noopener'; wa.textContent = T('Ask ' + ORD.name + ' on WhatsApp', 'לשאול את ' + ORD.name + ' בוואטסאפ');
      none.appendChild(wa);
    }
    lit = null; light();
  }
  more.addEventListener('click', function () {
    var first = $$('.grp:not(.grp-pop) .pc').filter(function (pc) { return pc.hidden; })[0];
    limit += STEP; apply();
    var f = first && first.querySelector('.pc-a'); if (f) f.focus({ preventScroll: true });
  });

  // ── "Most ordered", from real orders only ──
  function popular() {
    var old = cat.querySelector('.grp-pop'); if (old) old.remove();
    if (cat.classList.contains('size-s')) return;
    var list; try { list = JSON.parse((document.getElementById('mir-popular') || {}).textContent || '[]'); } catch (e) { list = []; }
    var seen = {}, picks = [];
    (Array.isArray(list) ? list : []).forEach(function (k) {
      var it = CAT.by[k] || byName[String(k).toLowerCase()]; if (!it || seen[it.id]) return;
      var pc = $$('.grp:not(.grp-pop) .pc').filter(function (c) { var x = itemOf(c); return x && x.id === it.id && !isOut(c); })[0];
      if (pc) { seen[it.id] = 1; picks.push(pc); }
    });
    if (picks.length < 3) return;
    var g = document.createElement('div'); g.className = 'grp grp-pop';
    g.innerHTML = '<h2></h2><ul class="cards rail"></ul>'; g.firstChild.textContent = T('Most ordered', 'הכי מוזמנים');
    picks.slice(0, 8).forEach(function (pc) {
      var c = pc.cloneNode(true); c.hidden = false; c.removeAttribute('data-o');
      [].forEach.call(c.querySelectorAll('[id]'), function (x) { x.removeAttribute('id'); });
      g.lastChild.appendChild(c);
    });
    (cat.querySelector('[data-mir-list]') || cat).prepend(g);
  }

  function start() {
    arm();
    var n = sizeIt();
    drawChips(); buildTools(n); popular();
    if (CAT.steppers) CAT.steppers();
    var last = groups().pop();
    if (last) { last.after(none); none.after(more); }
    apply();
  }
  window.SHOP = { showAll: showAll, refresh: start };
  start();
  // the live catalogue (mir-catalog.js, at the end of <body>) may redraw the cards after this
  addEventListener('DOMContentLoaded', function () { if ($$('.grp:not(.grp-pop) .pc').some(function (pc) { return !pc.dataset.o; })) start(); });
})();
