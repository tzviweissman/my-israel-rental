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

# The product hero shot (rules section 8, Tzvi 22 Oct 2026) and one shoot (8.1): her four platters, each
# re-shot by Higgsfield from her own photo (p04, p05 cleaned, p06, p07) into one scene: a pale travertine slab,
# a few whole fruits from the platter, a blush-to-cream gradient, one warm light from the left, the same
# angle. Every fruit was checked against her photo. h-*.jpg are those shots, 4:3.
M = {k: Image.open(O + f'h-{k}.jpg').convert('RGB') for k in ('small', 'medium', 'large', 'xl')}

def fit(im, size):
    """The whole shot, fitted to the width; above and below it the shot's own top and bottom edges carry on
    (a plain gradient and a plain table), so a square or tall frame never cuts the platter."""
    W, H = size
    s = W / im.width; fg = im.resize((W, round(im.height * s)), Image.LANCZOS)
    if fg.height >= H:
        y = (fg.height - H) // 2; return fg.crop((0, y, W, y + H))
    out = Image.new('RGB', (W, H)); y0 = (H - fg.height) // 2
    top = fg.crop((0, 0, W, 2)).resize((W, y0 + 1)).filter(ImageFilter.GaussianBlur(8))
    bot = fg.crop((0, fg.height - 2, W, fg.height)).resize((W, H - y0 - fg.height + 1)).filter(ImageFilter.GaussianBlur(8))
    out.paste(top, (0, 0)); out.paste(bot, (0, y0 + fg.height - 1)); out.paste(fg, (0, y0))
    return out

for i, k in ((1, 'small'), (2, 'medium'), (3, 'large'), (4, 'xl')):
    save(fit(M[k], (1200, 1200)), f'size-{i}.webp', None, 78)
    save(fit(M[k], (520, 390)), f'size-{i}-t.webp', None, 76)   # 4:3 thumbnails, the whole platter each
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

# the home page's full-bleed pictures (rule 3t): the same hero shots
save(fit(M['large'], (2000, 1250)), 'w-large.webp', None, 80)
save(fit(M['large'], (900, 931)), 'w-large-m.webp', None, 78)
save(fit(M['xl'], (2000, 1000)), 'w-xl.webp', None, 80)
save(fit(M['xl'], (700, 1187)), 'w-xl-m.webp', None, 78)
save(fit(M['small'], (1800, 1125)), 'w-small.webp', None, 80)
save(fit(M['small'], (900, 1200)), 'w-small-m.webp', None, 78)

# the home cards (review 22 Oct 2026): each platter whole on its card, nothing sliced by the card edge. The whole shot sits
# inside the frame at 92% with its own picture, enlarged and blurred, carrying on at the sides (the same trick as stage()).
def card(im, size=(1000, 800), scale=.92, feather=22):
    W, H = size
    bg = im.copy(); s = max(W / bg.width, H / bg.height)
    bg = bg.resize((round(bg.width * s), round(bg.height * s)), Image.LANCZOS)
    x0, y0 = (bg.width - W) // 2, (bg.height - H) // 2
    bg = bg.crop((x0, y0, x0 + W, y0 + H)).filter(ImageFilter.GaussianBlur(26))
    f = min(W * scale / im.width, H * scale / im.height)
    fg = im.resize((round(im.width * f), round(im.height * f)), Image.LANCZOS)
    m = Image.new('L', fg.size, 0); m.paste(255, (feather, feather, fg.width - feather, fg.height - feather)); m = m.filter(ImageFilter.GaussianBlur(feather / 2.2))
    bg.paste(fg, ((W - fg.width) // 2, (H - fg.height) // 2), m)
    return bg
for i, k in ((1, 'small'), (2, 'medium'), (3, 'large'), (4, 'xl')):
    save(card(M[k]), f'card-{i}.webp', None, 78)
