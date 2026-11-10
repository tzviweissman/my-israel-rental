// The opening (IDEAS.md idea I, Tzvi 9 Nov 2026 "yes 1"): the scroll walks through one coloured room per category. Each new room
// wipes in from the right over the last, its piece and its big word with it. The scroll leads; nothing plays on its own.
// Without this script the rooms simply stand one under another (.rooms without .live).
(function () {
  var st = document.getElementById('gifts');
  if (!st) return;
  var rooms = [].slice.call(st.querySelectorAll('.r-room')), dots = [].slice.call(st.querySelectorAll('.r-dots a')), n = rooms.length;
  st.classList.add('live');
  var still = matchMedia('(prefers-reduced-motion: reduce)').matches, want = null, raf = 0, last = -1;
  function frame() {
    raf = 0;
    var r = st.getBoundingClientRect(), run = st.offsetHeight - innerHeight;
    // each room has one screen of scroll: the first two thirds hold it still, the last third wipes the next one in
    var p = Math.min(Math.max(-r.top / Math.max(run, 1), 0), 1) * (n - 1), at = Math.floor(p), f = p - at;
    var t = still ? (f > .5 ? 1 : 0) : Math.min(Math.max((f - .45) / .55, 0), 1);
    t = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    var base = t >= 1 ? at + 1 : at;   // the room fully in view
    for (var i = 0; i < n; i++) {
      var v = i <= at ? 1 : i === at + 1 ? t : 0;
      if (i) rooms[i].style.setProperty('--t', v.toFixed(4));
      // only the room in view and the one wiping over it are there: the rooms under them and those still to come are hidden
      rooms[i].style.visibility = i === base || (i === at + 1 && t > 0) ? '' : 'hidden';
    }
    var cur = Math.min(n - 1, at + (t > .5 ? 1 : 0));
    if (cur !== last) {
      last = cur;
      dots.forEach(function (d, i) { d.setAttribute('aria-current', i === cur ? 'true' : 'false'); });
    }
  }
  // each room's big word goes in the open wall, never behind its piece (Tzvi, 10 Nov 2026: "some of the words cant be read at all"): the
  // piece's place in its picture is written by gen/build.py (data-wide, data-tall: top, left, right as shares), mapped the way the
  // picture is laid on the screen (cover, 50% 85%). Two places are tried, the full width under the card and the wall right of the
  // card, both above the piece; the word takes the one where it can be biggest.
  var stage = st.querySelector('.r-stage'), card = st.querySelector('.r-card'), list = st.querySelector('.r-dots');
  function place() {
    var S = stage.getBoundingClientRect(), W = S.width, H = S.height, tall = matchMedia('(max-aspect-ratio: 1/1)').matches;
    var iw = tall ? 1152 : 2048, ih = tall ? 2048 : 1152, s = Math.max(W / iw, H / ih), ox = (W - iw * s) / 2, oy = (H - ih * s) * .85;
    var c = card.getBoundingClientRect(), d = list.getBoundingClientRect(), g = 16, gap = 10;
    var cT = c.top - S.top, cB = c.bottom - S.top, cR = c.right - S.left, edge = d.width ? d.left - S.left - 2 * g : W - g;
    var most = Math.min(240, W * (tall ? .15 : .14));
    rooms.forEach(function (room) {
      var w = room.querySelector('.r-word'), b = (room.dataset[tall ? 'tall' : 'wide'] || '').split(',').map(Number);
      if (b.length < 3) return;
      var py = oy + b[0] * ih * s - gap;
      w.classList.add('at');
      w.style.fontSize = '100px';
      var w100 = w.scrollWidth / 100, best = null;
      [[g, cB + gap, edge, py], [cR + 2 * g, cT, edge, py]].forEach(function (r) {
        var bw = r[2] - r[0], bh = r[3] - r[1], f = Math.min(most, bw / w100, bh / .9);
        if (bw > 0 && bh > 0 && (!best || f > best.f)) best = { f: f, r: r };
      });
      if (!best) { w.classList.remove('at'); w.style.fontSize = ''; return; }
      var f = Math.floor(best.f), r = best.r;
      w.style.fontSize = f + 'px';
      w.style.left = Math.round(r[0] + (r[2] - r[0] - w100 * f) / 2) + 'px';
      w.style.top = Math.round(r[1] + (r[3] - r[1] - .9 * f) / 2) + 'px';
    });
  }
  function ask() { if (!raf) raf = requestAnimationFrame(frame); }
  // the arrival ends at once when the visitor scrolls: the wipe is the motion from then on, and two at once stutter
  addEventListener('scroll', function () { if (scrollY > 0 && st.classList.contains('go')) { st.classList.remove('go'); st.classList.add('went'); } ask(); }, { passive: true });
  addEventListener('resize', function () { place(); ask(); });
  place();
  var first = rooms[0] && rooms[0].querySelector('.r-front');
  function go() { if (!st.classList.contains('went')) st.classList.add('go'); }
  if (!first || first.complete) go(); else { first.addEventListener('load', go); first.addEventListener('error', go); }
  if (document.fonts) document.fonts.ready.then(place);
  // a chapter name jumps to its room
  dots.forEach(function (d, i) {
    d.addEventListener('click', function (e) {
      e.preventDefault();
      var run = st.offsetHeight - innerHeight;
      scrollTo({ top: st.offsetTop + run * i / (n - 1) + 1, behavior: still ? 'auto' : 'smooth' });
    });
  });
  frame();
})();
