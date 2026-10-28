"""Makes assets/*.webp from her photos (src/owner) and the cut-outs (gen/cut). Run from the build folder: python gen/assets.py"""
import os
import sys; sys.path.insert(0, 'gen')
from clean_cut import clean
from PIL import Image, ImageFilter

os.makedirs('assets', exist_ok=True)

def save(im, name, q=84, cap=600_000):
    p = f'assets/{name}.webp'
    for qq in range(q, 40, -6):
        im.save(p, 'WEBP', quality=qq, method=6)
        if os.path.getsize(p) < cap: break
    print(name, im.size, os.path.getsize(p) // 1000, 'KB')

def fit(im, longest):
    s = longest / max(im.size)
    return im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS) if s < 1 else im

# the doughnut cut-outs: pale fringe and stray specks trimmed from the alpha, a margin so nothing touches the edge
for p in ['p05', 'p06', 'p07', 'p08', 'p11', 'p12', 'p13', 'p14']:
    im = clean(Image.open(f'gen/cut/{p}.png'))   # gen/clean_cut.py: slit, hole and cast-shadow rim
    m = int(max(im.size) * .04)
    out = Image.new('RGBA', (im.width + 2 * m, im.height + 2 * m), (0, 0, 0, 0)); out.paste(im, (m, m))
    save(fit(out, 900), f'dn-{p}', 90)

# phone screenshots: take only the photo area at its real resolution
for p in ['p02', 'p03', 'p04']:
    im = Image.open(f'src/owner/{p}.jpg').convert('RGB')
    white = im.convert('L').point(lambda v: 255 if v > 235 else 0)   # the photo sits on a white square
    x0, y0, x1, y1 = white.crop((0, 300, im.width, 2100)).getbbox(); y0 += 300; y1 += 300
    print(p, 'photo area', x0, y0, x1, y1)
    save(im.crop((x0, y0, x1, y1)), f'cream-{p}')

for p, name, cap in [('p01', 'card', 1400), ('p09', 'tray', 1200), ('p15', 'diy', 1200), ('p16', 'trays', 1200), ('p17', 'challah', 1200),
                     ('p18', 'buns', 1200), ('p19', 'cakes', 1200), ('p20', 'mini', 1200), ('p21', 'cheese', 1200), ('p22', 'babka', 1200)]:
    save(fit(Image.open(f'src/owner/{p}.jpg').convert('RGB'), cap), name)

# link preview: the film's last frame, the middle 1200x630
f = Image.open('assets/film/d/0150.webp').convert('RGB'); w, h = f.size; s = 1200 / (h * 1200 / 630)
c = f.crop(((w - h * 1200 // 630) // 2, 0, (w + h * 1200 // 630) // 2, h)).resize((1200, 630), Image.LANCZOS); save(c, 'og', 82)
