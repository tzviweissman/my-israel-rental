# Landscape and phone crops of her own photos for the full-screen opening and picture sections.
# (src, hands centre y as a fraction of the photo)
from PIL import Image
import os
# k: (photo, hands centre y, where it sits in the landscape band, where it sits in the phone crop)
S = {'milky': ('p08', .55, .30, .22), 'bubblegum': ('p04', .50, .38, .30), 'sheer': ('p13', .66, .26, .20), 'nude': ('p05', .60, .28, .22), 'ruby': ('p07', .68, .40, .30), 'blue': ('p12', .62, .26, .20)}
def crop(src, cy, ratio, at, scale_h, out, wmax, up=None):
    im = Image.open(f'src/owner/{src}.jpg').convert('RGB'); W, H = im.size
    h = min(H, W / ratio * scale_h) if ratio < 1 else W / ratio
    w = h * ratio
    if w > W: w = W; h = w / ratio
    top = cy * H - at * h; top = max(0, min(H - h, top)); left = (W - w) / 2
    c = im.crop((int(left), int(top), int(left + w), int(top + h)))
    tw = min(wmax, c.width * (up or (1.5 if ratio > 1 else 1.3)))
    c = c.resize((int(tw), int(tw / ratio)), Image.LANCZOS)
    c.save(out, quality=84, method=6)
if __name__ == '__main__':
    for k, (src, cy, al, ap) in S.items():
        crop(src, cy, 1920 / 1200, al, 1, f'assets/hero-{k}-l.webp', 1920)
        crop(src, cy, 390 / 844, ap, .75, f'assets/hero-{k}-p.webp', 900)
    for k, src, cy, al, ap in [('studio', 'p07', .40, .45, .35), ('visit', 'p10', .62, .30, .22)]:
        # never enlarged (22 Oct review: the studio crop was soft): the file is at most the photo's own size
        crop(src, cy, 1920 / 1200, al, 1, f'assets/pic-{k}-l.webp', 1920, 1.0)
        crop(src, cy, 390 / 844, ap, .75, f'assets/pic-{k}-p.webp', 900, 1.0)
    print('ok')
