"""Rough sketch of the wider film (12 Nov 2026), for Tzvi to approve before any paid still or clip.
Drawn over their own coffee bar photo, faded, so every frame shows the whole table. Run from the build folder."""
from PIL import Image, ImageDraw, ImageEnhance, ImageFont

base = Image.open('assets/open-wide.webp').convert('RGB').resize((800, 450))
W, H = base.size
try:
    font = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 26)
    small = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 18)
except OSError:
    font = small = ImageFont.load_default()
INK, BROWN, MILK = (30, 20, 16), (70, 32, 14), (250, 248, 240)
# where things are in their photo, at 800 x 450
DISP = (440, 40, 630, 300)      # the glass dispenser
GLASS = (180, 285, 280, 420)    # the glass at the front left


def faded():
    im = ImageEnhance.Color(base).enhance(0.25)
    return Image.blend(im, Image.new('RGB', im.size, (246, 238, 227)), 0.45)


def label(d, n, word, line):
    d.rounded_rectangle((14, 14, 360, 92), 12, fill=(246, 238, 227))
    d.text((28, 20), f'{n}. {word}', font=font, fill=INK)
    d.text((28, 56), line, font=small, fill=INK)


frames = []
# 1 Grind: grinder above the open dispenser, beans in, powder falls into clear water and ice
im = faded(); d = ImageDraw.Draw(im)
d.rectangle((DISP[0] + 10, DISP[1] + 30, DISP[2] - 10, DISP[3] - 60), fill=(215, 230, 235), outline=INK, width=3)
d.rounded_rectangle((505, 0, 565, 45), 8, fill=(25, 25, 25))
for y in range(47, 90, 10): d.line((535, y, 535, y + 5), fill=BROWN, width=3)
d.polygon([(GLASS[0], GLASS[1]), (GLASS[2], GLASS[1]), (GLASS[2] - 5, GLASS[3]), (GLASS[0] + 5, GLASS[3])], outline=INK, fill=(220, 232, 236), width=3)
label(d, 1, 'Grind', 'Beans into the grinder, powder into the water')
frames.append(im)
# 2 Steep: coffee clouds through the water and turns deep brown; the grinder rises out of the picture
im = faded(); d = ImageDraw.Draw(im)
d.rectangle((DISP[0] + 10, DISP[1] + 30, DISP[2] - 10, DISP[3] - 60), fill=BROWN, outline=INK, width=3)
d.line((535, 40, 535, 0), fill=INK, width=4); d.polygon([(525, 12), (545, 12), (535, 0)], fill=INK)
d.polygon([(GLASS[0], GLASS[1]), (GLASS[2], GLASS[1]), (GLASS[2] - 5, GLASS[3]), (GLASS[0] + 5, GLASS[3])], outline=INK, fill=(220, 232, 236), width=3)
label(d, 2, 'Steep', 'The water turns to cold brew')
frames.append(im)
# 3 Swirl: cold brew then milk poured into the glass from above
im = faded(); d = ImageDraw.Draw(im)
d.rectangle((DISP[0] + 10, DISP[1] + 30, DISP[2] - 10, DISP[3] - 60), fill=BROWN, outline=INK, width=3)
d.polygon([(GLASS[0], GLASS[1]), (GLASS[2], GLASS[1]), (GLASS[2] - 5, GLASS[3]), (GLASS[0] + 5, GLASS[3])], outline=INK, fill=BROWN, width=3)
d.line((230, 0, 230, GLASS[1] + 20), fill=MILK, width=8)
for k in range(3): d.arc((GLASS[0] + 8, GLASS[1] + 30 + 25 * k, GLASS[2] - 8, GLASS[1] + 60 + 25 * k), 0, 180, fill=MILK, width=4)
label(d, 3, 'Swirl', 'Milk curls into the glass')
frames.append(im)
# 4 Serve: the camera settles on their own photo, exactly
im = base.copy(); d = ImageDraw.Draw(im)
label(d, 4, 'Serve', 'Ends on your real coffee bar photo')
frames.append(im)

sheet = Image.new('RGB', (W * 2 + 30, H * 2 + 30), (255, 255, 255))
for i, f in enumerate(frames):
    sheet.paste(f, (10 + (i % 2) * (W + 10), 10 + (i // 2) * (H + 10)))
sheet.save('gen/wide-sketch.png')
print('gen/wide-sketch.png')
