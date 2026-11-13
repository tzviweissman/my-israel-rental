"""The opening photo in the screen's shape, made in code (10 Nov 2026). The paid API has no image edit model today
(google/nano-banana-2/edit, nano_banana_2 and seedream edit all answer model_not_found), so the padded part of
extend_photo.py's canvases (their own edge colours, smeared) is softened into an out-of-focus band of the same light,
and their original pixels sit over it untouched with a feathered seam. Nothing of theirs is moved, zoomed or framed.
The water layer of the steeping (assets/steep-water.webp) is placed at the same spot on each canvas.
Run from the build folder after gen/steep.py: python gen/wide.py"""
import json

from PIL import Image, ImageDraw, ImageFilter

src = Image.open('src/site/01-sunlit-closeup-v3.webp').convert('RGB')
water = Image.open('assets/steep-water.webp').convert('RGBA')

for shape in ('wide', 'tall'):
    c = json.load(open(f'gen/ext/canvas-{shape}.json'))
    W, H = c['size']
    x, y, w, h = c['box']
    canvas = Image.open(f'gen/ext/canvas-{shape}.png').convert('RGB').resize((W, H))
    soft = canvas.filter(ImageFilter.GaussianBlur(28 if shape == 'wide' else 40))
    photo = src.resize((w, h), Image.LANCZOS)
    m = Image.new('L', (w, h), 0)
    f = 36
    ImageDraw.Draw(m).rectangle((f if x > 0 else 0, f if y > 0 else 0, w - (f if x + w < W else 0), h - (f if y + h < H else 0)), fill=255)
    m = m.filter(ImageFilter.GaussianBlur(f / 2))
    soft.paste(photo, (x, y), m)
    soft.save(f'assets/open-{shape}.webp', 'WEBP', quality=84)
    wl = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    wl.paste(water.resize((w, h), Image.LANCZOS), (x, y))
    wl.save(f'assets/water-{shape}.webp', 'WEBP', quality=82)
    print(shape, W, H)
