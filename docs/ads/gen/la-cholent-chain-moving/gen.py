"""L.A. Cholent chain moving ad: the three shots' stills (docs/ads/blueprints/la-cholent-chain-moving.md, A3.3, A3.11).
One billable Higgsfield API still per run.

    python docs/ads/gen/la-cholent-chain-moving/gen.py <s1|s2|s3> [take]

Built on their own photos (A3.3): the tub scrollcraft/builds/la-cholent/src/medium.jpg and the slow cooker
scrollcraft/builds/la-cholent/assets/pot.webp; each shot's layout sketch goes in too, and shots 2 and 3 also get the
chosen shot 1 so the stone, light and pot match. No words in any picture (A3.7): the tub's label is laid on in code.
Shot 3's cooked bowl is generated: Tzvi allowed it as an exception, 18 Nov 2026 (A3.10).
HF_KEY comes from backend/.env.local; never read or printed here."""
import io
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
TUB = ROOT / "scrollcraft" / "builds" / "la-cholent" / "src" / "medium.jpg"
POT = ROOT / "scrollcraft" / "builds" / "la-cholent" / "assets" / "pot.webp"
SET = ("Professional overhead food advertising photograph, straight down from above, vertical 9:16. Photograph the "
       "layout sketch for real: follow where its boxes are exactly. The ground is one slab of matte near-black stone, "
       "edge to edge. Warm soft side light from the left, a gentle fall to darker at the edges, real depth and soft "
       "shadows. The slow cooker is the stainless steel one in the pot photo, seen from directly above as an oval about "
       "70 percent of the picture's width, centred. The top 22 percent of the picture is plain dark stone. ")
NO = (" No text, no letters, no logos, no writing on any label, no extra objects, no people other than the one hand, "
      "no rings or jewellery.")
SHOTS = {
    "s1": SET + (
        "The cooker is open, its black lid off and out of frame; inside, the empty steel crock. A real hand comes in "
        "from the right holding one clear plastic square tub exactly like the tubs in the tub photo, open, tipped "
        "steeply over the crock, and the thick red-brown raw cholent kit (grains and beans, as seen through the tub in "
        "the tub photo) is starting to slide out of it in one mass into the crock. On the left edge a plain glass jug "
        "of water." + NO),
    "s2": SET + (
        "The same set as the shot 1 picture, the same stone and light and jug. The cooker now has its black glass lid "
        "on, fogged on the inside with fine beads of water, one soft wisp of steam rising from under the lid's edge. A "
        "real hand comes in from the right, fingers just about to take the lid's black knob in the centre." + NO),
    "s3": SET + (
        "The same stone and light as the shot 1 picture. Exactly where the cooker was in the shot 1 picture, the same "
        "size and centre, there is now one wide cream ceramic bowl, full of slow-cooked cholent: soft brown barley and "
        "beans with tender chunks of beef, deep glossy brown, the same grains as the raw kit in the tub photo after a "
        "long cook; no potatoes, no eggs, no garnish. A spoon at the right edge beside the bowl. Above the bowl at the "
        "upper right, just under the plain top area, one small sealed clear square tub of the raw kit with its lid "
        "on, seen from above, its label area a plain dark rectangle. Nothing in the lower fifth of the picture but "
        "plain dark stone. No jug, no hand, no steam." + NO),
}


def up(path: Path) -> str:
    buf = io.BytesIO()
    Image.open(path).convert("RGB").save(buf, "JPEG", quality=92)
    tmp = OUT / f"src-{path.stem}.jpg"
    tmp.write_bytes(buf.getvalue())
    return higgsfield_client.upload_file(tmp)


def main(shot: str, take: str) -> None:
    OUT.mkdir(exist_ok=True)
    images = [up(TUB), up(POT), higgsfield_client.upload_file(HERE / f"layout-{shot}.png")]
    if shot != "s1":
        images.append(up(OUT / "s1.jpg"))  # the chosen shot 1, so all three shots are one set
    final = {}
    r = higgsfield_client.subscribe(
        "marketing-studio/image/sunburst",
        arguments={"prompt": "Image 1 is the tub photo, Image 2 the pot photo, Image 3 the layout sketch"
                   + (", Image 4 the shot 1 picture. " if shot != "s1" else ". ") + SHOTS[shot],
                   "image_urls": images, "aspect_ratio": "9:16", "resolution": "2k", "quality": "medium",
                   "enhance_prompt": False},
        on_queue_update=lambda s: final.update(s=s),
    )
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
