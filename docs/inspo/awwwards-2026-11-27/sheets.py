import sys, os, glob
from PIL import Image
cap = sys.argv[1]
for d in sorted(os.listdir(cap)):
    full = os.path.join(cap, d)
    if not os.path.isdir(full): continue
    for pat, cols, w, out in (('d-*.jpg', 4, 480, 'desktop'), ('m-*.jpg', 5, 260, 'phone')):
        fs = sorted(glob.glob(os.path.join(full, pat)), key=lambda f: (('scroll' in f), f))
        if not fs: continue
        ims = [Image.open(f).convert('RGB') for f in fs]
        ims = [im.resize((w, round(im.height * w / im.width))) for im in ims]
        h = max(i.height for i in ims); rows = -(-len(ims) // cols)
        S = Image.new('RGB', (cols * w + (cols + 1) * 8, rows * h + (rows + 1) * 8), (34, 34, 34))
        for i, im in enumerate(ims): S.paste(im, (8 + (i % cols) * (w + 8), 8 + (i // cols) * (h + 8)))
        S.save(os.path.join(cap, f'{d}-{out}.webp'), quality=72)
print('sheets done')
