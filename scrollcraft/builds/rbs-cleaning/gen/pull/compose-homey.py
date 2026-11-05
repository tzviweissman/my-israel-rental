"""The end picture of the pull-back, furnished (Tzvi, 5 Nov: "more furniture to make it feel more homey"): the generated
room homey-0.png with the film's own view through its window, so the hills match all the way. Run from gen/pull."""
from PIL import Image, ImageDraw, ImageFilter
room = Image.open('homey-0.png').convert('RGB'); view = Image.open('start-c.png').convert('RGB')
X0, X1, Y0, WALL = 752, 1351, 258, 634      # the glass, and the top of the stone wall outside it
H = WALL - Y0 + 8; W = round(H * view.width / view.height)
v = view.resize((W, H), Image.LANCZOS).crop(((W - (X1 - X0)) // 2, 0, (W - (X1 - X0)) // 2 + X1 - X0, H))
layer = room.copy(); layer.paste(v, (X0, Y0))
m = Image.new('L', room.size, 0); d = ImageDraw.Draw(m)
d.rectangle((X0, Y0, X1, WALL), fill=255)
d.rectangle((X0, 582, 925, WALL), fill=0)   # the olive branches in the vase stay in front of the glass
m = m.filter(ImageFilter.GaussianBlur(2))
room.paste(layer, (0, 0), m)
# the framed photos on the sideboard held made-up people: they hold the hills instead (no people, brief)
hill = view.crop((500, 400, 1300, 1000))
for box in [(1909, 636, 1978, 700), (2021, 644, 2048, 745), (1920, 705, 1960, 738), (1838, 698, 1898, 732), (1374, 730, 1396, 762)]:
    room.paste(hill.resize((box[2] - box[0], box[3] - box[1])), box[:2])
room.save('room-d.png'); print(room.size, W, H)
