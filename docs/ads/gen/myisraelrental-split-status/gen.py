"""MyIsraelRental's before-and-after status ad pictures (docs/ads/blueprints/myisraelrental-split-status.md). Two
billable Higgsfield API stills, text only: the same kind of desk buried in notes (before) and clean (after). The
ad uses the left half of "before" and the right half of "after", joined by a tear drawn in code. No words in the
pictures (A3.7). HF_KEY from backend/.env.local, never printed.

    python docs/ads/gen/myisraelrental-split-status/gen.py before|after [take]"""
import sys
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[4]
load_dotenv(ROOT / "backend" / ".env.local")
import higgsfield_client  # noqa: E402
from PIL import Image  # noqa: E402

OUT = Path(__file__).resolve().parent / "out"
COMMON = ("Commercial advertising photograph, vertical, shot on a real camera, eye level. A small business owner's "
          "wooden desk against a plain wall. A modern black smartphone stands upright on a small black stand on the "
          "desk, facing the camera straight on, its screen a plain glowing white rectangle with nothing on it, the "
          "phone about 22 percent of the picture's width, its top at about 42 percent of the height and its stand at "
          "about 64 percent. The desk runs to the bottom of the picture. The top 25 percent is plain wall. Nothing "
          "written anywhere: no text, no letters, no logos, no hands, no people. ")
SIDES = {
    "before": COMMON + ("The phone stands at about 27 percent of the picture's width from the left. The desk and the "
                        "wall behind are buried in dozens of blank yellow sticky notes, stuck everywhere, piled and "
                        "overlapping, a cold mug, a messy heap of papers. Evening: dim cold blue light from a desk lamp, "
                        "tired and cluttered, deep shadows."),
    "after": COMMON + ("The phone stands at about 73 percent of the picture's width from the left. The desk is clean "
                       "and tidy: only a small plant and a cup of coffee with steam. Morning: warm golden sunlight "
                       "streaming from a window on the right, bright, calm and fresh, soft shadows."),
}


def main(side: str, take: str) -> None:
    OUT.mkdir(exist_ok=True)
    final = {}
    r = higgsfield_client.subscribe(
        "higgsfield-ai/soul/standard",
        arguments={"prompt": SIDES[side], "resolution": "1080p", "aspect_ratio": "9:16", "num_images": 1},
        on_queue_update=lambda s: final.update(s=s),
    )
    if not isinstance(final.get("s"), higgsfield_client.Completed) or not (r or {}).get("images"):
        raise SystemExit(f"not made: {type(final.get('s')).__name__}")
    out = OUT / f"{side}-{take}.jpg"
    out.write_bytes(urllib.request.urlopen(r["images"][0]["url"], timeout=60).read())
    print("saved", out, Image.open(out).size)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "1")
