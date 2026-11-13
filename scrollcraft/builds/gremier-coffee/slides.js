// The opening as connected slides, from the starter (12 Nov 2026, rules as a blueprint; Gremier Coffee first).
// Write it with sitekit.opening_slides(); include after site.js. The stage sticks while the section scrolls by. Each slide
// holds its own clip, led by the scroll while the slide is on screen (never played, only moved to the eased scroll point;
// encode with every frame a keyframe, -g 1); then it pushes up and the next comes in from below. Make each clip start on
// the last frame of the one before (scripts/clip-chain) and the seam shows the same picture on both sides: one story.
// Built in, so no check has to catch it: the schedule is long enough (3 screens or more, 3h.20), the opening words leave as
// the film starts and nothing else covers it (3h.25), the phone bar waits for the end (3h.25), reduced motion shows the
// last slide still (3a.5). The section gets c2, c3 ... as each slide is reached, and c<n+2> at the very end.
(function () {
  [].forEach.call(document.querySelectorAll('.film.slides'), function (film) {
    var track = film.querySelector('.track'), slides = [].slice.call(film.querySelectorAll('.slide'));
    var N = slides.length, HOLD = +film.dataset.hold || 1, PUSH = +film.dataset.push || 0.55;
    // a slide marked data-same starts on the last frame of the one before (clipchain), so it carries on in place, no push
    var P = slides.map(function (s, i) { return i && slides[i].hasAttribute('data-same') ? 0 : PUSH; }).slice(1);
    var total = N * HOLD + P.reduce(function (a, b) { return a + b; }, 0), grow = Math.max(1, 3 / total);   // 3 screens or more (3h.20)
    HOLD *= grow; P = P.map(function (x) { return x * grow; });
    var starts = [0]; for (var q = 1; q < N; q++) starts[q] = starts[q - 1] + HOLD + P[q - 1];
    var units = starts[N - 1] + HOLD, still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var kind = innerWidth <= 860 || innerWidth <= innerHeight ? 'm' : 'd', bar = document.getElementById('bar');
    slides.forEach(function (s, i) { s.style.top = (i * 100) + '%'; });
    var vids = slides.map(function (s) {
      if (!s.dataset.video) {   // a still slide (the business's own photo), joined by the push, never a fade
        var im = document.createElement('img'); im.src = s.dataset.poster.replace('{k}', kind); im.alt = ''; im.setAttribute('aria-hidden', 'true');
        im.className = 'still'; im.width = 1600; im.height = 900;   // sized, so nothing jumps (3s.2, 3s.24)
         s.insertBefore(im, s.firstChild); return { el: null, want: 0, shown: 0 };
      }
      var v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      v.setAttribute('aria-hidden', 'true'); v.poster = s.dataset.poster.replace('{k}', kind);
      if (!still) v.src = s.dataset.video.replace('{k}', kind);
      s.insertBefore(v, s.firstChild);
      return { el: v, want: 0, shown: -1 };
    });
    function size() { film.style.height = still ? '100svh' : ((units + 1) * 100) + 'svh'; }
    function ease(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
    var raf = 0;
    function frame() {
      raf = 0;
      var r = film.getBoundingClientRect(), span = film.offsetHeight - innerHeight;
      var u = still ? units : Math.min(units, Math.max(0, -r.top / Math.max(1, span) * units)), pos = 0, active = 0;
      for (var i = 0; i < N; i++) {
        var start = starts[i];
        if (u < start + HOLD || i === N - 1) { pos = i; active = i; vids[i].want = Math.min(1, Math.max(0, (u - start) / HOLD)); break; }
        if (u < start + HOLD + P[i]) { var t = ease((u - start - HOLD) / P[i]); pos = i + t; active = t > .5 ? i + 1 : i; vids[i].want = 1; vids[i + 1].want = 0; break; }
      }
      // slides already passed rest on their last frame, slides still below rest on their first
      for (var j = 0; j < N; j++) { if (j < Math.floor(pos)) vids[j].want = 1; else if (j > Math.ceil(pos)) vids[j].want = 0; }
      // a chained clip opens on the last picture of the one before, so its word waits until its own scene has arrived
      // (review 12 Nov, Gremier: "Cold" came up over the grinder, "Serve" over the pour; rules 3aa.20)
      for (var w = 0; w < N; w++) slides[w].classList.toggle('early', slides[w].hasAttribute('data-same') && vids[w].want < 0.45);
      track.style.transform = 'translate3d(0,' + (-pos * 100) + '%,0)';
      for (var k = 0; k < N; k++) film.classList.toggle('c' + (k + 2), active >= k && (u > 0.02 || k > 0));
      film.classList.toggle('c' + (N + 2), u >= units - 0.02); film.classList.toggle('at-end', u >= units - 0.02); film.classList.toggle('on-last', u >= units - 0.02 || (!vids[N - 1].el && pos >= N - 1.02));   // a still lands at once; a last clip must play out first   // the closing words come with the last slide on a phone
      if (bar) bar.classList.toggle('in-film', r.bottom > innerHeight * 1.02);
      vids.forEach(seek);
      if (vids.some(function (v) { return Math.abs(v.shown - v.want) > 0.002; })) raf = requestAnimationFrame(frame);
    }
    function seek(v) {
      var el = v.el; if (!el) { v.shown = v.want; return; } var dur = el.duration; if (!dur || el.readyState < 1) return;
      v.shown = v.shown < 0 ? v.want : v.shown + (v.want - v.shown) * 0.22;   // ease toward the scroll: no jolts from a wheel
      if (Math.abs(v.want - v.shown) < 0.002) v.shown = v.want;
      var t = v.shown * (dur - 0.05);
      if (!el.seeking && Math.abs(el.currentTime - t) > 0.004) el.currentTime = t;
    }
    vids.forEach(function (v) { if (v.el) v.el.addEventListener('loadedmetadata', function () { v.shown = -1; if (!raf) raf = requestAnimationFrame(frame); }); });
    addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(frame); }, { passive: true });
    addEventListener('resize', function () { size(); if (!raf) raf = requestAnimationFrame(frame); });
    size(); frame();
  });
})();
