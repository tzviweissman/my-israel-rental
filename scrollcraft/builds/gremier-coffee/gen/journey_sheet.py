"""The journey's detailed sheet: the four generated stills (gen/journey-brief.md) and their own coffee bar photo,
in order, each with its word and what moves between it and the next. Run from the build folder."""
import textwrap
from PIL import Image, ImageDraw, ImageFont

F = 'C:/Windows/Fonts/'
word_f, cap_b, cap_f, title_f = (ImageFont.truetype(F + n, s) for n, s in
                                 [('seguibl.ttf', 64), ('segoeuib.ttf', 21), ('segoeui.ttf', 19), ('segoeuib.ttf', 30)])
CREAM, INK, BREW, TERRA = (246, 238, 227), (28, 20, 16), (59, 10, 2), (178, 96, 58)
W, H = 760, 428
steps = [('gen/journey/grind.png', 'GRIND', 'Beans pour from above into the grinder. The camera follows them down through it.'),
         ('gen/journey/powder.png', 'GRIND', '...and out of the bottom as a fine powder, every grain sharp. The camera keeps falling with it.'),
         ('gen/journey/steep-3.png', 'STEEP', 'The grounds fall into a jar of cold water and cloud through it. As you scroll the water turns to dark cold brew. "Brewed for hours, not minutes."'),
         ('gen/journey/tap-2.png', 'POUR', 'The brewed coffee runs from the dispenser tap over ice into a tall glass.'),
         ('gen/journey/pour.png', 'SWIRL', 'Cold milk pours in and swirls through it. The camera pulls back...'),
         ('assets/open-wide.webp', 'YOURS', '...to their own coffee bar on the sunlit table: the top of the page, with the headline and Shop cold brew.')]
pad, top, cols = 28, 92, 3
rowh = H + 125
sheet = Image.new('RGB', (pad + cols * (W + pad), top + 2 * rowh + 150), CREAM)
d = ImageDraw.Draw(sheet)
d.text((pad, 26), 'Gremier Coffee: the cold brew journey, one shot as you scroll down', font=title_f, fill=INK)
d.text((pad, 62), 'Concept stills 1 to 5 generated to look photographed; 6 is their own photo. The film moves between them.', font=cap_f, fill=(94, 81, 72))
for i, (src, word, line) in enumerate(steps):
    fr = Image.open(src).convert('RGB')
    fr = fr.resize((W, round(fr.height * W / fr.width)))
    fr = fr.crop((0, (fr.height - H) // 2, W, (fr.height - H) // 2 + H))
    fd = ImageDraw.Draw(fr)
    if i == len(steps) - 1:
        fd.rounded_rectangle((26, 150, 300, 300), 12, fill=CREAM)
        fd.text((42, 162), 'Cold brew &', font=title_f, fill=INK); fd.text((42, 200), 'coffee bars', font=title_f, fill=INK)
        fd.rounded_rectangle((42, 248, 230, 280), 8, fill=BREW); fd.text((56, 251), 'Shop cold brew', font=cap_f, fill='white')
    else:
        fd.text((26, 14), word, font=word_f, fill=TERRA)
    x, y = pad + (i % cols) * (W + pad), top + (i // cols) * rowh
    sheet.paste(fr, (x, y))
    d.text((x, y + H + 10), f'{i + 1}  {word}', font=cap_b, fill=BREW)
    d.multiline_text((x, y + H + 38), textwrap.fill(line, 70), font=cap_f, fill=INK, spacing=3)
y = top + 2 * rowh
d.text((pad, y), 'In the film', font=cap_b, fill=BREW)
d.text((pad, y + 32), 'One unbroken shot led by your scroll, backwards too. The camera rides down with what falls: beans, powder, cold brew, glass, their bar.', font=cap_f, fill=INK)
d.text((pad, y + 60), 'One big word per step in their warm terracotta, on their cream all the way, so the film melts into the page. Their bottles, badge and bar are never redrawn: it ends on their own photo.', font=cap_f, fill=INK)
sheet.save('gen/journey-detail.png')
print(sheet.size)
