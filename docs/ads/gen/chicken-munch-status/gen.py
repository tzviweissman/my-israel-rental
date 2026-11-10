"""Chicken Munch's WhatsApp status ad picture (docs/ads/blueprints/chicken-munch-status.md). One billable Higgsfield API still.

    python docs/ads/gen/chicken-munch-status/gen.py [take]

Rebuilt around his own photo (frontend/public/pages/chicken-munch/assets/poppers.webp, rule A3.3): the same bowl and
the same glazed poppers, only the camera, the light and the leaping pieces change. No words in the picture (A3.7).
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

OUT = Path(__file__).resolve().parent / "out"
PHOTO = ROOT / "frontend" / "public" / "pages" / "chicken-munch" / "assets" / "poppers.webp"
PROMPT = (
    "Professional food advertising photograph, vertical. Image 1 is the real product: keep it exactly, the same kraft "
    "paper bowl and the same glazed popcorn chicken, the same deep navy blue cloth under it. Composition, strictly: "
    "the TOP THIRD of the picture is completely empty smooth dark navy backdrop, nothing in it. The bowl stands on the "
    "navy cloth, centred, filling about 65 percent of the width; its top rim is at about 55 percent of the picture's "
    "height and its bottom at about 78 percent; below it only the navy cloth, empty. Moment: like popcorn popping, four "
    "pieces leap up out of the bowl, frozen in mid-air close above it, all of them between 36 and 55 percent of the "
    "picture's height. Every piece in the air is a copy of the pieces in Image 1's bowl and must look exactly like "
    "them: a round, puffy, irregular lump of boneless chicken about the size of a walnut, never square, never boxy, "
    "never flat-sided, no spiky flakes; deep amber-red, the same colour as the pieces in the bowl; completely coated in "
    "a thick, wet, glossy sticky glaze, the same as in the bowl. Nothing else in the air: no crumbs, no flakes, no "
    "drops, no drips. Light: one warm key light from the upper left and soft fill from the front, so every piece is "
    "lit from the front like the bowl's pieces, with a gentle warm rim; no glowing or see-through edges; the navy "
    "falling to near black at the corners, real depth, the leaping pieces sharp. No text, no letters, no logos, no "
    "labels, no hands, no people, no props."
)


def main(take: str) -> None:
    OUT.mkdir(exist_ok=True)
    buf = io.BytesIO()
    Image.open(PHOTO).convert("RGB").save(buf, "JPEG", quality=92)
    src = OUT / "poppers-src.jpg"
    src.write_bytes(buf.getvalue())
    final = {}
    r = higgsfield_client.subscribe(
        "marketing-studio/image/sunburst",
        arguments={"prompt": PROMPT, "image_urls": [higgsfield_client.upload_file(src)], "aspect_ratio": "9:16",
                   "resolution": "2k", "quality": "medium", "enhance_prompt": False},
        on_queue_update=lambda s: final.update(s=s),
    )
    if not isinstance(final.get("s"), higgsfield_client.Completed):
        raise SystemExit(f"not made: {type(final.get('s')).__name__}")
    url = ((r or {}).get("images") or [{}])[0].get("url")
    if not url:
        raise SystemExit("not made: no image")
    out = OUT / f"pop-{take}.jpg"
    out.write_bytes(urllib.request.urlopen(url, timeout=60).read())
    print("saved", out, Image.open(out).size)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "1")
