"""Each studio picture beside the owner's own photo, to check piece by piece: python gen/studio_sheet.py [suffix] -> gen/studio/_sheet*.jpg"""
import os, sys
from pathlib import Path
from PIL import Image
os.chdir(Path(__file__).resolve().parent.parent)
suf = sys.argv[1] if len(sys.argv) > 1 else ''
names = sorted(p.stem[1:-3] for p in Path('gen/studio').glob('_p*-in.png'))
for part in range(0, len(names), 4):
    grp = names[part:part + 4]; cols = [f'gen/studio/_{n}-in.png' for n in grp], [f'gen/studio/{n}{suf}.png' for n in grp]
    if suf: cols = ([f'gen/studio/{n}.png' for n in grp], [f'gen/studio/{n}-yellow.png' for n in grp], [f'gen/studio/{n}-rose.png' for n in grp], [f'gen/studio/{n}-white.png' for n in grp])
    s = Image.new('RGB', (600 * len(grp), 600 * len(cols)))
    for r, row in enumerate(cols):
        for c, f in enumerate(row):
            if os.path.exists(f): s.paste(Image.open(f).convert('RGB').resize((600, 600)), (600 * c, 600 * r))
    s.save(f'gen/studio/_sheet{suf and "-golds"}-{part // 4}.jpg', quality=85)
