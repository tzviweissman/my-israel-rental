"""American Crust Chanukah moving ad, in 3D (docs/ads/blueprints/american-crust-chanukah-moving.md). Tzvi's choice,
22 Nov 2026: the eighth jar; "just make it an american crust film". One billable Higgsfield API still per run; HF_KEY
from backend/.env.local, never printed.

    python docs/ads/gen/american-crust-chanukah-moving/gen3d.py <s1..s5> [take]

The same three Maccabees and the same 3D film look as the Chicken Munch Chanukah ad (its character sheets and first
shot are the references). Their pack is rebuilt from assets/bagel-dough.webp and their bagels from
assets/baked-bagels.webp, each checked beside the photo; their real label is laid on in code afterwards (A28.2)."""
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
CM = ROOT / "docs" / "ads" / "gen" / "chicken-munch-chanukah-moving" / "out"
AC = ROOT / "frontend" / "public" / "pages" / "american-crust" / "assets"
FILES = {"hero": CM / "hero.jpg", "friends": CM / "friends.jpg", "look": CM / "s1.jpg", "pack": AC / "bagel-dough.webp",
         "bagels": AC / "baked-bagels.webp", "layout": HERE / "layout.png", "cm3": CM / "s3.jpg", "cm6": CM / "s6.jpg"}
NAMES = {"hero": "the character sheet", "friends": "the friends sheet", "look": "a frame of the same film (match its look, "
         "its temple and its warm lamp light exactly)", "pack": "the bagel dough pack photo", "bagels": "the baked bagels photo",
         "layout": "the layout sketch (follow where its boxes are)",
         "cm3": "the film frame to remake (same camera, set and light; only the food on the table changes)",
         "cm6": "the film frame to remake (same camera, set and light; only what he carries changes)"}
LOOK = ("A frame from a modern 3D animated feature film, vertical 9:16, cinematic: rich detailed textures, soft global "
        "illumination, warm oil-lamp light, shallow depth of field, expressive cartoon faces. Inside an ancient stone temple "
        "hall at night: carved stone pillars, bronze oil lamps, a woven rug. ")
HERO = ("The young Maccabee soldier from the character sheet, the same as in the film frame: a round bronze helmet with a tall "
        "red plume, a short dark beard, a cream tunic with a brown leather belt and bracers, a short red cape, a round bronze "
        "shield on his back, sandals. ")
PACK = ("their bagel dough pack exactly as in the pack photo: a clear plastic clamshell holding six pale raw dough rings, with "
        "a big mustard-yellow label across its lid (the label's printing left as plain dark blocks, no readable words). ")
NO = " No readable text or captions anywhere, no extra people, no modern objects but the pack."
SHOTS = {
    # Tzvi, 23 Nov 2026: "each scene isnt connected ... just use the ad we made for chicken munch and put his bagels
    # instead": the Chicken Munch film's shots with their bagels; these two are remade, the others reused from it.
    # The Chicken Munch shot 3 frame is the look reference, so the table, the light and the turn match exactly.
    "t3": (["hero", "cm3", "pack", "bagels"], LOOK + HERO + "Medium shot from behind his shoulder, the same as the film "
           "frame: holding the small oil jug in one hand, he has just turned around and sees, on the same carved stone "
           "table lit by two oil lamps, " + PACK + "beside a wooden board of six golden baked everything bagels exactly "
           "like the bagels photo, steam rising from them; big, sharp, the hero objects of the shot. He rubs his chin with "
           "his other hand, thinking hard; the space above his head is plain dark wall." + NO),
    "t6": (["hero", "friends", "cm6", "pack", "bagels"], LOOK + "The same shot as the film frame, facing the camera: the "
           "hero walks toward the camera between the temple pillars, proudly holding " + PACK + "in both hands in front of "
           "his chest, with a few baked everything bagels stacked on top of it, big and sharp; a huge happy grin. His two "
           "friends follow him, laughing and reaching toward the bagels. Lit menorah and oil lamps behind." + NO),
    "s1": (["hero", "look"], LOOK + HERO + "Medium shot: a row of big terracotta clay jars along the hall; he tips one upside "
           "down with both hands, peering under it, frustrated; two jars already lie empty on their sides behind him." + NO),
    "s2": (["hero", "look"], LOOK + HERO + "Close shot: at the end of the row stands one smaller clay jar with a lid; warm "
           "golden light leaks from under the lid; his hand is on the lid, his face lit gold, eyes wide with wonder." + NO),
    "s3": (["hero", "friends", "look", "pack"], LOOK + HERO + "Medium close shot, facing the camera: he holds up " + PACK
           + "in both hands in front of his chest, big and sharp, label to the camera, golden light around it, beaming; his "
           "two friends from the friends sheet (blue plume and moustache; yellow plume, curly hair, green cape) lean in "
           "from both sides, amazed." + NO),
    "s4": (["friends", "look", "bagels"], LOOK + "Close shot at the mouth of a glowing stone bread oven: the friend with the "
           "blue plume pulls out a long wooden baker's paddle holding six golden baked everything bagels exactly like the "
           "bagels photo (seeds, sesame, onion and garlic flakes), steam rising." + NO),
    "s5": (["hero", "friends", "look", "pack", "bagels", "layout"], LOOK + "Wide shot: the three Maccabees sit on cushions "
           "round a low carved stone table, happily eating everything bagels; on the table a wooden board with the baked "
           "bagels and, in the middle, " + PACK + "facing the camera. A lit nine-branch menorah on a ledge. The top 40 "
           "percent of the frame is a plain dark blue night sky through a tall stone arch, empty, for words." + NO),
}


def up(name):
    path = FILES[name]
    if path.suffix == ".webp":
        jpg = OUT / f"src-{name}.jpg"
        Image.open(path).convert("RGB").save(jpg, quality=92)
        path = jpg
    return higgsfield_client.upload_file(path)


def main(shot, take):
    OUT.mkdir(exist_ok=True)
    refs, prompt = SHOTS[shot]
    lead = " ".join(f"Image {i + 1} is {NAMES[r]}." for i, r in enumerate(refs)) + " "
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
