(function () {
  // Build your plan (rules 3x.9): tiles, and one plain plan that writes itself beside the form. That plan is what is
  // saved on MyIsraelRental and sent on WhatsApp. Only the weekly 4-hour visit has a price (the listing's, read live);
  // everything else is priced by the owner on WhatsApp.
  var WA = '972587130664', GIG = '__GIG__', TIER = '__TIER__';
  var PRICE = Number((window.MIR_PRICES || {})[TIER]) || __PRICE__;
  var API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:8001/api' : '/api';
  var NAMES = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday' };
  var KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
  var $ = function (id) { return document.getElementById(id); };
  var step = 1, phase = '';
  function pick(n) { var c = document.querySelector('input[name=' + n + ']:checked'); return c ? c.value : ''; }
  function picks(n) { return [].map.call(document.querySelectorAll('input[name=' + n + ']:checked'), function (c) { return c.value; }); }
  function v(id) { return ($(id).value || '').trim(); }
  function set(n, val, on) { var c = document.querySelector('input[name=' + n + '][value="' + val + '"]'); if (c) c.checked = on !== false; }

  // the first day we can do: tomorrow (no lead time in the record yet), never a Saturday until the owner answers (question 6)
  var d0 = new Date(); d0.setHours(12, 0, 0, 0); d0.setDate(d0.getDate() + 1); if (d0.getDay() === 6) d0.setDate(d0.getDate() + 1);
  function iso(d) { return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  var first = iso(d0);
  $('day').min = first; $('day').value = first;
  function nice(d) { return new Date(d + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); }
  function nextOn(k) { var d = new Date(d0); while (KEYS[d.getDay()] !== k) d.setDate(d.getDate() + 1); return iso(d); }

  // the plan from the home page's board arrives chosen (plan.html?often=week&day=tue&kind=regular&same=1)
  var qs = new URLSearchParams(location.search);
  var kind = qs.get('kind') || (qs.get('often') ? 'regular' : '');
  if (kind === 'regular' && qs.get('often') === 'once') kind = 'once';
  if (kind) set('kind', kind);
  if (qs.get('often') === 'week' || qs.get('often') === '2weeks') set('often', qs.get('often'));
  if (qs.get('same')) set('extra', 'same');
  if (qs.get('sup')) set('extra', 'sup');
  if (qs.get('day') && NAMES[qs.get('day')]) { set('wday', qs.get('day')); $('day').value = nextOn(qs.get('day')); }
  if (location.search) history.replaceState(null, '', location.pathname);
  // the sensible choices made on purpose (3s.16): every week for regular visits, any time of day
  if (!pick('often')) set('often', 'week');
  set('part', '09:00');

  var TAKEN = {};
  fetch(API + '/marketplace/gigs/' + GIG + '/taken-slots').then(function (r) { return r.ok ? r.json() : {}; }).then(function (t) { TAKEN = t || {}; drawTaken(); }).catch(function () {});
  function drawTaken() {
    var gone = TAKEN[v('day')] || [];
    [].forEach.call(document.querySelectorAll('input[name=part]'), function (i) { var off = gone.indexOf(i.value) >= 0; i.disabled = off; i.closest('.opt').classList.toggle('gone', off); if (off && i.checked) i.checked = false; });
  }
  $('day').addEventListener('change', drawTaken);
  function regular() { return pick('kind') === 'regular'; }
  function weeklyPriced() { return regular() && pick('often') === 'week'; }
  function sentence() {
    var k = pick('kind'); if (!k) return '';
    var s, wd = pick('wday'), day = v('day');
    if (k === 'regular') {
      var o = pick('often') === '2weeks' ? 'Every other ' : 'Every ';
      s = wd && wd !== 'any' ? o + NAMES[wd] + ', 4 hours' : (pick('often') === '2weeks' ? 'Every two weeks' : 'Every week') + ', 4 hours, any day that suits you';
      if (step > 1 && day) s += ', starting ' + nice(day);
    } else {
      s = k === 'deep' ? 'A deep clean' : k === 'once' ? 'A one-time clean' : 'A clean';
      if (step > 1 && day) s += ' on ' + nice(day);
    }
    var part = pick('part');
    if (step > 1 && part) s += ', from ' + part.replace(/^0/, '');
    if (v('where')) s += ', in ' + v('where').replace(/\s+/g, ' ');
    return s + '.';
  }
  function lines() {
    var L = [], x = picks('extra');
    if (x.indexOf('same') >= 0) L.push('The same cleaner each visit, please.');
    if (x.indexOf('sup') >= 0) L.push('Please bring equipment and supplies.');
    if (v('note')) L.push(v('note').replace(/\s+/g, ' '));
    return L;
  }
  function update() {
    $('w-often').classList.toggle('on', regular());
    $('w-wday').classList.toggle('on', regular());
    $('day-l').textContent = regular() ? 'Starting from' : 'The day you would like';
    $('para').textContent = sentence() || 'Choose the kind of clean, and your plan is written here.';
    $('sum-lines').innerHTML = lines().map(function (l) { return '<li></li>'; }).join('');
    [].forEach.call($('sum-lines').children, function (li, i) { li.textContent = lines()[i]; });
    $('total-line').innerHTML = weeklyPriced() || !pick('kind') ? 'Weekly, 4 hours <b>₪' + PRICE + ' a visit</b>' : 'Your price <b>sent on WhatsApp</b>';
    $('send-l').textContent = step === 1 ? 'Continue to when and where' : step === 2 ? 'Continue to your details' : (weeklyPriced() ? 'Send my plan, ₪' + PRICE + ' a visit' : 'Send my plan');
    $('send-note').textContent = step === 3 ? 'Opens WhatsApp with your plan written out. Nothing to pay on this page.' : 'Nothing to pay on this page.';
    $('back').hidden = step === 1;
  }
  function mark(id, msg) { var w = $('w-' + id); if (w) w.classList.toggle('bad', !!msg); $('e-' + id).textContent = msg || ''; }
  function check(show, upto) {
    var ok = true, e;
    function t(id, msg) { if (msg) ok = false; if (show || !msg) mark(id, msg); }
    t('kind', pick('kind') ? '' : 'Choose the kind of clean');
    t('often', !regular() || pick('often') ? '' : 'Choose how often');
    if (upto < 2) return ok;
    t('wday', !regular() || pick('wday') ? '' : 'Choose a day, or "Any day"');
    e = v('day') ? (v('day') < first ? 'The earliest day you can ask for is ' + nice(first) : new Date(v('day') + 'T12:00').getDay() === 6 ? 'Please choose Sunday to Friday' : '') : 'Choose a day';
    t('day', e);
    t('part', !pick('part') ? 'Choose a start time' : (TAKEN[v('day')] || []).indexOf(pick('part')) >= 0 ? 'That time is taken that day. Choose another time or day' : '');
    t('where', v('where') ? '' : 'Your neighbourhood, so we know where to come');
    if (upto < 3) return ok;
    t('me', v('me') ? '' : 'Your name, please');
    t('ph', /\d{9,}/.test(v('ph').replace(/\D/g, '')) ? '' : 'A phone number we can reach you on');
    return ok;
  }
  document.addEventListener('change', function (ev) {
    if (!ev.target.closest('#form')) return;
    // a weekday chosen moves the first day to the next one of it
    if (ev.target.name === 'wday' && NAMES[ev.target.value]) $('day').value = nextOn(ev.target.value);
    update(); check(false, step);
  });
  document.addEventListener('input', function (ev) { if (ev.target.closest('#form')) { update(); check(false, step); } });

  function drawStep() {
    [].forEach.call(document.querySelectorAll('.ostep'), function (el) { el.hidden = +el.dataset.s !== step; });
    [].forEach.call(document.querySelectorAll('.osteps li'), function (li, i) {
      li.className = i + 1 < step ? 'is-done' : i + 1 === step ? 'is-now' : '';
      if (i + 1 === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    update();
  }
  function go(n, push) {
    if (n > 1 && !check(false, 1)) n = 1; if (n > 2 && !check(false, 2)) n = 2;
    step = n; drawStep();
    if (push) {
      history.pushState({ step: n }, '', n === 1 ? location.pathname : '#plan-' + n);
      var f = document.querySelector('.ostep:not([hidden]) input, .ostep:not([hidden]) .fld');
      $('form').scrollIntoView({ block: 'start' });
      if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 150);
    }
  }
  addEventListener('popstate', function () { var m = /#plan-(\d)/.exec(location.hash); go(m ? +m[1] : 1, false); });
  $('back').addEventListener('click', function () { history.back(); });
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b && +b.dataset.go < step) go(+b.dataset.go, true); });

  // a discount code the business made (mir-code.js, the same check as every order page); only the weekly visit has a price
  function goods() { return weeklyPriced() ? PRICE : 0; }
  MirCode.mount({ api: API, gig: GIG, goods: goods, phone: 'ph', field: 'fld', onChange: function () { update(); } });
  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (phase) return;
    if (!check(true, step)) { var bad = document.querySelector('.ostep:not([hidden]) .bad input, .ostep:not([hidden]) .bad .fld'); if (bad) bad.focus(); $('status').textContent = 'Please fill in what is marked.'; return; }
    $('status').textContent = '';
    if (step < 3) { go(step + 1, true); return; }
    var para = sentence(), L = lines(), priced = weeklyPriced();
    var text = 'Hi Clean Plus, here is my plan' + (priced ? ' (weekly, 4 hours, ₪' + PRICE + ' a visit)' : '') + ':\n' + para +
      (L.length ? '\n' + L.join('\n') : '') + '\nName: ' + v('me') + ', ' + v('ph');
    if (MirCode.code()) text += '\n' + MirCode.text(goods());
    phase = 'open'; $('send').setAttribute('aria-busy', 'true');
    // saved on MyIsraelRental first (rules 3k.9, R0b.13); the WhatsApp tab opens at once so the pop-up blocker allows it
    var tab = window.open('', '_blank');
    var post = fetch(API + '/marketplace/gigs/' + GIG + '/book', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tier_name: TIER, preferred_date: v('day'), time_slot: pick('part'), amount: priced ? PRICE : 0, guest_name: v('me'), contact_phone: v('ph'), message: para + (L.length ? ' ' + L.join(' ') : ''), lang: 'en', discount_code: MirCode.code() || undefined }) })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    Promise.race([post, new Promise(function (res) { setTimeout(function () { res(null); }, 5000); })]).then(function (saved) {
      if (saved && saved.track_path) text += '\n\nFollow your plan: https://myisraelrental.com' + saved.track_path;
      var url = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text);
      if (tab) tab.location.href = url; else location.href = url;
      $('status').textContent = 'Sent. Press send in WhatsApp and we will confirm your first visit.';
      phase = ''; $('send').setAttribute('aria-busy', 'false');
    });
  });
  drawStep();
  var m0 = /#plan-(\d)/.exec(location.hash); if (m0) go(+m0[1], false);
})();
