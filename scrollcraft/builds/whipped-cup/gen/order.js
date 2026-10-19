(function () {
  // ── the order: written out on WhatsApp to +1 929 993 6768 (her menu card).
  // Each package says what it allows, and its choices sit under it (page
  // rules 3l): the Duo and the Cloud Bundle mix any flavours to exactly 2 or
  // 6 jars, One Flavour is one flavour, Assorted is a mix of all three.
  var WA = '19299936768';
  var JARS = { classic: ['Classic Cloud', 40], caramel: ['Caramel Cloud', 48], vanilla: ['Vanilla Cloud', 48] };
  var PACKS = {
    duo: { name: 'Try It Duo', price: 75, jars: 2, mode: 'mix', meta: '2 jars · Starter', allows: '2 jars, any flavours' },
    one: { name: 'One Flavour', price: 148, jars: 4, mode: 'one', meta: '4 jars · Weekly', allows: 'One flavour, 4 jars every week' },
    assorted: { name: 'Assorted', price: 155, jars: 4, mode: 'fixed', meta: '4 jars · Weekly', allows: 'A mix of all three flavours, every week' },
    bundle: { name: 'Cloud Bundle', price: 220, jars: 6, mode: 'mix', meta: '6 jars · Monthly · Best value', allows: 'Any 6 jars, mix and match' }
  };
  var saved = window.twcBasket.get(), qs = new URLSearchParams(location.search);
  var q = {}; Object.keys(JARS).forEach(function (k) { q[k] = Math.max(0, Math.min(20, +((saved.jars || {})[k]) || 0)); });
  var pack = PACKS[saved.pack] ? saved.pack : '';
  if (JARS[qs.get('jar')] && !q[qs.get('jar')]) q[qs.get('jar')] = 1;
  if (PACKS[qs.get('pack')]) pack = qs.get('pack');
  if (qs.toString()) history.replaceState(null, '', location.pathname);
  var mixQ = { classic: 0, caramel: 0, vanilla: 0 }, oneFlav = '';

  var lines = document.getElementById('lines');
  Object.keys(JARS).forEach(function (k) {
    var d = document.createElement('div'); d.className = 'line'; d.dataset.k = k;
    d.innerHTML = '<div><div class="nm">' + JARS[k][0] + '</div><div class="pr">₪' + JARS[k][1] + ' a jar</div></div>' +
      '<div class="step"><button type="button" data-d="-1" aria-label="One fewer ' + JARS[k][0] + '">−</button><output>0</output><button type="button" data-d="1" aria-label="One more ' + JARS[k][0] + '">+</button></div>';
    d.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; q[k] = Math.max(0, Math.min(20, q[k] + (+b.dataset.d))); update(); check(false); });
    lines.appendChild(d);
  });
  var plans = document.getElementById('plans');
  plans.innerHTML = Object.keys(PACKS).map(function (k) {
    var p = PACKS[k];
    return '<label class="plan"><input type="radio" name="pack" value="' + k + '"><span class="box"><span><b>' + p.name + '</b><br><span class="pr">' + p.meta + '</span></span><span class="p">₪' + p.price + '</span><span class="allows">' + p.allows + '</span></span></label>';
  }).join('') + '<label class="plan plan-none"><input type="radio" name="pack" value=""><span class="box"><span><b>No package</b><br><span class="pr">Jars only</span></span></span></label>';
  plans.addEventListener('change', function (e) { pack = e.target.value; mixQ = { classic: 0, caramel: 0, vanilla: 0 }; oneFlav = ''; drawMix(); update(); check(false); });

  var mix = document.getElementById('mix'), mixH = document.getElementById('mix-h'), mixLeft = document.getElementById('mix-left'), mixBody = document.getElementById('mix-body');
  function mixSum() { return mixQ.classic + mixQ.caramel + mixQ.vanilla; }
  function drawMix() {
    var p = PACKS[pack]; mix.hidden = !p; if (!p) return;
    mixH.textContent = p.name + ': ' + p.allows;
    if (p.mode === 'mix') {
      mixBody.innerHTML = Object.keys(JARS).map(function (k) {
        return '<div class="line" data-m="' + k + '"><div class="nm">' + JARS[k][0] + '</div><div class="step"><button type="button" data-d="-1" aria-label="One fewer ' + JARS[k][0] + ' in the package">−</button><output>0</output><button type="button" data-d="1" aria-label="One more ' + JARS[k][0] + ' in the package">+</button></div></div>';
      }).join('');
      [].forEach.call(mixBody.querySelectorAll('[data-m]'), function (l) {
        l.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; var k = l.dataset.m, d = +b.dataset.d;
          if (d > 0 && mixSum() >= p.jars) return; mixQ[k] = Math.max(0, mixQ[k] + d); drawMixState(); update(); check(false); });
      });
    } else if (p.mode === 'one') {
      mixBody.innerHTML = '<div class="chips">' + Object.keys(JARS).map(function (k) {
        return '<label class="chip"><input type="radio" name="oneflav" value="' + k + '"><span>' + JARS[k][0] + '</span></label>'; }).join('') + '</div>';
      mixBody.addEventListener('change', function (e) { if (e.target.name === 'oneflav') { oneFlav = e.target.value; update(); check(false); } });
    } else mixBody.innerHTML = '';
    drawMixState();
  }
  function drawMixState() {
    var p = PACKS[pack]; if (!p) return;
    if (p.mode === 'mix') {
      var left = p.jars - mixSum();
      mixLeft.textContent = left ? 'Choose ' + left + ' more jar' + (left > 1 ? 's' : '') : 'All ' + p.jars + ' jars chosen';
      [].forEach.call(mixBody.querySelectorAll('[data-m]'), function (l) { l.querySelector('output').textContent = mixQ[l.dataset.m]; l.querySelector('[data-d="1"]').disabled = !left; });
    } else mixLeft.textContent = p.mode === 'one' ? 'Pick your flavour' : 'Nothing to choose: we send a mix of Classic, Caramel and Vanilla Cloud';
  }
  function packDesc() {
    var p = PACKS[pack]; if (!p) return '';
    if (p.mode === 'mix') return Object.keys(mixQ).filter(function (k) { return mixQ[k]; }).map(function (k) { return mixQ[k] + ' ' + JARS[k][0]; }).join(', ');
    if (p.mode === 'one') return oneFlav ? '4 ' + JARS[oneFlav][0] : '';
    return 'a mix of all three flavours';
  }
  function total() { var t = 0; for (var k in q) t += q[k] * JARS[k][1]; if (PACKS[pack]) t += PACKS[pack].price; return t; }
  var send = document.getElementById('send');
  function update() {
    [].forEach.call(lines.querySelectorAll('.line'), function (l) { l.querySelector('output').textContent = q[l.dataset.k]; });
    [].forEach.call(plans.querySelectorAll('input'), function (i) { i.checked = i.value === pack; });
    var html = ''; for (var k in q) if (q[k]) html += '<li><span>' + q[k] + ' × ' + JARS[k][0] + '</span><span>₪' + q[k] * JARS[k][1] + '</span></li>';
    if (PACKS[pack]) html += '<li><span>' + PACKS[pack].name + (packDesc() ? ': ' + packDesc() : '') + '</span><span>₪' + PACKS[pack].price + '</span></li>';
    document.getElementById('sum-list').innerHTML = html || '<li><span>Nothing yet</span></li>';
    document.getElementById('total').textContent = '₪' + total();
    send.firstElementChild.textContent = total() ? 'Send order on WhatsApp, ₪' + total() : 'Send order on WhatsApp';
    var b = { jars: {} }; for (var k2 in q) if (q[k2]) b.jars[k2] = q[k2]; if (pack) b.pack = pack; window.twcBasket.set(b);
  }
  function v(id) { return document.getElementById(id).value.trim(); }
  function mark(id, msg) { var w = document.getElementById('w-' + id) || document.getElementById('c-' + id); if (w) w.classList.toggle('bad', !!msg); document.getElementById('e-' + id).textContent = msg || ''; }
  function check(show) {
    var ok = true, e, p = PACKS[pack];
    e = total() ? '' : 'Add a jar or choose a package';
    if (!e && p && p.mode === 'mix' && mixSum() !== p.jars) e = 'Choose ' + (p.jars - mixSum()) + ' more jar' + (p.jars - mixSum() > 1 ? 's' : '') + ' for the ' + p.name;
    if (!e && p && p.mode === 'one' && !oneFlav) e = 'Pick the flavour for One Flavour';
    if (e) ok = false; if (show || !e) mark('items', e);
    e = v('addr') ? '' : 'Where should we deliver?'; if (e) ok = false; if (show || !e) mark('addr', e);
    e = v('when') ? '' : 'Choose the day'; if (e) ok = false; if (show || !e) mark('when', e);
    e = v('me') ? '' : 'Your name, please'; if (e) ok = false; if (show || !e) mark('me', e);
    e = /\d{9,}/.test(v('ph').replace(/\D/g, '')) ? '' : 'A phone number we can reach you on'; if (e) ok = false; if (show || !e) mark('ph', e);
    return ok;
  }
  ['addr', 'when', 'me', 'ph'].forEach(function (id) { document.getElementById(id).addEventListener('input', function () { check(false); }); });
  document.getElementById('when').min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  document.getElementById('form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!check(true)) { var bad = document.querySelector('.bad .fld'); if (bad) bad.focus(); else document.getElementById('c-items').scrollIntoView({ block: 'center' }); return; }
    var out = ['Hi The Whipped Cup, I would like to order:'];
    for (var k in q) if (q[k]) out.push('• ' + q[k] + ' × ' + JARS[k][0] + ' (₪' + q[k] * JARS[k][1] + ')');
    if (PACKS[pack]) { out.push('• ' + PACKS[pack].name + ', ' + PACKS[pack].meta.replace(/ · /g, ', ') + ' (₪' + PACKS[pack].price + ')'); out.push('   ' + packDesc()); }
    if (v('note')) out.push('Notes: ' + v('note'));
    out.push('Total: ₪' + total());
    out.push('Deliver to: ' + v('addr'));
    out.push('First delivery: ' + new Date(v('when') + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }));
    out.push('Name: ' + v('me') + ', ' + v('ph'));
    var url = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(out.join('\n'));
    var tab = window.open(url, '_blank'); if (!tab) location.href = url;
  });
  drawMix(); update();
})();
