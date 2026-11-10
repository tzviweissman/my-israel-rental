(function () {
  // The request form (rules 3x.9): chips, and one plain paragraph that writes itself as the fields fill.
  // That paragraph is what is saved on MyIsraelRental and sent on WhatsApp. It states no price or promise
  // the owner did not give: only the basic home clean has a price (₪400); everything else is a free quote.
  var WA = '972535269002', GIG = '__GIG__';
  var API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'http://localhost:8001/api' : '/api';
  var KIND = { basic: 'a basic home clean', regular: 'regular cleaning', deep: 'a deep or post-construction clean',
    windows: 'window cleaning', manage: 'apartment management', other: 'a clean' };
  var OFTEN = { weekly: 'every week', biweekly: 'every two weeks', monthly: 'every month', once: 'just once' };
  var SIDES = { both: 'inside and outside', in: 'inside only', out: 'outside only' };
  var HOME = { apartment: 'apartment', house: 'house', other: 'place' };
  var PART = { morning: 'in the morning', afternoon: 'in the afternoon', any: 'any time of day' };
  var $ = function (id) { return document.getElementById(id); };
  var step = 1, phase = '';
  function pick(n) { var c = document.querySelector('input[name=' + n + ']:checked'); return c ? c.value : ''; }
  function v(id) { return ($(id).value || '').trim(); }

  // the first day we can do: tomorrow (no lead time is in the record yet), changeable (3k.10)
  var d0 = new Date(); d0.setDate(d0.getDate() + 1);
  var first = new Date(d0 - d0.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  $('day').min = first; $('day').value = first;
  function nice(d) { return new Date(d + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }); }

  // a link from the home page chooses the clean (book.html?svc=windows)
  var qs = new URLSearchParams(location.search), svc = qs.get('svc');
  if (svc) { var pre = document.querySelector('input[name=kind][value="' + svc + '"]'); if (pre) pre.checked = true; history.replaceState(null, '', location.pathname); }
  // the sensible choices made on purpose (3s.16): an apartment, any time of day
  document.querySelector('input[name=home][value=apartment]').checked = true;
  document.querySelector('input[name=part][value=any]').checked = true;

  function sentence() {
    var k = pick('kind'); if (!k) return '';
    var s = KIND[k], o = pick('often'), h = pick('home'), r = pick('rooms'), w = pick('where');
    s = s.charAt(0).toUpperCase() + s.slice(1);
    if (k === 'regular' && o) s += ', ' + OFTEN[o];
    if (k === 'windows' && SIDES[pick('sides')]) s += ', ' + SIDES[pick('sides')];
    if (h) {
      var size = r && r !== 'unsure' ? (r === '2' ? 'a 1 to 2 room ' : r === '6' ? 'a 6 or more room ' : 'a ' + r + ' room ') : 'an ';
      if (size === 'an ' && h === 'house') size = 'a ';
      s += ' for ' + size + HOME[h];
    }
    if (w) s += w === 'Other' ? ', somewhere else' : ' in ' + w;
    var out = s + '.';
    if (step > 1 || v('day')) {
      var when = v('day') ? nice(v('day')) : '', part = pick('part');
      if (when) out += ' ' + (k === 'regular' && o && o !== 'once' ? 'Starting ' : 'On ') + when + (part ? (part === 'any' ? ', ' : ' ') + PART[part] : '') + '.';
    }
    if (v('note')) out += ' ' + v('note').replace(/\s+/g, ' ');
    return out;
  }
  function update() {
    var k = pick('kind');
    $('w-often').classList.toggle('on', k === 'regular');
    $('w-sides').classList.toggle('on', k === 'windows');
    $('para').textContent = sentence() || 'Choose what you would like cleaned, and your request is written here.';
    $('total-line').innerHTML = k === 'basic' || !k ? 'Basic home clean <b>₪400</b>' : 'Your price: <b>a free quote</b>';
    $('send-l').textContent = step === 1 ? 'Next: where and when' : step === 2 ? 'Next: your details' : (k === 'basic' ? 'Send the request, ₪400' : 'Send for a free quote');
    $('send-note').textContent = step === 3 ? 'Opens WhatsApp with your request written out. Nothing to pay on this page.' : 'Nothing to pay on this page.';
    $('back').hidden = step === 1;
  }
  function mark(id, msg) { var w = $('w-' + id); if (w) w.classList.toggle('bad', !!msg); $('e-' + id).textContent = msg || ''; }
  function check(show, upto) {
    var ok = true, e;
    function t(id, msg) { if (msg) ok = false; if (show || !msg) mark(id, msg); }
    t('kind', pick('kind') ? '' : 'Choose what you would like cleaned');
    t('often', pick('kind') !== 'regular' || pick('often') ? '' : 'Choose how often');
    t('sides', pick('kind') !== 'windows' || pick('sides') ? '' : 'Choose which side');
    t('home', pick('home') ? '' : 'Choose the kind of home');
    t('rooms', pick('rooms') ? '' : 'Choose how many rooms, or "I am not sure"');
    if (upto < 2) return ok;
    t('where', pick('where') ? '' : 'Choose where it is');
    e = v('day') ? (v('day') < first ? 'The earliest day you can ask for is ' + nice(first) : '') : 'Choose a day';
    t('day', e);
    t('part', pick('part') ? '' : 'Choose a time of day');
    if (upto < 3) return ok;
    t('me', v('me') ? '' : 'Your name, please');
    t('ph', /\d{9,}/.test(v('ph').replace(/\D/g, '')) ? '' : 'A phone number we can reach you on');
    return ok;
  }
  document.addEventListener('change', function (ev) { if (ev.target.closest('#form')) { update(); check(false, step); } });
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
      history.pushState({ step: n }, '', n === 1 ? location.pathname : '#request-' + n);
      var f = document.querySelector('.ostep:not([hidden]) input, .ostep:not([hidden]) .fld');
      $('form').scrollIntoView({ block: 'start' });
      if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 150);
    }
  }
  addEventListener('popstate', function () { var m = /#request-(\d)/.exec(location.hash); go(m ? +m[1] : 1, false); });
  $('back').addEventListener('click', function () { history.back(); });
  document.addEventListener('click', function (e) { var b = e.target.closest('[data-go]'); if (b && +b.dataset.go < step) go(+b.dataset.go, true); });

  // a discount code the business made (mir-code.js, the same check as every order page); only the basic clean has a price
  function goods() { return pick('kind') === 'basic' || !pick('kind') ? 400 : 0; }
  MirCode.mount({ api: API, gig: GIG, goods: goods, phone: 'ph', field: 'fld', onChange: function () { update(); } });
  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (phase) return;
    if (!check(true, step)) { var bad = document.querySelector('.ostep:not([hidden]) .bad input, .ostep:not([hidden]) .bad .fld'); if (bad) bad.focus(); $('status').textContent = 'Please fill in what is marked.'; return; }
    $('status').textContent = '';
    if (step < 3) { go(step + 1, true); return; }
    var para = sentence(), k = pick('kind');
    var text = 'Hi, I would like ' + (k === 'basic' ? 'to book a basic home clean (₪400)' : 'a free quote') + ':\n' + para + '\nName: ' + v('me') + ', ' + v('ph');
    if (MirCode.code()) text += '\n' + MirCode.text(goods());
    phase = 'open'; $('send').setAttribute('aria-busy', 'true');
    // saved on MyIsraelRental first (rules 3k.9, R0b.13); the WhatsApp tab opens at once so the pop-up blocker allows it
    var tab = window.open('', '_blank');
    var post = fetch(API + '/marketplace/gigs/' + GIG + '/book', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tier_name: k === 'basic' ? 'Basic home clean' : 'Free quote', preferred_date: v('day'), guest_name: v('me'), contact_phone: v('ph'), message: para, lang: 'en', discount_code: MirCode.code() || undefined }) })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    Promise.race([post, new Promise(function (res) { setTimeout(function () { res(null); }, 5000); })]).then(function (saved) {
      if (saved && saved.track_path) text += '\n\nFollow the request: https://myisraelrental.com' + saved.track_path;
      var url = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text);
      if (tab) tab.location.href = url; else location.href = url;
      $('status').textContent = 'Sent. Press send in WhatsApp and we will reply with your quote.';
      phase = ''; $('send').setAttribute('aria-busy', 'false');
    });
  });
  drawStep();
  var m0 = /#request-(\d)/.exec(location.hash); if (m0) go(+m0[1], false);
})();
