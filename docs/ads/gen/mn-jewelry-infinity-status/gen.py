"""M and N Jewelry's infinity status ad picture (docs/ads/blueprints/mn-jewelry-infinity-status.md). One billable
Higgsfield API still, portrait 3:4. Images 1 and 2 are their own photos of the two rings (solitaire-src.jpg and
band-src.jpg, rule A3.3); image 3 is the layout drawn with scripts/ad-layout-sketch.py (layout.png from
layout.json, rule A3.11). No words in the picture (A3.7). HF_KEY from backend/.env.local, never printed.

    python docs/ads/gen/mn-jewelry-infinity-status/gen.py [take]"""
import sys
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[4]
load_dotenv(ROOT / "backend" / ".env.local")
import higgsfield_client  # noqa: E402
from PIL import Image  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
SOLITAIRE = HERE / "solitaire-src.jpg"
BAND = HERE / "band-src.jpg"
LAYOUT = HERE / "layout.png"
PROMPT = (
    "Luxury jewellery advertising photograph, portrait 3:4. Image 1 and image 2 are the real products, keep both "
    "exactly, including where their stones are: image 1 is a round brilliant solitaire diamond in a raised four-prong "
    "setting on a thin white-gold band; very small pave diamonds run only along the upper half of the band, from the "
    "centre stone down each shoulder, and the lower half of the band is plain polished white gold with no stones. "
    "Image 2 is a white-gold band with exactly FIVE larger round diamonds in a single row across the top only; the "
    "rest of the band is plain polished white gold with no stones. Image 3 is the layout to photograph for real, keep its arrangement: the two rings stand upright on "
    "their edges side by side, facing the camera, LINKED through each other so together they draw a perfect "
    "sideways infinity sign, the solitaire on the left with its diamond at the top, the diamond band on the right; "
    "they are big, together about three quarters of the picture's width, in the middle of the picture. Above them a "
    "deep navy background falling to near black, empty. Below them a white marble surface with fine gold veins, the "
    "rings' soft reflection on it. At the right edge a soft fold of champagne silk. The metal is cool bright "
    "silver-white white gold, never yellow or rose; the diamonds colourless and icy white. Light: one crisp white "
    "spotlight from above so every diamond sparkles with fine bright points, shallow depth of field, premium. Exactly "
    "two rings, no other jewellery, no text, no letters, no logos, no hands, no people."
)


def main(take: str) -> None:
    OUT.mkdir(exist_ok=True)
    final = {}
    r = higgsfield_client.subscribe(
        "marketing-studio/image/sunburst",
        arguments={"prompt": PROMPT, "image_urls": [higgsfield_client.upload_file(SOLITAIRE), higgsfield_client.upload_file(BAND),
                                                     higgsfield_client.upload_file(LAYOUT)],
                   "aspect_ratio": "3:4", "resolution": "2k", "quality": "medium", "enhance_prompt": False},
        on_queue_update=lambda s: final.update(s=s),
    )
    if not isinstance(final.get("s"), higgsfield_client.Completed):
        raise SystemExit(f"not made: {type(final.get('s')).__name__}")
    url = ((r or {}).get("images") or [{}])[0].get("url")
    if not url:
        raise SystemExit("not made: no image")
    out = OUT / f"rings-{take}.jpg"
    out.write_bytes(urllib.request.urlopen(url, timeout=60).read())
    print("saved", out, Image.open(out).size)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "1")
