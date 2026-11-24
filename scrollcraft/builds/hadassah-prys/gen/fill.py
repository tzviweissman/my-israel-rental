"""Fill the padded part of a canvas, one billable image: python gen/fill.py <canvas.png> <out.png> <aspect> "<prompt>"
HF_KEY comes from backend/.env.local in the main checkout; never read or printed here. Since 24 Nov 2026 through
scripts/hf.py (priced, logged): the nano-banana and seedream edit models are gone from the API (model_not_found), so
it uses Marketing Studio image (aspects 1:1, 3:4, 2:3, 9:16; others refused before any charge), 2 credits at 2k
(Higgsfield's estimate, 24 Nov 2026). Paste the original back over the fill afterwards (extend_photo.py)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "scripts"))
import hf  # noqa: E402

canvas, out, aspect, prompt = sys.argv[1:5]
if Path(out).exists():
    sys.exit(f"already made, nothing spent: {out}")
if not Path(canvas).is_file() or Path(canvas).stat().st_size == 0:
    sys.exit(f"no canvas picture at {canvas}")
h = hf._client()
hf.make("marketing-studio/image/sunburst",
        {"prompt": prompt, "image_urls": [h.upload_file(canvas)], "aspect_ratio": aspect, "resolution": "2k",
         "enhance_prompt": False},
        out, why=f"hadassah-prys fill of {Path(canvas).name}", credits=2)
