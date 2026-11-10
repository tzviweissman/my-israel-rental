"""M and N Jewelry's WhatsApp status ad picture (docs/ads/blueprints/mn-jewelry-status.md). One billable Higgsfield
API still. Image 1 is their own ring photo (ring-src.jpg, rule A3.3); image 2 is the layout drawn with
scripts/ad-layout-sketch.py (layout.png from layout.json, rule A3.11), which the model photographs for real. No words
in the picture (A3.7). HF_KEY from backend/.env.local, never printed.

    python docs/ads/gen/mn-jewelry-status/gen.py [take]"""
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
RING = HERE / "ring-src.jpg"
LAYOUT = HERE / "layout.png"
PROMPT = (
    "Luxury jewellery advertising photograph, vertical. Image 1 is the real product: keep the ring exactly, the same "
    "round brilliant solitaire diamond in a raised four-prong setting on a thin WHITE-gold band set with a fine row "
    "of very small pave diamonds, one ring only. The metal is cool bright silver-white white gold, never yellow or "
    "rose; the diamond is colourless and icy white, never champagne or tinted. Image 2 is the layout to photograph for real, keep its arrangement: the dark navy "
    "areas at the top are a deep navy background falling to near black, empty; in the middle an open navy velvet ring "
    "box with its lid open behind, the ring standing in the box's slot facing the camera; below, a white marble "
    "surface with fine gold veins running to the bottom; at the left edge a soft fold of champagne silk. Light: one "
    "crisp WHITE (cool neutral) spotlight from above on the ring so the diamond sparkles with fine bright white points "
    "and the band stays silver-white; any warmth only in the silk and the marble's gold veins, the velvet rich and deep, "
    "soft reflections on the marble, shallow depth of field, premium and elegant. No text, no letters, no logos, no "
    "hands, no people, no other jewellery."
)


def main(take: str) -> None:
    OUT.mkdir(exist_ok=True)
    final = {}
    r = higgsfield_client.subscribe(
        "marketing-studio/image/sunburst",
        arguments={"prompt": PROMPT, "image_urls": [higgsfield_client.upload_file(RING), higgsfield_client.upload_file(LAYOUT)],
                   "aspect_ratio": "9:16", "resolution": "2k", "quality": "medium", "enhance_prompt": False},
        on_queue_update=lambda s: final.update(s=s),
    )
    if not isinstance(final.get("s"), higgsfield_client.Completed):
        raise SystemExit(f"not made: {type(final.get('s')).__name__}")
    url = ((r or {}).get("images") or [{}])[0].get("url")
    if not url:
        raise SystemExit("not made: no image")
    out = OUT / f"ring-{take}.jpg"
    out.write_bytes(urllib.request.urlopen(url, timeout=60).read())
    print("saved", out, Image.open(out).size)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "1")
