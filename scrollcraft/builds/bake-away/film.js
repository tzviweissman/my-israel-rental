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
    // On a phone the film plays by itself on repeat instead of following the scroll (Tzvi, 29 Oct 2026: "on mobile
    // we should remove the scroll and it should just play on repeat"): one short video made from the same phone
    // frames (data-loop), the finished doughnut held a moment, then a soft fade back to the start; the section is
    // one screen tall (.film.loop in site.css) and its words hold still. Motion off keeps the last frame as a still.
    var vid = null;
    if (kind === 'm' && !still && film.dataset.loop) {
      film.classList.add('loop'); order = [];
      vid = document.createElement('video'); vid.muted = true; vid.loop = true; vid.playsInline = true; vid.setAttribute('playsinline', ''); vid.preload = 'auto'; vid.src = film.dataset.loop;
      // the video itself is shown (the browser plays it without work on the page), placed as the frames were;
      // drawing it into the canvas on every frame kept a phone 99% busy (check-speed BUSY, 29 Oct 2026)
      vid.setAttribute('aria-hidden', 'true'); vid.style.cssText = 'position:absolute;left:0;width:100%;height:auto;display:block';
      cv.style.background = '#241B1B'; cv.after(vid);
      vid.addEventListener('loadedmetadata', function () { draw(true); });
      new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) vid.play().catch(function () {}); else vid.pause(); }); }).observe(film);
    }
    // Frames are kept as files (blobs) and only those near the one on screen are decoded, off the main thread
    // (createImageBitmap), as on LS Fruit Platter: drawing an <img> decoded it on every scrolled frame
    // (check-motion HEAVY, 135 ms a frame on a slowed phone, 28 Oct 2026). The nearest decoded frame is drawn.
    (function next(k) {
      var batch = order.slice(k, k + 6), left = batch.length; if (!left) return;
      batch.forEach(function (i) {
        fetch(url(i)).then(function (r) { return r.ok ? r.blob() : null; }).then(function (bl) { if (bl) imgs[i] = bl; })
          .catch(function () {}).then(function () { if (--left === 0) { keep(want); draw(); next(k + 6); } });
      });
    })(0);
    var bm = new Array(N), WIN = 8, want = 0, making = {};
    function keep(c) {
      want = c;
      for (var i = 0; i < N; i++) {
        var near = Math.abs(i - c) <= WIN || (still && i === N - 1);
        if (!near && bm[i]) { if (bm[i].close) bm[i].close(); bm[i] = null; }
        if (near && !bm[i] && imgs[i] && !making[i] && window.createImageBitmap) {
          making[i] = 1;
          (function (i) {
            createImageBitmap(imgs[i]).then(function (b) {
              making[i] = 0;
              if (Math.abs(i - want) <= WIN) { bm[i] = b; draw(); } else if (b.close) b.close();
            }).catch(function () { making[i] = 0; });
          })(i);
        }
      }
    }
    function frameAt(q) {
      var f = Math.round(q * (N - 1)); keep(f);
      for (var d = 0; d < N; d++) { if (bm[f - d]) return bm[f - d]; if (bm[f + d]) return bm[f + d]; }
      return null;
    }
    var last = null;
    function draw(force) {
      var im = vid ? (vid.videoWidth ? vid : null) : frameAt(still ? 1 : p); if (!im || (im === last && !force)) return; last = im;   // only when the frame changes
      var W = cv.width, H = cv.height;
      if (vid) { var vh = vid.videoHeight * cv.clientWidth / vid.videoWidth, Hc = cv.clientHeight, top = Math.min(.41 * Hc - .39 * vh, Hc - 354 - .55 * vh); top = Math.max(top, Math.min(14 - .23 * vh, Hc - 354 - .55 * vh)); vid.style.top = Math.round(top) + 'px'; return; }   // the same placing as below, in screen pixels
      // Bake away: on a phone the frame is fitted to the screen's width (never cropped at the sides, her doughnut stays whole) on the film's own slate colour
      if (kind === 'm') { cx.fillStyle = '#241B1B'; cx.fillRect(0, 0, W, H); var fh = (im.naturalHeight || im.height) * W / (im.naturalWidth || im.width), d = W / cv.clientWidth;
        // her doughnut (23% to 55% of the frame's height) sits about 41% down the screen, clear of the menu bar and of the words, which take the bottom 330px
        var hi = H - 354 * d - .55 * fh, lo = 14 * d - .23 * fh, off = Math.min(.41 * H - .39 * fh, hi); off = Math.max(off, Math.min(lo, hi));
        cx.drawImage(im, 0, Math.round(off), W, fh); return; }   // the plain slate above her doughnut slides under the menu bar, so the words below never reach it
      var iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, sc = Math.max(W / iw, H / ih);
      var w = iw * sc, h = ih * sc;
      cx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
    }
    function size() { var d = Math.min(2, devicePixelRatio || 1, (kind === 'm' ? 720 : 1680) / Math.max(1, cv.clientWidth)); cv.width = cv.clientWidth * d; cv.height = cv.clientHeight * d; draw(true); }   // never a canvas larger than its pictures
    function paint() {
      raf = 0;
      var r = film.getBoundingClientRect(), span = film.offsetHeight - innerHeight;
      p = still ? 1 : Math.min(1, Math.max(0, -r.top / Math.max(1, span)));
      marks.forEach(function (m, i) { film.classList.toggle('c' + (i + 2), p >= m); });
      draw();
    }
    if (!vid) addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(paint); }, { passive: true });
    addEventListener('resize', size);
    size(); paint();
  });
})();
