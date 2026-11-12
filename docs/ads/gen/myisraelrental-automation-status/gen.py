"""MyIsraelRental's automation status ad picture (docs/ads/blueprints/myisraelrental-automation-status.md): a
miniature production line running out of a phone, turning orders into texts and emails. One billable Higgsfield API
still, story 9:16. Image 1 is the layout drawn with scripts/ad-layout-sketch.py (layout.png from layout.json, rule
A3.11). No words in the picture (A3.7); the phone's screen is left plain white so our real dashboard is laid on in
code (A3.12). HF_KEY from backend/.env.local, never printed.

    backend/.venv/Scripts/python docs/ads/gen/myisraelrental-automation-status/gen.py [take]"""
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
LAYOUT = HERE / "layout.png"
PROMPT = (
    "Surreal miniature advertising photograph, vertical 9:16, shot on a real camera with a macro lens. Image 1 is the "
    "layout to photograph for real, keep its arrangement exactly. A modern black smartphone stands upright on a small "
    "black stand on a warm walnut wooden desk at the left of the picture, facing the camera straight on, its screen a "
    "plain glowing white rectangle with nothing on it. From the right edge of the phone a tiny real factory "
    "production line runs up and to the right across the desk: a small grey rubber conveyor belt on metal rollers. "
    "On the belt ride small blank paper envelopes and small blank rounded chat-bubble cards, all in one blue colour "
    "(#167AB8), nothing written on them. Three small orange industrial robot arms stand over the belt, one folding an "
    "envelope, one stamping a card, one lifting a card off; at the far right end of the belt the envelopes and "
    "bubbles fly off into the air one after another, like they are being sent. Two tiny miniature workers in white "
    "hard hats and blue overalls stand beside the belt, each about the height of a coffee bean, one with a clipboard. "
    "A white coffee cup at the right of the desk. Behind the desk a deep navy blue wall, plain and empty in the top "
    "third of the picture. One warm light from the left raking across the desk and the machines, soft real shadows, "
    "shallow depth of field, premium and playful. No text, no letters, no numbers, no logos, no screens other than "
    "the plain white phone screen, no people of normal size, no hands."
)


def main(take: str) -> None:
    OUT.mkdir(exist_ok=True)
    final = {}
    r = higgsfield_client.subscribe(
        "marketing-studio/image/sunburst",
        arguments={"prompt": PROMPT, "image_urls": [higgsfield_client.upload_file(LAYOUT)],
                   "aspect_ratio": "9:16", "resolution": "2k", "quality": "medium", "enhance_prompt": False},
        on_queue_update=lambda s: final.update(s=s),
    )
    if not isinstance(final.get("s"), higgsfield_client.Completed):
        raise SystemExit(f"not made: {type(final.get('s')).__name__}")
    url = ((r or {}).get("images") or [{}])[0].get("url")
    if not url:
        raise SystemExit("not made: no image")
    out = OUT / f"factory-{take}.jpg"
    out.write_bytes(urllib.request.urlopen(url, timeout=60).read())
    print("saved", out, Image.open(out).size)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "1")
