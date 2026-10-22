# Crops of the owner's own photos, nothing generated. Run from the build folder.
from PIL import Image, ImageFilter
import os
O = 'src/owner/'
A = 'assets/'
os.makedirs(A, exist_ok=True)

def save(im, name, size=None, q=80):
    if size: im = im.resize(size, Image.LANCZOS)
    im.save(A + name, 'WEBP', quality=q, method=6)
    print(name, im.size, os.path.getsize(A + name) // 1024, 'KB')

def stage(im, bgsrc, size=(1200, 1200), feather=26):
    """The whole photo, never a slice: it sits inside the frame, and the rest of the frame is a table-only patch of
    the same photo, enlarged and blurred, so the sides read as table. Nothing is added to the picture."""
    W, H = size
    bg = bgsrc.copy(); s = max(W / bg.width, H / bg.height)
    bg = bg.resize((round(bg.width * s), round(bg.height * s)), Image.LANCZOS)
    x0, y0 = (bg.width - W) // 2, (bg.height - H) // 2
    bg = bg.crop((x0, y0, x0 + W, y0 + H)).filter(ImageFilter.GaussianBlur(30 * W / 1200))
    f = min(W / im.width, H / im.height)
    fg = im.resize((round(im.width * f), round(im.height * f)), Image.LANCZOS)
    fx = round(feather * W / 1200) if fg.width < W - 2 else 0
    fy = round(feather * H / 1200) if fg.height < H - 2 else 0
    m = Image.new('L', fg.size, 255)
    if fx or fy:
        m = Image.new('L', fg.size, 0); m.paste(255, (fx, fy, fg.width - fx, fg.height - fy)); m = m.filter(ImageFilter.GaussianBlur(max(fx, fy) / 2))
    bg.paste(fg, ((W - fg.width) // 2, (H - fg.height) // 2), m)
    return bg

# One shoot (rules 8.1, Tzvi 22 Oct 2026): every size on the same white marble, in the same light.
# m-small, m-large and m-xl are her own platters cut out of p04, p06 and p07 and placed on one generated
# empty marble (m-ground, made from her Medium photo's setting); the fruit is hers, untouched. m-medium is
# her Medium photo (p05) with the stray engraving on the board removed (Tzvi sent it as her Medium, 22 Oct).
G = Image.open(O + 'm-ground.jpg').convert('RGB').crop((0, 620, 1500, 1792))   # plain marble, away from the vase
M = {k: Image.open(O + f'm-{k}.jpg').convert('RGB') for k in ('small', 'medium', 'large', 'xl')}

def on_marble(im, size, feather=40):
    """The whole photo, fitted inside the frame; the rest of the frame is the same marble, so nothing is cut."""
    W, H = size
    s = max(W / G.width, H / G.height); bg = G.resize((round(G.width * s), round(G.height * s)), Image.LANCZOS)
    x0, y0 = (bg.width - W) // 2, (bg.height - H) // 2; bg = bg.crop((x0, y0, x0 + W, y0 + H))
    f = min(W / im.width, H / im.height); fg = im.resize((round(im.width * f), round(im.height * f)), Image.LANCZOS)
    fe = round(feather * W / 1200)
    m = Image.new('L', fg.size, 0); m.paste(255, (fe, fe, fg.width - fe, fg.height - fe)); m = m.filter(ImageFilter.GaussianBlur(fe / 2))
    bg.paste(fg, ((W - fg.width) // 2, (H - fg.height) // 2), m)
    return bg

for i, k in ((1, 'small'), (2, 'medium'), (3, 'large'), (4, 'xl')):
    save(on_marble(M[k], (1200, 1200)), f'size-{i}.webp', None, 78)
    save(on_marble(M[k], (520, 390)), f'size-{i}-t.webp', None, 76)   # 4:3 thumbnails, the whole platter each
p04 = Image.open(O + 'p04.jpg').convert('RGB')
p06 = Image.open(O + 'p06.jpg').convert('RGB')
p07 = Image.open(O + 'p07.jpg').convert('RGB')
# the long band: the extra large platter turned on its side, cut to the platter
band = p07.rotate(-90, expand=True).crop((0, 190, 2400, 800))
save(band, 'band.webp', (2400, 610), 78)
# a thin strip of the same platter, for the scroll bar across the top
strip = p07.rotate(-90, expand=True).crop((0, 440, 2400, 530)); save(strip, 'strip.webp', (2400, 90), 80)
# her monogram from the logo, as a round badge
p02 = Image.open(O + 'p02.jpg').convert('RGB')
save(p02.crop((345, 112, 587, 354)).resize((300, 300)), 'mark.webp', (200, 200), 90)
# link preview
og = Image.new('RGB', (1200, 630)); lg = p06.crop((0, 280, 2400, 1300)); bgc = p06.crop((0, 1340, 2400, 1800)).resize((1200, 630)).filter(ImageFilter.GaussianBlur(20)); og.paste(bgc); lg = lg.resize((1200, 510), Image.LANCZOS); og.paste(lg, (0, 60)); save(og, 'og.webp', (1200, 630), 78)
# the wrapped one
p08 = Image.open(O + 'p08.jpg').convert('RGB')
save(p08.crop((100, 0, 1500, 1400)), 'wrapped.webp', (900, 900), 76)

# the home page's full-bleed pictures (rule 3t): her platters on the one marble (see above)
save(M['large'].crop((0, 200, 2400, 1700)), 'w-large.webp', (2000, 1250), 80)
save(M['large'].crop((600, 300, 1800, 1541)), 'w-large-m.webp', (900, 931), 78)
save(M['xl'].crop((0, 300, 2400, 1500)), 'w-xl.webp', (2000, 1000), 80)
save(M['xl'].crop((760, 300, 1640, 1792)), 'w-xl-m.webp', (700, 1187), 78)
save(M['small'].crop((0, 420, 1344, 1260)), 'w-small.webp', (1800, 1125), 80)
save(M['small'], 'w-small-m.webp', (900, 1200), 78)
