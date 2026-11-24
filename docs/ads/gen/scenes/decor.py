"""Holiday decorations for the ad maker (Tzvi, 24 Nov 2026: "choose a specific design they like and then add a
festive feel like add chanukah themed things around the page not just a strip"). Billable Higgsfield API stills.

    backend/.venv/Scripts/python docs/ads/gen/scenes/decor.py [<name> ...]

Each prop is photographed alone on white, cut out with our own free cutter (backend/utils/cutout.py) and saved as a
PNG to docs/ads/gen/scenes/out/decor-<name>.png, then copied to frontend/public/ad-scenes/decor/. The ad maker tucks
them into the corners of whichever design the owner picked, clear of the words and the product.
No menorah and no letters: generated menorahs came with 7 or 11 branches and dreidel letters come out wrong; the
menorah's lights are drawn in code (menorahLights in AdMaker.jsx). HF_KEY comes from backend/.env.local, never printed."""
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "backend"))
import hf  # noqa: E402
from utils import cutout  # noqa: E402

OUT = Path(__file__).resolve().parent / "out"
PUB = ROOT / "frontend" / "public" / "ad-scenes" / "decor"
COMMON = ("Studio product photograph of ONE object alone on a pure plain white seamless background, the whole object "
          "in frame with white space all round, sharp, soft studio light, a realistic 3D look. No text, no letters, "
          "no numbers, no symbols, no logos, no hands, no people, nothing else in the picture.")
PROPS = {
    # The model does not know the word "dreidel" (24 Nov 2026: a cone top, then a flat silver lid): its shape is spelled out.
    "dreidel": "A small wooden spinning top shaped like a CUBE: a box-shaped body with four flat square sides, a short "
               "four-sided pyramid point under the cube, and a short round stem handle on top of the cube. Painted "
               "glossy royal blue, the stem gold. Leaning slightly, seen from a three-quarter angle so two square "
               "sides show. The sides are plain paint, no letters, no markings.",
    "sufganiya": "One round jam doughnut, a sufganiya, golden brown, dusted with powdered sugar, with a dollop of "
                 "bright red strawberry jam on top.",
    "gelt": "A small heap of round chocolate coins wrapped in shiny gold foil, a few standing on edge, the foil "
            "plain and smooth with no embossing.",
    "gift": "A small square gift box wrapped in deep blue paper with a shiny silver satin ribbon and bow.",
}


def make(name: str) -> None:
    raw = OUT / f"decor-{name}-raw.jpg"
    hf.make("higgsfield-ai/soul/standard",
            {"prompt": f"{COMMON} {PROPS[name]}", "resolution": "1080p", "aspect_ratio": "1:1", "num_images": 1},
            raw, why=f"ad maker Chanukah decoration: {name}", max_credits=4)
    png = cutout.cut(raw.read_bytes())
    if not png:
        print(f"{name}: the cutter found no clear object, look at {raw}")
        return
    out = OUT / f"decor-{name}.png"
    out.write_bytes(png)
    PUB.mkdir(parents=True, exist_ok=True)
    shutil.copy(out, PUB / out.name)
    print("saved", out.name)


if __name__ == "__main__":
    for n in sys.argv[1:] or PROPS:
        make(n)
