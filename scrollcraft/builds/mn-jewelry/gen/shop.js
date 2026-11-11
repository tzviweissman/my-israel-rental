(function () {
  var BIN = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var MN = window.MN, ITEMS = MN.ITEMS, money = MN.money;
  // The order is saved to their shop, then written out on WhatsApp to +1 516-790-4616 (their listing). Prices from their listing.
  var WA = '15167904616', GIG = '437e8b9b-e536-418a-9e20-19bf6768fa92';
  var API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:8001/api' : '/api';
  var saved = window.siteBasket.get(), q = {};
  Object.keys(saved).forEach(function (k) { if (ITEMS[k.split('|')[0]]) q[k] = Math.max(0, Math.min(5, +saved[k] || 0)); });
  var sel = 'twist', photo = 'p10', step = 1;
  var $ = function (id) { return document.getElementById(id); };
  var stAdd = $('st-add'), stIn = $('st-in'), phWrap = $('st-ph'), alt = $('st-alt');
  function radio(name) { var r = document.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : ''; }
  function opt() {
    var it = ITEMS[sel], g = radio('gold'), out = [g.charAt(0).toUpperCase() + g.slice(1) + ' gold', radio('dia').toLowerCase()];
    if (it.ring) out.push(radio('size') === 'know' ? 'ring size ' + ($('ring').value.trim() || '?') : 'help me with the ring size');
    return out.join(', ');
  }
  // the stage: this piece in this gold fades in over the last picture; a new gold also gets one pass of light across it.
  // Their own photo in that gold is used where they have one (the tennis bracelet), else this photo in that gold (gen/studio_edit.py)
  var layers = phWrap.querySelectorAll(':scope > img'), top = 0, tok = 0;
  function paint(glint) {
    var g = radio('gold'), src = 'assets/' + photo + '-st-' + g + '.webp', t = ++tok, pre = new Image();
    layers[top].alt = ITEMS[sel].alt + ', in ' + g + ' gold';
    if (layers[top].getAttribute('src') === src) return;
    pre.onload = function () {
      if (t !== tok) return;   // a newer choice was made while this one loaded
      var next = layers[1 - top]; next.src = src; next.alt = layers[top].alt; layers[top].alt = '';
      next.classList.add('on'); layers[top].classList.remove('on'); top = 1 - top;
      if (glint) { phWrap.classList.remove('glint'); void phWrap.offsetWidth; phWrap.classList.add('glint'); }
    };
    pre.src = src;
  }
  function paintGold() { var it = ITEMS[sel], own = it.photos[it.golds.indexOf(radio('gold'))]; showPhoto(own || photo, true); }
  function lineKey() { return sel + '|' + opt(); }
  function lineName(k) { var p = k.split('|'); return ITEMS[p[0]].name + (p[1] ? ' (' + p[1] + ')' : ''); }
  function showPhoto(ph, glint) {
    photo = ph; paint(glint);
    [].forEach.call(alt.querySelectorAll('button'), function (b) { b.setAttribute('aria-pressed', b.dataset.ph === ph ? 'true' : 'false'); });
  }
  function label() {
    var inBasket = 0; for (var k in q) if (k.split('|')[0] === sel) inBasket += q[k];
    stAdd.lastElementChild.textContent = 'Add to basket, from ' + money(ITEMS[sel].price);
    stAdd.setAttribute('aria-label', 'Add the ' + ITEMS[sel].name + ' to your basket, from ' + money(ITEMS[sel].price));
    stIn.textContent = inBasket ? 'In your basket: ' + inBasket + ' × ' + ITEMS[sel].name : '';
    // the piece as it now stands, in one line, as each choice is made
    var size = !ITEMS[sel].ring ? '' : radio('size') === 'know' && $('ring').value.trim() ? ', ring size ' + $('ring').value.trim() : ', we help with your ring size';
    $('st-sum').textContent = ITEMS[sel].name + ' in ' + radio('gold') + ' gold with ' + radio('dia').toLowerCase() + size;
  }
  function show(k) {
    var info = document.querySelector('.st-info'); info.classList.remove('swap'); void info.offsetWidth; info.classList.add('swap');
    sel = k; var it = ITEMS[k];
    $('st-kind').textContent = it.kind; $('st-name').textContent = it.name;
    $('st-desc').textContent = it.ring ? 'Ask us about sizing, stones and availability.' : 'Ask us about stones and availability.';
    $('c-size').classList.toggle('off', !it.ring);
    var own = document.querySelector('input[name="gold"][value="' + it.golds[0] + '"]'); if (own) own.checked = true;   // each piece opens in the gold it was photographed in
    // two fixed photo buttons, refilled (never rebuilt, so a button in use is never thrown away)
    [].forEach.call(alt.querySelectorAll('button'), function (b, i) {
      var ph = it.photos[i]; b.classList.toggle('off', !ph || it.photos.length < 2); if (!ph) return;
      b.dataset.ph = ph; b.firstElementChild.src = 'assets/' + ph + '-st.webp'; b.setAttribute('aria-label', 'Photo ' + (i + 1) + ' of ' + it.photos.length + ' of the ' + it.name);
    });
    showPhoto(it.photos[0]);
    ['white', 'yellow', 'rose'].forEach(function (g) { new Image().src = 'assets/' + it.photos[0] + '-st-' + g + '.webp'; });   // so a gold changes at once
    [].forEach.call(document.querySelectorAll('.thumb'), function (b) { b.setAttribute('aria-pressed', b.dataset.p === k ? 'true' : 'false'); });
    mark('ring', ''); label();
  }
  document.querySelectorAll('input[name="gold"]').forEach(function (r) { r.addEventListener('change', paintGold); });
  document.querySelector('.st-info').addEventListener('change', label);
  // look closer: the picture grows to twice its size under the pointer (a tap on a phone, then drag)
  function aim(e) { var r = phWrap.getBoundingClientRect(); phWrap.style.setProperty('--zx', (e.clientX - r.left) / r.width * 100 + '%'); phWrap.style.setProperty('--zy', (e.clientY - r.top) / r.height * 100 + '%'); }
  phWrap.addEventListener('pointermove', function (e) { aim(e); if (e.pointerType === 'mouse') phWrap.classList.add('zoom'); });
  phWrap.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') phWrap.classList.remove('zoom'); });
  phWrap.addEventListener('click', function (e) { if (!matchMedia('(hover: none)').matches) return; aim(e); phWrap.classList.toggle('zoom'); });
  $('thumbs').addEventListener('click', function (e) { var b = e.target.closest('.thumb'); if (b) show(b.dataset.p); });
  alt.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) showPhoto(b.dataset.ph); });
  // "I know my size" opens the field
  document.querySelectorAll('input[name="size"]').forEach(function (r) { r.addEventListener('change', function () { $('w-ring').classList.toggle('off', radio('size') !== 'know'); if (radio('size') === 'know') $('ring').focus(); else mark('ring', ''); }); });
  document.querySelector('.all').addEventListener('click', function (e) {
    var b = e.target.closest('.pick'); if (!b) return;
    glide($('items'), function () { show(b.dataset.p); });
  });
  stAdd.addEventListener('click', function () {
    if (ITEMS[sel].ring && radio('size') === 'know' && !$('ring').value.trim()) { mark('ring', 'Write your ring size, or choose Help me with sizing'); $('ring').focus(); return; }
    var k = lineKey(); q[k] = Math.min(5, (q[k] || 0) + 1); update(); check(false); label();
    window.siteToast('Added: ' + lineName(k)); stAdd.classList.add('added'); setTimeout(function () { stAdd.classList.remove('added'); }, 900);
  });
  $('ring').addEventListener('input', function () { mark('ring', ''); label(); });

  function glide(el, done) {
    var y0 = scrollY, y1 = Math.max(0, el.getBoundingClientRect().top + scrollY), t0 = 0, D = 520;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { scrollTo(0, y1); if (done) done(); return; }
    document.documentElement.style.scrollBehavior = 'auto';
    (function f(t) { if (!t0) t0 = t; var k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3); scrollTo(0, y0 + (y1 - y0) * e); if (k < 1) requestAnimationFrame(f); else { document.documentElement.style.scrollBehavior = ''; if (done) done(); } })(performance.now());
  }
  function total() { var t = 0; for (var k in q) t += q[k] * MN.unit(k); return t; }
  var send = $('send');
  function update() {
    var html = '', mini = '';
    for (var k in q) if (q[k]) {
      var nm = lineName(k), it0 = ITEMS[k.split('|')[0]], g0 = ((/^(White|Yellow|Rose) gold/.exec(k.split('|')[1] || '') || [0, 'White'])[1]).toLowerCase(), own0 = it0.photos[it0.golds.indexOf(g0)], ph = own0 || it0.photos[0], pic = 'assets/' + ph + '-st-' + g0 + '.webp';
      html += '<li class="bl"><span class="bl-l"><img src="' + pic + '" alt="" width="56" height="56"><span>' + nm + '<span class="step sm"><button type="button" data-k="' + k + '" data-d="-1" aria-label="One fewer ' + nm + '">−</button><output>' + q[k] + '</output><button type="button" data-k="' + k + '" data-d="1" aria-label="One more ' + nm + '">+</button></span></span></span><span class="bl-r">from ' + money(q[k] * MN.unit(k)) + '<button type="button" class="rm" data-rm="' + k + '" aria-label="Remove ' + nm + ' from the basket">' + BIN + '</button></span></li>';
      mini += '<li><span>' + q[k] + ' × ' + nm + '</span><span>from ' + money(q[k] * MN.unit(k)) + '</span></li>';
    }
    $('sum-list').innerHTML = html || '<li><span>Your basket is empty. Choose a piece above.</span></li>';
    $('sum-mini').innerHTML = mini || '<li><span>Nothing yet</span></li>';
    $('total').textContent = (total() ? 'From ' : '') + money(total());
    var s = {}; for (var k2 in q) if (q[k2]) s[k2] = q[k2]; window.siteBasket.set(s);
    drawStep();
  }
  function v(id) { return $(id).value.trim(); }
  function mark(id, msg) { var w = $('w-' + id) || $('c-' + id); if (w) w.classList.toggle('bad', !!msg); $('e-' + id).textContent = msg || ''; }
  var today = new Date(), minDay = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  $('when').min = minDay;
  // arrives filled in (rules 3k.10): tomorrow, the first day we can suggest while their lead time is unknown (OWNER-QUESTIONS); a pick is never overwritten
  if (!$('when').value) { var tm = new Date(today.getTime() - today.getTimezoneOffset() * 60000 + 864e5); $('when').value = tm.toISOString().slice(0, 10); }
  var firstDay = $('when').value || minDay;
  function nextDay() {
    var el = $('e-when'), d = new Date(firstDay + 'T12:00');
    el.textContent = 'That day has passed. The first day we can do is ' + d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }) + '. ';
    var b = document.createElement('button'); b.type = 'button'; b.className = 'lnk'; b.textContent = 'Choose ' + d.toLocaleDateString('en-GB', { weekday: 'long' });
    b.addEventListener('click', function () { var w = $('when'); w.value = firstDay; w.dispatchEvent(new Event('input')); w.focus(); });
    el.appendChild(b);
  }
  function check(show, upto) {
    var ok = true, e; upto = upto || 3;
    e = total() ? '' : 'Add a piece to your basket'; if (e) ok = false; if (show || !e) mark('items', e);
    if (upto < 2) return ok;
    e = !v('when') ? 'Choose a day' : v('when') < firstDay ? 'That day has passed.' : ''; if (e) ok = false; if (show || !e) mark('when', e);
    if (e && show && v('when')) nextDay();   // rules 3u.2: say so and offer the first day we can do, never change the pick quietly
    if (upto < 3) return ok;
    e = v('me') ? '' : 'Your name, please'; if (e) ok = false; if (show || !e) mark('me', e);
    e = /\d{9,}/.test(v('ph').replace(/\D/g, '')) ? '' : 'A phone number we can reach you on'; if (e) ok = false; if (show || !e) mark('ph', e);
    return ok;
  }
  ['when', 'me', 'ph'].forEach(function (id) { $(id).addEventListener('input', function () { check(false); drawStep(); }); });
  function dayName(o) { return new Date(v('when') + 'T12:00').toLocaleDateString('en-GB', o); }
  var sending = false;
  function itemised() { var out = []; for (var k in q) if (q[k]) out.push('• ' + q[k] + ' × ' + lineName(k) + ' (from ' + money(q[k] * MN.unit(k)) + ')'); return out; }
  // saved first (rules 3k): the order reaches their dashboard and the customer gets a tracking link; the appointment is agreed on WhatsApp
  function save(notes) {
    var ls = []; for (var k in q) if (q[k]) ls.push({ product_id: ITEMS[k.split('|')[0]].id, qty: q[k] });
    var post = fetch(API + '/marketplace/order-form/' + GIG + '/orders', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lines: ls, fulfilment: 'pickup', date: v('when'), customer_name: v('me'), customer_phone: v('ph'), notes: notes }) })
      .then(function (r) { return r.json().then(function (j) { return r.ok ? j : null; }, function () { return null; }); }).catch(function () { return null; });
    return Promise.race([post, new Promise(function (res) { setTimeout(function () { res(null); }, 5000); })]);
  }
  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    if (step < 3) { if (!check(true, step)) { var bad1 = document.querySelector('.ostep:not([hidden]) .bad .fld'); if (bad1) bad1.focus(); return; } go(step + 1, true); return; }
    if (!check(true)) { for (var s1 = 1; s1 <= 3; s1++) if (!check(false, s1)) { check(true, s1); go(s1, true); break; } var bad = document.querySelector('.ostep:not([hidden]) .bad .fld'); if (bad) bad.focus(); return; }
    var out = ['Hi M&N Jewelry, I would like to order:'].concat(itemised());
    out.push('Total: From ' + money(total()) + ', the final price for my choices to be confirmed');
    out.push('The day I would like to see it: ' + dayName({ weekday: 'long', day: 'numeric', month: 'long' }));
    if (v('note')) out.push('Note: ' + v('note'));
    out.push('Name: ' + v('me') + ', ' + v('ph'));
    var text = out.join('\n'), notes = itemised().concat(['Day they would like: ' + v('when'), v('note'), 'Appointment in Jerusalem: to be agreed on WhatsApp', 'Sent from the M&N Jewelry page by WhatsApp']).filter(Boolean).join('\n');
    sending = true; send.setAttribute('aria-busy', 'true');
    var tab = window.open('', '_blank');
    save(notes).then(function (saved) {   // if saving fails WhatsApp still opens
      if (saved && saved.track_url) text += '\n\nFollow the order: ' + saved.track_url;
      var url = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text);
      if (tab) tab.location.href = url; else location.href = url;
      sending = false; send.removeAttribute('aria-busy');
      var first = v('me').split(/\s+/)[0], sent = $('sent'); sent.textContent = 'Thank you, ' + first + '. Your order is open in WhatsApp. Send the message there so we get it.'; sent.hidden = false;
    });
  });
  $('sum-list').addEventListener('click', function (e) {
    var r = e.target.closest('button[data-rm]'); if (r) { q[r.dataset.rm] = 0; update(); check(false); label(); return; }
    var b = e.target.closest('button[data-k]'); if (!b) return; q[b.dataset.k] = Math.max(0, Math.min(5, q[b.dataset.k] + (+b.dataset.d))); update(); check(false); label();
  });
  // the steps: one screen each; the browser's back button goes back a step (#order, #order-2, #order-3)
  var STEP_BTN = ['', 'Continue to your appointment', 'Continue to your details', ''], STEP_NOTE = ['', 'Next: the day you would like to see it.', 'Next: your name and phone.', 'Opens WhatsApp with your order written out, to send to us.'];
  function drawStep() {
    [].forEach.call(document.querySelectorAll('.ostep'), function (el) { el.hidden = +el.dataset.s !== step; });
    [].forEach.call(document.querySelectorAll('#steps li'), function (li, i) { li.className = i + 1 < step ? 'is-done' : i + 1 === step ? 'is-now' : ''; if (i + 1 === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
    send.lastElementChild.textContent = step < 3 ? STEP_BTN[step] : (total() ? 'Send order on WhatsApp, from ' + money(total()) : 'Send order on WhatsApp');
    send.classList.toggle('idle', !check(false, step));
    $('send-note').textContent = STEP_NOTE[step];
    $('back').hidden = step === 1;
    var where = $('sum-where'); where.hidden = step < 3 || !v('when');
    if (!where.hidden) where.textContent = 'The day you would like: ' + dayName({ weekday: 'short', day: 'numeric', month: 'short' });
  }
  function go(s, push) {
    if (s > 1 && !check(false, s - 1)) s = 1; if (s > 2 && !check(false, 2)) s = 2;
    step = s; drawStep();
    if (push) { var h = s === 1 ? '#order' : '#order-' + s; if (location.hash !== h) history.pushState({ step: s }, '', h); $('order').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); var f = document.querySelector('.ostep:not([hidden]) .fld'); if (f && s > 1) setTimeout(function () { f.focus({ preventScroll: true }); }, 350); }
  }
  addEventListener('popstate', function () { var m = /#order-(\d)/.exec(location.hash); go(m ? +m[1] : 1, false); });
  $('back').addEventListener('click', function () { history.back(); });
  $('steps').addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b && +b.dataset.go < step) go(+b.dataset.go, true); });
  var qs = new URLSearchParams(location.search), want = qs.get('piece') || qs.get('add');
  show(ITEMS[want] ? want : 'twist'); update();
  if (qs.get('add') && ITEMS[qs.get('add')] && !ITEMS[qs.get('add')].ring) { var k0 = lineKey(); q[k0] = Math.max(q[k0] || 0, 1); update(); label(); }
  var m0 = /#order-(\d)/.exec(location.hash); if (m0) go(+m0[1], false);
})();
