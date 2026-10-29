"""contact sheet of shots: python gen/sheet.py <glob> <out> <cols> <cellwidth>"""
import sys, glob
from PIL import Image
fs = sorted(glob.glob(sys.argv[1])); cols = int(sys.argv[3]); cw = int(sys.argv[4])
ims = [Image.open(f).convert('RGB') for f in fs]
ims = [i.resize((cw, int(i.height * cw / i.width))) for i in ims]
rh = max(i.height for i in ims); rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (cols * cw + (cols + 1) * 6, rows * rh + (rows + 1) * 6), (60, 60, 60))
for n, i in enumerate(ims): S.paste(i, (6 + (n % cols) * (cw + 6), 6 + (n // cols) * (rh + 6)))
S.save(sys.argv[2]); print(len(ims), S.size)
