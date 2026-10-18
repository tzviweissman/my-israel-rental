"""v3: the seven styles become a picker (page rules 3h.10, 3i.2): tapping a
style swaps the big photo to that style and the section takes its colour, a
light wash of the photo's own ground. The trays move to black as the page's
contrast section. Photos: gen/film/st-*.png (generated per style, one shoot)."""
import io
from PIL import Image
KEYS = [('classic', 'Classic American Crunch'), ('hot', 'Original Hot Poppers'), ('shnitzel', 'Shnitzel Bites'),
        ('fruity', 'Fruity Chicken'), ('cornflakes', 'Crispy Corn Flakes'), ('pretzel', 'Crunchy Pretzel'), ('rice', 'Rice Crispy Fingers')]
import os
os.makedirs('assets/styles', exist_ok=True)
tint = {}
for k, _ in KEYS:
    im = Image.open(f'gen/film/st-{k}-0.png').convert('RGB')
    im.resize((900, 900), Image.LANCZOS).save(f'assets/styles/{k}.webp', quality=84)
    w, h = im.size
    px = [im.getpixel((x, y)) for x, y in [(12, 12), (w - 12, 12), (12, h // 2), (w - 12, h // 2)]]
    c = tuple(sorted(p[i] for p in px)[1] for i in range(3))
    wash = tuple(round(v + (255 - v) * .62) for v in c)
    tint[k] = '#%02x%02x%02x' % wash
    print(k, '#%02x%02x%02x' % c, '->', tint[k])

s = io.open('index.html', encoding='utf8').read()
def sub(a, b):
    global s
    assert s.count(a) == 1, (s.count(a), a[:80]); s = s.replace(a, b)

i = s.index('  .styles { background: var(--black);'); j = s.index('  /* ── trays and sides ── */')
s = s[:i] + """  .styles { --tint: %s; background: var(--tint); transition: background-color 500ms var(--out); }
  .picker { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(1.5rem, 4vw, 3.5rem); align-items: center; margin-top: clamp(1.5rem, 3vw, 2.5rem); }
  .opts { list-style: none; margin: 0; padding: 0; display: grid; gap: .1rem; }
  .opt { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: .8rem; width: 100%%; min-height: 44px; padding: .15rem 0; cursor: pointer;
    font: 400 clamp(1.7rem, 3.4vw, 3rem)/1.05 var(--font-head); text-transform: uppercase; color: #514A40; transition: color 200ms ease-out, transform 220ms var(--out); }
  .opt::before { content: ''; flex: none; width: 0; height: .5em; border-radius: 99px; background: var(--red-dk); transition: width 260ms var(--out); }
  .opt:hover { color: var(--ink); transform: translateX(4px); }
  .opt[aria-pressed="true"] { color: var(--ink); }
  .opt[aria-pressed="true"]::before { width: .9em; }
  .opt:focus-visible { outline: 3px solid var(--ink); outline-offset: 4px; border-radius: 6px; }
  .pic { position: relative; margin: 0; aspect-ratio: 1; max-height: 68svh; justify-self: center; width: min(100%%, 68svh); }
  .pic img { width: 100%%; height: 100%%; object-fit: cover; border-radius: var(--r); box-shadow: 0 30px 60px -30px rgb(20 18 16 / .5); transition: opacity 240ms ease-out, transform 420ms var(--out); }
  .pic img.swap { opacity: 0; transform: scale(.95) translateY(8px); }
  .pic figcaption { position: absolute; left: 14px; bottom: 14px; padding: .45rem .85rem; border-radius: 999px; background: var(--black); color: var(--yellow); font: 700 .95rem/1.2 var(--font-body); }
  @media (max-width: 860px) {
    .picker { grid-template-columns: 1fr; }
    .pic { order: -1; width: min(100%%, 52svh); }
    .opts { grid-template-columns: 1fr 1fr; gap: .2rem .9rem; }
    .opt { font-size: clamp(1.15rem, 5vw, 1.6rem); }
  }

""" % tint['classic'] + s[j:]

i = s.index('  <section class="sec styles"'); j = s.index('</section>', i) + len('</section>')
opts = '\n'.join(f'          <li><button type="button" class="opt" data-k="{k}" aria-pressed="{"true" if n == 0 else "false"}">{name}</button></li>' for n, (k, name) in enumerate(KEYS))
s = s[:i] + f"""  <section class="sec styles" id="styles" aria-labelledby="h-styles">
    <div class="wrap">
      <h2 id="h-styles" class="rev">Seven <span class="acc">styles</span></h2>
      <p class="lede rev">Tap one to see it. Choose your styles and sauces when you order.</p>
      <div class="picker">
        <ul class="opts" id="opts">
{opts}
        </ul>
        <figure class="pic"><img id="pic" src="assets/styles/classic.webp" alt="Classic American Crunch, golden crunchy fried chicken tenders in a kraft bowl" width="900" height="900" loading="lazy"><figcaption id="pic-name">Classic American Crunch</figcaption></figure>
      </div>
    </div>
  </section>""" + s[j:]

# the trays are the contrast section now: their flyer's black
sub("  .trays { background: var(--cream); }", "  .trays { background: var(--black); color: #fff; }\n  .trays h2 .acc { color: var(--yellow); }\n  .trays .side-h { color: #CFC8B8; }\n  .trays .tile { color: var(--ink); }")

# the old drift script for names and bowls goes; the picker script comes in
sub("  var names = document.getElementById('names'), styles = document.getElementById('styles'), bowls = document.getElementById('bowls');\n", "")
i = s.index("      var s = styles.getBoundingClientRect();"); j = s.index("bowls.children", i); j = s.index("\n", j) + 1
s = s[:i] + s[j:]
alts = {'classic': 'golden crunchy fried chicken tenders', 'hot': 'popcorn chicken poppers in a glossy red pepper sauce', 'shnitzel': 'golden breadcrumbed schnitzel bites',
        'fruity': 'sticky glazed chicken bites', 'cornflakes': 'chicken in a crispy corn flake crust', 'pretzel': 'chicken in a dark crushed pretzel crust', 'rice': 'chicken fingers in a puffed rice crust'}
js_t = ', '.join(f"{k}: ['{tint[k]}', '{dict(KEYS)[k]}', '{alts[k]}']" for k, _ in KEYS)
sub("  // sections ease in", f"""  // ── the style picker: the photo and the section's colour follow the choice
  var TINT = {{ {js_t} }};
  var pic = document.getElementById('pic'), picName = document.getElementById('pic-name'), stylesEl = document.getElementById('styles');
  var opts = [].slice.call(document.querySelectorAll('#opts .opt'));
  Object.keys(TINT).forEach(function (k) {{ var im = new Image(); im.src = 'assets/styles/' + k + '.webp'; }});
  opts.forEach(function (b) {{
    b.addEventListener('click', function () {{
      var k = b.dataset.k, t = TINT[k];
      opts.forEach(function (o) {{ o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); }});
      stylesEl.style.setProperty('--tint', t[0]);
      pic.classList.add('swap');
      setTimeout(function () {{ pic.src = 'assets/styles/' + k + '.webp'; pic.alt = t[1] + ', ' + t[2] + ' in a kraft bowl'; picName.textContent = t[1]; pic.classList.remove('swap'); }}, still ? 0 : 200);
    }});
  }});

  // sections ease in""")
io.open('index.html', 'w', encoding='utf8', newline='').write(s)
print('ok')
