"""Free stills for the film's end, from their own photo (gen/mountains-brief.md).
pano.png: their photo with black stone both sides; a centred window is where the climb lands, the left window leaves room for the words.
tall.png: the phone's end picture. edges.png: darkens the frame's sides, which hide the slivers at the end of the climb.
Run from gen/."""
import numpy as np
from PIL import Image
wide = Image.open('../assets/board-wide.webp').convert('RGB')          # 3200x1800, photo at x=950
stone = wide.crop((0, 0, 950, 1800))
p = Image.new('RGB', (3675, 1800))
p.paste(wide, (0, 0))
p.paste(stone.crop((475, 0, 950, 1800)).transpose(Image.FLIP_LEFT_RIGHT), (3200, 0))
p.save('film/pano.png')             
t = Image.open('../assets/board-tall.webp').convert('RGB')
t.resize((1440, round(t.height * 1440 / t.width)), Image.LANCZOS).crop((0, 0, 1440, 3200)).save('film/tall.png')
a = np.zeros((1440, 2560, 4), np.uint8); x = np.arange(2560) / 2559
d = np.minimum(x, 1 - x)
a[..., 0:3] = (7, 6, 5); a[..., 3] = (255 * np.clip((.115 - d) / .05, 0, 1)).astype(np.uint8)[None, :]
Image.fromarray(a).save('film/edges.png')
