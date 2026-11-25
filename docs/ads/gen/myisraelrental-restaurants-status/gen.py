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

# Take 4 (Tzvi, 25 Nov 2026, beside Pinterest "PASTA" and "TWIST" posters: "something about ours just looks bland";
# "fix it"): the pasta is made around our own typed number (A3.13), so it wraps the strokes and shades them, on a
# warm cream ground with the digits in our deep blue, wide ribbons with herbs and pepper in the air, on a diagonal
# from the fork at the top left. Image 2 is ad.html?plate=1 (the number exactly as typed); our crisp digits are laid
# back over the picture in ad.html and only the pasta in front of them is cut from it (strands.py).
WRAP = (
    "A real editorial food photograph for a magazine poster, shot on a full-frame camera with a 100mm lens, crisp, "
    "mouth-watering, fine texture. Image 2 is a flat sign: big deep blue numbers '5,000+' on a plain warm cream "
    "background. Keep those numbers EXACTLY as they are in Image 2: the same characters, same shapes, same size, same "
    "position, same deep blue colour, flat and matte, standing upright like solid painted letters in the scene; do not "
    "add, remove, move or restyle any character, and add no other text. Image 1 shows where things go: the grey bar "
    "is a stainless steel fork coming in from the top-left corner, the yellow circle a twirl of pasta on it, and the "
    "yellow path how the pasta falls from it. From the fork, long wide golden ribbons of fresh tagliatelle in a "
    "glossy light butter sauce cascade diagonally down and wrap around the numbers: looping around the strokes, "
    "passing behind some characters and in front of others, knotting once around the first zero, then falling away "
    "off the lower right. The pasta casts soft real shadows onto the blue numbers where it touches them. Cracked "
    "black pepper, small flakes of grated cheese and a few fresh parsley leaves are caught in the pasta and float in "
    "the air around it. Soft warm daylight from the upper left. The bottom third is plain empty warm cream. Dairy "
    "sauce only: no meat, no fish, no shellfish. No hands, no people, no plate, no other words or letters."
)

take = sys.argv[1] if len(sys.argv) > 1 else "1"
n = int(take)
h = hf._client()
prompt, layout, what = ((WRAP, "layout4.png", "wrapped around the digits") if n >= 4 else
                        (LOOSE, "layout3.png", "loose strands") if n == 3 else
                        (TWIST, "layout2.png", "twist") if n == 2 else (PROMPT, "layout.png", "nest"))
extra = HERE / ("plate.png" if n >= 4 else "out/photo-2.jpg")
images = [h.upload_file(str(HERE / layout))] + ([h.upload_file(str(extra))] if n >= 3 else [])
hf.make("marketing-studio/image/sunburst",
        {"prompt": prompt, "image_urls": images,
         "aspect_ratio": "9:16", "resolution": "2k", "quality": "medium", "enhance_prompt": False},
        HERE / "out" / f"photo-{take}.jpg", why=f"myisraelrental restaurants ad, pasta {what} photo, take {take}",
        credits=2, max_credits=3)
