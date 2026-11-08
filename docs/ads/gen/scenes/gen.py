"""Empty product-shoot scenes for the ad maker (docs/ads/blueprints/scenes.md). Billable Higgsfield API stills.

    python docs/ads/gen/scenes/gen.py <scene> [<scene> ...]

Each scene is made in the three ad shapes and saved, shrunk, to docs/ads/gen/scenes/out/, then copied to frontend/public/ad-scenes/.
No product is ever in a scene: the owner's real cut-out is laid on top by the ad maker (A3.3).
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

# Saved beside this script first: writing into frontend/public while the site runs reloads every open page.
OUT = Path(__file__).resolve().parent / "out"
SHAPES = {"square": "1:1", "feed": "3:4", "story": "9:16"}
COMMON = ("Photograph for a product advert: an EMPTY set waiting for a product. The middle of the table and the "
          "upper part of the picture are clear and calm. Props only near the left and right edges. Shot like a "
          "real studio product shoot, sharp, natural light, shallow depth of field. No text, no letters, no "
          "numbers, no signs, no logos, no people, no hands, nothing in the middle of the table.")
SCENES = {
    # No menorah: generated ones came with 7 or 11 branches (7 Nov 2026), a mistake every reader here sees.
    "chanukah-night": "A dark walnut table in the front third. Behind, a deep navy blue backdrop, softly lit, with a "
                      "string of tiny warm fairy lights far behind it, so out of focus they are only faint golden "
                      "glows. Near the table's left and right edges only: a small pile of gold-foil chocolate coins "
                      "and two small wooden dreidels.",
    "chanukah-light": "A table with a pale blue linen cloth in the front third. Behind, a plain soft white wall with "
                      "a gentle blue light falling on it. Near the edges only: a white plate of sufganiyot doughnuts "
                      "dusted with powdered sugar on the left, a blue wrapped gift with a silver ribbon on the right. "
                      "Bright, airy, silver and soft blue. Nothing else in the picture.",
    # Everyday sets (Tzvi, 8 Nov 2026: "guess from the listing"): a light and a dark one per kind of business.
    "slate-dark": "A dark slate board on a black stone counter in the front third, a few sprigs of rosemary and "
                  "coarse salt near the edges. No lamps, no stands, no hands, no people. Behind, a near-black wall with one soft warm light from the side.",
    "marble-light": "A white marble kitchen counter in the front third, a small bunch of fresh herbs and a linen "
                    "towel near the edges. Behind, a soft white tiled wall in daylight.",
    "cafe-dark": "A dark wooden cafe counter in the front third with a few roasted coffee beans near the edges. "
                 "Behind, a warm brown wall in low cafe light with soft out-of-focus lamps.",
    "gift-light": "A pale pink table in the front third, curled satin ribbon and a little tissue paper near the "
                  "edges. Behind, a soft blush wall with gentle daylight.",
    "beauty-light": "A pale stone vanity top in the front third, a few white flower petals near the edges and "
                    "nothing else: no bottles, no jars, no boxes, no packaging. Behind, a soft warm beige wall with "
                    "a diffused glow.",
    # No studio sets: every try came back as a behind-the-scenes photo with stands and tables. Drawn in code instead.
    "bakery-wood": "A rustic wooden table in the front third with a light dusting of flour and a few sesame seeds "
                   "near the edges, a linen cloth folded at one side. Behind, a plain warm cream wall lit by morning "
                   "window light.",
}


def make(scene: str, shape: str) -> None:
    final = {}
    r = higgsfield_client.subscribe(
        "higgsfield-ai/soul/standard",
        arguments={"prompt": f"{COMMON} {SCENES[scene]}", "resolution": "1080p", "aspect_ratio": SHAPES[shape], "num_images": 1},
        on_queue_update=lambda s: final.update(s=s),
    )
    if not isinstance(final.get("s"), higgsfield_client.Completed) or not (r or {}).get("images"):
        sys.exit(f"FAILED {scene} {shape}: {type(final.get('s')).__name__}")
    raw = urllib.request.urlopen(r["images"][0]["url"]).read()
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    img.thumbnail((1080, 1920))
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / f"{scene}-{shape}.jpg", quality=84, optimize=True, progressive=True)
    print("saved", scene, shape, img.size)


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        name, _, only = arg.partition(":")  # scene or scene:shape
        for sh in ([only] if only else SHAPES):
            make(name, sh)
