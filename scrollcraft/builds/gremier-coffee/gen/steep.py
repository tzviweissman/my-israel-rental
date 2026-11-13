"""The steeping opening's picture (GC-F1): their own 01-sunlit-closeup photo with the coffee in the dispenser jar
lightened to pale amber water, as a see-through layer the page fades and drains off in code. Nothing generated.
Run from the build folder: python gen/steep.py"""
from PIL import Image, ImageDraw, ImageFilter, ImageChops

base = Image.open('src/site/01-sunlit-closeup-v3.webp').convert('RGB')
W, H = base.size
# the coffee inside the jar, as a polygon in 1200x800 picture pixels (read off the photo), minus their badge
jar = [(562, 150), (610, 138), (700, 132), (800, 138), (858, 152), (880, 200), (884, 260), (878, 330), (862, 395), (835, 432),
       (705, 440), (560, 430), (552, 380), (548, 300), (550, 210)]
m = Image.new('L', (W, H), 0)
d = ImageDraw.Draw(m)
d.polygon(jar, fill=255)
d.ellipse((646, 192, 764, 310), fill=0)          # the GREMIER badge stays as it is
# anything already light (the white tap, the glass rim) stays as it is
keep = base.convert('L').point(lambda v: 0 if v > 150 else 255).filter(ImageFilter.MaxFilter(5))
m = ImageChops.multiply(m, keep).filter(ImageFilter.GaussianBlur(4))
# how light each pixel is, then pale amber water that keeps the ice's highlights and the glass ribs
L = base.convert('L').point(lambda v: min(255, int(v * 2.2)))
amber = Image.new('RGB', (W, H), (205, 140, 62))
lift = Image.merge('RGB', [L.point(lambda v, k=k: int(v * k)) for k in (1.0, .93, .82)])
water = ImageChops.screen(ImageChops.multiply(amber, Image.new('RGB', (W, H), (235, 235, 235))), lift)
layer = water.convert('RGBA'); layer.putalpha(m)
layer.save('assets/steep-water.webp', 'WEBP', quality=82)
prev = base.copy(); prev.paste(water, (0, 0), m); prev.save('gen/steep-check.jpg', quality=85)
print('ok', W, H)
