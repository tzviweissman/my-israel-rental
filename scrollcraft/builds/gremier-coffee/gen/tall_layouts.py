"""Tall 9:16 layout sketches for the phone film (13 Nov 2026, Tzvi: "do the 60"): the same three stills as the laptop
film, re-framed for a phone held upright, given to the reference model beside the wide still (rules 3aa.9, A3.11).
Run from the build folder: python gen/tall_layouts.py"""
import math
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
CREAM, TERRA, BLACK, GLASS, BEAN = '#F6EEE3', '#CD7850', '#1c1c1c', '#d9e2e6', '#5a3a22'
font = ImageFont.truetype('C:/Windows/Fonts/georgiab.ttf', 230)

# g0t: GRIND across the width a little above the middle, the whole grinder in front of the I, beans from the top
im = Image.new('RGB', (W, H), CREAM); d = ImageDraw.Draw(im)
d.text((W / 2, H * .47), 'GRIND', font=font, fill=TERRA, anchor='mm')
d.rectangle([W * .43, H * .30, W * .57, H * .40], fill=GLASS, outline='#9aa', width=4)
for k in range(50):
    x = W * .5 + math.sin(k * 1.7) * 14; y = H * (.02 + k * .0058)
    d.ellipse([x - 8, y - 5, x + 8, y + 5], fill=BEAN)
d.rounded_rectangle([W * .41, H * .40, W * .59, H * .45], 14, fill=BLACK)
d.rectangle([W * .45, H * .45, W * .55, H * .66], fill=BLACK)
d.rectangle([W * .49, H * .66, W * .51, H * .70], fill=BLACK)
im.save('gen/world/g0t-layout.png')

# o1t: waterline about a third down, waves filling the lower two thirds and rolling at the camera, grounds into the middle
im = Image.new('RGB', (W, H), CREAM); d = ImageDraw.Draw(im)
pts = [(x, H * .34 + 40 * math.sin(x / 120) + 22 * math.sin(x / 47)) for x in range(0, W + 1, 6)]
d.polygon(pts + [(W, H), (0, H)], fill='#7d9aa6')
for row in range(1, 9):
    y0 = H * .34 + row * 150
    d.line([(x, y0 + (24 + row * 12) * math.sin(x / (100 + row * 25) + row)) for x in range(0, W + 1, 6)], fill='#c9dbe2', width=6 + row * 3)
for k in range(50):
    x = W * .5 + math.sin(k * 2.3) * 8; y = H * (k * .0068)
    d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=BEAN)
im.save('gen/world/o1t-layout.png')

# J3t: the whole tall glass of ice, large in the middle, the stream of cold brew falling into it from the top
im = Image.new('RGB', (W, H), '#E9D9C4'); d = ImageDraw.Draw(im)
d.rectangle([W * .26, H * .30, W * .74, H * .86], fill='#8a5a36', outline='#ddd', width=8)
d.rectangle([W * .495, 0, W * .505, H * .30], fill='#5a3a22')
d.rectangle([0, H * .86, W, H], fill='#F2EEE8')
im.save('gen/world/J3t-layout.png')
print('ok')
