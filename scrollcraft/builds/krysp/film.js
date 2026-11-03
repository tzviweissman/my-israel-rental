// The opening film that follows the scroll (page rules 3h; Tzvi, 22 Oct 2026: "i like the scrolling rather
// than just a video because once the video ends they cant see it again"). From The Brown Box and American
// Crust, which each wrote it by hand. Copy into the build and include it after site.js.
//
// Markup (the section is tall, its stage sticks while the film plays):
//   <section class="film" id="film" data-frames="150" data-src="assets/film" data-video="assets/film/opening-{k}.mp4" data-marks="0.4,0.59">
//     <div class="stage"><canvas aria-hidden="true"></canvas> ...words, button... </div>
//   </section>
// CSS: .film { height: 380vh; position: relative }  .film .stage { position: sticky; top: 0; height: 100svh;
//      overflow: hidden }  .film canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover }
//      @media (prefers-reduced-motion: reduce) { .film { height: 100svh } }
// Frames: <data-src>/d/0001.webp ... (laptop, 16:9) and <data-src>/m/0001.webp ... (phone, 9:16), made from
// the joined film with ffmpeg (american-crust/gen/film.sh is the worked example). data-marks are scroll
// points (0 to 1) where chapters begin: the section gets c2, c3 ... as each is passed, and loses it on the way
// back, so CSS can light each chapter's words. Frames load in passes (every 8th, 4th, 2nd, all) so the film
// scrubs at once and sharpens; the nearest decoded frame is drawn, never a blank. Reduced motion: last frame.
// Smooth on a slowed phone (American Crust, 28 Oct 2026; Krysp, 31 Oct: 137 ms a frame with plain images): frames arrive
// as files and are decoded off the main thread (createImageBitmap of a blob) only around the current one; only decoded
// frames are drawn, only when the frame changes, at their own size on a canvas CSS scales to cover.
// Played as real video (3 Nov 2026, rules 3h.22, check-film-video): data-video names two files, {k} = d (laptop 16:9) or
// m (phone, the frames' crop), H.264 with a keyframe every 12 frames so jumping back is quick:
//   ffmpeg -i opening.mp4 -vf scale=1920:-2 -c:v libx264 -crf 22 -g 12 -pix_fmt yuv420p -an -movflags +faststart opening-d.mp4
// The frames stay: the picture until the video can play, the fallback without it, and reduced motion's last frame.
(function () {
  [].forEach.call(document.querySelectorAll('.film[data-frames]'), function (film) {
    var cv = film.querySelector('canvas'); if (!cv) return;
    var cx = cv.getContext('2d'), N = +film.dataset.frames, src = film.dataset.src || 'assets/film';
    var marks = (film.dataset.marks || '').split(',').filter(Boolean).map(Number);
    var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var kind = innerWidth <= 760 ? 'm' : 'd', blobs = new Array(N), p = 0, raf = 0;
    function url(i) { return src + '/' + kind + '/' + String(i + 1).padStart(4, '0') + '.webp'; }
    cv.style.background = 'url(' + url(still ? N - 1 : 0) + ') center / cover no-repeat';
    var order = [], seen = {}, vid = false;
    [8, 4, 2, 1].forEach(function (st) { for (var i = 0; i < N; i += st) if (!seen[i]) { seen[i] = 1; order.push(i); } });
    if (still) order = [N - 1];
    (function next(k) {
      var batch = order.slice(k, k + 6), left = batch.length; if (!left || vid) return;
      batch.forEach(function (i) {
        fetch(url(i)).then(function (r) { return r.ok ? r.blob() : null; }).catch(function () { return null; })
          .then(function (b) { if (b) blobs[i] = b; if (--left === 0) { draw(); next(k + 6); } });
      });
    })(0);
    var fw = 0, fh = 0, shown = -1, bmp = {}, asked = {}, WIN = 8;
    function keep(f) {
      for (var k in asked) if (Math.abs(k - f) > WIN) { if (bmp[k] && bmp[k].close) bmp[k].close(); delete bmp[k]; delete asked[k]; }
      for (var i = Math.max(0, f - WIN); i <= Math.min(N - 1, f + WIN); i++) if (blobs[i] && !asked[i]) (function (i) {
        asked[i] = 1;
        createImageBitmap(blobs[i]).then(function (b) {
          if (!asked[i]) { if (b.close) b.close(); return; }
          bmp[i] = b; if (!fw) { fw = b.width; fh = b.height; size(); } else draw();
        }).catch(function () {});
      })(i);
    }
    function nearest(f) { for (var d = 0; d < N; d++) { if (bmp[f - d]) return f - d; if (bmp[f + d]) return f + d; } return -1; }
    // Smooth at any scroll speed (Tzvi, 3 Nov 2026: "the motions dont look smooth"): the picture eases toward the scroll
    // position (the scroll itself is never changed) and two neighbouring frames are blended by the fraction between them,
    // so a slow scroll shows motion instead of a step every few frames.
    var pos = -1, last = '';
    function draw() {
      if (vid) return;
      var target = (still ? 1 : p) * (N - 1);
      pos = pos < 0 || still ? target : pos + (target - pos) * 0.22;
      if (Math.abs(target - pos) < 0.02) pos = target;
      var f0 = Math.floor(pos), a = pos - f0, f;
      keep(f0); f = bmp[f0] ? f0 : nearest(f0);
      if (f < 0) return;
      var b = f === f0 && a > 0.03 && bmp[f0 + 1] ? f0 + 1 : -1, key = f + ':' + (b < 0 ? 0 : Math.round(a * 20));
      if (key !== last) {
        last = key; shown = f;
        cx.globalAlpha = 1; cx.drawImage(bmp[f], 0, 0);
        if (b >= 0) { cx.globalAlpha = a; cx.drawImage(bmp[b], 0, 0); cx.globalAlpha = 1; }
      }
      if (pos !== target && !raf) raf = requestAnimationFrame(paint);
    }
    // the canvas is the frame's own size and CSS scales it (object-fit: cover): no scaling on every draw
    function size() { if (fw && (cv.width !== fw || cv.height !== fh)) { cv.width = fw; cv.height = fh; } shown = -1; last = ''; draw(); }
    function paint() {
      raf = 0;
      var r = film.getBoundingClientRect(), span = film.offsetHeight - innerHeight;
      p = still ? 1 : Math.min(1, Math.max(0, -r.top / Math.max(1, span)));
      marks.forEach(function (m, i) { film.classList.toggle('c' + (i + 2), p >= m); });
      draw();
    }
    addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(paint); }, { passive: true });

    // Played as real video, led by the scroll (data-video; Tzvi, 3 Nov 2026: "it still doesnt look so smooth like the
    // video i sent you"). Scrubbed frames stretch the film into slow motion; here it plays at its own speed while the
    // scroll is ahead of it, pauses when the scroll stops, and jumps back when the visitor scrolls up. The frames above
    // stay as the fallback (no video, reduced motion) and as the picture until the video can play.
    if (film.dataset.video && !still) (function () {
      var v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      v.src = film.dataset.video.replace('{k}', kind); v.poster = url(0); v.setAttribute('aria-hidden', 'true');
      v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0';
      cv.parentNode.appendChild(v);
      var ready = false;
      v.addEventListener('canplaythrough', function () {
        if (ready) return; ready = true; v.style.opacity = 1; vid = true; cv.style.visibility = 'hidden';
        for (var k in bmp) if (bmp[k] && bmp[k].close) bmp[k].close(); bmp = {}; blobs = [];   // the frames are not needed now
        addEventListener('scroll', wake, { passive: true }); wake();
      });
      var on = 0, still2 = 0;
      function wake() { still2 = 0; if (!on) { on = 1; requestAnimationFrame(follow); } }
      v.addEventListener('error', function () { v.remove(); });
      function follow() {
        var r = film.getBoundingClientRect(), span = film.offsetHeight - innerHeight;
        var q = Math.min(1, Math.max(0, -r.top / Math.max(1, span))), dur = v.duration || 1, want = q * dur, t = v.currentTime;
        // steer the speed, never stop and start every frame (starting a video takes a moment, so that would freeze it)
        if (want < t - 0.6) { v.pause(); v.currentTime = want; }                    // scrolled back up: jump back
        else if (v.paused) { if (want > t + 0.08) v.play().catch(function () {}); }  // scroll ahead of the film: play
        else if (t > want + 0.25) v.pause();                                         // scroll stopped: hold the picture
        else v.playbackRate = Math.min(2.5, Math.max(0.35, 1 + (want - t) * 1.2)); // close: speed up or ease to match
        // keep steering while the scroll moves or the film is catching up; rest after half a second of nothing to do
        if (Math.abs(want - v.currentTime) < 0.05 && v.paused) still2++; else still2 = 0;
        if (still2 > 30) { on = 0; return; }
        requestAnimationFrame(follow);
      }
    })();
    addEventListener('resize', size);
    size(); paint();
  });
})();
