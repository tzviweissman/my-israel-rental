(function () {
  // The plan board (CP-X1, IDEAS.md A): four weeks, Sunday to Friday. A 4-hour visit lands on a weekday and repeats
  // down the weeks; tapping a day moves every visit to it; the pills and the option tiles change the plan; the
  // sentence and the Build your plan link follow. Only the weekly 4-hour visit has a price (the listing's), read live.
  var $ = function (id) { return document.getElementById(id); };
  var board = $('board'); if (!board) return;
  var PRICE = Number((window.MIR_PRICES || {})['Weekly cleaning 4 hours']) || 325;
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NAMES = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday' };
  var KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
  var S = { often: 'week', day: 'tue', kind: 'regular', same: false, sup: false };

  // the real dates: the week that holds tomorrow, and the three after it; days before tomorrow cannot be chosen
  var t0 = new Date(); t0.setHours(12, 0, 0, 0); var first = new Date(t0); first.setDate(t0.getDate() + 1);
  if (first.getDay() === 6) first.setDate(first.getDate() + 1); // Saturday is asked (question 6), so the board starts Sunday
  var sun0 = new Date(first); sun0.setDate(first.getDate() - first.getDay());
  var cells = [].slice.call(board.querySelectorAll('.day'));
  function dateOf(c) { var d = new Date(sun0); d.setDate(sun0.getDate() + (+c.dataset.w) * 7 + KEYS.indexOf(c.dataset.d)); return d; }
  cells.forEach(function (c) {
    var d = dateOf(c); c._d = d;
    c.querySelector('.dn').textContent = d.getDate();
    c.setAttribute('aria-label', d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }));
    if (d < first) { c.disabled = true; c.classList.add('past'); }
  });
  var m1 = sun0.toLocaleDateString('en-GB', { month: 'long' }), last = new Date(sun0); last.setDate(sun0.getDate() + 27);
  var m2 = last.toLocaleDateString('en-GB', { month: 'long' });
  $('month').textContent = m1 === m2 ? m1 : m1 + ' to ' + m2;

  // one visit block per week, moved between that week's cells (so a change slides, never jumps)
  var visits = [];
  board.querySelectorAll('.visit').forEach(function (v) { v.remove(); });
  for (var w = 0; w < 4; w++) {
    var v = document.createElement('span'); v.className = 'visit'; v.setAttribute('aria-hidden', 'true');
    v.innerHTML = '<i class="booked"></i><span class="vl"></span>'; visits.push(v);
  }
  function wanted() {
    // which week gets a visit: weekly every week, every two weeks from the first, once only the first possible
    var out = [], k = KEYS.indexOf(S.day), n = 0;
    for (var w = 0; w < 4; w++) {
      var c = cells[w * 6 + k], ok = !c.disabled;
      var on = ok && (S.often === 'week' || (S.often === '2weeks' && n % 2 === 0) || (S.often === 'once' && n === 0));
      if (ok) n++;
      out.push(on ? c : null);
    }
    return out;
  }
  function label() { return S.kind === 'deep' ? 'Deep clean' : S.kind === 'once' ? 'One time' : '4 hours'; }
  function place(anim, stagger) {
    var to = wanted();
    visits.forEach(function (v, w) {
      var from = v.parentNode && v.getBoundingClientRect();
      v.querySelector('.vl').textContent = label();
      if (!to[w]) { if (v.parentNode) { v.classList.add('off'); setTimeout(function () { if (v.classList.contains('off')) v.remove(); }, still ? 0 : 220); } return; }
      var wasOff = !v.parentNode || v.classList.contains('off');
      v.classList.remove('off');
      if (v.parentNode !== to[w]) to[w].appendChild(v);
      if (!anim || still) { v.classList.add('in'); return; }
      if (from && !wasOff) { // slide across from where it was (FLIP)
        var r = v.getBoundingClientRect();
        v.style.transition = 'none'; v.style.transform = 'translateX(' + (from.left - r.left) + 'px)';
        v.getBoundingClientRect(); v.style.transition = ''; v.style.transform = '';
      } else { // land, one after another down the weeks
        v.classList.remove('in');
        setTimeout(function () { v.classList.add('in'); }, (stagger ? w * 120 : 0) + 30);
      }
    });
    cells.forEach(function (c) { c.setAttribute('aria-pressed', to.indexOf(c) >= 0 ? 'true' : 'false'); });
  }
  function firstDate() { var c = wanted().filter(Boolean)[0]; return c ? c._d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : ''; }
  function sentence() {
    var day = NAMES[S.day], p = '<b>₪' + PRICE + ' a visit</b>';
    if (S.kind === 'deep') return 'A deep clean on ' + firstDate() + '. We send the price for your home on WhatsApp.';
    if (S.often === 'once' || S.kind === 'once') return 'One visit on ' + firstDate() + '. We send the price for your home on WhatsApp.';
    if (S.often === '2weeks') return 'Every other ' + day + ', 4 hours. We send the price on WhatsApp.';
    return 'Every ' + day + ', 4 hours, ' + p + '.';
  }
  function draw(anim, stagger) {
    place(anim, stagger);
    $('sentence').innerHTML = $('pick-sentence').innerHTML = sentence();
    var L = [];
    if (S.same) L.push('The same cleaner each visit, please.');
    if (S.sup) L.push('Please bring equipment and supplies.');
    $('lines').innerHTML = $('pick-lines').innerHTML = L.map(function (l) { return '<li>' + l + '</li>'; }).join('');
    board.querySelectorAll('.pill').forEach(function (b) { b.setAttribute('aria-checked', b.dataset.often === S.often ? 'true' : 'false'); });
    glide();
    document.querySelectorAll('.toggle').forEach(function (b) {
      var k = b.dataset.opt, on = k === 'same' ? S.same : k === 'sup' ? S.sup : S.kind === k;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var q = 'often=' + (S.kind === 'regular' ? S.often : 'once') + '&day=' + S.day + '&kind=' + S.kind + (S.same ? '&same=1' : '') + (S.sup ? '&sup=1' : '');
    $('board-go').href = $('pick-go').href = 'book.html?' + q;
    // the phone bar follows the plan: the price only for the weekly 4-hour visit
    var bp = document.querySelector('#bar .p');
    if (bp) bp.innerHTML = S.kind === 'regular' && S.often === 'week' ? '<b>₪' + PRICE + ' a visit</b>Weekly, 4 hours' : '<b>Your plan</b>Price on WhatsApp';
  }
  // the highlight glides between the pills (T7)
  var gl = board.querySelector('.glide');
  function glide() {
    var on = board.querySelector('.pill[aria-checked=true]'); if (!on || !gl) return;
    gl.style.width = on.offsetWidth + 'px'; gl.style.transform = 'translateX(' + on.offsetLeft + 'px)';
  }
  addEventListener('resize', glide);
  board.addEventListener('click', function (e) {
    var c = e.target.closest('.day'), p = e.target.closest('.pill');
    if (c && !c.disabled) { S.day = c.dataset.d; draw(true); }
    if (p) { S.often = p.dataset.often; if (S.often !== 'once' && S.kind !== 'regular') S.kind = 'regular'; draw(true); }
  });
  // arrows move between the pills, as a radio group does
  board.querySelector('.pills').addEventListener('keydown', function (e) {
    var ps = [].slice.call(board.querySelectorAll('.pill')), i = ps.indexOf(document.activeElement);
    if (i < 0 || !/Arrow(Left|Right)/.test(e.key)) return;
    e.preventDefault(); var n = ps[(i + (e.key === 'ArrowRight' ? 1 : ps.length - 1)) % ps.length]; n.focus(); n.click();
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.toggle'); if (!b) return;
    var k = b.dataset.opt;
    if (k === 'same') S.same = !S.same;
    else if (k === 'sup') S.sup = !S.sup;
    else if (S.kind === k) { S.kind = 'regular'; S.often = 'week'; }
    else { S.kind = k; S.often = 'once'; }
    draw(true);
  });
  draw(false);
  // the first visit lands as the page arrives, then repeats down the weeks
  if (!still) { visits.forEach(function (v) { v.classList.remove('in'); v.remove(); }); setTimeout(function () { place(true, true); }, 1300); } // after the board has arrived
  // depth on laptops with a mouse (3u.6): the room moves at 0.35 of the scroll; never on touch or with reduced motion
  var ph = document.querySelector('.open-ph img');
  if (ph && !still && matchMedia('(pointer: fine) and (min-width: 901px)').matches) {
    var ticking = 0;
    addEventListener('scroll', function () {
      if (ticking) return; ticking = 1;
      requestAnimationFrame(function () { ticking = 0; var y = Math.min(scrollY, innerHeight); ph.style.transform = 'translateY(' + (y * .35) + 'px)'; });
    }, { passive: true });
  }
  board.classList.add('live');
})();
