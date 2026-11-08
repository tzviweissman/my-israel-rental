// The opening: six guitar strings along the neck and over the soundhole of a guitar (like the one in Aaron's flyer), drawn in code.
// They are strummed once as the page arrives and again as you start to scroll; pass the mouse across them
// (or tap one) to pluck it. "Sound off" turns on a G major chord, one note per string. Reduced motion: still.
(function () {
  var cv = document.getElementById('strings'); if (!cv) return;
  var cx = cv.getContext('2d'), still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 0, H = 0, dpr = 1, wall = null, S = [], raf = 0;
  // low E at the top, as a player looks down at the guitar; the chord is G major (3 2 0 0 0 3)
  var GAUGE = [11, 9.4, 7.8, 5.6, 4.4, 3.4], WOUND = [1, 1, 1, 1, 0, 0], HZ = [98.0, 123.47, 146.83, 196.0, 246.94, 392.0];

  // the guitar is a generated still with no strings of its own (gen/guitar-brief.md, gen/guitar.py); the strings stay code so they can ring
  var pics = {}, FILE = { wide: 'assets/guitar-wide.webp', tall: 'assets/guitar-tall.webp' };
  function drawWall() {
    var kind = W / H < .9 ? 'tall' : 'wide', img = pics[kind];
    if (!img) { img = pics[kind] = new Image(); img.onload = function () { drawWall(); draw(performance.now()); }; img.src = FILE[kind]; return; }
    if (!img.complete || !img.naturalWidth) return;
    wall = document.createElement('canvas'); wall.width = W * dpr; wall.height = H * dpr;
    var g = wall.getContext('2d'), k = Math.max(wall.width / img.naturalWidth, wall.height / img.naturalHeight), iw = img.naturalWidth * k, ih = img.naturalHeight * k;
    g.drawImage(img, (wall.width - iw) / 2, (wall.height - ih) / 2, iw, ih);
  }
  function layout() {
    var r = cv.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, r.width < 760 ? 1.5 : 2);
    W = r.width; H = r.height; if (W < 2 || H < 2) { requestAnimationFrame(layout); return; } cv.width = W * dpr; cv.height = H * dpr;
    // on the neck in the picture: where its edges fall on this screen, however the picture is fitted to it
    var tall = W / H < .9, ih = Math.max(H, W * (tall ? 16 / 9 : 9 / 16)), y0 = (H - ih) / 2, a = tall ? .252 : .308, b = tall ? .424 : .608;
    var top = y0 + a * ih, gap = (b - a) * ih / 5;
    S = GAUGE.map(function (g, i) { var o = S[i] || {}; return { y: top + i * gap, g: g * (W < 760 ? .6 : Math.min(1.25, W / 1280)), wound: WOUND[i], a: o.a || 0, t0: o.t0 || 0, p: o.p || .5, f: 6.2 + i * .55 }; });
    drawWall(); draw(performance.now());
  }
  function pluck(i, at, amp) {
    var s = S[i]; if (!s) return;
    s.t0 = performance.now(); s.a = Math.min(18, amp); s.p = Math.max(.08, Math.min(.92, at));
    if (audio) note(i, Math.min(1, amp / 14));
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function strum() { if (still) return; S.forEach(function (s, i) { setTimeout(function () { pluck(i, .62, 13 - i); }, i * 70); }); }
  function off(s, x, now) {
    // the string's shape while it rings: two modes from where it was plucked, slowing and dying away
    var t = (now - s.t0) / 1000, e = s.a * Math.exp(-t * 2.6); if (e < .25) return 0;
    var u = x / W;
    return e * (Math.sin(Math.PI * u) * Math.cos(2 * Math.PI * s.f * t) + .35 * Math.sin(2 * Math.PI * u) * Math.sin(Math.PI * 2 * s.p) * Math.cos(2 * Math.PI * s.f * 1.9 * t));
  }
  function draw(now) {
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (wall) cx.drawImage(wall, 0, 0, W, H); else { cx.fillStyle = '#C98A34'; cx.fillRect(0, 0, W, H); }
    var live = false, step = Math.max(10, W / 90);
    S.forEach(function (s) {
      var pts = []; for (var x = 0; x <= W + step; x += step) { var d = off(s, x, now); if (d) live = true; pts.push([x, s.y + d]); }
      function line(dy, w, col) { cx.beginPath(); pts.forEach(function (p, k) { k ? cx.lineTo(p[0], p[1] + dy) : cx.moveTo(p[0], p[1] + dy); }); cx.lineWidth = w; cx.strokeStyle = col; cx.stroke(); }
      line(s.g * .9 + 4, s.g * 1.3, 'rgba(60,34,10,.16)'); line(s.g * .9 + 3, s.g * .7, 'rgba(60,34,10,.28)'); // its soft shadow on the wood
      line(0, s.g, s.wound ? '#5E4220' : '#6E6A62');                              // the dark edge
      line(-s.g * .06, s.g * .78, s.wound ? '#A7793F' : '#B8B4AA');               // bronze wound, or plain steel
      if (s.wound) { cx.setLineDash([s.g * .22, s.g * .26]); line(0, s.g * .74, 'rgba(70,45,15,.55)'); cx.setLineDash([]); }
      line(-s.g * .26, Math.max(.8, s.g * .22), s.wound ? 'rgba(255,224,160,.9)' : 'rgba(255,255,248,.95)'); // the light along its top
    });
    return live;
  }
  function loop(now) { raf = 0; if (draw(now)) raf = requestAnimationFrame(loop); }

  // the pointer crossing a string plucks it there; a tap near one plucks it too
  var lastY = null;
  cv.parentNode.addEventListener('pointermove', function (e) {
    if (still || e.pointerType !== 'mouse') return;
    var r = cv.getBoundingClientRect(), y = e.clientY - r.top, x = e.clientX - r.left;
    if (lastY !== null) S.forEach(function (s, i) { if ((lastY - s.y) * (y - s.y) < 0) pluck(i, x / W, Math.min(14, 4 + Math.abs(y - lastY) * .5)); });
    lastY = y;
  });
  cv.parentNode.addEventListener('pointerleave', function () { lastY = null; });
  cv.parentNode.addEventListener('pointerdown', function (e) {
    if (still || e.target.closest('a, button')) return;
    var r = cv.getBoundingClientRect(), y = e.clientY - r.top, best = -1, bd = 26;
    S.forEach(function (s, i) { var d = Math.abs(s.y - y); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) pluck(best, (e.clientX - r.left) / W, 12);
  });
  // the first scroll strums them again, low to high; back at the top they are ready for the next one
  var armed = true;
  addEventListener('scroll', function () { if (scrollY > innerHeight * .12 && armed) { armed = false; strum(); } else if (scrollY < 4) armed = true; }, { passive: true });

  // sound: off until asked for, then each pluck plays its string's note of the G chord (Karplus-Strong)
  var audio = null, btn = document.getElementById('sound');
  function note(i, vol) {
    var sr = audio.sampleRate, n = Math.round(sr / HZ[i]), len = sr * 2.2, buf = audio.createBuffer(1, len, sr), d = buf.getChannelData(0), ring = new Float32Array(n);
    for (var k = 0; k < n; k++) ring[k] = Math.random() * 2 - 1;
    for (var j = 0, p = 0; j < len; j++) { var nx = (p + 1) % n; d[j] = ring[p]; ring[p] = (ring[p] + ring[nx]) * .4985; p = nx; }
    var src = audio.createBufferSource(), gn = audio.createGain(); gn.gain.value = .22 * vol; src.buffer = buf; src.connect(gn).connect(audio.destination); src.start();
  }
  if (btn) btn.addEventListener('click', function () {
    var on = btn.getAttribute('aria-pressed') !== 'true';
    if (on && !audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } }
    if (audio) { if (on) audio.resume(); else audio.suspend(); }
    btn.setAttribute('aria-pressed', on); btn.textContent = on ? 'Sound on' : 'Sound off';
    if (on) strum(); else if (audio) { audio.close(); audio = null; }
  });

  var rt = 0; addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(layout, 150); });
  layout();
  setTimeout(strum, 650);
})();
