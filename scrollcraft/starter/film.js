// The opening film that follows the scroll (page rules 3h; Tzvi, 22 Oct 2026: "i like the scrolling rather
// than just a video because once the video ends they cant see it again"). From The Brown Box and American
// Crust, which each wrote it by hand. Copy into the build and include it after site.js.
//
// Markup (the section is tall, its stage sticks while the frames scrub):
//   <section class="film" id="film" data-frames="150" data-src="assets/film" data-marks="0.4,0.59">
//     <div class="stage"><canvas aria-hidden="true"></canvas> ...words, button... </div>
//   </section>
// CSS: .film { height: 380vh; position: relative }  .film .stage { position: sticky; top: 0; height: 100svh;
//      overflow: hidden }  .film canvas { position: absolute; inset: 0; width: 100%; height: 100% }
//      @media (prefers-reduced-motion: reduce) { .film { height: 100svh } }
// Frames: <data-src>/d/0001.webp ... (laptop, 16:9) and <data-src>/m/0001.webp ... (phone, 9:16), made from
// the joined film with ffmpeg (american-crust/gen/film.sh is the worked example). data-marks are scroll
// points (0 to 1) where chapters begin: the section gets c2, c3 ... as each is passed, and loses it on the way
// back, so CSS can light each chapter's words. Frames load in passes (every 8th, 4th, 2nd, all) so the film
// scrubs at once and sharpens; the nearest loaded frame is drawn, never a blank. Reduced motion: last frame.
(function () {
  [].forEach.call(document.querySelectorAll('.film[data-frames]'), function (film) {
    var cv = film.querySelector('canvas'); if (!cv) return;
    var cx = cv.getContext('2d'), N = +film.dataset.frames, src = film.dataset.src || 'assets/film';
    var marks = (film.dataset.marks || '').split(',').filter(Boolean).map(Number);
    var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var kind = innerWidth <= 760 ? 'm' : 'd', imgs = new Array(N), p = 0, raf = 0;
    function url(i) { return src + '/' + kind + '/' + String(i + 1).padStart(4, '0') + '.webp'; }
    cv.style.background = 'url(' + url(still ? N - 1 : 0) + ') center / cover no-repeat';
    var order = [], seen = {};
    [8, 4, 2, 1].forEach(function (st) { for (var i = 0; i < N; i += st) if (!seen[i]) { seen[i] = 1; order.push(i); } });
    if (still) order = [N - 1];
    (function next(k) {
      var batch = order.slice(k, k + 6), left = batch.length; if (!left) return;
      batch.forEach(function (i) {
        var im = new Image(); im.decoding = 'async';
        im.onload = im.onerror = function () { if (im.naturalWidth) imgs[i] = im; if (--left === 0) { draw(); next(k + 6); } };
        im.src = url(i);
      });
    })(0);
    function frameAt(q) {
      var f = Math.round(q * (N - 1));
      for (var d = 0; d < N; d++) { if (imgs[f - d]) return imgs[f - d]; if (imgs[f + d]) return imgs[f + d]; }
      return null;
    }
    function draw() {
      var im = frameAt(still ? 1 : p); if (!im) return;
      var W = cv.width, H = cv.height, sc = Math.max(W / im.naturalWidth, H / im.naturalHeight);
      var w = im.naturalWidth * sc, h = im.naturalHeight * sc;
      cx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
    }
    function size() { var d = Math.min(2, devicePixelRatio || 1); cv.width = cv.clientWidth * d; cv.height = cv.clientHeight * d; draw(); }
    function paint() {
      raf = 0;
      var r = film.getBoundingClientRect(), span = film.offsetHeight - innerHeight;
      p = still ? 1 : Math.min(1, Math.max(0, -r.top / Math.max(1, span)));
      marks.forEach(function (m, i) { film.classList.toggle('c' + (i + 2), p >= m); });
      draw();
    }
    addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(paint); }, { passive: true });
    addEventListener('resize', size);
    size(); paint();
  });
})();
