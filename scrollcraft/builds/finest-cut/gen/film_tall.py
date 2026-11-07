"""film/tall.png lowered so the board's top clears the header on short phones (review, 7 Nov 2026: at 360x640 the top row sat under it).
The board moves down 368 px of 3200 (184 of the phone film's 1600); the space above it is the stone's own dark, feathered in. Run from gen/ after film_stills.py."""
import numpy as np
from PIL import Image
t = np.asarray(Image.open('film/tall.png').convert('RGB')).astype(np.float32)
D, FEATHER = 368, 160
top = np.broadcast_to(t[:40].mean(axis=(0, 1)), (D, t.shape[1], 3))
out = np.concatenate([top, t], 0)[:t.shape[0]]
w = np.clip((np.arange(FEATHER)) / FEATHER, 0, 1)[:, None, None]
out[D:D + FEATHER] = top[0] * (1 - w) + t[:FEATHER] * w
Image.fromarray(out.clip(0, 255).astype(np.uint8)).save('film/tall.png')
