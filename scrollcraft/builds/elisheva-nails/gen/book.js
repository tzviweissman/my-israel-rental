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
    i.addEventListener('change', function () { svc = i.value; time = ''; drawTimes(); update(); check(false); });
  });
  var chips = [].slice.call(document.querySelectorAll('#bshades .shade'));
  function drawShade() { chips.forEach(function (c) { c.setAttribute('aria-pressed', c.dataset.k === shade ? 'true' : 'false'); }); $('bshade-name').textContent = shade ? SHADES[shade] : ''; }
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
  function check(show) {
    var ok = true, e;
    e = svc ? '' : 'Choose what you would like'; if (e) ok = false; if (show || !e) mark('svc', e);
    e = v('day') ? '' : 'Choose a day'; if (e) ok = false; if (show || !e) mark('day', e);
    e = time ? '' : 'Choose a time'; if (e) ok = false; if (show || !e) mark('time', e);
    e = v('me') ? '' : 'Your name, please'; if (e) ok = false; if (show || !e) mark('me', e);
    e = /\d{9,}/.test(v('ph').replace(/\D/g, '')) ? '' : 'A phone number I can reach you on'; if (e) ok = false; if (show || !e) mark('ph', e);
    return ok;
  }
  ['me', 'ph'].forEach(function (id) { $(id).addEventListener('input', function () { check(false); }); });
  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!check(true)) { var bad = document.querySelector('.bad .fld, .bad input'); if (bad) bad.focus(); return; }
    var s = SERVICES[svc], lines = ['Hi Elisheva, I would like to book:', '• ' + s.n + ' (₪' + s.p + ', about ' + s.m + ' minutes)'];
    if (shade) lines.push('Shade: ' + SHADES[shade]);
    lines.push('When: ' + nice(v('day')) + ' at ' + time);
    if (v('note')) lines.push('Note: ' + v('note'));
    lines.push('Name: ' + v('me') + ', ' + v('ph'));
    var url = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(lines.join('\n'));
    var tab = window.open(url, '_blank'); if (!tab) location.href = url;
  });
  drawShade(); drawTimes(); update();
})();
