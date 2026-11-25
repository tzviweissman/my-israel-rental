"""MyIsraelRental restaurants ad, "fork through 5,000+" (Tzvi, 25 Nov 2026; blueprint
docs/ads/blueprints/myisraelrental-restaurants-status.md, from Pinterest pin 900d6a and library ad 88ee2d).

    backend/.venv/Scripts/python docs/ads/gen/myisraelrental-restaurants-status/gen.py [take]

One real photograph through scripts/hf.py (priced first, logged, never paid twice). layout.png goes in as Image 1.
The picture carries no text: "5,000+" and every word are drawn in ad.html, and the strands that pass in front of
the digits are cut from this photo by strands.py (A11.2). Pareve food only: tomato sauce and basil, no meat, cheese,
shellfish or pork."""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(ROOT / "scripts"))
import hf  # noqa: E402

PROMPT = (
    "A real food photograph, shot on a full-frame camera with a 100mm macro lens: crisp, appetising, fine detail. "
    "Image 1 is a rough layout: follow its arrangement exactly. The whole background is one plain, flat, warm cream "
    "colour (#F4EBDD), completely empty, seamless, no table edge, no plate, no props, no text. Where the orange ring "
    "is in Image 1, a stainless steel fork, held by no hand, its handle running down to the lower right edge exactly "
    "like the grey bar, twirls a neat nest of spaghetti in a glossy plain tomato sauce, one small fresh basil leaf "
    "on top. Where the two thin strokes are, two or three long single strands of spaghetti hang loose from the nest "
    "and loop out to the left across the empty cream, long and graceful, each strand clearly separate. One drop of "
    "sauce falls below the nest. Hard light from the upper left, a soft natural shadow under the fork on the cream. "
    "Nothing else in the picture: the top third and bottom third are empty cream. No people, no hands, no words."
)

take = sys.argv[1] if len(sys.argv) > 1 else "1"
h = hf._client()
hf.make("marketing-studio/image/sunburst",
        {"prompt": PROMPT, "image_urls": [h.upload_file(str(HERE / "layout.png"))],
         "aspect_ratio": "9:16", "resolution": "2k", "quality": "medium", "enhance_prompt": False},
        HERE / "out" / f"photo-{take}.jpg", why=f"myisraelrental restaurants ad, fork and pasta photo, take {take}",
        credits=2, max_credits=3)
