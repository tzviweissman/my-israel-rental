"""Chicken Munch moving ad's start picture (docs/ads/blueprints/chicken-munch-moving.md, A3.3, A3.11). One billable Higgsfield API still.

    python docs/ads/gen/chicken-munch-moving/gen.py [take]

Rebuilt around his own photo (frontend/public/pages/chicken-munch/assets/poppers.webp, rule A3.3): the same bowl and
the same glazed poppers; the only addition is one ribbon of the same glaze already pouring onto the top piece.
The layout sketch layout.png (ad-layout-sketch.py) goes in as Image 2. No words in the picture (A3.7).
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
    "Professional food advertising photograph, vertical 9:16. Photograph Image 2's layout for real: Image 2 is a flat "
    "layout sketch, follow where its boxes are exactly. Image 1 is the real product: keep it exactly, the same kraft "
    "paper bowl standing on the same navy woven cloth, the same heap of round, puffy, craggy popcorn chicken fully "
    "coated in the same sticky deep amber orange glaze with the same highlights. The bowl is where the brown box is: "
    "centred, about two thirds of the picture's width, its rim at about 50 percent of the height. Behind it a plain "
    "dark navy wall, falling to near black at the edges; the top 45 percent of the picture is empty navy wall except "
    "for one thing: where the thin orange box is, one smooth ribbon of the same glossy amber orange glaze, about as "
    "wide as a finger, falls straight down from above the top edge of the picture at the centre and is just touching "
    "the top chicken piece. The source of the pour is out of frame. One warm back light from the upper left, a warm "
    "rim on the glaze ribbon, straight-on low camera, real depth. Nothing in the air: no flying pieces, no drops, no "
    "splashes, no steam. No text, no letters, no logos, no labels, no hands, no people, no jug, no spoon, no props."
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
        arguments={"prompt": PROMPT, "image_urls": [higgsfield_client.upload_file(src), higgsfield_client.upload_file(Path(__file__).resolve().parent / "layout.png")], "aspect_ratio": "9:16",
                   "resolution": "2k", "quality": "medium", "enhance_prompt": False},
        on_queue_update=lambda s: final.update(s=s),
    )
    if not isinstance(final.get("s"), higgsfield_client.Completed):
        raise SystemExit(f"not made: {type(final.get('s')).__name__}")
    url = ((r or {}).get("images") or [{}])[0].get("url")
    if not url:
        raise SystemExit("not made: no image")
    out = OUT / f"start-{take}.jpg"
    out.write_bytes(urllib.request.urlopen(url, timeout=60).read())
    print("saved", out, Image.open(out).size)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "1")
