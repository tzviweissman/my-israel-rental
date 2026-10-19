# The kraft bowl in his poppers photo came out blue-grey (the blue cloth cast
# its colour); the owner: "change the cup to brown, which was the original
# colour" (19 Oct 2026). Only the bluish, low-colour pixels (the bowl) are
# turned kraft brown; the orange food is untouched.
import sys, numpy as np, cv2
from PIL import Image
for src in sys.argv[1:]:
    im = Image.open(src); has_a = im.mode == 'RGBA'
    rgba = np.array(im.convert('RGBA')); rgb = rgba[..., :3]
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
    H, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    # bluish or grey, and not a bright glint on the glaze; the cloth (strong blue) is left
    bowl = (((H > 80) & (H < 140) & (S < 190)) | (S < 40)) & (V < 215)
    w = cv2.GaussianBlur(bowl.astype(np.float32), (0, 0), 2.5)   # soft edge
    H2 = np.full_like(H, 15)
    S2 = np.clip(95 + S * .25, 0, 150)
    V2 = np.clip(V * 1.08 + 8, 0, 255)
    out = cv2.cvtColor(np.dstack([H2, S2, V2]).astype(np.uint8), cv2.COLOR_HSV2RGB).astype(np.float32)
    w3 = w[..., None]
    rgb2 = (out * w3 + rgb * (1 - w3)).astype(np.uint8)
    res = np.dstack([rgb2, rgba[..., 3]]) if has_a else rgb2
    Image.fromarray(res).save(src, quality=86, method=6)
    print('recoloured', src)
