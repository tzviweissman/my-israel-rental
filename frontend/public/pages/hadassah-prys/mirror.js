// The opening: the mirror's bulbs come on one by one and warm the room, and the switch turns them off and on. Light only:
// the lit picture shows through a soft circle round each bulb (measured on the picture, gen/assets.py), then everywhere.
// With no script or reduced motion the room is simply lit.
(function () {
  var open = document.getElementById('open'), room = document.getElementById('room'), lit = room.querySelector('.lit'), sw = document.getElementById('switch');
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var phone = matchMedia('(max-width: 760px)').matches;
  var bulbs = JSON.parse(room.dataset[phone ? 'tall' : 'wide']);
  var GAP = 55, GROW = 420, WASH = 700, raf = 0, on = true, t0 = 0, dir = 1;

  function set(mask) { lit.style.webkitMaskImage = mask; lit.style.maskImage = mask; }
  function ease(x) { return 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3); }
  var whole = bulbs.length * GAP + GROW;
  // the picture covers the room (object-fit), so each bulb's place is worked out from the picture's real size and position
  var img = lit.querySelector('img');
  function box() {
    var W = room.clientWidth, H = room.clientHeight, iw = img.naturalWidth || (phone ? 1118 : 2400), ih = img.naturalHeight || (phone ? 1988 : 1350);
    var s = Math.max(W / iw, H / ih), px = phone ? .53 : 1, py = phone ? 0 : 1;
    return { s: s, w: iw * s, h: ih * s, x: (W - iw * s) * px, y: (H - ih * s) * py };
  }
  function paint(t) {
    var g = box(), parts = [];
    for (var i = 0; i < bulbs.length; i++) {
      var k = ease((t - i * GAP) / GROW);
      if (k <= 0) continue;
      var b = bulbs[i], r = b[2] / 100 * g.w, R = r * (1.1 + 5 * k), bx = g.x + b[0] / 100 * g.w, by = g.y + b[1] / 100 * g.h;
      parts.push('radial-gradient(circle ' + R.toFixed(1) + 'px at ' + bx.toFixed(1) + 'px ' + by.toFixed(1) + 'px, rgba(0,0,0,' + k.toFixed(3) + ') ' + (r * 1.2).toFixed(1) + 'px, rgba(0,0,0,0) 100%)');
    }
    var a = ease((t - whole + WASH * .5) / WASH);
    parts.push('linear-gradient(rgba(0,0,0,' + a.toFixed(3) + '),rgba(0,0,0,' + a.toFixed(3) + '))');
    set(parts.join(','));
    return a >= 1;
  }
  var END = whole + WASH * .5;
  function run(now) {
    var t = dir > 0 ? now - t0 : END - (now - t0) * 2.2;
    var done = dir > 0 ? paint(t) : (t <= 0);
    if (dir < 0) paint(t);
    if (dir > 0 && done) { set('none'); raf = 0; return; }
    if (dir < 0 && done) { set('linear-gradient(transparent,transparent)'); raf = 0; return; }
    raf = requestAnimationFrame(run);
  }
  function go(d) { cancelAnimationFrame(raf); dir = d; t0 = performance.now(); raf = requestAnimationFrame(run); }

  function label() { sw.setAttribute('aria-pressed', String(on)); sw.querySelector('span').textContent = on ? 'Lights on' : 'Lights off'; open.classList.toggle('dark-room', !on); }
  sw.addEventListener('click', function () {
    on = !on; label();
    if (still) { set(on ? 'none' : 'linear-gradient(transparent,transparent)'); return; }
    go(on ? 1 : -1);
  });

  if (still) return;
  // the bulbs start only when the bulbs-off picture is there, so the room never flashes lit first
  var off = room.querySelector('.off img');
  set('linear-gradient(transparent,transparent)');
  function start() { if (on && !raf) go(1); }
  (off.decode ? off.decode().catch(function () {}) : Promise.resolve()).then(start);
  // coming back up to the top lights it again
  var away = false;
  new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting && e.intersectionRatio > .5 && away && on) { away = false; set('linear-gradient(transparent,transparent)'); go(1); }
      if (!e.isIntersecting) away = true;
    });
  }, { threshold: [0, .5] }).observe(open);
})();
