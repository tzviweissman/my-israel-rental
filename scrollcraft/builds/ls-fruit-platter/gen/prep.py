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

# Small: the round platter, whole (its board's lower rim included); the photo is her own, top to bottom
p04 = Image.open(O + 'p04.jpg').convert('RGB')
sq1 = p04.crop((0, 60, 1800, 1860))
# Medium: NO photo. The one photo supplied for it (a studio shot on marble) has another business's placeholder
# words ("logo" and a Hebrew name) engraved on the board, which means it may not be her platter. It is not shown,
# not even with the words covered; the site shows a plain tile and asks her (message-to-owner.md, question 4).
# Large: the whole board, from the handle to the lychees, and its shadow
p06 = Image.open(O + 'p06.jpg').convert('RGB')
lg_crop, lg_bg = p06.crop((0, 220, 2400, 1340)), p06.crop((0, 1360, 2400, 1800))
# Extra large: the whole long board, top to bottom
p07 = Image.open(O + 'p07.jpg').convert('RGB')
xl_bg = p07.crop((830, 180, 1080, 1200))
sm_bg = p04.crop((0, 1900, 1800, 2400))
for i, (im, bgp, fe) in ((1, (sq1, sm_bg, 26)), (3, (lg_crop, lg_bg, 26)), (4, (p07, xl_bg, 70))):
    save(stage(im, bgp, (1200, 1200), fe), f'size-{i}.webp', None, 78)
    save(stage(im, bgp, (520, 390), fe), f'size-{i}-t.webp', None, 76)   # 4:3 thumbnails, the whole platter each
for f in ('size-2.webp', 'size-2-t.webp'):
    if os.path.exists(A + f): os.remove(A + f)
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

# the home page's full-bleed pictures (rule 3t): her own photos, cropped, nothing added
save(p06.crop((0, 180, 2400, 1680)), 'w-large.webp', (2000, 1250), 80)                       # the Large board, the table below it for the words
save(p06.crop((330, 0, 2070, 1800)), 'w-large-m.webp', (900, 931), 78)                       # phone: the board's middle, tall
xr = p07.rotate(-90, expand=True)                                                              # the Extra large board on its side
save(xr.crop((0, 40, 2400, 1240)), 'w-xl.webp', (2000, 1000), 80)
save(p07.crop((0, 0, 1242, 2400)), 'w-xl-m.webp', (700, 1353), 78)                           # phone: upright, as she photographed it
save(p04.crop((0, 430, 1800, 1555)), 'w-small.webp', (1800, 1125), 80)                       # the Small platter, close
save(p04, 'w-small-m.webp', (900, 1200), 78)
