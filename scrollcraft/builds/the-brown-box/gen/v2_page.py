"""Rewrites index.html's opening as the v2 film (page rules §3h): full screen,
frames on a canvas, a chapter line per scene, bold bowl tiles after."""
import io
import shutil

shutil.copy('index.html', 'gen/index-v1.html')
s = io.open('index.html', encoding='utf8').read()


def cut(a, b, new):
    global s
    i = s.index(a)
    j = s.index(b, i)
    s = s[:i] + new + s[j:]


def sub(a, b):
    global s
    assert s.count(a) == 1, a[:70]
    s = s.replace(a, b)


sub("""  One idea: the bowl builds. A clear bowl on their cream table; the acai pours
  in on arrival, and scrolling drops their Classic bowl's toppings in, banana
  and blueberries, then the granola, each step its own generated clip
  (Higgsfield, MiniMax H3), each clip starting on the last frame of the one
  before.""", """  One idea, one unbroken film (v2, 16 Oct 2026, page rules 3h, after the
  PULP video): acai berries on the branch at sunrise fall into the purple
  blend, it folds into their clear bowl, the Classic bowl's toppings fall in
  slow motion and land, and the camera rises as the bowl sits in a kraft
  brown box. Five generated clips (Higgsfield, MiniMax H3), each starting on
  the last frame of the one before and ending on a keyframe still, drawn as
  frames on a canvas, full screen, with a chapter line per scene.""")

cut("  /* ── 1. the bowl builds (held stage)", "  /* kosher band */", """  /* ── 1. the film (held, full screen) ── */
  .film { height: 620vh; position: relative; background: #120A05; }
  .film .stage { position: sticky; top: 0; height: 100vh; height: 100svh; overflow: hidden; background: #120A05; }
  .film canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  /* a dark pool behind every line, low and to the start side */
  .film .pool { position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(120% 75% at 18% 92%, rgb(18 10 5 / .82) 0%, rgb(18 10 5 / .45) 38%, rgb(18 10 5 / 0) 62%),
                linear-gradient(to bottom, rgb(18 10 5 / .55), rgb(18 10 5 / 0) 18%); }
  .chap { position: absolute; inset: auto var(--gutter) clamp(2rem, 9vh, 5.5rem) var(--gutter); max-width: 46rem; color: #FFF6EA;
    opacity: 0; transform: translateY(18px); filter: blur(6px); transition: opacity 500ms var(--out), transform 600ms var(--out), filter 500ms var(--out); pointer-events: none; }
  .chap.on { opacity: 1; transform: none; filter: none; pointer-events: auto; }
  .chap .kick { color: #F1C9A0; }
  .chap h1, .chap h2 { font-size: clamp(2.8rem, 1.2rem + 5.4vw, 6.6rem); line-height: .96; color: #FFF6EA; text-wrap: balance; }
  .chap .acc { color: #E7A6D1; }
  .chap p.line { margin: 1.1rem 0 1.5rem; color: #EADBC8; font-size: clamp(1rem, .9rem + .4vw, 1.25rem); max-width: 30rem; }
  .chap .btn { background: #FFF6EA; color: var(--brown-2); }
  .chap .btn:hover { background: #fff; }
  .chap .proof { margin-top: .9rem; color: #D9C7B2; font-size: .92rem; }
  .film .hint { position: absolute; right: var(--gutter); bottom: clamp(2rem, 9vh, 5.5rem); color: #D9C7B2; font-size: .85rem; letter-spacing: .1em; text-transform: uppercase; transition: opacity 300ms; }
  .film .load { position: absolute; left: 0; bottom: 0; height: 2px; background: #E7A6D1; width: 0; transition: width 200ms linear, opacity 400ms; }
  /* the bar sits on the film until the film is passed */
  body.on-film .bar { background: transparent; border-color: transparent; backdrop-filter: none; }
  body.on-film .bar .brand, body.on-film .bar nav a.l { color: #FFF6EA; }
  body.on-film .bar .btn { background: #FFF6EA; color: var(--brown-2); }
  @media (max-width: 760px) {
    .film { height: 560vh; }
    .film .pool { background: linear-gradient(to top, rgb(18 10 5 / .88) 0%, rgb(18 10 5 / .55) 36%, rgb(18 10 5 / 0) 60%), linear-gradient(to bottom, rgb(18 10 5 / .5), rgb(18 10 5 / 0) 16%); }
    .chap { bottom: 1.6rem; }
    .chap h1, .chap h2 { font-size: clamp(2.3rem, 11vw, 3.2rem); }
    .chap p.line { margin: .7rem 0 1rem; font-size: 1rem; }
    .chap .proof, .film .hint { display: none; }
  }

""")

sub("""  .opt { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .2rem 1rem; text-align: start; padding: 1rem 1.1rem; border-radius: var(--r); border: 1.5px solid var(--line); background: var(--paper);
    cursor: pointer; color: var(--ink); font: inherit; transition: border-color 180ms ease-out, background 180ms ease-out, transform 160ms ease-out; }
  .opt:hover { border-color: var(--soft); }""", """  /* bold colour blocks after the dark film (3h.8): each bowl in its fruit */
  .opt { --c: #6E2A57; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .2rem 1rem; text-align: start; padding: 1.05rem 1.2rem; border-radius: var(--r); border: 2px solid transparent; background: var(--c);
    cursor: pointer; color: #fff; font: inherit; transition: transform 160ms ease-out, box-shadow 200ms ease-out; }
  .opt[data-k="tropical"] { --c: #A0560A; } .opt[data-k="sunrise"] { --c: #44691A; } .opt[data-k="superfruit"] { --c: #2E4A9B; } .opt[data-k="own"] { --c: #4A2E17; }
  .opt:hover { transform: translateY(-2px); box-shadow: var(--shadow); }""")
sub(""".opt .p { font-weight: 700; color: var(--brown); align-self: center; }
  .opt span.t { grid-column: 1 / -1; color: var(--soft); font-size: .95rem; }
  .opt[aria-pressed="true"] { border-color: var(--acai); background: #fff; box-shadow: 0 0 0 3px var(--acai-lt); }""", """.opt .p { font-weight: 700; color: #fff; align-self: center; }
  .opt span.t { grid-column: 1 / -1; color: rgb(255 255 255 / .92); font-size: .95rem; }
  .opt[aria-pressed="true"] { border-color: #fff; box-shadow: 0 0 0 3px var(--c), var(--shadow); }""")

cut('  <section class="build" id="build"', '  <div class="kosher">', """  <section class="film" id="film" aria-label="A film of an acai bowl being made, from the berries to the box">
    <div class="stage">
      <canvas id="cv" aria-hidden="true"></canvas>
      <div class="pool" aria-hidden="true"></div>
      <div class="chap on" data-from="0" data-to="0.14">
        <div class="kick">The Brown Box · Jerusalem</div>
        <h1>Acai bowls, <span class="acc">delivered</span> across Jerusalem</h1>
        <p class="line">Bowls, acai boards and brunch boxes, sugar free and almond milk based.</p>
        <a class="btn" href="order.html?add=Acai%20bowl">Order a bowl, <b>₪60</b> <span class="arw" aria-hidden="true">→</span></a>
        <p class="proof">Kosher, Vaad HaKashrus of Rabbi Shmuel Weiner</p>
      </div>
      <div class="chap" data-from="0.2" data-to="0.36" aria-hidden="true"><h2>Our signature <span class="acc">acai</span> base.</h2></div>
      <div class="chap" data-from="0.4" data-to="0.55" aria-hidden="true"><h2>Sugar free. <span class="acc">Almond milk</span> based.</h2></div>
      <div class="chap" data-from="0.59" data-to="0.76" aria-hidden="true"><h2>Topped <span class="acc">your way.</span></h2></div>
      <div class="chap" data-from="0.86" data-to="1.01" aria-hidden="true">
        <h2>A delicious &amp; healthy <span class="acc">brunch.</span></h2>
        <p class="line">The Brown Box, delivered across Jerusalem.</p>
        <a class="btn" href="order.html?add=Acai%20bowl" tabindex="-1">Order a bowl, <b>₪60</b> <span class="arw" aria-hidden="true">→</span></a>
      </div>
      <div class="hint" id="hint">Scroll</div>
      <div class="load" id="load"></div>
    </div>
  </section>

""")

cut("  // ── the bowl builds", "  // ── pick your bowl", """  // ── the film ──
  // assets/film/d/0001.webp ... (laptop, 16:9) and assets/film/m/ (phone,
  // portrait crop): the five clips as one sequence of sharp frames, drawn on
  // a canvas to cover the screen, chosen by scroll. Frames load in passes
  // (every 8th, then every 4th, ...) so the whole film scrubs early and
  // sharpens as the rest arrive; the nearest loaded frame is drawn.
  var FILM = { d: 300, m: 300 };
  var filmEl = document.getElementById('film'), cv = document.getElementById('cv'), cx = cv.getContext('2d');
  var chaps = [].slice.call(document.querySelectorAll('.chap'));
  var kind = phone() ? 'm' : 'd', N = FILM[kind], imgs = new Array(N), got = 0;
  function url(i) { return 'assets/film/' + kind + '/' + String(i + 1).padStart(4, '0') + '.webp'; }
  var order = [], seen = {};
  [8, 4, 2, 1].forEach(function (st) { for (var i = 0; i < N; i += st) if (!seen[i]) { seen[i] = 1; order.push(i); } });
  var load = document.getElementById('load');
  (function next(k) {
    var batch = order.slice(k, k + 6); if (!batch.length) { load.style.opacity = 0; return; }
    var left = batch.length;
    batch.forEach(function (i) {
      var im = new Image(); im.decoding = 'async';
      im.onload = im.onerror = function () { if (im.naturalWidth) { imgs[i] = im; got++; } load.style.width = (got / N * 100) + '%'; if (--left === 0) { draw(); next(k + 6); } };
      im.src = url(i);
    });
  })(0);
  function size() { var d = Math.min(2, devicePixelRatio || 1); cv.width = cv.clientWidth * d; cv.height = cv.clientHeight * d; draw(); }
  function frameAt(q) {
    var f = Math.round(q * (N - 1));
    for (var d = 0; d < N; d++) { if (imgs[f - d]) return imgs[f - d]; if (imgs[f + d]) return imgs[f + d]; }
    return null;
  }
  var p = 0;
  function draw() {
    var im = frameAt(p); if (!im) return;
    var W = cv.width, H = cv.height, sc = Math.max(W / im.naturalWidth, H / im.naturalHeight);
    var w = im.naturalWidth * sc, h = im.naturalHeight * sc;
    cx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
  }
  function progress() {
    var r = filmEl.getBoundingClientRect(), span = filmEl.offsetHeight - innerHeight;
    return Math.min(1, Math.max(0, -r.top / Math.max(1, span)));
  }
  var hint = document.getElementById('hint');
  function paint() {
    p = still ? 1 : progress();
    draw();
    chaps.forEach(function (c) {
      var on = p >= +c.dataset.from && p < +c.dataset.to;
      c.classList.toggle('on', on); c.setAttribute('aria-hidden', on ? 'false' : 'true');
      c.querySelectorAll('a').forEach(function (a) { a.tabIndex = on ? 0 : -1; });
    });
    hint.style.opacity = p > 0.02 ? 0 : 1;
    document.body.classList.toggle('on-film', filmEl.getBoundingClientRect().bottom > 64);
  }
  var raf = 0;
  addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(function () { raf = 0; paint(); }); }, { passive: true });
  addEventListener('resize', size);
  size(); paint();

""")
sub("var past = build.getBoundingClientRect().bottom < innerHeight * 0.6;", "var past = filmEl.getBoundingClientRect().bottom < innerHeight * 0.6;")
io.open('index.html', 'w', encoding='utf8', newline='').write(s)
print('ok')
