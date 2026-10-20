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
    // the way shops show a saving (GGg61sdEjeI): the price apart struck through beside hers, and "Save ₪20"
    var sv = s && svc === 'gel-removal' ? (SERVICES.removal.p + SERVICES.gel.p) - s.p : 0;
    $('st-price').style.visibility = s ? 'visible' : 'hidden'; if (s) $('st-price').innerHTML = (sv ? '<s class="was">₪' + (s.p + sv) + '</s>' : '') + '<span class="sym">₪</span>' + s.p + ' <small>' + s.n + ', about ' + s.m + ' minutes</small>';
    $('st-save').style.visibility = sv ? 'visible' : 'hidden'; if (sv) $('st-save').innerHTML = 'Save ₪' + sv;
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
  function update() {
    var s = SERVICES[svc], rows = [];
    if (s) rows.push('<li><span>' + s.n + '</span><span>₪' + s.p + '</span></li>');
    if (shade) rows.push('<li><span>Shade</span><span>' + SHADES[shade] + '</span></li>');
    if ($('day').value && time) rows.push('<li><span>' + nice($('day').value) + '</span><span>' + time + '</span></li>');
    $('sum').innerHTML = rows.join('') || '<li><span>Nothing chosen yet</span></li>';
    $('total').textContent = '₪' + (s ? s.p : 0);
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
  ['me', 'ph'].forEach(function (id) { $(id).addEventListener('input', function () { check(false); }); });
  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    // steps 1 and 2: check this step, then on to the next (page rules 3k: the order in steps)
    if (step < 3) { if (!check(true, step)) { var bad1 = document.querySelector('.bad .fld, .bad input'); if (bad1) bad1.focus(); return; } go(step + 1, true); return; }
    if (!check(true)) { for (var s1 = 1; s1 <= 3; s1++) if (!check(false, s1)) { check(true, s1); go(s1, true); break; } var bad = document.querySelector('.bad .fld, .bad input'); if (bad) bad.focus(); return; }
    var s = SERVICES[svc], lines = ['Hi Elisheva, I would like to book:', '• ' + s.n + ' (₪' + s.p + ', about ' + s.m + ' minutes)'];
    if (shade) lines.push('Shade: ' + SHADES[shade]);
    lines.push('When: ' + nice(v('day')) + ' at ' + time);
    if (v('note')) lines.push('Note: ' + v('note'));
    lines.push('Name: ' + v('me') + ', ' + v('ph'));
    var url = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(lines.join('\n'));
    var tab = window.open(url, '_blank'); if (!tab) location.href = url;
  });
  // ── the steps: 1 her work and the service, 2 day and time, 3 your details; back goes back a step
  var step = 1, pick = $('pick'), book = $('book');
  function drawStep() {
    pick.hidden = step !== 1; book.hidden = step === 1;
    [].forEach.call(document.querySelectorAll('.ostep'), function (el) { el.hidden = +el.dataset.s !== step; });
    [].forEach.call(document.querySelectorAll('.osteps'), function (ol) { [].forEach.call(ol.children, function (li, i) { li.className = i + 1 < step ? 'is-done' : i + 1 === step ? 'is-now' : ''; if (i + 1 === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); }); });
    var s = SERVICES[svc];
    $('send').firstElementChild.textContent = step === 2 ? 'Continue to your details' : 'Send booking on WhatsApp' + (s ? ', ₪' + s.p : '');
    $('send-note').textContent = step === 2 ? 'Next: your name and phone.' : 'Opens WhatsApp with your booking written out. The time is yours once I confirm it.';
  }
  function go(n, push) {
    if (n > 1 && !check(false, 1)) n = 1; if (n > 2 && !check(false, 2)) n = 2;
    step = n; drawStep();
    if (push) { history.pushState({ step: n }, '', n === 1 ? '#pick' : '#book-' + n); scrollTo({ top: 0, behavior: 'auto' }); var f = document.querySelector('.ostep:not([hidden]) .fld'); if (f && n > 1) setTimeout(function () { f.focus({ preventScroll: true }); }, 200); }
  }
  addEventListener('popstate', function () { var m = /#book-(\d)/.exec(location.hash); go(m ? +m[1] : 1, false); });
  $('back').addEventListener('click', function () { history.back(); });
  [].forEach.call(document.querySelectorAll('.osteps'), function (ol) { ol.addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b && +b.dataset.go < step) go(+b.dataset.go, true); }); });
  drawShade(); drawSvc(); drawTimes(); update();
  var m0 = /#book-(\d)/.exec(location.hash); if (m0) go(+m0[1], false);
})();
