"""v5 (Tzvi, 18 Oct 2026: "the crumbs arent exploding outwards towards the
viewer ... it just goes out a little and falls"). The generated clip cannot
throw crumbs at the camera, so they are built in code (memory: generated
video cannot match a reference; build the motion): 29 real cut-out corn
flake shards (gen/crumbs/) burst from the break toward the viewer during the
blast, growing as they pass the screen, and fly back in as the film reverses."""
import io, glob, os
s = io.open('index.html', encoding='utf8').read()
def sub(a, b):
    global s
    assert s.count(a) == 1, (s.count(a), a[:80]); s = s.replace(a, b)
n = len(glob.glob('assets/crumbs/*.webp'))
sub("""    ctx.drawImage(im, (W - fw) / 2, y, fw, fh);
    stage.style.setProperty('--chap-y', ((y + fh) / H * 100 + 2).toFixed(1) + '%');
  }""", """    ctx.drawImage(im, (W - fw) / 2, y, fw, fh);
    stage.style.setProperty('--chap-y', ((y + fh) / H * 100 + 2).toFixed(1) + '%%');
    crumbs(W / 2, y + fh * .44, W, H);
  }
  // ── the crumbs: real cut-out shards thrown at the viewer from the break.
  // The film is snap (0-.2), blast (.2-.4), blast backwards (.4-.6), snap
  // backwards (.6-.8), drop (.8-1): out over the blast, back in as it reverses.
  var CR = [], CN = %d;
  for (var ci = 0; ci < CN; ci++) { var ci_ = new Image(); ci_.src = 'assets/crumbs/c' + String(ci).padStart(2, '0') + '.webp'; CR.push(ci_); }
  var seed = 7; function rnd() { seed = (seed * 16807) %% 2147483647; return seed / 2147483647; }
  var PARTS = [];
  for (var pi = 0; pi < 90; pi++) {
    var th = rnd() * Math.PI * 2, fly = rnd() < .62;
    PARTS.push({ img: pi %% CN, th: th, r: .25 + rnd() * .75, vz: fly ? .55 + rnd() * .45 : .1 + rnd() * .25,
      s: .012 + rnd() * .03, spin: (rnd() - .5) * 7, rot: rnd() * 6.3, lag: rnd() * .25 });
  }
  function crumbs(ox, oy, W, H) {
    var f = want / (N - 1), q = f < .2 || f > .6 ? 0 : f <= .4 ? (f - .2) / .2 : (.6 - f) / .2;
    if (q <= .01 || still) return;
    PARTS.forEach(function (pt) {
      var t = Math.max(0, (q - pt.lag) / (1 - pt.lag)); if (t <= 0) return;
      t = 1 - Math.pow(1 - t, 1.6);                       // a fast burst that eases
      var d = Math.min(.93, t * pt.vz), k = 1 / (1 - d);   // nearer, bigger
      var R = pt.r * t * Math.max(W, H) * .32 * k;
      var x = ox + Math.cos(pt.th) * R, y = oy + Math.sin(pt.th) * R * .8;
      var im = CR[pt.img]; if (!im.complete || !im.naturalWidth) return;
      var w = pt.s * W * k, h = w * im.naturalHeight / im.naturalWidth;
      if (x + w < 0 || x - w > W || y + h < 0 || y - h > H) return;
      ctx.save(); ctx.globalAlpha = Math.min(1, t * 4) * (k > 8 ? Math.max(0, 1 - (k - 8) / 6) : 1);
      ctx.translate(x, y); ctx.rotate(pt.rot + pt.spin * t);
      ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore();
    });
  }""" % n)
sub("    if (!phone.matches) { var sc = Math.max(W / iw, H / ih); ctx.drawImage(im, (W - iw * sc) / 2, (H - ih * sc) / 2, iw * sc, ih * sc); return; }",
    "    if (!phone.matches) { var sc = Math.max(W / iw, H / ih); ctx.drawImage(im, (W - iw * sc) / 2, (H - ih * sc) / 2, iw * sc, ih * sc); crumbs(W / 2, (H - ih * sc) / 2 + ih * sc * .44, W, H); return; }")
sub("want = Math.round(clamp((p - .06) / .8) * (N - 1)); draw(want, phone.matches);", "want = Math.round(clamp((p - .06) / .8) * (N - 1)); draw(want, true);")
io.open('index.html', 'w', encoding='utf8', newline='').write(s)
print('ok', n)
