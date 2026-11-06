// The opening: the camera and a warm light go round their real board with the scroll, one part per step (CONCEPT.md).
// Only transform and opacity change, so it stays smooth on a phone. Positions are measured on the owner's photo.
(function () {
  var sec = document.getElementById('board'), stage = document.getElementById('stage'), scene = document.getElementById('scene');
  var still = matchMedia('(prefers-reduced-motion: reduce)');
  // where each part sits in the photo, as fractions of it: x, y, half width, half height (src/owner/p02.jpg)
  var PART = [null, [.345, .335, .255, .19], [.72, .3, .17, .19], [.265, .7, .225, .2], [.71, .655, .22, .225], [.468, .535, .14, .17], null];
  var WIDE = { w: 4000, h: 2250, x: 1700, y: 225, pw: 2250, ph: 1800 }, TALL = { w: 2250, h: 5000, x: 0, y: 330, pw: 2250, ph: 1800 };
  var dims = [].slice.call(scene.querySelectorAll('.dim')), chaps = [].slice.call(sec.querySelectorAll('.chaps li'));
  var w0 = document.getElementById('w0'), w6 = document.getElementById('w6');
  var keys = [], last = -1, tick = 0;

  function layout() {
    var W = stage.clientWidth, H = stage.clientHeight, tall = matchMedia('(max-aspect-ratio: 1/1)').matches, C = tall ? TALL : WIDE;
    var c = Math.max(W / C.w, H / C.h), ox = tall ? (W - C.w * c) / 2 : W - C.w * c, oy = tall ? 0 : (H - C.h * c) / 2;
    keys = PART.map(function (p) {
      if (!p) return { s: 1, x: 0, y: 0 };
      var fx = ox + (C.x + p[0] * C.pw) * c, fy = oy + (C.y + p[1] * C.ph) * c, rw = p[2] * C.pw * c, rh = p[3] * C.ph * c;
      var s = Math.max(1, Math.min(tall ? (p[2] < .15 ? 2.2 : 1.45) : 1.5, .82 * W / (2 * rw), .6 * H / (2 * rh)));
      var x = Math.min(0, Math.max(W * (1 - s), W * (tall ? (p[2] < .15 ? .5 : p[0] < .5 ? .4 : .58) : .56) - fx * s)), y = Math.min(0, Math.max(H * (1 - s), H * (tall ? .44 : p[1] > .5 ? .6 : .48) - fy * s));
      return { s: s, x: x, y: y, fx: fx, fy: fy, rw: rw, rh: rh };
    });
    dims.forEach(function (d) {
      var k = keys[+d.dataset.i], g = 'radial-gradient(ellipse ' + (k.rw * 1.3) + 'px ' + (k.rh * 1.3) + 'px at ' + k.fx + 'px ' + k.fy + 'px, transparent 74%, #000 100%)';
      d.style.webkitMaskImage = g; d.style.maskImage = g;
    });
    last = -1; draw();
  }
  function ease(t) { t = Math.max(0, Math.min(1, (t - .22) / .56)); return t * t * (3 - 2 * t); }
  function draw() {
    tick = 0;
    var top = sec.getBoundingClientRect().top, run = sec.offsetHeight - stage.offsetHeight, p = Math.max(0, Math.min(1, -top / (run || 1))), f = p * 6;
    if (f === last) return; last = f;
    var i = Math.min(5, Math.floor(f)), e = ease(f - i), a = keys[i], b = keys[i + 1];
    scene.style.transform = 'translate3d(' + (a.x + (b.x - a.x) * e) + 'px,' + (a.y + (b.y - a.y) * e) + 'px,0) scale(' + (a.s + (b.s - a.s) * e) + ')';
    dims.forEach(function (d) { var n = +d.dataset.i; d.style.opacity = n === i ? 1 - e : n === i + 1 ? e : 0; });
    var near = i + (e > .5 ? 1 : 0);
    w0.classList.toggle('on', near === 0);
    w6.classList.toggle('on', near === 6);
    document.body.classList.toggle('at-end', near === 6);
    w6.querySelector('.btn').tabIndex = near === 6 ? 0 : -1;
    chaps.forEach(function (c) { c.classList.toggle('on', +c.dataset.i === near); });
  }
  function start() {
    if (still.matches) { scene.style.transform = ''; return; }
    layout();
  }
  addEventListener('scroll', function () { if (!tick && !still.matches) tick = requestAnimationFrame(draw); }, { passive: true });
  addEventListener('resize', start);
  still.addEventListener('change', start);
  start();
  // the board's light comes up as the page arrives
  requestAnimationFrame(function () { document.body.classList.add('lit'); });

  // a detail tied to the scroll: the light line under the three numbers, finished by the time they are mid-screen
  var nums = document.getElementById('nums'), line = document.getElementById('numline'), t2 = 0;
  function numline() {
    t2 = 0;
    var r = nums.getBoundingClientRect(), h = innerHeight, from = h * .85, to = h * .5 - r.height / 2;
    line.style.transform = 'scaleX(' + Math.max(0, Math.min(1, (from - r.top) / (from - to))) + ')';
  }
  if (still.matches) line.style.transform = 'none';
  else { addEventListener('scroll', function () { if (!t2) t2 = requestAnimationFrame(numline); }, { passive: true }); numline(); }

  // whose table: the picture, words, ground and button follow the choice, and the choice reaches the order form
  var who = document.getElementById('who'), go = document.getElementById('who-go');
  who.querySelector('.seg').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var w = b.dataset.w; who.dataset.who = w;
    [].forEach.call(who.querySelectorAll('.seg button'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
    [].forEach.call(who.querySelectorAll('.who-ph img, .who-c > div'), function (x) { x.classList.toggle('on', x.dataset.w === w); });
    go.href = w === 'else' ? 'shop.html?add=feast&for=else#order' : 'shop.html?add=feast#order';
  });
})();
