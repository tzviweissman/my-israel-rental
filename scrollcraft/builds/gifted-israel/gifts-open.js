// The opening (Tzvi, 5 Nov 2026): their pieces fall into a heap on the floor; choose an occasion and its pieces rise out of the
// heap and flow into a line. The heap is worked out in depth: each piece lands somewhere on the floor (near or far) on top of
// what is already there, then is drawn smaller and dimmer the further back and deeper it lies, tilted the way it landed.
// Transforms only, one loop that stops when everything is still. Words never move with the pieces.
(function () {
  var D = window.GIFTS, st = document.getElementById('gifts'), lay = document.getElementById('g-pile'), caps = document.getElementById('g-caps'), words = document.getElementById('g-words');
  if (!D || !st || !lay) return;
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches, money = window.GI.money;
  st.classList.add('live');
  // a phone holds fewer: the chosen pieces come first in the list, so all of them are always there
  var pool = st.clientWidth < 760 ? D.pool.slice(0, 66) : D.pool;
  var P = pool.map(function (g, i) {
    var el = document.createElement('img');
    el.src = 'assets/g/' + g.id + '.webp'; el.alt = ''; el.width = g.w; el.height = g.h; el.decoding = 'async';
    lay.appendChild(el);
    var p = { g: g, el: el, i: i, x: 0, y: 0, r: 0, s: 1, a: 0, b: 0, vx: 0, vy: 0, vr: 0, vs: 0, va: 0, vb: 0, tx: 0, ty: 0, tr: 0, ts: 1, ta: 0, tb: 0, rest: {}, up: false, fall: true, wait: 0, side: 0, done: false };
    el.addEventListener('click', function () { location.href = 'shop.html?p=' + g.id; });
    // a piece on the floor hops when the pointer touches it
    el.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse' && !p.up && !p.fall) { p.vy = -170; p.fall = true; p.done = false; shade(p); wake(); } });
    return p;
  });
  var W, H, S, now = null, seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }

  function layout() {
    W = st.clientWidth; H = st.clientHeight; seed = 7;
    S = Math.max(70, Math.min(W / (W < 760 ? 4.4 : 9.5), H / 5.6));
    var phone = W < 760, GX = phone ? 10 : 26, GZ = 7, grid = [], top = 0, band = H * (phone && H > 700 ? .17 : .14), lift = H * (phone && H > 700 ? .1 : .075);
    var front = H - S * .34, back = front - band;
    for (var i = 0; i < GX * GZ; i++) grid[i] = 0;
    // lay each piece where three tries find the lowest spot, favouring the middle, so a mound builds up
    P.forEach(function (p) {
      var best = null;
      for (var t = 0; t < 3; t++) {
        var u = phone ? rnd() : (rnd() + rnd() + rnd()) / 3 * .5 + rnd() * .5, v = rnd(), gx = Math.min(GX - 1, Math.floor(u * GX)), gz = Math.min(GZ - 1, Math.floor(v * GZ)), h = 0;
        for (var dx = -1; dx <= 1; dx++) for (var dz = 0; dz <= 1; dz++) { var ix = gx + dx, iz = gz + dz; if (ix >= 0 && ix < GX && iz < GZ) h = Math.max(h, grid[iz * GX + ix]); }
        var score = h + Math.abs(u - .5) * 1.5;
        if (!best || score < best.score) best = { score: score, u: u, v: v, h: h, gx: gx, gz: gz };
      }
      for (var ax = -1; ax <= 1; ax++) for (var az = 0; az <= 1; az++) { var jx = best.gx + ax, jz = best.gz + az; if (jx >= 0 && jx < GX && jz < GZ) grid[jz * GX + jx] = best.h + (ax === 0 ? 1 : .55); }
      p.u = best.u; p.v = best.v; p.h = best.h; top = Math.max(top, best.h);
    });
    P.forEach(function (p) {
      var k = Math.max(p.g.w, p.g.h), v = p.v, hh = top ? p.h / top : 0, sc = .66 + v * .5 + hh * .08;
      var w = p.g.w / k * S, h = p.g.h / k * S;
      p.el.style.width = w + 'px'; p.el.style.height = h + 'px'; p.w = w; p.pw = h;
      var ceil = back - lift - S * .25, cy = Math.max(back + (front - back) * v - hh * lift, ceil + Math.max(w, h) * sc * .62), cx = S * .3 + p.u * (W - S * .6);
      p.rest = {
        x: cx - w / 2, y: cy - h / 2, s: sc, r: (rnd() - .5) * 70,
        a: 18 + rnd() * 38, b: (rnd() - .5) * 46,                                      // lying back, and turned, the way it landed
        d: Math.max(.66, Math.min(1, .72 + hh * .2 + v * .14)), z: Math.round(v * 40 + p.h * 12)   // further back and deeper is dimmer, and drawn first
      };
      p.el.style.zIndex = p.rest.z;
    });
    // the line stops above the top of the heap
    lay.style.setProperty('--heap', Math.round(H - (back - lift - S * .25)) + 'px');
  }

  function aim(p) { p.tx = p.rest.x; p.ty = p.rest.y; p.tr = p.rest.r; p.ts = p.rest.s; p.ta = p.rest.a; p.tb = p.rest.b; }
  function shade(p) { p.el.style.filter = p.up || p.fall ? 'none' : 'brightness(' + p.rest.d + ')'; }

  function slots(n) {
    var top = words.getBoundingClientRect().bottom - st.getBoundingClientRect().top + (W < 760 ? 8 : 18);
    var bottom = H - parseFloat(lay.style.getPropertyValue('--heap')), rows = W < 760 ? 2 : 1, cols = Math.ceil(n / rows), g = Math.max(14, W * .03);
    var sw = (W - g * 2) / cols, capH = 30, L = Math.max(56, Math.min(sw - 14, (bottom - top) / rows - capH, 230)), out = [];
    var y0 = top + Math.max(0, (bottom - top - rows * (L + capH)) / 2);
    for (var i = 0; i < n; i++) { var r = rows === 2 ? Math.floor(i / cols) : 0; out.push({ x: g + sw * (i - r * cols + .5), y: y0 + r * (L + capH), L: L, sw: sw }); }
    return out;
  }

  function choose(name, instant, stag) {
    now = name;
    mark(name);
    var ids = D.occ[name], sl = slots(ids.length), html = '', row = {}, left = 0;
    P.forEach(function (p) {
      var k = ids.indexOf(p.g.id);
      if (k < 0) {
        if (p.up) { p.fall = true; p.vy = 0; p.done = false; p.wait = instant ? 0 : left++ * .05; }
        p.up = false; aim(p); p.el.style.zIndex = p.rest.z; if (p.fall) shade(p);
        return;
      }
      var s = sl[k], sc = s.L / Math.max(p.w, p.pw);
      p.up = true; p.fall = false; p.done = false; p.wait = instant ? 0 : k * (stag || .19); p.side = instant ? 0 : .12;
      p.tx = s.x - p.w / 2; p.ty = s.y + (s.L - p.pw) / 2; p.tr = 0; p.ta = 0; p.tb = 0; p.ts = sc;
      p.el.style.zIndex = 200 + k; shade(p);
      row[k] = '<a class="g-cap" href="shop.html?p=' + p.g.id + '" style="left:' + (s.x - s.sw / 2) + 'px;top:' + s.y + 'px;width:' + s.sw + 'px;height:' + (s.L + 30) + 'px;--d:' + (instant ? 0 : Math.round((k * (stag || .19) + .75) * 1000)) + 'ms"><span>' + p.g.name.replace(/&/g, '&amp;') + '</span><b>' + money(p.g.price) + '</b></a>';
    });
    ids.forEach(function (id, k) { html += row[k] || ''; });
    caps.innerHTML = html;
    if (instant) P.forEach(snap); else wake();
  }
  function snap(p) { p.x = p.tx; p.y = p.ty; p.r = p.tr; p.s = p.ts; p.a = p.ta; p.b = p.tb; p.vx = p.vy = p.vr = p.vs = p.va = p.vb = 0; p.fall = false; p.done = true; shade(p); put(p); }
  function put(p) {
    p.el.style.willChange = p.done ? 'auto' : 'transform';
    p.el.style.transform = 'translate3d(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px,0) perspective(620px) rotateX(' + p.a.toFixed(1) + 'deg) rotateY(' + p.b.toFixed(1) + 'deg) rotate(' + p.r.toFixed(1) + 'deg) scale(' + p.s.toFixed(3) + ')';
  }

  var raf = 0, last = 0;
  function wake() { if (!raf && !still) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  function spring(p, a, t, dt, K, C) { var v = 'v' + a; p[v] += (K * (t - p[a]) - C * p[v]) * dt; p[a] += p[v] * dt; }
  function tick(t) {
    var dt = Math.min(.033, (t - last) / 1000), busy = false; last = t;
    P.forEach(function (p) {
      if (p.wait > 0) { p.wait -= dt; busy = true; return; }
      if (p.done && !p.fall) return; // lying still: nothing to redraw
      if (p.fall) { // gravity, one small bounce, then it lies still
        p.vy += 2600 * dt; p.y += p.vy * dt;
        if (p.y >= p.ty) { p.y = p.ty; p.vy = Math.abs(p.vy) < 170 ? 0 : -p.vy * .28; if (!p.vy) { snap(p); return; } }
        spring(p, 'r', p.tr, dt, 60, 11); spring(p, 'x', p.tx, dt, 60, 13); spring(p, 's', p.ts, dt, 90, 16); spring(p, 'a', p.ta, dt, 70, 12); spring(p, 'b', p.tb, dt, 70, 12);
        busy = true;
      } else {
        // a rising piece goes straight up first, then flows sideways into its place in the line, turning to face you
        if (p.side > 0) p.side -= dt; else spring(p, 'x', p.tx, dt, 95, 15);
        spring(p, 'y', p.ty, dt, 105, 16); spring(p, 'r', p.tr, dt, 90, 15); spring(p, 's', p.ts, dt, 105, 17); spring(p, 'a', p.ta, dt, 80, 14); spring(p, 'b', p.tb, dt, 80, 14);
        if (p.side > 0 || Math.abs(p.x - p.tx) + Math.abs(p.y - p.ty) > .4 || Math.abs(p.vy) + Math.abs(p.vx) > 2 || Math.abs(p.s - p.ts) > .002 || Math.abs(p.r - p.tr) + Math.abs(p.a - p.ta) + Math.abs(p.b - p.tb) > .2) busy = true; else { snap(p); return; }
      }
      put(p);
    });
    raf = busy ? requestAnimationFrame(tick) : 0;
  }

  function mark(name) { [].forEach.call(document.querySelectorAll('#g-occ .chip'), function (b) { b.setAttribute('aria-pressed', b.textContent === name ? 'true' : 'false'); }); }
  var tap = 0, touched = false, first = Object.keys(D.occ)[0];
  document.getElementById('g-occ').addEventListener('click', function (e) { var b = e.target.closest('.chip'); if (!b) return; touched = true; mark(b.textContent); clearTimeout(tap); tap = setTimeout(function () { if (b.textContent !== now) choose(b.textContent, still); }, still ? 0 : 260); });
  layout();
  P.forEach(function (p) { aim(p); p.x = p.rest.x + (rnd() - .5) * 40; p.y = -p.pw - rnd() * H * .25; p.r = p.rest.r + (rnd() - .5) * 120; p.a = rnd() * 60; p.b = (rnd() - .5) * 60; p.s = p.rest.s; });
  // those deepest in the heap land first
  P.slice().sort(function (x, y) { return x.rest.z - y.rest.z; }).forEach(function (p, i) { p.wait = i * (P.length > 70 ? .0085 : .012); });
  if (still) { lay.classList.add('on'); choose(first, true); P.forEach(snap); } else {
    P.forEach(put);
    // start once the pictures are in, or after a moment with those that are
    var go = false;
    var start = function () { if (go) return; go = true; lay.classList.add('on'); wake(); setTimeout(function () { if (!touched && now === null) choose(first, false, .09); }, 1400); };
    // scrolled away before it finished: nothing keeps flying behind the page
    var away = function () { if (scrollY < 40) return; removeEventListener('scroll', away); if (!touched) { P.forEach(function (p) { p.wait = 0; }); choose(first, true); } };
    addEventListener('scroll', away, { passive: true });
    Promise.all(P.map(function (p) { return p.el.decode ? p.el.decode().catch(function () {}) : 0; })).then(start); setTimeout(start, 1400);
  }
  var rs = 0;
  addEventListener('resize', function () {
    clearTimeout(rs);
    rs = setTimeout(function () {
      if (st.clientWidth === W && Math.abs(st.clientHeight - H) < 90) return;
      layout(); P.forEach(aim);
      if (now) choose(now, true); else P.forEach(snap);
    }, 150);
  });
})();
