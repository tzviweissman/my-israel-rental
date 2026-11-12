"""MyIsraelRental's ad series pictures (docs/ads/blueprints/myisraelrental-series-status.md), one scene per thing
the site does, in the style of the automation ad (a tiny world on a walnut desk under a navy wall). Tzvi chose the
four scenes on 12 Nov 2026. One billable Higgsfield API still per call; image 1 is the scene's layout sketch
(layout-<scene>.png from layout-<scene>.json, drawn with scripts/ad-layout-sketch.py, rule A3.11). No words in the
pictures (A3.7); phone screens and the billboard are left plain white for our real screens, laid on in code (A3.12).
HF_KEY from backend/.env.local, never printed.

    backend/.venv/Scripts/python docs/ads/gen/myisraelrental-series-status/gen.py <rentals|shop|email|ads> [shape] [take]"""
import sys
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[4]
load_dotenv(ROOT / "backend" / ".env.local")
import higgsfield_client  # noqa: E402
from PIL import Image  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
ASPECT = {"story": "9:16", "post": "3:4"}
STYLE = (
    "Surreal miniature advertising photograph, shot on a real camera with a macro lens. Image 1 is the layout to "
    "photograph for real, keep its arrangement exactly. A warm walnut wooden desk in the lower half; behind it a deep "
    "navy blue wall, plain and empty in the top third of the picture. One warm light from the left raking across the "
    "desk, soft real shadows, shallow depth of field, premium and playful. Tiny miniature people are real scale "
    "figures, each about the height of a coffee bean, in sharp focus with real small shadows. "
)
PHONE = ("A modern black smartphone stands upright on a small black stand at the left of the desk, facing the camera "
         "straight on, its screen a plain glowing white rectangle with nothing on it. ")
END = "No text, no letters, no numbers, no logos, no people of normal size, no hands."
SCENES = {
    "rentals": PHONE + (
        "To the right of the phone on the desk stands a small real miniature two-storey house of pale Jerusalem stone "
        "with a red front door standing open and windows glowing warm. A tiny moving crew of four movers in grey "
        "overalls carries furniture up a little wooden ramp from the desk into the open door: two carry a small blue "
        "sofa, one a cardboard box, one a floor lamp. A few more small cardboard boxes wait on the desk, and a small "
        "white moving van is parked at the right with its back doors open. "),
    "shop": PHONE + (
        "Around the phone stands tiny metal scaffolding with miniature construction workers in yellow hard hats and "
        "orange vests building a little shop front onto the phone: one on the scaffolding with a paint roller, one "
        "carrying bricks, one with a wheelbarrow on the desk. A small yellow tower crane on the desk to the right of "
        "the phone swings a little blue striped shop awning on its hook over the top of the phone. A few orange "
        "traffic cones and a small pile of bricks on the desk. "),
    "email": (
        "In the middle of the desk lies one giant white paper envelope, opened, its flap standing up behind. Inside "
        "the envelope is a tiny real post office: small wooden sorting cubbies full of little white letters, tiny "
        "postal workers in blue uniforms and caps sorting letters into them, one at a tiny wooden desk typing on a "
        "small typewriter, one carrying a small canvas sack of letters. Little blue envelopes fly up out of the big "
        "envelope at the upper right one after another, like they are being sent. "),
    "ads": (
        "At the left of the desk a tiny real vintage printing press with metal rollers prints a long strip of paper "
        "that runs out across the desk. At the right stands a small wooden billboard on legs, its poster area a plain "
        "flat white rectangle facing the camera straight on, nothing on it. A tiny worker in white overalls on a small "
        "ladder beside the billboard smooths the poster with a brush, another carries a rolled poster over his "
        "shoulder, a third holds a small bucket of paste. "),
}


def main(scene: str, shape: str, take: str) -> None:
    OUT.mkdir(exist_ok=True)
    final = {}
    r = higgsfield_client.subscribe(
        "marketing-studio/image/sunburst",
        arguments={"prompt": f"{STYLE}{SCENES[scene]}{END}", "image_urls": [higgsfield_client.upload_file(HERE / f"layout-{scene}.png")],
                   "aspect_ratio": ASPECT[shape], "resolution": "2k", "quality": "medium", "enhance_prompt": False},
        on_queue_update=lambda s: final.update(s=s),
    )
    if not isinstance(final.get("s"), higgsfield_client.Completed):
        raise SystemExit(f"not made: {type(final.get('s')).__name__}")
    url = ((r or {}).get("images") or [{}])[0].get("url")
    if not url:
        raise SystemExit("not made: no image")
    out = OUT / f"{scene}-{shape}-{take}.jpg"
    out.write_bytes(urllib.request.urlopen(url, timeout=60).read())
    print("saved", out, Image.open(out).size)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "story", sys.argv[3] if len(sys.argv) > 3 else "1")
