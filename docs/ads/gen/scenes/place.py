"""The owner's real product photographed onto one of our empty sets (docs/ads/blueprints/scenes.md, A3.3).
Billable Higgsfield API (Marketing Studio Image, edit mode).

    python docs/ads/gen/scenes/place.py <out.jpg> <aspect> <product photo URL or path> <set picture path> "<what the product is>"

The product is redrawn from the owner's own photo, never invented; the result is compared beside that photo.
HF_KEY comes from backend/.env.local; never read or printed here."""
import io
import sys
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[4]
load_dotenv(ROOT / "backend" / ".env.local")
import higgsfield_client  # noqa: E402
from PIL import Image  # noqa: E402

out, aspect, product, scene, what = sys.argv[1:6]
shot = sys.argv[6] if len(sys.argv) > 6 else ""


def url_of(src: str) -> str:
    return src if src.startswith("http") else higgsfield_client.upload_file(Path(src))


prompt = (
    f"Product photograph. Image 1 is the real product: {what}. Image 2 is the empty set. Place exactly the product "
    "from image 1 standing on the table of image 2, in the middle of the tabletop, as a real photo shot on that "
    "table: the same camera angle, light and shadows as image 2, a soft contact shadow where it touches. Keep the "
    "product identical to image 1: same shape, colour, toppings, texture and count; do not add, remove or improve "
    "anything about it. Keep image 2's table, wall and props, and keep the upper third of the picture empty. "
    "No text, no letters, no logos, no hands, no people."
    + (f" The shot: {shot}" if shot else "")
)
final = {}
r = higgsfield_client.subscribe(
    "marketing-studio/image/sunburst",
    arguments={"prompt": prompt, "image_urls": [url_of(product), url_of(scene)], "aspect_ratio": aspect,
               "resolution": "2k", "quality": "medium", "enhance_prompt": False},
    on_queue_update=lambda s: final.update(s=s),
)
if not isinstance(final.get("s"), higgsfield_client.Completed):
    sys.exit(f"FAILED: {type(final.get('s')).__name__} {sorted((r or {}).keys())}")
images = (r or {}).get("images") or []
if not images:
    sys.exit(f"FAILED: no images {sorted((r or {}).keys())}")
img = Image.open(io.BytesIO(urllib.request.urlopen(images[0]["url"]).read())).convert("RGB")
img.thumbnail((1080, 1920))
img.save(out, quality=88)
print("saved", out, img.size)
