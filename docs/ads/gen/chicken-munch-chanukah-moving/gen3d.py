"""Chicken Munch Chanukah moving ad, in 3D (Tzvi, 22 Nov 2026: "make there more details ... make the munch box actually
look behind him ... look at these videos they are 3d and full of detail"). One billable Higgsfield API still per run;
HF_KEY from backend/.env.local, never printed.

    python docs/ads/gen/chicken-munch-chanukah-moving/gen3d.py <s1..s5> [take]

The Maccabee and his friends come from the drawn sheets (out/hero.jpg, out/friends.jpg), rebuilt as detailed 3D animated
film characters; s1, once chosen as out/s1.jpg, is given to every later shot so the look, the temple and the light
match. Their Munch box is rebuilt from their own photo (assets/box-yellow.webp) and checked beside it (A3.3, A9.6)."""
import sys
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
load_dotenv(ROOT / "backend" / ".env.local")
import higgsfield_client  # noqa: E402
from PIL import Image  # noqa: E402

OUT = HERE / "out"
BOX = ROOT / "frontend" / "public" / "pages" / "chicken-munch" / "assets" / "box-yellow.webp"
LOOK = ("A frame from a modern 3D animated feature film, vertical 9:16, cinematic: rich detailed textures, soft global "
        "illumination, warm oil-lamp light, shallow depth of field, expressive cartoon faces. The setting is the inside "
        "of the ancient Temple in Jerusalem at night: carved stone walls and pillars, bronze oil lamps, tall terracotta "
        "jars, a woven rug, dust in the lamp light. ")
HERO = ("The young Maccabee soldier from the character sheet, rebuilt in 3D with the same look: a round bronze helmet with a "
        "tall red plume, a short dark beard, a cream tunic with a brown leather belt and bracers, a short red cape, a round "
        "bronze shield on his back, sandals. ")
BOXTXT = ("Their real takeaway box from the box photo, exactly as it is: a brown kraft cardboard box with a lifted kraft lid "
          "that has a clear window, full of golden cornflake-crusted chicken tenders and crunchy dark crispy chicken bites, "
          "with round black sauce cups with the red and yellow CHICKEN MUNCH sticker. ")
NO = " No text or captions anywhere except the sticker on the sauce cups, no extra people, no modern objects but the box."
SHOTS = {
    "s1": (["hero"], LOOK + HERO + "Medium close shot: he leans over a tall terracotta jar, peering inside with a worried, "
           "searching face, one hand on the rim; more jars around him; behind him, out of focus on a stone table at the "
           "right, a warm glow and the shape of a box." + NO),
    "s2": (["hero", "s1"], LOOK + HERO + "Close-up: he holds a small terracotta oil jug up in both hands, and a golden "
           "glow shines out of it onto his delighted face; tiny sparkles of light in the air; the temple behind him soft "
           "and dark." + NO),
    "s3": (["hero", "s1", "box"], LOOK + HERO + "Medium shot from behind his shoulder: holding the small oil jug in one "
           "hand, he has just turned around and sees, on a carved stone table behind him lit by two oil lamps, "
           + BOXTXT + "The box stands squarely on the table facing the camera, big and sharp, the hero object of the shot. "
           "He rubs his chin with his other hand, thinking hard." + NO),
    "s4": (["hero", "s1"], LOOK + HERO + "Medium shot: grinning, he tosses the small terracotta oil jug back over his "
           "shoulder without looking; the jug is in the air behind him; he steps forward toward the camera." + NO),
    "s5": (["hero", "friends", "s1", "box"], LOOK + "Wide shot: three Maccabee friends sit on cushions around a low "
           "carved stone table, eating happily: the hero from the character sheet in the middle, his friend with a blue "
           "plume and a moustache at the left, his stocky curly-haired friend with a yellow plume and green cape at the "
           "right, from the friends sheet, all in the same 3D look. In the middle of the table stands " + BOXTXT
           + "open, big and sharp, facing the camera; each friend holds one golden chicken tender from it. A lit nine-branch "
           "menorah on a ledge behind them. The top third of the frame is the dark temple wall, plain, for words." + NO),
}


def up(name):
    path = {"hero": OUT / "hero.jpg", "friends": OUT / "friends.jpg", "s1": OUT / "s1.jpg", "box": BOX}[name]
    if path.suffix == ".webp":
        jpg = OUT / "box-src.jpg"
        Image.open(path).convert("RGB").save(jpg, quality=92)
        path = jpg
    return higgsfield_client.upload_file(path)


def main(shot, take):
    refs, prompt = SHOTS[shot]
    names = {"hero": "the character sheet", "friends": "the friends sheet", "s1": "the first shot (match its look, temple and light)", "box": "the box photo"}
    lead = " ".join(f"Image {i + 1} is {names[r]}." for i, r in enumerate(refs)) + " "
    final = {}
    r = higgsfield_client.subscribe(
        "marketing-studio/image/sunburst",
        arguments={"prompt": lead + prompt, "image_urls": [up(x) for x in refs], "aspect_ratio": "9:16",
                   "resolution": "2k", "quality": "medium", "enhance_prompt": False},
        on_queue_update=lambda s: final.update(s=s))
    if not isinstance(final.get("s"), higgsfield_client.Completed):
        raise SystemExit(f"not made: {type(final.get('s')).__name__}")
    url = ((r or {}).get("images") or [{}])[0].get("url")
    if not url:
        raise SystemExit("not made: no image")
    out = OUT / f"{shot}-{take}.jpg"
    out.write_bytes(urllib.request.urlopen(url, timeout=60).read())
    print("saved", out, Image.open(out).size)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "1")
