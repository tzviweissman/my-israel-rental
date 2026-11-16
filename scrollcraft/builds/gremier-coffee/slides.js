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
    // data-intro: the seconds of the first clip that play by themselves on arrival (beans pouring in as the page opens), so the
    // first event is seen, not frozen until a scroll; the scroll then leads from that point (Tzvi 14 Nov 2026, Gremier)
    var INTRO = 0, SECS = +film.dataset.intro || 0, introT = still || !SECS ? 1 : 0;
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
    // END: screens of scroll the closing words stay pinned and still before the film lets go (Tzvi 16 Nov 2026, Gremier:
    // "Stock your fridge" came on only as the stage unpinned, so it was first seen sliding up under the menu bar)
    var END = still ? 0 : 0.6;
    function size() { film.style.height = still ? '100svh' : ((units + 1 + END) * 100) + 'svh'; }
    function ease(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
    // Phone: the opening plays by itself in one screen (rules 3ac.1, Tzvi 16 Nov 2026): the clips play one after another
    // (sped up, the chain is ~30 s), the track jumps to the next clip as each ends (they are chained, so the seam is the same
    // picture), the opening words leave after ~1.8 s, the last clip ends on the closing words and holds; one swipe goes on.
    if (!still && matchMedia('(max-width: 860px)').matches) {
      film.style.height = '100svh'; var RATE = 5, ci = 0, ended = false;
      function cls(i) { for (var k = 0; k < N; k++) film.classList.toggle('c' + (k + 2), i >= k && (k > 0 || film.classList.contains('c2'))); }
      function finish() {
        if (ended) return; ended = true; cls(N - 1); film.classList.add('c2', 'c' + (N + 2), 'at-end', 'on-last');
        if (bar) bar.classList.remove('in-film');
      }
      function go(i) {
        if (i >= N) return finish();
        ci = i; track.style.transform = 'translate3d(0,' + (-i * 100) + '%,0)'; cls(i); if (i) film.classList.add('c2');
        var el = vids[i].el; el.playbackRate = i || film.classList.contains('c2') ? RATE : 1;   // the first clip at its own speed while the words are up el.onended = function () { go(i + 1); };
        var pr = el.play(); if (pr && pr.catch) pr.catch(finish);   // play refused (Low Power Mode): show the ending at once
      }
      if (bar) bar.classList.add('in-film');
      // the words stay up for 1.8 s of the first clip actually playing (the clock starts at its first picture, not at load)
      vids[0].el.addEventListener('playing', function () { setTimeout(function () { if (!ended) { film.classList.add('c2'); cls(ci); vids[ci].el.playbackRate = RATE; } }, 1800); }, { once: true });
      go(0); return;
    }
    var raf = 0;
    function frame() {
      raf = 0;
      var r = film.getBoundingClientRect(), span = film.offsetHeight - innerHeight * (1 + END);
      var u = still ? units : Math.min(units, Math.max(0, -r.top / Math.max(1, span) * units)), pos = 0, active = 0;
      for (var i = 0; i < N; i++) {
        var start = starts[i];
        if (u < start + HOLD || i === N - 1) { pos = i; active = i; vids[i].want = Math.min(1, Math.max(0, (u - start) / HOLD));
          if (!i) vids[0].want = INTRO * introT + (1 - INTRO * introT) * vids[0].want; break; }
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
      var el = v.el; if (!el) { v.shown = v.want; return; } if (v.playing) return; var dur = el.duration; if (!dur || el.readyState < 1) return;
      v.shown = v.shown < 0 ? v.want : v.shown + (v.want - v.shown) * 0.22;   // ease toward the scroll: no jolts from a wheel
      if (Math.abs(v.want - v.shown) < 0.002) v.shown = v.want;
      var t = v.shown * (dur - 0.05);
      if (!el.seeking && Math.abs(el.currentTime - t) > 0.004) el.currentTime = t;
    }
    vids.forEach(function (v) { if (v.el) v.el.addEventListener('loadedmetadata', function () { v.shown = -1; if (!raf) raf = requestAnimationFrame(frame); }); });
    // the intro really plays (muted, inline): a phone loads no video data until it is played, so seeking alone showed a
    // frozen first frame on an iPhone (Tzvi 14 Nov 2026: "I can't see it on my phone"). It stops at SECS and hands over to
    // the scroll from there; skipped if the page opened past the film; if play is refused (Low Power Mode) the scroll leads.
    var v0 = vids[0];
    if (introT < 1 && v0.el) {
      var done = function () {
        if (!v0.playing) return;
        v0.playing = false; v0.el.pause();
        var d = v0.el.duration || 1; INTRO = Math.min(0.9, v0.el.currentTime / d); introT = 1; v0.shown = -1; frame();
      };
      if (film.getBoundingClientRect().top < -innerHeight * 0.1) introT = 1;
      else {
        v0.playing = true;
        (function watch() { if (!v0.playing) return; if (v0.el.currentTime >= SECS) done(); else requestAnimationFrame(watch); })();
        addEventListener('scroll', function () { if (v0.playing && film.getBoundingClientRect().top < -innerHeight * 0.05) done(); }, { passive: true });
        var pr = v0.el.play(); if (pr && pr.catch) pr.catch(function () { v0.playing = false; introT = 1; });
      }
    }
    addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(frame); }, { passive: true });
    addEventListener('resize', function () { size(); if (!raf) raf = requestAnimationFrame(frame); });
    size(); frame();
  });
})();
