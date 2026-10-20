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
  if (JARS[qs.get('jar')]) q[qs.get('jar')] = Math.max(q[qs.get('jar')], Math.min(20, +qs.get('n') || 1));  // ?jar=classic&n=3 from "How many coffees?"
  if (PACKS[qs.get('pack')]) pack = qs.get('pack');
  if (qs.toString()) history.replaceState(null, '', location.pathname);
  var mixQ = { classic: 0, caramel: 0, vanilla: 0 }, oneFlav = '';

  // ── the stage: one flavour at a time, big (Tzvi's product pages, 20 Oct 2026, inspo
  // product-pages-2026-10-20: one product per screen, the choice recolours it, quantity and the
  // total in the button). Choosing another flavour crossfades the jar and tints the stage.
  var stage = document.getElementById('jars'), sel = 'classic', n = 1;
  var DESC = { classic: 'Original whipped coffee', caramel: 'Whipped coffee and caramel', vanilla: 'Whipped coffee and vanilla' };
  var stN = document.getElementById('st-n'), stAdd = document.getElementById('st-add'), stIn = document.getElementById('st-in');
  function label() { stAdd.firstElementChild.textContent = 'Add ' + (n === 1 ? 'a jar' : n + ' jars') + ', ₪' + n * JARS[sel][1]; stN.textContent = n;
    stIn.textContent = q[sel] ? 'In your basket: ' + q[sel] + ' ' + JARS[sel][0] : ''; }
  function show(k) {
    sel = k; stage.dataset.flav = k;
    [].forEach.call(stage.querySelectorAll('.st-ph img'), function (i) { i.classList.toggle('on', i.dataset.flav === k); });
    [].forEach.call(stage.querySelectorAll('.st-pick button'), function (b) { b.setAttribute('aria-pressed', b.dataset.flav === k ? 'true' : 'false'); });
    document.getElementById('st-name').textContent = JARS[k][0]; document.getElementById('st-desc').textContent = DESC[k];
    document.getElementById('st-price').textContent = '₪' + JARS[k][1];
    label();
  }
  stage.querySelector('.st-pick').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) show(b.dataset.flav); });
  stage.querySelector('.st-buy .step').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; n = Math.max(1, Math.min(20, n + (+b.dataset.d))); label(); });
  stAdd.addEventListener('click', function () {
    q[sel] = Math.min(20, q[sel] + n); n = 1; update(); check(false); label();
    stAdd.classList.add('added'); setTimeout(function () { stAdd.classList.remove('added'); }, 900);
  });
  var plans = document.getElementById('plans');
  // what a package saves against the same jars bought one by one, from her own prices (Tzvi, 20 Oct
  // 2026: "people feel like they are getting a deal ... it should show what they save"). Honest: the
  // range is real, "up to" is its top, and the price a jar is the package price divided by its jars.
  function singles(k) { var p = PACKS[k]; if (p.mode === 'fixed') return [40 + 48 + 48 + 40, 40 + 48 + 48 + 48]; return [p.jars * 40, p.jars * 48]; }
  // shown the way shops show a deal (Tzvi, 20 Oct 2026, from the strawberry video: the original price
  // with a slash through it next to the price, and a short badge, not a sentence). The jars bought one
  // by one at the lowest single price, so the saving is always true whatever the flavours.
  function was(k) { return singles(k)[0]; }
  plans.innerHTML = Object.keys(PACKS).map(function (k) {
    var p = PACKS[k];
    return '<label class="plan"><input type="radio" name="pack" value="' + k + '"><span class="box"><span><b>' + p.name + '</b><br><span class="pr">' + p.meta + '</span></span><span class="p"><s class="was" aria-label="instead of ₪' + was(k) + '">₪' + was(k) + '</s> ₪' + p.price + '</span><span class="allows">' + p.allows + '</span><span class="save-b">Save ₪' + (was(k) - p.price) + '</span></span></label>';
  }).join('') + '<label class="plan plan-none"><input type="radio" name="pack" value=""><span class="box"><span><b>No package</b><br><span class="pr">Jars only</span></span></span></label>';
  plans.addEventListener('change', function (e) { if (e.target.name !== 'pack') return; pack = e.target.value; mixQ = { classic: 0, caramel: 0, vanilla: 0 }; oneFlav = ''; drawMix(); update(); check(false);
    if (!mix.hidden) mix.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); });

  var mix = document.getElementById('mix'), mixH = document.getElementById('mix-h'), mixLeft = document.getElementById('mix-left'), mixBody = document.getElementById('mix-body');
  function mixSum() { return mixQ.classic + mixQ.caramel + mixQ.vanilla; }
  function drawMix() {
    var p = PACKS[pack]; mix.hidden = !p; if (!p) return;
    // the choices sit right under the package they belong to (page rules 3l; Tzvi, 20 Oct 2026:
    // "it doesn't let me choose which flavours I want", the choices were below every package)
    var lab = plans.querySelector('input[value="' + pack + '"]'); if (lab) lab.closest('label').after(mix);
    mixH.textContent = p.mode === 'mix' ? 'Choose your ' + p.jars + ' jars' : p.mode === 'one' ? 'Choose your flavour' : p.name + ': ' + p.allows;
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
    [].forEach.call(plans.querySelectorAll('input'), function (i) { i.checked = i.value === pack; });
    var html = ''; for (var k in q) if (q[k]) html += '<li class="bl"><span>' + JARS[k][0] + '<span class="step sm"><button type="button" data-k="' + k + '" data-d="-1" aria-label="One fewer ' + JARS[k][0] + '">−</button><output>' + q[k] + '</output><button type="button" data-k="' + k + '" data-d="1" aria-label="One more ' + JARS[k][0] + '">+</button></span></span><span>₪' + q[k] * JARS[k][1] + '</span></li>';
    if (PACKS[pack]) html += '<li><span>' + PACKS[pack].name + (packDesc() ? ': ' + packDesc() : '') + '</span><span>₪' + PACKS[pack].price + '</span></li>';
    document.getElementById('sum-list').innerHTML = html || '<li><span>Nothing yet</span></li>';
    // single jars a package would make cheaper: say so, with one tap to switch (the deal, shown honestly)
    var deal = document.getElementById('deal'), jn = 0, cost = 0, kinds = []; for (var kq in q) if (q[kq]) { jn += q[kq]; cost += q[kq] * JARS[kq][1]; kinds.push(kq); }
    var sw = '';
    var extra = '';
    if (!pack) {
      if (jn === 2 && cost > 75) sw = 'duo';
      else if (jn === 4 && kinds.length === 1 && cost > 148) sw = 'one';
      else if (jn === 4 && kinds.length === 3 && cost > 155) sw = 'assorted';
      else if (jn === 6 && cost > 220) sw = 'bundle';
      else if (jn === 5 && cost > 220) { sw = 'bundle'; extra = ' and a 6th jar'; }  // one more jar, for less
    }
    deal.hidden = !sw;
    // the deal shown, not described (old price struck through)
    if (sw) { deal.dataset.pack = sw; deal.querySelector('span').innerHTML = extra ? 'Make it 6 jars: Cloud Bundle <s>₪' + cost + '</s> ₪220' : 'As the ' + PACKS[sw].name + ': <s>₪' + cost + '</s> ₪' + PACKS[sw].price; }
    document.getElementById('total').textContent = '₪' + total();
    send.firstElementChild.textContent = total() ? 'Send order on WhatsApp, ₪' + total() : 'Send order on WhatsApp';
    var b = { jars: {} }; for (var k2 in q) if (q[k2]) b.jars[k2] = q[k2]; if (pack) b.pack = pack; window.twcBasket.set(b);
    var bar = document.querySelector('#bar .p'), jarsN = 0; for (var k3 in q) jarsN += q[k3];
    var barBtn = document.querySelector('#bar .btn'); if (barBtn) { barBtn.textContent = 'Basket'; barBtn.setAttribute('href', '#order'); }
    if (bar) bar.innerHTML = total() ? '<b>Basket, ₪' + total() + '</b>' + (jarsN ? jarsN + ' jar' + (jarsN > 1 ? 's' : '') : '') + (pack ? (jarsN ? ' and ' : '') + PACKS[pack].name : '') : '<b>From ₪40 a jar</b>Each jar makes 3 to 4 coffees';
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
    if (PACKS[pack]) { var pk = PACKS[pack], every = /Weekly/.test(pk.meta) ? ', weekly' : /Monthly/.test(pk.meta) ? ', monthly' : ''; out.push('• ' + pk.name + ', ' + pk.jars + ' jars' + every + ' (₪' + pk.price + ')'); out.push('   ' + packDesc()); }
    if (v('note')) out.push('Notes: ' + v('note'));
    out.push('Total: ₪' + total());
    out.push('Deliver to: ' + v('addr'));
    out.push('First delivery: ' + new Date(v('when') + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }));
    out.push('Name: ' + v('me') + ', ' + v('ph'));
    var url = 'https://wa.me/' + WA + '?text=' + encodeURIComponent(out.join('\n'));
    var tab = window.open(url, '_blank'); if (!tab) location.href = url;
  });
  document.getElementById('deal').querySelector('button').addEventListener('click', function () {
    var k = document.getElementById('deal').dataset.pack; pack = k; oneFlav = ''; mixQ = { classic: 0, caramel: 0, vanilla: 0 };
    if (PACKS[k].mode === 'one') { for (var j in q) if (q[j]) oneFlav = j; } else { for (var j2 in q) mixQ[j2] = q[j2]; }
    for (var j3 in q) q[j3] = 0; drawMix();
    if (oneFlav) { var r = document.querySelector('input[name=oneflav][value="' + oneFlav + '"]'); if (r) r.checked = true; }
    drawMixState(); update(); check(false); label();
  });
  document.getElementById('sum-list').addEventListener('click', function (e) { var b = e.target.closest('button[data-k]'); if (!b) return; q[b.dataset.k] = Math.max(0, Math.min(20, q[b.dataset.k] + (+b.dataset.d))); update(); check(false); label(); });
  show(JARS[qs.get('jar')] ? qs.get('jar') : 'classic');
  drawMix(); update();
  if (PACKS[qs.get('pack')]) setTimeout(function () { var l = plans.querySelector('input[value="' + pack + '"]'); if (l) l.closest('label').scrollIntoView({ block: 'center' }); }, 60);
})();
