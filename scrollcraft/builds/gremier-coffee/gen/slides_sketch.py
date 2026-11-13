"""Sketch of the opening as stacked slides (Tzvi, 12 Nov 2026: "they are each on their own slide so its not just
fading away"), after his recording of the Pinterest coffee site. Each slide is one full screen; scrolling pushes it
up and the next comes in from below; what is falling crosses the line between them at the same place.
Drawn from the stills already made; nothing generated. Run from the build folder: python gen/slides_sketch.py"""
from PIL import Image, ImageDraw, ImageFont

F = 'C:/Windows/Fonts/'
word = ImageFont.truetype(F + 'seguibl.ttf', 54); cap = ImageFont.truetype(F + 'segoeui.ttf', 20); capb = ImageFont.truetype(F + 'segoeuib.ttf', 22)
title = ImageFont.truetype(F + 'segoeuib.ttf', 30)
CREAM, INK, BREW, TERRA = (246, 238, 227), (28, 20, 16), (59, 10, 2), (154, 78, 44)
W, H = 560, 315
slides = [('gen/journey/grind.png', 'GRIND', 'Beans pour in at the top; fine powder streams out of the bottom of the grinder, down out of the slide'),
          ('gen/journey/steep-3.png', 'STEEP', 'The same stream of powder falls in from the top of this slide into the jar of cold water, which turns dark'),
          ('gen/journey/pour.png', 'POUR', 'Cold brew pours in from the top over ice; milk swirls through it'),
          ('gen/journey/bar-end.png', 'YOURS', 'Their coffee bar slides in from below, the iced glass at its front left: their own photo with the Shop button')]
pad, top, gap = 30, 90, 0
colx = pad
sheet = Image.new('RGB', (pad * 3 + W + 760, top + len(slides) * H + pad + 40), CREAM)
d = ImageDraw.Draw(sheet)
d.text((pad, 26), 'Gremier: the opening as slides stacked down the page (sketch from the stills, nothing generated)', font=title, fill=INK)
for i, (src, w, line) in enumerate(slides):
    im = Image.open(src).convert('RGB').resize((W, H))
    fd = ImageDraw.Draw(im)
    fd.text((18, 10), w, font=word, fill=TERRA)
    y = top + i * H
    sheet.paste(im, (colx, y))
    if i and i < len(slides) - 1:   # the seam between two slides, and the stream that crosses it
        d.line([(colx, y), (colx + W, y)], fill=CREAM, width=4)
        d.line([(colx + W // 2, y - 46), (colx + W // 2, y + 46)], fill=(70, 38, 18), width=8)
        d.ellipse((colx + W // 2 - 26, y - 26, colx + W // 2 + 26, y + 26), outline=BREW, width=4)
    tx = colx + W + pad
    d.text((tx, y + 20), f'Slide {i + 1}: {w.title()}', font=capb, fill=BREW)
    words, row, ty = line.split(), '', y + 56
    for t in words:   # wrap by hand
        if d.textlength(row + ' ' + t, font=cap) > 700:
            d.text((tx, ty), row.strip(), font=cap, fill=INK); ty += 28; row = ''
        row += ' ' + t
    d.text((tx, ty), row.strip(), font=cap, fill=INK)
    if i < len(slides) - 1:
        d.text((tx, y + H - 44), 'Scroll: this slide pushes up, the next comes in from below;', font=cap, fill=(94, 81, 72))
        d.text((tx, y + H - 18), 'the circle marks where the falling coffee crosses into it.', font=cap, fill=(94, 81, 72))
sheet.save('gen/slides-sketch.png')
print(sheet.size)
