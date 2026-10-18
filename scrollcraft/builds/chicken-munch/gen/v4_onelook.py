"""v4 (Tzvi, 17 Oct 2026: the poppers in the box looked different from the
picker; page rules 3h.12, one look per product). The picker's pictures are
now the film's own final frame: choosing a style zooms into that piece of
the full box, so the box and the picker can never disagree. Two styles have
no piece in the box (Classic American Crunch, Fruity Chicken): named only,
until the owner sends photos."""
import io, re, shutil, os
s = io.open('index.html', encoding='utf8').read()
def sub(a, b):
    global s
    assert s.count(a) == 1, (s.count(a), a[:80]); s = s.replace(a, b)
KEYS = [('hot', 'Original Hot Poppers', 24, 64, '#FFDCD2'), ('cornflakes', 'Crispy Corn Flakes', 38, 33, '#FFF1C4'),
        ('pretzel', 'Crunchy Pretzel', 16, 31, '#F3E1CC'), ('rice', 'Rice Crispy Fingers', 79, 40, '#F7EBD3'),
        ('shnitzel', 'Shnitzel Bites', 57, 66, '#FFE4CC')]
# markup
i = s.index('      <div class="picker">'); j = s.index('</figure>', i); j = s.index('</div>', j) + len('</div>')
opts = '\n'.join(f'          <li><button type="button" class="opt" data-k="{k}" aria-pressed="{"true" if n == 0 else "false"}">{name}</button></li>' for n, (k, name, *_ ) in enumerate(KEYS))
s = s[:i] + f"""      <div class="picker">
        <ul class="opts" id="opts">
{opts}
        </ul>
        <figure class="pic" id="pic-frame"><img id="pic" src="assets/box-full.webp" alt="A Chicken Munch box of fried chicken styles, close on the Original Hot Poppers" width="2000" height="1125" loading="lazy"><figcaption id="pic-name">Original Hot Poppers</figcaption></figure>
      </div>
      <p class="also rev">Also on the menu: Classic American Crunch and Fruity Chicken.</p>""" + s[j:]
sub('<p class="lede rev">Pick one to see it. Choose your styles and sauces when you order.</p>',
    '<p class="lede rev">Pick one to see it in the box. Choose your styles and sauces when you order.</p>')
# css: the frame crops; the picture moves inside it
sub(".pic img { width: 100%; height: 100%; object-fit: cover; border-radius: var(--r); box-shadow: 0 30px 60px -30px rgb(20 18 16 / .5); transition: opacity 240ms ease-out, transform 420ms var(--out); }\n  .pic img.swap { opacity: 0; transform: scale(.95) translateY(8px); }",
    ".pic { overflow: hidden; border-radius: var(--r); box-shadow: 0 30px 60px -30px rgb(20 18 16 / .5); background: #FED801; }\n"
    "  .pic img { position: absolute; left: 0; top: 0; width: auto; max-width: none; height: 100%; transform-origin: 0 0; transition: transform 700ms var(--out); will-change: transform; }\n"
    "  .also { margin: 1.4rem 0 0; color: var(--soft); font-size: 1rem; }")
sub(".pic figcaption {", ".pic figcaption { z-index: 1;")
# js
i = s.index('  // ── the style picker'); j = s.index('  // sections ease in')
pts = ', '.join(f"{k}: [{x / 100}, {y / 100}, '{t}', '{n}']" for k, n, x, y, t in KEYS)
s = s[:i] + f"""  // ── the style picker: one picture, the film's last frame (page rules
  // 3h.12); choosing a style zooms into that piece and tints the section
  var PTS = {{ {pts} }};
  var pic = document.getElementById('pic'), picFrame = document.getElementById('pic-frame'), picName = document.getElementById('pic-name'), stylesEl = document.getElementById('styles');
  var opts = [].slice.call(document.querySelectorAll('#opts .opt')), cur = 'hot';
  function aim(k) {{
    var t = PTS[k], W = picFrame.clientWidth, H = picFrame.clientHeight, z = 2.3;
    var iw = H * 2000 / 1125 * z, ih = H * z;
    var x = Math.min(0, Math.max(W - iw, W / 2 - t[0] * iw)), y = Math.min(0, Math.max(H - ih, H / 2 - t[1] * ih));
    pic.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + z + ')';
  }}
  opts.forEach(function (b) {{
    b.addEventListener('click', function () {{
      cur = b.dataset.k; var t = PTS[cur];
      opts.forEach(function (o) {{ o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); }});
      stylesEl.style.setProperty('--tint', t[2]);
      picName.textContent = t[3]; pic.alt = 'A Chicken Munch box of fried chicken styles, close on the ' + t[3];
      aim(cur);
    }});
  }});
  pic.addEventListener('load', function () {{ aim(cur); }});
  addEventListener('resize', function () {{ aim(cur); }});
  if (pic.complete) aim(cur);

""" + s[j:]
sub('.styles { --tint: #fcdfb6;', '.styles { --tint: #FFDCD2;')
sub('<p class="chap" data-from=".66" data-to=".84">All seven, one tray</p>', '<p class="chap" data-from=".66" data-to=".84">Your styles, one tray</p>')
io.open('index.html', 'w', encoding='utf8', newline='').write(s)
shutil.rmtree('assets/styles', ignore_errors=True)
print('ok')
