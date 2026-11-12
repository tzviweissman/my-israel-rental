"""The Large size card's tub shot from their own photo of a Large tub (Tzvi, 11 Nov 2026: "can I send a picture of the
large size cholent to be added to the website"). One Higgsfield API edit, about 0.25 credits.

    python scrollcraft/builds/la-cholent/gen/tub_large.py [take]

Image 1 is their photo (src/owner-2026-11-11/large-tub.jpg, turned upright as gen/large-upright.jpg so the label reads across): the product, kept exactly. Image 2 is the Large card's
current shot (assets/tub-olive.webp): only its set, camera and light are taken. HF_KEY from backend/.env.local, never
printed."""
import io
import sys
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[4]
load_dotenv(ROOT / "backend" / ".env.local")
import higgsfield_client  # noqa: E402
from PIL import Image  # noqa: E402

GEN = Path(__file__).resolve().parent
BUILD = GEN.parent
PROMPT = (
    "Premium product photograph, landscape 4:3. Image 1 is the real product: keep it exactly, one deep clear plastic "
    "tub of raw cholent sealed in cling film, with the folded white slow cooker liner lying on its lid and the black "
    "and white label 'L.A. CHOLENT By Rabbi Samuels' with its recipe lines; the same tub shape, size, contents, colour, "
    "label, liner and cling film. The label reads left to right, exactly 'L.A. CHOLENT' in thin capitals and 'By Rabbi Samuels' in script below it, then small recipe lines; copy those letters exactly, never mirrored or invented; it is fine for the liner to cover part of the recipe lines, as in image 1. Image 2 shows only the set to put it in: a plain olive green studio wall and table, a "
    "dark rough slate block, one raw beef marrow bone at the right of the slab, one warm soft key light from the left. "
    "Place the tub on the slate block, three-quarter view, label facing the camera and readable, the tub filling about "
    "half the width, centred, as in image 2. Nothing else: no beans, no potatoes, no grains, no other food, no text "
    "besides the tub's own label, no hands."
)


def jpg(path: Path, name: str) -> Path:
    out = GEN / name
    buf = io.BytesIO()
    im = Image.open(path).convert("RGB")
    im.thumbnail((2048, 2048))
    im.save(buf, "JPEG", quality=92)
    out.write_bytes(buf.getvalue())
    return out


def main(take: str) -> None:
    refs = [jpg(GEN / "large-upright.jpg", "large-src.jpg"), jpg(BUILD / "assets" / "tub-olive.webp", "large-set.jpg")]
    final = {}
    r = higgsfield_client.subscribe(
        "marketing-studio/image/sunburst",
        arguments={"prompt": PROMPT, "image_urls": [higgsfield_client.upload_file(p) for p in refs], "aspect_ratio": "4:3",
                   "resolution": "2k", "quality": "medium", "enhance_prompt": False},
        on_queue_update=lambda s: final.update(s=s),
    )
    if not isinstance(final.get("s"), higgsfield_client.Completed):
        raise SystemExit(f"not made: {type(final.get('s')).__name__}")
    url = ((r or {}).get("images") or [{}])[0].get("url")
    if not url:
        raise SystemExit("not made: no image")
    out = GEN / f"tub-large-{take}.png"
    out.write_bytes(urllib.request.urlopen(url, timeout=60).read())
    print("saved", out, Image.open(out).size)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "1")
