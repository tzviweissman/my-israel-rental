"""Chicken Munch Chanukah moving ad: the drawn Maccabee's pose sheets (docs/ads/blueprints/chicken-munch-chanukah-moving.md,
A3.11, A11.11). One billable Higgsfield API still per run; HF_KEY from backend/.env.local, never printed.

    python docs/ads/gen/chicken-munch-chanukah-moving/gen.py <hero|friends> [take]

Tzvi's idea, 22 Nov 2026: the Maccabee looks for the oil, finds it glowing, turns and sees the Munch box, thinks hard,
throws the oil behind him, and he and his friends eat the chicken. The character is drawn (a library 5 does this:
d09); their box stays their own photo (assets/box-yellow.webp), laid on in code, never generated. Each sheet is drawn
on flat green from its layout sketch and keyed out by cut.py. The friends sheet gets the chosen hero sheet as a
reference, so all three are one style."""
import sys
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
load_dotenv(HERE.parents[3] / "backend" / ".env.local")
import higgsfield_client  # noqa: E402
from PIL import Image  # noqa: E402

OUT = HERE / "out"
STYLE = ("A modern flat cartoon illustration style, like a premium animated advert: bold clean dark brown ink outlines of "
         "even weight, flat colours with one soft cel shade, no texture, no gradients. ")
HERO = ("a friendly young Maccabee soldier: a round bronze helmet with one tall red plume, a short cream tunic with a "
        "brown leather belt, a small red cape, brown sandals, a round bronze shield on his back, a short dark beard and a "
        "big expressive cheerful face")
PROMPTS = {
    "hero": STYLE + (
        "A character sheet: the image is the layout sketch's grid photographed as finished art; follow where its boxes "
        f"are exactly, one drawing per box, each whole and not touching another. The same character in every drawing, "
        f"{HERO}. Row one: he tips a tall clay jar towards himself and peers into it; he holds a small clay oil jug high "
        "over his head with both hands, delighted; he stands with one hand on his chin, eyes up, thinking hard. Row two: "
        "he throws the small jug back over his shoulder without looking, grinning; he sits cross-legged biting a piece "
        "of golden fried chicken held in one hand; he sits cross-legged chewing, eyes closed, very happy. Row three: two "
        "plain tall terracotta clay jars, and one small terracotta oil jug with a narrow neck. Flat even chroma green "
        "ground everywhere, no floor, no shadows on the ground, no words, no letters, no symbols, no extra objects."),
    "friends": STYLE + (
        "A character sheet: the image is the layout sketch's grid photographed as finished art; follow where its boxes "
        "are exactly, one drawing per box, each whole and not touching another. Image 2 shows the main character; draw "
        "his two friends in exactly the same drawing style, line weight and colours, as two other Maccabee soldiers of "
        "the same world: friend one taller with a bronze helmet and a blue plume, a blue cape and a round face with a "
        "moustache; friend two shorter and stocky with a bronze helmet and a yellow plume, a green cape and curly hair. "
        "Row one: friend one sits cross-legged biting a long crispy golden chicken tender strip; friend one sits cross-legged "
        "chewing, eyes closed, happy. Row two: friend two sits cross-legged biting a long crispy golden chicken tender strip; friend "
        "two sits cross-legged chewing with a thumbs up. Flat even chroma green ground everywhere, no floor, no shadows "
        "on the ground, no words, no letters, no symbols, no extra objects."),
}


def main(sheet: str, take: str) -> None:
    OUT.mkdir(exist_ok=True)
    images = [higgsfield_client.upload_file(HERE / f"layout-{sheet}.png")]
    if sheet == "friends":
        images.append(higgsfield_client.upload_file(OUT / "hero.jpg"))
    final = {}
    r = higgsfield_client.subscribe(
        "marketing-studio/image/sunburst",
        arguments={"prompt": "Image 1 is the layout sketch. " + PROMPTS[sheet], "image_urls": images, "aspect_ratio": "1:1",
                   "resolution": "2k", "quality": "medium", "enhance_prompt": False},
        on_queue_update=lambda s: final.update(s=s),
    )
    if not isinstance(final.get("s"), higgsfield_client.Completed):
        raise SystemExit(f"not made: {type(final.get('s')).__name__}")
    url = ((r or {}).get("images") or [{}])[0].get("url")
    if not url:
        raise SystemExit("not made: no image")
    out = OUT / f"{sheet}-{take}.jpg"
    out.write_bytes(urllib.request.urlopen(url, timeout=60).read())
    print("saved", out, Image.open(out).size)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "1")
