(function () {
  // ── booking: a service, an optional shade, a day in her hours, a time that
  // fits before closing, then WhatsApp to +44 7871 822590 (her listing).
  var WA = '447871822590';
  // her hours (listing): 0 Sunday ... 6 Shabbat; [open, close] in minutes
  var HOURS = { 0: [600, 780], 1: [600, 1140], 2: [600, 1140], 3: [600, 1140], 4: [600, 1140], 5: [600, 780] };
  var qs = new URLSearchParams(location.search), svc = SERVICES[qs.get('service')] ? qs.get('service') : '', shade = SHADES[qs.get('shade')] ? qs.get('shade') : '', time = '';
  if (qs.toString()) history.replaceState(null, '', location.pathname);
  var $ = function (id) { return document.getElementById(id); };
  [].forEach.call(document.querySelectorAll('#svcs input'), function (i) {
    i.checked = i.value === svc;
    i.addEventListener('change', function () { svc = i.value; time = ''; drawSvc(); drawTimes(); update(); check(false); });
  });
  var chips = [].slice.call(document.querySelectorAll('#bshades .shade'));
  // the stage shows her work in the shade you pick, and takes its colour (the product-page rules)
  var stage = $('pick');
  function drawShade() {
    chips.forEach(function (c) { c.setAttribute('aria-pressed', c.dataset.k === shade ? 'true' : 'false'); }); $('bshade-name').textContent = shade ? SHADES[shade] : '';
    var k = shade || 'milky';
    [].forEach.call(stage.querySelectorAll('.st-ph img'), function (i) { i.classList.toggle('on', i.dataset.k === k); });
    stage.style.setProperty('--st', SHADE_C[k]); var deep = /^#[0-9a-c]/i.test(SHADE_C[k]); stage.style.setProperty('--tmix', deep ? '74%' : '50%'); stage.dataset.tone = deep ? 'dark' : ''; $('st-cap').textContent = SHADES[k] + ', my work';
  }
  // the service, its price and time beside her work; a saving where there is one (Tzvi, 20 Oct 2026:
  // show the deal): gel with removal is ₪110, removal and new gel booked apart are ₪40 + ₪90
  function drawSvc() {
    var s = SERVICES[svc];
    // the heading stays put (one line, nothing below it moves); the chosen service is named beside its price
    // the way shops show a saving (GGg61sdEjeI): the price apart struck through beside hers, and "15% off"
    var sv = s && svc === 'gel-removal' ? (SERVICES.removal.p + SERVICES.gel.p) - s.p : 0;
    $('st-price').style.visibility = s ? 'visible' : 'hidden'; if (s) $('st-price').innerHTML = (sv ? '<s class="was">₪' + (s.p + sv) + '</s>' : '') + '<span class="sym">₪</span>' + s.p + ' <small>' + s.n + ', about ' + s.m + ' minutes</small>';
    $('st-save').style.visibility = sv ? 'visible' : 'hidden'; if (sv) $('st-save').innerHTML = Math.floor(sv * 100 / (s.p + sv)) + '% off';
  }
  chips.forEach(function (c) { c.addEventListener('click', function () { shade = shade === c.dataset.k ? '' : c.dataset.k; drawShade(); update(); }); });
  var today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  $('day').min = today;
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function drawTimes() {
    var box = $('times'), d = $('day').value;
    if (!d) { box.innerHTML = '<p class="hint">Choose a day first.</p>'; return; }
    var wd = new Date(d + 'T12:00').getDay(), h = HOURS[wd];
    if (!h) { box.innerHTML = '<p class="hint">The studio is closed on Shabbat. Choose another day.</p>'; time = ''; return; }
    var len = svc ? SERVICES[svc].m : 45, out = [];
    for (var m = h[0]; m + len <= h[1]; m += 30) {
      if (d === today) { var now = new Date(); if (m <= now.getHours() * 60 + now.getMinutes() + 60) continue; }
      out.push(m);
    }
    if (!out.length) { box.innerHTML = '<p class="hint">No times left that day. Choose another day.</p>'; time = ''; return; }
    if (out.map(hhmm).indexOf(time) < 0) time = '';
    box.innerHTML = out.map(function (m) { var t = hhmm(m); return '<label class="opt"><input type="radio" name="time" value="' + t + '"' + (t === time ? ' checked' : '') + '><span class="box">' + t + '</span></label>'; }).join('');
    [].forEach.call(box.querySelectorAll('input'), function (i) { i.addEventListener('change', function () { time = i.value; update(); check(false); }); });
  }
  $('day').addEventListener('change', function () { drawTimes(); update(); check(false); });
  function nice(d) { return new Date(d + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); }
  // each row of the summary has a Change link that goes back to that part (never a dead end)
  function chg(n, what) { return step > n ? ' <button type="button" class="chg" data-go="' + n + '" aria-label="Change ' + what + '">Change</button>' : ''; }
  function update() {
    var s = SERVICES[svc], rows = [];
    if (s) rows.push('<li><span>' + s.n + chg(1, 'service') + '</span><span>₪' + s.p + '</span></li>');
    if (shade) rows.push('<li><span>Shade' + chg(1, 'shade') + '</span><span>' + SHADES[shade] + '</span></li>');
    if ($('day').value && time) rows.push('<li><span>' + nice($('day').value) + chg(2, 'day and time') + '</span><span>' + time + '</span></li>');
    $('sum').innerHTML = rows.join('') || '<li><span>Nothing chosen yet</span></li>';
    $('total').textContent = '₪' + (s ? s.p : 0);
    // the heading is the honest pause: "Ready to book?" once everything is in, and the first name once given
    var nm = v('me').split(/\s+/)[0], ok = valid();
    $('sum-h').textContent = ok ? 'Ready to book' + (nm ? ', ' + nm : '') + '?' : 'Your booking' + (nm ? ', ' + nm : '');
    setSend();
  }
  // everything needed to send: a service, a day, a time, a name and a phone (no marks, no messages)
  function valid() { return !!(svc && v('day') && time && v('me') && /\d{9,}/.test(v('ph').replace(/\D/g, ''))); }
  // the send button tells the truth: grey until it can go, the label says what happens, and it is still
  // pressable when grey so the messages show what is missing. Steps 1 and 2 keep their "Continue" buttons.
  var phase = '';
  var CHECK = '<svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><path d="M5 8.3l2 2L11 6"/></svg>';
  function setSend() {
    var b = $('send'), s = SERVICES[svc], l = b.firstElementChild, grey = false, html = '';
    if (step === 2) html = 'Continue to your details';
    else if (phase === 'open') { html = 'Opening WhatsApp'; grey = true; }
    else if (phase === 'done') { html = CHECK; }
    else if (valid()) { var d = new Date($('day').value + 'T12:00').toLocaleDateString('en-GB', { weekday: 'short' }); html = 'Send ' + d + ' ' + time + ' on WhatsApp · ₪' + s.p; }
    else { html = 'Send on WhatsApp' + (s ? ' · ₪' + s.p : ''); grey = true; }
    if (l.dataset.h !== html) { l.innerHTML = html; l.dataset.h = html; }
    b.setAttribute('aria-disabled', grey ? 'true' : 'false'); b.classList.toggle('is-done', phase === 'done');
    if (phase === 'done') b.setAttribute('aria-label', 'Booking written out'); else b.removeAttribute('aria-label');
  }
  function v(id) { return $(id).value.trim(); }
  function mark(id, msg) { var w = $('w-' + id); if (w) w.classList.toggle('bad', !!msg); $('e-' + id).textContent = msg || ''; }
  function check(show, upto) {
    var ok = true, e; upto = upto || 3;
    e = svc ? '' : 'Choose what you would like'; if (e) ok = false; if (show || !e) mark('svc', e);
    if (upto < 2) return ok;
    e = v('day') ? '' : 'Choose a day'; if (e) ok = false; if (show || !e) mark('day', e);
    e = time ? '' : 'Choose a time'; if (e) ok = false; if (show || !e) mark('time', e);
    if (upto < 3) return ok;
    e = v('me') ? '' : 'Your name, please'; if (e) ok = false; if (show || !e) mark('me', e);
    e = /\d{9,}/.test(v('ph').replace(/\D/g, '')) ? '' : 'A phone number I can reach you on'; if (e) ok = false; if (show || !e) mark('ph', e);
    return ok;
  }
  ['me', 'ph'].forEach(function (id) { $(id).addEventListener('input', function () { check(false); update(); }); });
  // the message box starts as one line and grows to four, then scrolls
  var note = $('note');
  note.addEventListener('input', function () { note.style.height = 'auto'; note.style.height = Math.min(note.scrollHeight + 3, 115) + 'px'; });
  var toastT = 0;
  function toast() {
    var t = $('toast'); clearTimeout(toastT); t.hidden = false; requestAnimationFrame(function () { requestAnimationFrame(function () { t.classList.add('in'); }); });
    toastT = setTimeout(function () { t.classList.remove('in'); setTimeout(function () { t.hidden = true; }, 220); }, 2400);
  }
  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (phase) return;
    // steps 1 and 2: check this step, then on to the next (page rules 3k: the order in steps)
    if (step < 3) { if (!check(true, step)) { var bad1 = document.querySelector('.bad .fld, .bad input'); if (bad1) bad1.focus(); return; } go(step + 1, true); return; }
    if (!check(true)) { for (var s1 = 1; s1 <= 3; s1++) if (!check(false, s1)) { check(true, s1); go(s1, true); break; } var bad = document.querySelector('.bad .fld, .bad input'); if (bad) bad.focus(); return; }
    var s = SERVICES[svc], lines = ['Hi Elisheva, I would like to book:', '• ' + s.n + ' (₪' + s.p + ', about ' + s.m + ' minutes)'];
    if (shade) lines.push('Shade: ' + SHADES[shade]);
    lines.push('When: ' + nice(v('day')) + ' at ' + time);
    if (v('note')) lines.push('Note: ' + v('note'));
    lines.push('Name: ' + v('me') + ', ' + v('ph'));
    var url = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(lines.join('\n'));
    phase = 'open'; setSend();
    var tab = window.open(url, '_blank'); if (!tab) location.href = url;
    toast();
    setTimeout(function () { phase = 'done'; setSend(); }, 250);
    setTimeout(function () { phase = ''; setSend(); }, 1450);
  });
  // ── the steps: 1 her work and the service, 2 day and time, 3 your details; back goes back a step
  var step = 1, pick = $('pick'), book = $('book');
  function drawStep() {
    pick.hidden = step !== 1; book.hidden = step === 1;
    [].forEach.call(document.querySelectorAll('.ostep'), function (el) { el.hidden = +el.dataset.s !== step; });
    [].forEach.call(document.querySelectorAll('.osteps'), function (ol) { [].forEach.call(ol.children, function (li, i) { li.className = i + 1 < step ? 'is-done' : i + 1 === step ? 'is-now' : ''; if (i + 1 === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); }); });
    $('send-note').textContent = step === 2 ? 'Next: your name and phone.' : 'Opens WhatsApp with your booking written out.';
    update();
  }
  function go(n, push) {
    if (n > 1 && !check(false, 1)) n = 1; if (n > 2 && !check(false, 2)) n = 2;
    step = n; drawStep();
    if (push) { history.pushState({ step: n }, '', n === 1 ? '#pick' : '#book-' + n); scrollTo({ top: 0, behavior: 'auto' }); var f = n === 1 ? document.querySelector('#svcs input:checked') : document.querySelector('.ostep:not([hidden]) .fld'); if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 200); }
  }
  addEventListener('popstate', function () { var m = /#book-(\d)/.exec(location.hash); go(m ? +m[1] : 1, false); });
  $('back').addEventListener('click', function () { history.back(); });
  $('sum').addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b && +b.dataset.go < step) go(+b.dataset.go, true); });
  [].forEach.call(document.querySelectorAll('.osteps'), function (ol) { ol.addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b && +b.dataset.go < step) go(+b.dataset.go, true); }); });
  drawShade(); drawSvc(); drawTimes(); update();
  var m0 = /#book-(\d)/.exec(location.hash); if (m0) go(+m0[1], false);
})();
