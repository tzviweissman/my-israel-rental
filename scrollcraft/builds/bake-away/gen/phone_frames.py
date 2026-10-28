"""Phone frames (720x1280) from the 16:9 film without zooming past the frame: the middle of each frame,
holding the whole doughnut and the falling stream, full width, set on the film's own dark slate colour
with soft top and bottom edges (rule 3c.12: never zoom in, never frame it in another colour)."""
import glob, os
import numpy as np
from PIL import Image
B = 'C:/Users/tzviw/Documents/mir-hero/scrollcraft/builds/bake-away/'
X0, X1, Y0, Y1 = 420, 2080, 0, 1360           # the doughnut and the stream above it, in 2560x1440 frames
W, H, TOP = 720, 1280, 170
ground = np.array([36, 27, 27], float)          # the film's top band, so the page and the film meet
for f in sorted(glob.glob(B + 'gen/film/raw/*.png')):
    im = Image.open(f).convert('RGB').crop((X0, Y0, X1, Y1))
    h = round(im.height * W / im.width)
    a = np.asarray(im.resize((W, h), Image.LANCZOS)).astype(float)
    m = np.ones((h, 1)); fe = 90
    m[:fe, 0] = np.linspace(0, 1, fe) ** 1.5; m[-fe:, 0] = np.linspace(1, 0, fe) ** 1.5
    canvas = np.tile(ground, (H, W, 1))
    canvas[TOP:TOP + h] = a * m[:, :, None] + canvas[TOP:TOP + h] * (1 - m[:, :, None])
    Image.fromarray(canvas.astype(np.uint8)).save(B + 'assets/film/m/' + os.path.basename(f)[:-4] + '.webp', quality=68)
print('phone frames', len(glob.glob(B + 'assets/film/m/*.webp')))
