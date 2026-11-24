"""One billable Higgsfield API still edited from their own crop: python still.py <out.png> <ref> <aspect> "<prompt>"
HF_KEY from backend/.env.local; never read or printed. Since 24 Nov 2026 through scripts/hf.py (priced, logged).
google/nano-banana-2/edit and bytedance/seedream/v4/edit are gone from the API (model_not_found), so the edit model is
Marketing Studio image, the one that redraws an owner's product exactly (backend/utils/ad_shots.py). It takes the
aspects 1:1, 3:4, 2:3 and 9:16; any other is refused before anything is charged.
2 credits a picture at 2k (Higgsfield's estimate, 24 Nov 2026); the API gives only a per-token rate for it."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "scripts"))
import hf  # noqa: E402

out, ref, aspect, prompt = sys.argv[1:5]
if Path(out).exists():
    sys.exit(f"already made, nothing spent: {out}")
if not Path(ref).is_file() or Path(ref).stat().st_size == 0:
    sys.exit(f"no reference picture at {ref}")
h = hf._client()
hf.make("marketing-studio/image/sunburst",
        {"prompt": prompt, "image_urls": [h.upload_file(ref)], "aspect_ratio": aspect, "resolution": "2k",
         "enhance_prompt": False},
        out, why=f"{Path(__file__).resolve().parents[1].name} still from {Path(ref).name}", credits=2)
