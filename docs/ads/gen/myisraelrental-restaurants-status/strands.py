"""The weave (A11.2), take 2: which parts of the pasta twist lie in front of "5,000+". Free, code only, from
twist.png (ad-fit-picture.py --cut of gen.py's photo-2.jpg). ad.html lays twist.png whole behind the digits and
strands.png over them, both moved up by LIFT px. In front: the lower half of the twist (from the digits' middle
down) and the strand swinging right; behind: the upper half of the twist and the strand swinging left, so the pasta
goes through the number. Take 2b: the twist hangs BEHIND the digits (seen through the zeros' holes) and only the
strands come out IN FRONT: the left one over the 5 and the first zero's left stroke, the right one from just past the
third zero, so every cut falls inside a zero's hole or a gap, never on a white stroke.
    backend/.venv/Scripts/python docs/ads/gen/myisraelrental-restaurants-status/strands.py"""
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
LEFT_END = 418    # in front left of here (well inside the second character's hole, so the strand meets the twist there)
RIGHT_START = 735 # in front right of here (the gap after the third character)
a = np.asarray(Image.open(HERE / "twist.png").convert("RGBA")).copy()
x = np.arange(a.shape[1])[None, :]
front = np.maximum(np.clip((LEFT_END - x) / 10, 0, 1), np.clip((x - RIGHT_START) / 10, 0, 1))
a[..., 3] = (a[..., 3] * front).astype(np.uint8)
Image.fromarray(a).save(HERE / "strands.png", optimize=True)
print("strands.png: in front left of", LEFT_END, "and right of", RIGHT_START)
