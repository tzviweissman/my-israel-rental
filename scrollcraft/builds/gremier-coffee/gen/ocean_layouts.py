"""Layout sketches for the two new opening stills (12 Nov 2026, Tzvi: the grinder whole, beans going in, GRIND; then a
wavy ocean at the waterline that fills the screen). Given to the reference model with "photograph this layout for
real" (rules 3aa.9, A3.11). Run from the build folder: python gen/ocean_layouts.py"""
import math
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
CREAM, TERRA, BLACK, GLASS, BEAN = '#F6EEE3', '#CD7850', '#1c1c1c', '#d9e2e6', '#5a3a22'
font = ImageFont.truetype('C:/Windows/Fonts/georgiab.ttf', 430)

# g0: the whole grinder in the middle, space above it, beans falling into the hopper, GRIND behind with the I in front
im = Image.new('RGB', (W, H), CREAM); d = ImageDraw.Draw(im)
d.text((W / 2, H * 0.52), 'GRIND', font=font, fill=TERRA, anchor='mm')
d.rectangle([W * .465, H * .24, W * .535, H * .40], fill=GLASS, outline='#9aa', width=4)        # clear hopper
d.rectangle([W * .468, H * .02, W * .532, H * .26], fill=None)
for k in range(40):                                                                           # beans from above
    x = W * .5 + math.sin(k * 1.7) * 18; y = H * (.04 + k * .0075)
    d.ellipse([x - 9, y - 6, x + 9, y + 6], fill=BEAN)
d.rounded_rectangle([W * .455, H * .40, W * .545, H * .48], 18, fill=BLACK)                     # collar
d.rectangle([W * .475, H * .48, W * .525, H * .80], fill=BLACK)                                 # body
d.rectangle([W * .495, H * .80, W * .505, H * .86], fill=BLACK)                                 # spout
im.save('gen/world/g0-layout.png')

# o1: the waterline across the whole width at eye level, swells rolling toward the camera, cream page above,
# grounds falling from the top into the middle
im = Image.new('RGB', (W, H), CREAM); d = ImageDraw.Draw(im)
pts = [(x, H * .50 + 40 * math.sin(x / 140) + 25 * math.sin(x / 57)) for x in range(0, W + 1, 8)]
d.polygon(pts + [(W, H), (0, H)], fill='#7d9aa6')
for row in range(1, 6):                                                                       # swells nearer the camera
    y0 = H * .50 + row * 90
    d.line([(x, y0 + (20 + row * 14) * math.sin(x / (120 + row * 30) + row)) for x in range(0, W + 1, 8)], fill='#c9dbe2', width=6 + row * 3)
for k in range(60):
    x = W * .5 + math.sin(k * 2.3) * 10; y = H * (k * .0085)
    d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=BEAN)
im.save('gen/world/o1-layout.png')
print('ok')
