"""The three size-card pictures as one set (Tzvi, 12 Nov 2026: "consistency is key and the different sizes arent in the
same position", "i dont like how its just one bone on the side its too empty", and the new photo is the Extra Large's).
Rule 8 hero shot 9: one layout sketch for the set, the same props in the same places, only the tub changes. One
Higgsfield API still per card at 21:9 2k, about 1 credit each.

    python scrollcraft/builds/la-cholent/gen/cards_set.py medium large kiddush

Image 1 is the layout (gen/layout-std.png, or layout-xl.png for the bigger Kiddush tub); image 2 is a close crop of
their own tub: the standard tub (gen/tub-std-crop.jpg, from their four-tub photo) for Medium and Large, their own
Extra Large tub with its slow cooker liner (gen/tub-xl-crop.jpg, from src/owner-2026-11-11/large-tub.jpg) for the
Kiddush. HF_KEY from backend/.env.local, never printed."""
import sys
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[4]
load_dotenv(ROOT / "backend" / ".env.local")
import higgsfield_client  # noqa: E402
from PIL import Image  # noqa: E402

GEN = Path(__file__).resolve().parent
CARDS = {
    "medium": ("layout-std.png", "tub-std-crop.jpg", "a warm golden mustard yellow", "the standard tub"),
    "large": ("layout-std.png", "tub-std-crop.jpg", "a deep olive green", "the standard tub"),
    "kiddush": ("layout-xl.png", "tub-xl-crop.jpg", "a dark warm charcoal brown", "the big Extra Large tub, taller and wider than a standard tub, with the folded white slow cooker liner on it"),
}
PROMPT = (
    "Premium food product photograph, wide 21:9, filling the whole frame. Image 1 is the layout: put every thing "
    "exactly in its box, at that size and place, and leave the rest of the frame as plain wall and table. Image 2 is the "
    "real product, {what}: one clear plastic tub of raw cholent sealed in cling film with its black and white label; "
    "keep it exactly as it is, the same tub, contents, colour, cling film and label; the label reads left to right, "
    "'L.A. CHOLENT' in thin capitals and 'By Rabbi Samuels' in script below it, then small recipe lines, copied "
    "exactly, never mirrored or invented. Set: a plain studio wall and table in {colour}, the table's edge a soft "
    "horizon line behind; the tub stands on a dark rough slate block, three-quarter view, label facing the camera; to "
    "the right of the slate two raw beef marrow bones, cut ends showing; to the left a small round stoneware dish of "
    "dry pearl barley, small pale oval grains, on a folded natural linen napkin. One warm soft key light from the left, "
    "soft shadows, the wall a soft gradient of the same colour. Eye level. No beans, no potatoes, no other food, no "
    "hands, no text besides the tub's own label."
)


MASTER_NOTE = (
    " Size and room: everything sits in the middle three fifths of the frame and the outer fifth on each side is plain "
    "wall and table only. The tub is the biggest thing; the slate is a little wider than the tub; the dish is small, "
    "about a third of the tub's height; the bones are about half the tub's height. Pearl barley: tiny grains the size "
    "of rice, oval and cream with a thin dark line down each grain, nothing like a bean or a chickpea."
)
EDIT = (
    "Edit image 1. Keep every thing exactly where it is and the same size: the slate, the dish of barley on the napkin, "
    "the two marrow bones, the camera, the framing and the light. {change} Add nothing else, no text besides the "
    "tub's own label."
)


def master():
    final = {}
    r = higgsfield_client.subscribe(
        "marketing-studio/image/sunburst",
        arguments={"prompt": PROMPT.format(colour=CARDS["medium"][2], what=CARDS["medium"][3]) + MASTER_NOTE,
                   "image_urls": [higgsfield_client.upload_file(GEN / "layout-std.png"), higgsfield_client.upload_file(GEN / "tub-std-crop.jpg")],
                   "aspect_ratio": "21:9", "resolution": "2k", "quality": "medium", "enhance_prompt": False},
        on_queue_update=lambda s: final.update(s=s),
    )
    return save(r, final, "card-master")


def edit(name, change, refs):
    final = {}
    r = higgsfield_client.subscribe(
        "marketing-studio/image/sunburst",
        arguments={"prompt": EDIT.format(change=change), "image_urls": [higgsfield_client.upload_file(GEN / f) for f in refs],
                   "aspect_ratio": "21:9", "resolution": "2k", "quality": "medium", "enhance_prompt": False},
        on_queue_update=lambda s: final.update(s=s),
    )
    return save(r, final, f"card-{name}")


def save(r, final, stem):
    if not isinstance(final.get("s"), higgsfield_client.Completed):
        print(f"{stem}: not made: {type(final.get('s')).__name__}"); return None
    out = GEN / f"{stem}.png"
    out.write_bytes(urllib.request.urlopen(((r or {}).get("images") or [{}])[0].get("url"), timeout=60).read())
    print("saved", out, Image.open(out).size)
    return out


def main(names):
    if names == ["set"]:
        # one master, then the others edited from it, so everything stays in its place (rule 8, hero shot 9)
        master()
        return
    if names == ["calm"]:
        # Tzvi, 12 Nov 2026: one calm look for the cards (like Gremier's shop): one light warm ground for all three
        sand = ("Change only the colour of the wall and the table to a light warm sand beige, soft and calm, the wall a gentle "
                "gradient a little lighter at the top, the table a touch deeper.")
        edit("calm-standard", sand, ["card-master.png"])
        edit("calm-kiddush", sand, ["card-kiddush-turned-fixed.png"])
        return
    if names == ["turn"]:
        # Tzvi, 12 Nov 2026: "i can tell that the xl was originally facing the other way ... something looks off"
        edit("kiddush-turned", "Turn only the tub so it stands at exactly the same angle as the tub in image 2: lid facing the "
             "camera, turned the same way, its side wall showing on the RIGHT as in image 2, sitting flat and steady on the "
             "slate, lit by the same light from the left. Keep it this bigger Extra Large tub, the same height and width as "
             "now, the same cholent inside and the same label words ('L.A. CHOLENT', 'By Rabbi Samuels', '1) Thaw, and empty "
             "contents into a slow cooker pot', '2) Add 5 cups of water* (amount may vary due to pot)', '3) Mix well', '4) Slow "
             "cook on low for about 20 hours', '5) Stir well before serving and enjoy'). Neat cling film, no bunched film.",
             ["card-kiddush-final.png", "tub-std-crop.jpg"])
        return
    if names == ["noliner"]:
        # Tzvi, 12 Nov 2026: "in the xl the cholent has a napkin taped on can you remove that"
        edit("kiddush-noliner", "Remove only the folded white slow cooker liner taped on the front of the tub, and the tape. "
             "Where it was, show the rest of the tub as it is: the clear plastic and the cholent inside, and the lower part "
             "of the same black label with its last recipe lines in the same small white type ('4) Slow cook on low for "
             "about 20 hours', '5) Stir well before serving and enjoy'). The tub, its size, its cling film and the top of "
             "its label stay exactly as they are.", ["card-kiddush.png"])
        return
    if names == ["edits"]:
        edit("large", "Change only the colour of the wall and the table to a deep olive green, the same soft gradient.", ["card-master.png"])
        edit("kiddush", "Change the colour of the wall and the table to a dark warm charcoal brown, the same soft gradient. "
             "Replace the tub with the tub in image 2, their Extra Large tub with the folded white slow cooker liner on it, "
             "kept exactly as image 2 shows it (its label reads 'L.A. CHOLENT', 'By Rabbi Samuels', 'Add 5 cups of water'); "
             "it stands on the same slate, bigger than the old tub, its bottom on the slate where the old tub's was.",
             ["card-master.png", "tub-xl-crop.jpg"])
        return
    for name in names:
        layout, crop, colour, what = CARDS[name]
        final = {}
        r = higgsfield_client.subscribe(
            "marketing-studio/image/sunburst",
            arguments={"prompt": PROMPT.format(colour=colour, what=what),
                       "image_urls": [higgsfield_client.upload_file(GEN / layout), higgsfield_client.upload_file(GEN / crop)],
                       "aspect_ratio": "21:9", "resolution": "2k", "quality": "medium", "enhance_prompt": False},
            on_queue_update=lambda s: final.update(s=s),
        )
        if not isinstance(final.get("s"), higgsfield_client.Completed):
            print(f"{name}: not made: {type(final.get('s')).__name__}"); continue
        url = ((r or {}).get("images") or [{}])[0].get("url")
        out = GEN / f"card-{name}.png"
        out.write_bytes(urllib.request.urlopen(url, timeout=60).read())
        print("saved", out, Image.open(out).size)


if __name__ == "__main__":
    main(sys.argv[1:] or list(CARDS))
