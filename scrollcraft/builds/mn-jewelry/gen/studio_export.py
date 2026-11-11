"""The studio pictures (gen/studio/pNN.png and pNN-{gold}.png, made by gen/studio_edit.py from the owner's photos) into the
site: assets/pNN-st.webp (the piece in the gold it was photographed in) and assets/pNN-st-{white,yellow,rose}.webp.

    backend venv python gen/studio_export.py
"""
import glob, os, re
from PIL import Image
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
OWN = {'p04': 'yellow', 'p14': 'rose', 'p18': 'yellow'}   # the rest were photographed in white gold (build.py GOLD_OF)
n = 0
for f in sorted(glob.glob('gen/studio/p[0-9][0-9]*.png')):
    m = re.fullmatch(r'(p\d\d)(?:-(white|yellow|rose))?\.png', os.path.basename(f))
    if not m: continue
    ph, gold = m.groups()
    im = Image.open(f).convert('RGB').resize((1000, 1000), Image.LANCZOS)
    for out in ([f'{ph}-st-{gold}'] if gold else [f'{ph}-st', f'{ph}-st-{OWN.get(ph, "white")}']):
        im.save(f'assets/{out}.webp', quality=86, method=6); n += 1
for f in glob.glob('assets/p21-st*.webp'): os.remove(f)
print(n, 'pictures')
