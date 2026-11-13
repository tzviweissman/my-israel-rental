"""A rough storyboard of the new opening (Tzvi, 11 Nov 2026: "show me a picture of how the scene will look").
Made in code from their own photo: each panel is a frame of the zoom out. Panel 1 stands in for the close-up
swirl a generated clip would show sharp. Run from the build folder: python gen/storyboard.py"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter

im = Image.open('assets/open-wide.webp').convert('RGB')   # 1422x800, the jar's coffee around x 772..1105, y 140..440
W, H = 560, 315
# camera boxes (16:9) from deep inside the coffee out to the whole table
boxes = [(985, 150, 1085, 206), (760, 120, 1120, 323), (560, 40, 1220, 411), (0, 0, 1422, 800)]
caps = ['1  Inside the cold brew: it swirls, ice turns, sun comes through',
        '2  Scroll: the camera pulls back through the glass, the badge appears',
        '3  The whole dispenser, then the syrups, milk and iced glass',
        '4  Their own coffee bar photo; the headline and button arrive']
try:
    font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 19)
    big = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 26)
except OSError:
    font = big = ImageFont.load_default()
pad, top = 24, 70
sheet = Image.new('RGB', (pad + 2 * (W + pad), top + 2 * (H + 60) + pad), (246, 238, 227))
d = ImageDraw.Draw(sheet)
d.text((pad, 20), 'Gremier Coffee: the new opening, frame by frame as you scroll (rough sketch from their photo)', fill=(28, 20, 16), font=big)
for i, (b, c) in enumerate(zip(boxes, caps)):
    fr = im.crop(b).resize((W, H), Image.LANCZOS)
    if i == 0:   # the close-up is soft here because their photo is small; the generated clip makes it sharp and swirling
        fr = fr.filter(ImageFilter.GaussianBlur(1.2))
    if i == 3:
        fd = ImageDraw.Draw(fr)
        fd.rounded_rectangle((24, 90, 250, 200), 10, fill=(246, 238, 227))
        fd.text((36, 100), 'Cold brew &', fill=(28, 20, 16), font=big)
        fd.text((36, 132), 'coffee bars', fill=(28, 20, 16), font=big)
        fd.rounded_rectangle((36, 168, 200, 194), 6, fill=(59, 10, 2))
        fd.text((46, 168), 'Shop cold brew', fill='white', font=font)
    x, y = pad + (i % 2) * (W + pad), top + (i // 2) * (H + 60)
    sheet.paste(fr, (x, y))
    d.text((x, y + H + 10), c, fill=(28, 20, 16), font=font)
sheet.save('gen/storyboard.png')
print('ok')
