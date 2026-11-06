// Book: one request in three steps (rules 3k.7). The summary beside the form is written as the fields fill (3x.9) and is
// what is sent: saved to MyIsraelRental first (the listing's /book), then WhatsApp to Hadassah.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:8001/api' : '/api', WA = '447712331169';
  var GIG = '0b499771-4fd2-4977-bb9b-cb98837d65cc', TIER = 'Makeup', PRICE = 260;
  // weekly_availability in her record: Sunday to Thursday 9:00 to 19:00, Friday 9:00 to 13:00, one hour a slot
  var HOURS = { 0: [9, 19], 1: [9, 19], 2: [9, 19], 3: [9, 19], 4: [9, 19], 5: [9, 13] };
  var time = '', taken = {}, step = 1, phase = '';

  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function works(d) { return !!HOURS[d.getDay()]; }
  function firstDay() { var d = new Date(); d.setDate(d.getDate() + 1); while (!works(d)) d.setDate(d.getDate() + 1); return d; }
  function nice(v) { return new Date(v + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); }
  function v(id) { return $(id).value.trim(); }

  var day = $('day'); day.min = iso(firstDay()); day.value = iso(firstDay());
  function drawTimes() {
    var box = $('times'), dv = day.value, d = dv ? new Date(dv + 'T12:00') : null, h = d && HOURS[d.getDay()];
    box.innerHTML = ''; $('t-hint').innerHTML = '';
    if (dv && !h) {
      // a day she does not work: name the next one, with a button to choose it (rules 3u.2)
      var nx = new Date(dv + 'T12:00'); while (!works(nx)) nx.setDate(nx.getDate() + 1);
      $('t-hint').innerHTML = 'Hadassah is closed on Shabbat. <button type="button" class="link" id="nx">Choose ' + nice(iso(nx)) + '</button>';
      $('nx').addEventListener('click', function () { day.value = iso(nx); time = ''; drawTimes(); update(); });
      return;
    }
    if (!h) return;
    for (var m = h[0]; m < h[1]; m++) {
      var t = String(m).padStart(2, '0') + ':00', off = (taken[dv] || []).indexOf(t) >= 0;
      var l = document.createElement('label'); l.className = 'chip';
      l.innerHTML = '<input type="radio" name="time" value="' + t + '"' + (t === time ? ' checked' : '') + (off ? ' disabled' : '') + '><span>' + t + '</span>';
      box.appendChild(l);
    }
    if (time && (taken[dv] || []).indexOf(time) >= 0) time = '';
  }
  fetch(API + '/marketplace/gigs/' + GIG + '/taken-slots').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
    .then(function (t) { taken = t || {}; drawTimes(); update(); });

  function summary() {
    var t = 'Makeup with lashes included, 60 minutes';
    if (v('occ')) t += ', for ' + v('occ');
    if (v('day')) t += ', on ' + nice(v('day'));
    if (time) t += ' at ' + time;
    if (v('place')) t += ', in ' + v('place');
    t += '.';
    if (v('me')) t += ' From ' + v('me') + (v('ph') ? ', ' + v('ph') : '') + '.';
    if (v('note')) t += ' ' + v('note');
    return t;
  }
  function update() {
    $('sum-p').textContent = summary();
    var l = step === 1 ? 'Continue to occasion' : step === 2 ? 'Continue to your details' : 'Send on WhatsApp, ₪' + PRICE;
    if (phase === 'done') l = 'Sent';
    $('send-l').textContent = l;
    $('send-note').textContent = step === 3 ? 'Opens WhatsApp with your request written out.' : step === 2 ? 'Next: your name and phone.' : 'Next: the occasion, if you would like to say.';
  }
  function mark(id, msg) { var w = $('w-' + id); if (w) w.classList.toggle('bad', !!msg); var e = $('e-' + id); if (e) e.textContent = msg || ''; }
  function check(show, upto) {
    var ok = true;
    function f(id, m) { if (m) ok = false; if (show || !m) mark(id, m); }
    var dv = v('day'), d = dv ? new Date(dv + 'T12:00') : null;
    f('day', !dv ? 'Choose a day' : dv < day.min ? 'Choose a day from ' + nice(day.min) : !works(d) ? 'Hadassah is closed on Shabbat' : '');
    f('time', time ? '' : 'Choose a time');
    if (upto < 3) return ok;
    f('me', v('me') ? '' : 'Your name, please');
    f('ph', /\d{9,}/.test(v('ph').replace(/\D/g, '')) ? '' : 'A phone number Hadassah can reach you on');
    return ok;
  }

  function drawStep() {
    [].forEach.call(document.querySelectorAll('.ostep'), function (el) { el.hidden = +el.dataset.s !== step; });
    [].forEach.call(document.querySelectorAll('.osteps li'), function (li, i) {
      li.className = i + 1 < step ? 'is-done' : i + 1 === step ? 'is-now' : '';
      if (i + 1 === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    $('back').hidden = step === 1;
    update();
  }
  function go(n, push) {
    if (n > 1 && !check(false, 1)) n = 1;
    step = n; drawStep();
    if (push) {
      history.pushState({ step: n }, '', n === 1 ? location.pathname + location.search : '#book-' + n);
      var f = document.querySelector('.ostep:not([hidden]) input:not([disabled])'); if (f) f.focus({ preventScroll: true });
    }
  }
  addEventListener('popstate', function () { var m = /#book-(\d)/.exec(location.hash); go(m ? +m[1] : 1, false); });
  $('back').addEventListener('click', function () { history.back(); });
  document.querySelector('.osteps').addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b && +b.dataset.go < step) go(+b.dataset.go, true); });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'time') { time = t.value; mark('time', ''); }
    else if (t.id === 'day') { time = ''; drawTimes(); check(false, 1); }
    update();
  });
  ['occ', 'place', 'me', 'ph', 'note'].forEach(function (id) { $(id).addEventListener('input', function () { if (id === 'me' || id === 'ph') check(false, 3); update(); }); });
  var note = $('note'); note.addEventListener('input', function () { note.style.height = 'auto'; note.style.height = Math.min(note.scrollHeight + 3, 115) + 'px'; });

  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (phase) return;
    if (step < 3) { if (!check(true, step)) { var b1 = document.querySelector('.bad input:not([disabled]), .bad .fld'); if (b1) b1.focus(); return; } go(step + 1, true); return; }
    if (!check(true, 1)) { go(1, true); check(true, 1); return; }
    if (!check(true, 3)) { var b2 = document.querySelector('.bad .fld'); if (b2) b2.focus(); return; }
    var text = 'Hi Hadassah, I would like to book:\n' + summary() + '\nPrice on your listing: ₪' + PRICE;
    phase = 'open'; $('send').setAttribute('aria-busy', 'true'); $('status').textContent = 'Saving your request…';
    var tab = window.open('', '_blank');  // opened now so the pop-up blocker allows it; filled once the request is saved
    var post = fetch(API + '/marketplace/gigs/' + GIG + '/book', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tier_name: TIER, preferred_date: v('day'), time_slot: time, guest_name: v('me'), contact_phone: v('ph'), message: summary(), lang: 'en' }) })
      .then(function (r) { return r.ok ? r.json() : r.text().then(function (t) { console.warn('booking not saved', r.status, t); return null; }); })
      .catch(function (err) { console.warn('booking not saved', err); return null; });
    Promise.race([post, new Promise(function (res) { setTimeout(function () { res(null); }, 5000); })]).then(function (saved) {
      if (saved && saved.track_path) text += '\n\nFollow the booking: https://myisraelrental.com' + saved.track_path;
      var url = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text);
      if (tab) tab.location.href = url; else location.href = url;
      phase = 'done'; $('send').removeAttribute('aria-busy');
      $('status').textContent = saved ? 'Sent. Your request is saved and WhatsApp is open with it written out.' : 'WhatsApp is open with your request written out.';
      update(); setTimeout(function () { phase = ''; update(); }, 2500);
    });
  });

  drawTimes(); drawStep();
  var m0 = /#book-(\d)/.exec(location.hash); if (m0) go(+m0[1], false);
})();
