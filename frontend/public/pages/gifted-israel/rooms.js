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
  function ask() { if (!raf) raf = requestAnimationFrame(frame); }
  addEventListener('scroll', ask, { passive: true });
  addEventListener('resize', ask);
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
