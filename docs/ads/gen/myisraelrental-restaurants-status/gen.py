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

# Take 2 (Tzvi, 25 Nov 2026, beside Pinterest "PASTA"/"TWIST" posters: "what makes ours bland and boring"): take 1's
# nest sat still in a corner. Now the fork lifts one tall twisting ribbon of pasta down the middle of the frame, on
# our blue, so the digits can be woven through it in front and behind (strands.py).
TWIST = (
    "A real food photograph, shot on a full-frame camera with a 100mm lens, crisp, mouth-watering, high contrast. "
    "Image 1 is a rough layout: follow its arrangement exactly. The whole background is one flat, seamless, saturated "
    "medium blue (#167AB8), completely empty, no table, no plate, no props, no text. Near the top centre, a stainless "
    "steel fork held by no hand, tines pointing down, lifts a tall, dramatic twisting ribbon of spaghetti that hangs "
    "and spirals down the middle of the picture to about three quarters of its height, glossy with a rich plain "
    "tomato sauce, a few small fresh basil leaves caught in it. Where the two thin strokes are, two long single "
    "strands swing out wide, one looping to the left edge and one to the right edge, in motion. A thick drop of sauce "
    "falls from the bottom of the twist. Hard light from the upper left, bright highlights on the pasta, a deep "
    "soft shadow on the right side of the twist. The bottom fifth is empty blue. No people, no hands, no words."
)

# Take 3 (Tzvi, 25 Nov 2026: "it only goes through the number once it should be wrapping in and out"): the twist is
# too wide to pass in front of a whole zero without hiding it, so thin loose strands of the same pasta are shot alone,
# swooping across the full width, and woven in front of and behind each character in code (strands.py).
LOOSE = (
    "A real food photograph, shot on a full-frame camera with a 100mm lens, crisp, high contrast. Image 1 is a rough "
    "layout: follow its arrangement exactly. Image 2 shows the pasta: the very same spaghetti with the same glossy "
    "plain tomato sauce, same colour, same thickness. The whole background is one flat, seamless, saturated medium "
    "blue (#167AB8), completely empty. Where the four thin lines are, four long single strands of that spaghetti "
    "float in mid-air, each running the full width of the picture from the left edge to the right edge in a long, "
    "loose, gentle wave, coated in sauce with small flecks of tomato, clearly separate from each other, never "
    "touching or crossing. Hard light from the upper left, bright highlights along each strand. The top quarter and "
    "the bottom two fifths are empty blue. No fork, no plate, no basil, no people, no hands, no words."
)

take = sys.argv[1] if len(sys.argv) > 1 else "1"
n = int(take)
h = hf._client()
prompt, layout, what = ((LOOSE, "layout3.png", "loose strands") if n >= 3 else
                        (TWIST, "layout2.png", "twist") if n == 2 else (PROMPT, "layout.png", "nest"))
images = [h.upload_file(str(HERE / layout))] + ([h.upload_file(str(HERE / "out" / "photo-2.jpg"))] if n >= 3 else [])
hf.make("marketing-studio/image/sunburst",
        {"prompt": prompt, "image_urls": images,
         "aspect_ratio": "9:16", "resolution": "2k", "quality": "medium", "enhance_prompt": False},
        HERE / "out" / f"photo-{take}.jpg", why=f"myisraelrental restaurants ad, pasta {what} photo, take {take}",
        credits=2, max_credits=3)
