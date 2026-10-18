"""v2 (Tzvi, 17 Oct 2026: "do 1"): the opening becomes the generated film.
The name still stamps in and parts like doors, now over the empty box on the
film's yellow table; scrolling drives the film as the styles drop in, with a
chapter line per scene, and it ends on the full box beside the headline."""
import io
s = io.open('index.html', encoding='utf8').read()
def sub(a, b):
    global s
    assert s.count(a) == 1, (s.count(a), a[:80]); s = s.replace(a, b)
def cut(start, end):
    global s
    i = s.index(start); j = s.index(end, i) + len(end); s = s[:i] + s[j:]

sub("""  /* ── the opening: the name stamps in, splits, the box pushes through ── */
  #open { position: relative; height: 230vh; }""", """  /* ── the opening: the name stamps in and parts like doors over the
     empty box; the scroll drives the film as the styles drop in ── */
  #open { position: relative; height: 520vh; }""")
sub(".stage { position: sticky; top: 64px; height: calc(100vh - 64px); height: calc(100svh - 64px); overflow: hidden; }",
    ".stage { position: sticky; top: 64px; height: calc(100vh - 64px); height: calc(100svh - 64px); overflow: hidden; background: var(--film, #FFD60A); }\n"
    "  .reel { position: absolute; inset: 0; transform: translateX(calc(var(--c, 0) * 21vw)) scale(calc(1 - var(--c, 0) * .1)); transform-origin: 60% 50%; will-change: transform; }\n"
    "  #cv { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }\n"
    "  .word { z-index: 2; }\n"
    "  /* one short line per scene, on a small solid card at the edge (5b.3) */\n"
    "  .chap { position: absolute; z-index: 3; left: var(--gutter); bottom: 22px; margin: 0; padding: .55rem .95rem; border-radius: 999px; background: var(--black); color: var(--yellow);\n"
    "    font: 700 .95rem/1.2 var(--font-body); opacity: 0; transform: translateY(8px); transition: opacity 260ms ease-out, transform 320ms var(--out); pointer-events: none; }\n"
    "  .chap.on { opacity: 1; transform: none; }\n"
    "  .copy { z-index: 3; }")
cut("  .box { position: absolute; left: 50%; top: 50%;", "  .box img { width: 100%; height: 100%; object-fit: cover; }\n")
sub("    #open { height: 210vh; }", "    #open { height: 440vh; }\n    .reel { transform: none; }\n    .chap { bottom: auto; top: var(--chap-y, 60%); }")
cut("    .box { width: min(78vw, 46svh * .82); }\n", "")
sub("""      <div class="box" id="box"><img src="assets/box-yellow.webp" alt="An open Chicken Munch box of corn flake, pretzel and rice crispy chicken, with sauce pots" width="935" height="1136" fetchpriority="high"></div>""",
    """      <div class="reel" id="reel"><canvas id="cv" role="img" aria-label="Chicken Munch's seven styles drop one by one into an open kraft box on a yellow table until it is full"></canvas></div>
      <p class="chap" data-from=".12" data-to=".38">Crispy Corn Flakes and Crunchy Pretzel</p>
      <p class="chap" data-from=".42" data-to=".64">Rice Crispy Fingers and Shnitzel Bites</p>
      <p class="chap" data-from=".68" data-to=".84">Seven styles, one tray</p>""")
sub("box = document.getElementById('box'), copy", "copy")
# replace setOpen wholesale
i = s.index("  function setOpen(p) {"); j = s.index("\n  }\n", i) + 4
s = s[:i] + """  // ── the film: frames on a canvas, loaded in passes (every 8th, 4th, all)
  var N = 240, cv = document.getElementById('cv'), ctx = cv.getContext('2d'), reel = document.getElementById('reel');
  var chaps = [].slice.call(document.querySelectorAll('.chap'));
  var dir = phone.matches ? 'm' : 'd', imgs = [], drawn = -1, want = 0;
  function src(i) { return 'assets/film/' + dir + '/' + String(i + 1).padStart(4, '0') + '.webp'; }
  function load(i) { if (imgs[i]) return; var im = new Image(); im.decoding = 'async'; im.onload = function () { im.ok = 1; if (Math.abs(i - want) < 9) draw(want, true); }; im.src = src(i); imgs[i] = im; }
  function nearest(i) { for (var d = 0; d < N; d++) { if (imgs[i - d] && imgs[i - d].ok) return i - d; if (imgs[i + d] && imgs[i + d].ok) return i + d; } return -1; }
  var copyTop = 0;
  function size() {
    var dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr); drawn = -1;
  }
  function draw(i, force) {
    var k = nearest(i); if (k < 0 || (k === drawn && !force)) return; drawn = k;
    var im = imgs[k], W = cv.width, H = cv.height, iw = im.naturalWidth, ih = im.naturalHeight;
    ctx.clearRect(0, 0, W, H);
    if (!phone.matches) { var sc = Math.max(W / iw, H / ih); ctx.drawImage(im, (W - iw * sc) / 2, (H - ih * sc) / 2, iw * sc, ih * sc); return; }
    // phone: the box and its margin, full width, in the room above the words
    var fh = W * ih / iw, c = +copy.style.getPropertyValue('--c') || 0;
    var room = H - copyTop, y = ((H - fh) / 2) * (1 - c) + Math.max(0, (room - fh) / 2) * c;
    ctx.drawImage(im, 0, y, W, fh);
    stage.style.setProperty('--chap-y', ((y + fh) / H * 100 + 2).toFixed(1) + '%');
  }
  function setOpen(p) {
    open.style.setProperty('--sc-p', p.toFixed(3));
    // 0 to .1: the doors part; .06 to .86: the film; .86 on: the words arrive
    var a = ease(clamp(p / .1)), b = ease(clamp((p - .86) / .12));
    stage.style.setProperty('--a', (a + .7 * b).toFixed(4));
    var wo = Math.max(0, 1 - a * 1.15);
    w1.style.opacity = w2.style.opacity = wo.toFixed(3);
    w1.style.visibility = w2.style.visibility = wo < .02 ? 'hidden' : '';
    copy.style.setProperty('--c', b.toFixed(4)); reel.style.setProperty('--c', b.toFixed(4));
    copy.classList.toggle('on', b > .5);
    copyTop = H0 - copy.offsetHeight - 30;
    want = Math.round(clamp((p - .06) / .8) * (N - 1)); draw(want, phone.matches);
    chaps.forEach(function (el) { el.classList.toggle('on', p >= +el.dataset.from && p < +el.dataset.to); });
  }
  var H0 = 0;
  function boot() {
    size(); H0 = cv.height / Math.min(2, devicePixelRatio || 1) * Math.min(2, devicePixelRatio || 1);
    H0 = cv.height;
    load(still ? N - 1 : 0);
    [8, 4, 2, 1].forEach(function (step, n) { setTimeout(function () { for (var i = 0; i < N; i += step) load(i); }, 200 + n * 500); });
  }
""" + s[j:]
# copyTop must be in canvas pixels on a phone
s = s.replace("    copyTop = H0 - copy.offsetHeight - 30;", "    copyTop = H0 - (copy.offsetHeight + 30) * (cv.height / Math.max(1, cv.clientHeight));")
sub("  if (still) setOpen(1);\n  frame();", "  boot();\n  addEventListener('resize', function () { size(); H0 = cv.height; frame(); });\n  if (still) setOpen(1);\n  frame();")
io.open('index.html', 'w', encoding='utf8', newline='').write(s)
print('ok')
