// Book: one request in three steps (rules 3k.7). The summary beside the form is written as the fields fill
// (3x.9) and is what is sent: saved to MyIsraelRental first (the listing's /book), then WhatsApp to Aaron.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:8001/api' : '/api', WA = '972534193420';
  // the two listings in his record, with their tier names, prices and slot lengths; mentoring is booked as a lesson
  var SVC = {
    kumzits: { n: 'Kumzits', gig: 'f45f0cd9-941b-4b79-93a9-05bcf2654830', tier: 'Kumzits', p: 1200, step: 30 },
    lesson: { n: 'Guitar lesson, 40 minutes', gig: 'ce870646-c60c-4611-9c15-70f22522fac3', tier: 'Music Lessons', p: 100, step: 45 },
    mentor: { n: 'Guitar and mentoring', gig: 'ce870646-c60c-4611-9c15-70f22522fac3', tier: 'Music Lessons', p: 0, step: 45 }
  };
  var OPEN = [0, 1, 2, 3, 4];  // Sunday to Thursday, 9:00 to 17:00 (weekly_availability in his record)
  var svc = '', occ = '', how = 'in person', time = '', taken = {}, step = 1, phase = '';
  var q = new URLSearchParams(location.search);

  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function firstDay() { var d = new Date(); d.setDate(d.getDate() + 1); while (OPEN.indexOf(d.getDay()) < 0) d.setDate(d.getDate() + 1); return d; }
  function nice(v) { return new Date(v + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); }
  function slots() { var s = SVC[svc] || SVC.kumzits, out = []; for (var m = 540; m + (svc === 'kumzits' ? 30 : 40) <= 1020; m += s.step) out.push(String(m / 60 | 0).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')); return out; }
  function v(id) { return $(id).value.trim(); }

  var day = $('day'); day.min = iso(firstDay()); day.value = iso(firstDay());
  function drawTimes() {
    var box = $('times'), dv = day.value, d = dv ? new Date(dv + 'T12:00') : null, open = d && OPEN.indexOf(d.getDay()) >= 0;
    var gone = taken[dv] || [];
    box.innerHTML = '';
    $('t-hint').innerHTML = '';
    if (dv && !open) {
      // a day he does not work: name the next one, with a button to choose it (rules 3u.2)
      var nx = new Date(dv + 'T12:00'); while (OPEN.indexOf(nx.getDay()) < 0) nx.setDate(nx.getDate() + 1);
      $('t-hint').innerHTML = 'Aaron books Sunday to Thursday. <button type="button" class="link" id="nx">Choose ' + nice(iso(nx)) + '</button>';
      $('nx').addEventListener('click', function () { day.value = iso(nx); time = ''; drawTimes(); update(); });
      return;
    }
    slots().forEach(function (t) {
      var l = document.createElement('label'); l.className = 'chip';
      var off = gone.indexOf(t) >= 0;
      l.innerHTML = '<input type="radio" name="time" value="' + t + '"' + (t === time ? ' checked' : '') + (off ? ' disabled' : '') + '><span>' + t + '</span>';
      box.appendChild(l);
    });
    if (time && gone.indexOf(time) >= 0) time = '';
  }
  function loadTaken() {
    var s = SVC[svc]; if (!s) return;
    fetch(API + '/marketplace/gigs/' + s.gig + '/taken-slots').then(function (r) { return r.ok ? r.json() : {}; }).then(function (t) { taken = t || {}; drawTimes(); }).catch(function () {});
  }

  function summary() {
    var s = SVC[svc]; if (!s) return 'Choose a kumzits or a lesson to start.';
    var t = svc === 'kumzits' ? 'A kumzits' + (occ ? (occ === 'Just a kumzits' ? '' : ' for a ' + occ.replace('Any other occasion', 'simcha')) : '') : (svc === 'lesson' ? 'A 40-minute guitar lesson' : 'Guitar and mentoring') + ', ' + how;
    if (v('day')) t += ', on ' + nice(v('day'));
    if (time) t += ' at ' + time;
    if (svc === 'kumzits' && v('place')) t += ', in ' + v('place');
    if (svc === 'kumzits' && v('guests')) t += ', for about ' + v('guests') + ' people';
    t += '.';
    if (v('me')) t += ' From ' + v('me') + (v('ph') ? ', ' + v('ph') : '') + '.';
    if (v('note')) t += ' ' + v('note');
    return t;
  }
  function update() {
    $('sum-p').textContent = summary();
    var s = SVC[svc];
    $('total').innerHTML = !s ? '·' : s.p ? '<span class="sym">₪</span>' + s.p.toLocaleString('en-US') : '<span class="ask">Ask for the price</span>';
    var l = step === 1 ? 'Continue to day and time' : step === 2 ? 'Continue to your details' : 'Send on WhatsApp' + (s && s.p ? ', ₪' + s.p.toLocaleString('en-US') : '');
    if (phase === 'done') l = 'Sent';
    $('send-l').textContent = l;
    $('send-note').textContent = step === 3 ? 'Opens WhatsApp with your request written out.' : step === 2 ? 'Next: your name and phone.' : 'Next: the day and time.';
  }
  function mark(id, msg) { var w = $('w-' + id); if (w) w.classList.toggle('bad', !!msg); var e = $('e-' + id); if (e) e.textContent = msg || ''; }
  function check(show, upto) {
    var ok = true, e;
    function f(id, m) { if (m) ok = false; if (show || !m) mark(id, m); }
    f('svc', svc ? '' : 'Choose a kumzits or a lesson');
    if (svc === 'kumzits') f('occ', occ ? '' : 'Choose the occasion, or "Just a kumzits"');
    if (upto < 2) return ok;
    var dv = v('day'), d = dv ? new Date(dv + 'T12:00') : null;
    f('day', !dv ? 'Choose a day' : dv < day.min ? 'Choose a day from ' + nice(day.min) : OPEN.indexOf(d.getDay()) < 0 ? 'Aaron books Sunday to Thursday' : '');
    f('time', time ? '' : 'Choose a time');
    if (upto < 3) return ok;
    f('me', v('me') ? '' : 'Your name, please');
    f('ph', /\d{9,}/.test(v('ph').replace(/\D/g, '')) ? '' : 'A phone number Aaron can reach you on');
    return ok;
  }

  function drawStep() {
    [].forEach.call(document.querySelectorAll('.ostep'), function (el) { el.hidden = +el.dataset.s !== step; });
    [].forEach.call(document.querySelectorAll('.osteps li'), function (li, i) { li.className = i + 1 < step ? 'is-done' : i + 1 === step ? 'is-now' : ''; if (i + 1 === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
    $('back').hidden = step === 1;
    $('w-place').hidden = svc !== 'kumzits';
    update();
  }
  function go(n, push) {
    if (n > 1 && !check(false, 1)) n = 1; if (n > 2 && !check(false, 2)) n = 2;
    step = n; drawStep();
    if (push) { history.pushState({ step: n }, '', n === 1 ? location.pathname + location.search : '#book-' + n); var f = document.querySelector('.ostep:not([hidden]) input:not([disabled])'); if (f) f.focus({ preventScroll: true }); $('book').scrollIntoView({ block: 'start' }); }
  }
  addEventListener('popstate', function () { var m = /#book-(\d)/.exec(location.hash); go(m ? +m[1] : 1, false); });
  $('back').addEventListener('click', function () { history.back(); });
  document.querySelector('.osteps').addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b && +b.dataset.go < step) go(+b.dataset.go, true); });

  function setSvc(k) {
    svc = k; time = '';
    $('occ-box').hidden = k !== 'kumzits'; $('how-box').hidden = !k || k === 'kumzits';
    [].forEach.call(document.querySelectorAll('input[name=svc]'), function (i) { i.checked = i.value === k; });
    taken = {}; drawTimes(); loadTaken(); check(false, 1); drawStep();
  }
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'svc') setSvc(t.value);
    else if (t.name === 'occ') { occ = t.value; check(false, 1); }
    else if (t.name === 'how') how = t.value;
    else if (t.name === 'time') { time = t.value; mark('time', ''); }
    else if (t.id === 'day') { time = ''; drawTimes(); check(false, 2); }
    update();
  });
  ['me', 'ph', 'note', 'place', 'guests'].forEach(function (id) { $(id).addEventListener('input', function () { if (id === 'me' || id === 'ph') check(false, 3); update(); }); });
  var note = $('note'); note.addEventListener('input', function () { note.style.height = 'auto'; note.style.height = Math.min(note.scrollHeight + 3, 115) + 'px'; });

  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (phase) return;
    if (step < 3) { if (!check(true, step)) { var b1 = document.querySelector('.bad input:not([disabled]), .bad .fld'); if (b1) b1.focus(); return; } go(step + 1, true); return; }
    if (!check(true)) { for (var s1 = 1; s1 <= 3; s1++) if (!check(false, s1)) { go(s1, true); check(true, s1); break; } return; }
    var s = SVC[svc], text = 'Hi Aaron, I would like to book:\n' + summary() + (s.p ? '\nPrice on your listing: ₪' + s.p.toLocaleString('en-US') : '');
    phase = 'open'; $('send').setAttribute('aria-busy', 'true'); $('status').textContent = 'Saving your request…';
    var tab = window.open('', '_blank');  // opened now so the pop-up blocker allows it; filled once the request is saved
    var post = fetch(API + '/marketplace/gigs/' + s.gig + '/book', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tier_name: s.tier, preferred_date: v('day'), time_slot: time, guest_name: v('me'), contact_phone: v('ph'), message: summary(), lang: 'en' }) })
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

  // arriving filled in (rules 3k.10): the service and occasion from the link, the first day he works, quantity none
  var pre = q.get('svc'); setSvc(SVC[pre] ? pre : '');
  var oc = q.get('occasion'), OCC = { 'bar-mitzvah': 'Bar Mitzvah', chuppah: 'Chuppah', bris: 'Bris Milah', other: 'Any other occasion', kumzits: 'Just a kumzits' };
  if (oc && OCC[oc] && svc === 'kumzits') { occ = OCC[oc]; [].forEach.call(document.querySelectorAll('input[name=occ]'), function (i) { i.checked = i.value === occ; }); }
  drawStep();
  var m0 = /#book-(\d)/.exec(location.hash); if (m0) go(+m0[1], false);
})();
