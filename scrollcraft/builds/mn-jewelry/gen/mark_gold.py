"""Their logo's gold on the dark menu bar: the marble behind the oval goes, the gold stays (R minus B is the gold)."""
import numpy as np
from PIL import Image
a = np.asarray(Image.open('assets/mark.webp').convert('RGB')).astype(np.float32)
alpha = np.clip((a[:, :, 0] - a[:, :, 2] - 18) / 45, 0, 1)
rgb = np.clip(a * 1.12, 0, 255)
Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), 'RGBA').save('assets/mark-gold.webp', lossless=True)
