"""Sketch of the cold brew journey opening (Tzvi, 11 Nov 2026: "yes" to a picture before any spend), after the
Pinterest coffee site he liked (docs/inspo/pinterest-coffee-2026-11-11). Drawn in code: simple shapes where the film
would show new footage, their own photos where the footage ends on their real things. Nothing generated, no cost.
Run from the build folder: python gen/journey_sketch.py"""
import math
import random
import textwrap

from PIL import Image, ImageDraw, ImageFont, ImageFilter

random.seed(4)
W, H = 640, 400
CREAM, INK, BREW, TERRA = (246, 238, 227), (28, 20, 16), (59, 10, 2), (178, 96, 58)
F = 'C:/Windows/Fonts/'
huge = ImageFont.truetype(F + 'seguibl.ttf', 132)
cap_f = ImageFont.truetype(F + 'segoeui.ttf', 19)
cap_b = ImageFont.truetype(F + 'segoeuib.ttf', 19)
title_f = ImageFont.truetype(F + 'segoeuib.ttf', 28)
small = ImageFont.truetype(F + 'segoeui.ttf', 16)


def ground():
    im = Image.new('RGB', (W, H), CREAM)
    sh = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(sh)
    for k in range(5):   # soft leaf shadow, like their photos' wall
        d.ellipse((380 + k * 40, -60 + k * 25, 520 + k * 40, 40 + k * 25), fill=26)
    sh = sh.filter(ImageFilter.GaussianBlur(18))
    im.paste((210, 190, 165), (0, 0), sh)
    return im


def word(im, text, y, colour=TERRA):
    d = ImageDraw.Draw(im)
    w = d.textlength(text, font=huge)
    d.text(((W - w) / 2, y), text, font=huge, fill=colour)


def bean(d, x, y, r, a):
    pts = [(x + r * math.cos(t) * math.cos(a) - .62 * r * math.sin(t) * math.sin(a),
            y + r * math.cos(t) * math.sin(a) + .62 * r * math.sin(t) * math.cos(a)) for t in [i * math.pi / 12 for i in range(24)]]
    d.polygon(pts, fill=(62, 34, 18))
    d.line([(x - r * .8 * math.cos(a), y - r * .8 * math.sin(a)), (x + r * .8 * math.cos(a), y + r * .8 * math.sin(a))], fill=(30, 14, 6), width=2)


def arrow(d, x, y0, y1):
    d.line([(x, y0), (x, y1)], fill=BREW, width=3)
    d.polygon([(x - 8, y1 - 12), (x + 8, y1 - 12), (x, y1)], fill=BREW)


frames = []

# 1 GRIND: beans fall from above into a grinder, the huge word behind
im = ground(); word(im, 'GRIND', 120); d = ImageDraw.Draw(im)
for _ in range(26):
    bean(d, 320 + random.gauss(0, 26), random.uniform(-10, 150), random.uniform(9, 13), random.uniform(0, 3))
d.polygon([(250, 170), (390, 170), (360, 270), (280, 270)], fill=(235, 230, 222), outline=INK, width=3)   # glass hopper
for _ in range(14):
    bean(d, random.uniform(292, 348), random.uniform(225, 262), 9, random.uniform(0, 3))
d.rounded_rectangle((270, 270, 370, 380), 10, fill=(32, 30, 28))   # grinder body
d.ellipse((300, 300, 340, 340), outline=(140, 140, 140), width=3)
frames.append((im, 'GRIND', 'Beans fall from above into the grinder. Scrolling down follows them down.'))

# 2 STEEP: the grounds fall into a big jar of cold water, which turns dark as you scroll
im = ground(); word(im, 'STEEP', 40); d = ImageDraw.Draw(im)
for _ in range(220):
    x = 320 + random.gauss(0, 10); y = random.uniform(0, 190)
    d.ellipse((x, y, x + 3, y + 3), fill=(70, 40, 20))
jar = (215, 180, 425, 395)
grad = Image.new('RGB', (jar[2] - jar[0], jar[3] - jar[1]))
for yy in range(grad.height):   # pale water at the top, already dark cold brew below: the steeping, mid-scroll
    t = min(1, max(0, (yy - 40) / 120))
    c = tuple(round(a + (b - a) * t) for a, b in zip((222, 196, 150), (60, 18, 6)))
    ImageDraw.Draw(grad).line([(0, yy), (grad.width, yy)], fill=c)
m = Image.new('L', grad.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, grad.width - 1, grad.height - 1), 40, fill=255)
im.paste(grad, jar[:2], m); d = ImageDraw.Draw(im)
d.rounded_rectangle(jar, 40, outline=INK, width=3)
for _ in range(9):   # ice
    x, y = random.uniform(240, 390), random.uniform(195, 260)
    d.rounded_rectangle((x, y, x + 22, y + 22), 5, outline=(255, 255, 255), width=2)
d.text((242, 362), 'Brewed for hours, not minutes', font=ImageFont.truetype(F + 'segoeui.ttf', 14), fill=(255, 246, 236))
frames.append((im, 'STEEP', 'The grounds land in cold water with ice. As you scroll the water slowly turns to dark cold brew.'))

# 3 BOTTLE: the cold brew runs from the jar's tap into their black-label bottle (their own photo)
im = ground(); word(im, 'BOTTLE', 120); d = ImageDraw.Draw(im)
ph = Image.open('assets/p/classic.webp').convert('RGB')   # their Classic shot, 1200x800: bottle x 500-700, glass x 300-490
b = ph.crop((490, 20, 710, 740)).resize((132, 432))
bm = Image.new('L', b.size, 0); ImageDraw.Draw(bm).rounded_rectangle((6, 0, 126, 432), 24, fill=255)
im.paste(b, (329, 60), bm.filter(ImageFilter.GaussianBlur(4)))
d.rectangle((250, 0, 400, 22), fill=(240, 240, 236), outline=INK, width=2)   # the jar's tap above
d.line([(395, 22), (395, 66)], fill=BREW, width=7)
frames.append((im, 'BOTTLE', 'It runs from the jar into their Classic bottle (their own photo of it).'))

# 4 POUR: over ice in a glass, milk swirls in (their own iced glass)
im = ground(); word(im, 'POUR', 120); d = ImageDraw.Draw(im)
g = ph.crop((290, 300, 500, 720)).resize((180, 360))
gm = Image.new('L', g.size, 0); ImageDraw.Draw(gm).rounded_rectangle((4, 0, 176, 360), 20, fill=255)
im.paste(g, (230, 40), gm.filter(ImageFilter.GaussianBlur(4)))
d.line([(330, 0), (328, 70)], fill=(250, 248, 240), width=9)   # milk pouring in
frames.append((im, 'POUR', 'Poured over ice; milk swirls through it, like in their own photos. The camera pulls back...'))

# 5 the shop: it lands on their coffee bar, the page's own ground
im = Image.open('assets/open-wide.webp').convert('RGB').resize((W, round(800 * W / 1422)))
canvas = Image.new('RGB', (W, H), CREAM); canvas.paste(im, (0, (H - im.height) // 2)); d = ImageDraw.Draw(canvas)
d.rounded_rectangle((20, 120, 270, 250), 12, fill=CREAM)
d.text((34, 130), 'Cold brew &', font=title_f, fill=INK); d.text((34, 166), 'coffee bars', font=title_f, fill=INK)
d.rounded_rectangle((34, 208, 198, 238), 8, fill=BREW); d.text((46, 210), 'Shop cold brew', font=small, fill='white')
frames.append((canvas, 'SHOP', '...out to their whole coffee bar, which is the top of the page, with the headline and button.'))

# the sheet: five frames in a row of 3 and 2, numbered, each with its line
pad, top = 26, 80
cols = 3
sheet = Image.new('RGB', (pad + cols * (W + pad), top + 2 * (H + 90) + pad), CREAM)
d = ImageDraw.Draw(sheet)
d.text((pad, 24), 'Gremier Coffee: the cold brew journey, one shot as you scroll down (sketch, nothing generated yet)', font=title_f, fill=INK)
for i, (fr, name, line) in enumerate(frames):
    x, y = pad + (i % cols) * (W + pad), top + (i // cols) * (H + 90)
    sheet.paste(fr, (x, y))
    ImageDraw.Draw(sheet).rectangle((x, y, x + W - 1, y + H - 1), outline=(220, 205, 185), width=2)
    d.text((x, y + H + 10), f'{i + 1}  {name}', font=cap_b, fill=BREW)
    d.multiline_text((x, y + H + 34), textwrap.fill(line, 62), font=cap_f, fill=INK, spacing=2)
# how the steps join, in the last cell
x, y = pad + 2 * (W + pad), top + H + 90
d.text((x + 10, y + 20), 'How it joins up', font=cap_b, fill=BREW)
for k, t in enumerate(['What falls out of each step falls into the next:', 'beans  >  grounds  >  cold brew  >  glass  >  your coffee bar.',
                       'The camera rides down with what is falling.', 'One huge word per step, the thing in front of it.',
                       'All on their warm cream, so the film melts into the page.', 'Steps 3 to 5 end on their real bottle, glass and bar photos.']):
    d.text((x + 10, y + 56 + k * 30), t, font=cap_f, fill=INK)
sheet.save('gen/journey-sketch.png')
print('ok', sheet.size)
