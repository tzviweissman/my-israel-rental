# Crops from the owner's own photos (src/owner), honest: no retouching, only cutting and resizing.
from PIL import Image
o = 'src/owner/'
p1, p2, p3, p5 = (Image.open(o + f).convert('RGB') for f in ('p01.jpg', 'p02.jpg', 'p03.jpg', 'p05.jpg'))
def save(im, name, q=88): im.save('assets/' + name, 'WEBP', quality=q)
bag = p2.crop((340, 1005, 922, 1470))   # their flyer render of the bagel pack, 582x465
# the flyer's thin black leader line (its annotation for the "Bagel Dough" legend) enters the corner of this crop:
# the 3 pixel rows it covers are filled from the rows above and below, nothing of the product is touched
px = bag.load()
for x in range(0, 84):
    for y in range(40, 47):
        t = (y - 38) / 10
        px[x, y] = tuple(round(px[x, 38][c] * (1 - t) + px[x, 48][c] * t) for c in range(3))
save(bag, 'bagel-dough.webp')
save(p5.crop((322, 545, 742, 880)), 'pizza-dough.webp')                  # their photo of the pizza dough tub, 420x335
save(p3.crop((0, 0, 1152, 1152)).resize((760, 760), Image.LANCZOS), 'baked-bagels.webp')   # their everything-bagels photo
save(p3.crop((0, 0, 1152, 1000)).resize((720, 625), Image.LANCZOS), 'baked-wide.webp')
save(p5.crop((0, 300, 1024, 1190)), 'pizza-tubs.webp')                   # their photo of the tubs in a row, 1024x890
save(p1.resize((160, 160), Image.LANCZOS), 'logo.webp', 92)
og = p2.crop((0, 760, 1344, 1470)).resize((1200, 634), Image.LANCZOS).crop((0, 0, 1200, 630)); save(og, 'og.webp', 85)
