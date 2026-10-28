"""Cleans a cut-out (gen/cut/pNN.png): trims the pale cast-shadow rim under the doughnut, clears the background seen through the hole,
fills a thin slit, and softens the edge. Imported by assets.py."""
from PIL import Image, ImageChops, ImageFilter, ImageDraw

def clean(im):
    im = im.convert('RGBA'); W, H = im.size
    a = im.getchannel('A').point(lambda v: 255 if v > 128 else 0)
    # 1. a thin slit inside the cut (p12): close it, filling its colour from the pixels beside it
    closed = a.filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.MinFilter(15))
    slit = ImageChops.subtract(closed, a)
    if slit.getbbox():
        rgb = im.convert('RGB'); sh = ImageChops.offset(rgb, -11, 0)
        im = Image.composite(sh.convert('RGBA'), im, slit.point(lambda v: 255 if v > 0 else 0)); a = closed
    hsv = im.convert('RGB').convert('HSV'); h, s, v = hsv.split()
    # 2. the hole: pale background seen through it goes (flood fill from the middle over pale pixels)
    pale = ImageChops.multiply(v.point(lambda x: 255 if x > 212 else 0), s.point(lambda x: 255 if x < 14 else 0))
    bx = a.getbbox(); cx, cy = (bx[0] + bx[2]) // 2, int(bx[1] + (bx[3] - bx[1]) * .5)
    box = (int(cx - W * .17), int(cy - H * .13), int(cx + W * .17), int(cy + H * .2))
    seed = None; best = 1e18; pw = pale.crop(box); bw = pw.size[0]
    for i, px in enumerate(pw.getdata()):
        if px == 255:
            x, y = box[0] + i % bw, box[1] + i // bw; d = (x - cx) ** 2 + (y - cy - H * .06) ** 2
            if d < best: best, seed = d, (x, y)
    if seed:
        win = Image.new('L', (W, H), 0); ImageDraw.Draw(win).rectangle(box, fill=255)
        m = ImageChops.multiply(pale, win); ImageDraw.floodfill(m, seed, 128, thresh=0)
        hole = m.point(lambda x: 255 if x == 128 else 0)
        if hole.getbbox(): a = ImageChops.subtract(a, hole.filter(ImageFilter.MaxFilter(3)))
    # 3. the pale beige cast shadow rim (hue near orange, low saturation, bright), eaten from the edge inwards
    low = Image.new('L', (W, H), 0); ImageDraw.Draw(low).rectangle((0, bx[1] + (bx[3] - bx[1]) * .66, W, H), fill=255)
    rim = ImageChops.multiply(ImageChops.multiply(ImageChops.multiply(v.point(lambda x: 255 if x > 195 else 0), s.point(lambda x: 255 if 38 < x < 80 else 0)), h.point(lambda x: 255 if 8 < x < 24 else 0)), low)
    for _ in range(14):
        edge = ImageChops.subtract(a, a.filter(ImageFilter.MinFilter(3)))
        gone = ImageChops.multiply(edge, rim)
        if not gone.getbbox(): break
        a = ImageChops.subtract(a, gone)
    a = a.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))
    a = a.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.9))
    im.putalpha(a)
    return im
