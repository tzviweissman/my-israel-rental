"""From the chosen real-looking view (gen/view/a-0.png): the squeegee film's end and start stills and the furnished room.
Run with the backend venv python (numpy) from gen/view. Only levels are changed on the view, never its content."""
from PIL import Image, ImageFilter
import numpy as np
v = Image.open('a-0.png').convert('RGB').crop((0, 60, 1920, 1140))      # the window frame on its right edge goes
a = np.asarray(v).astype(float) / 255
a = np.clip(a ** .82 * 1.04, 0, 1)                                      # morning light: lift the shadows a little
v = Image.fromarray((a * 255).round().astype('uint8')); v.save('end.png')
l = Image.open('../wipe/lather-0.png').convert('RGB').resize((1920, 1080), Image.LANCZOS).crop((765, 0, 1920, 650)).resize((1920, 1080), Image.LANCZOS).point(lambda c: min(255, int(130 + c * .55)))
Image.blend(v.filter(ImageFilter.GaussianBlur(24)), l, .8).save('start.png')
room = Image.open('../pull/homey-0.png').convert('RGB')
X0, X1, Y0, Y1 = 752, 1351, 258, 745
H = Y1 - Y0; W = round(H * 16 / 9); cut = (W - (X1 - X0)) // 2
p = v.resize((W, H), Image.LANCZOS).crop((cut, 0, cut + X1 - X0, H))
lum = np.asarray(room.convert('L')).astype(float)
m = np.zeros(lum.shape, 'uint8'); m[Y0:Y1, X0:X1] = 255
b = lum[585:Y1, X0:935]; m[585:Y1, X0:935] = np.where(b < 92, 0, 255)    # the olive branches in the vase stay in front
m = Image.fromarray(m).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.8))
layer = room.copy(); layer.paste(p, (X0, Y0)); room.paste(layer, (0, 0), m)
hill = v.crop((500, 300, 1300, 900))
for box in [(1909, 636, 1978, 700), (2021, 644, 2048, 745), (1920, 705, 1960, 738), (1838, 698, 1898, 732), (1374, 730, 1396, 762)]:
    room.paste(hill.resize((box[2] - box[0], box[3] - box[1])), box[:2])
room.save('room.png'); room.crop((640, 220, 2048, 960)).save('room-crop.png')
