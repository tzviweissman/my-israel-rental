"""The end picture of the pull-back: the room with the film's own view through one wide window. Free, in code, so the
hills match the squeegee film exactly. Run from gen/pull: python compose.py"""
from PIL import Image, ImageDraw, ImageFilter
room = Image.open('../room/wide2-0.png').convert('RGB'); view = Image.open('start-c.png').convert('RGB')
# 1. the two upright bars go: each is covered by the wall right beside it; the left one stops above the sofa
for x0, x1, y0, y1 in [(726, 768, 220, 748), (726, 768, 748, 762), (742, 768, 762, 806), (1054, 1090, 220, 806)]:
    room.paste(room.crop((x1 + 2, y0, x1 + 2 + x1 - x0 + 1, y1)), (x0, y0))
# the band above the glass becomes one even piece, from a stretch with no joints in it
room.paste(room.crop((1200, 224, 1210, 262)).resize((1565 - 470, 38)), (470, 224))
# 2. the film's view through the glass, feathered into the existing stone wall so the sofa and table stay in front
X0, X1, Y0, Y1, FADE = 475, 1562, 262, 690, 640
W = X1 - X0 + 1; H = round(W * view.height / view.width); top = int(655 - .885 * H)
v = view.resize((W, H), Image.LANCZOS)
layer = room.copy(); layer.paste(v, (X0, top))
m = Image.new('L', room.size, 0); d = ImageDraw.Draw(m)
for y in range(Y0, Y1):
    d.line([(X0, y), (X1, y)], fill=255 if y < FADE else round(255 * (Y1 - y) / (Y1 - FADE)))
d.rectangle((X0, 652, 552, Y1), fill=0)   # the top of the sofa stays in front of the view
m = m.filter(ImageFilter.GaussianBlur(1.2))
room.paste(layer, (0, 0), m)
room.save('room-c.png'); print(room.size, view.size, 'view top', top, 'H', H)
