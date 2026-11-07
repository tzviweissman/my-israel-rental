"""film/fade.png: the phone film's lower edge fades into the dark as the picture draws back. Run from gen/."""
import numpy as np
from PIL import Image
r = np.clip((1440 - np.arange(1440)) / 170, 0, 1)
Image.fromarray((np.full((1440, 2560), 255.) * r[:, None]).astype(np.uint8)).save('film/fade.png')
