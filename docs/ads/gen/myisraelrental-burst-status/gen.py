"""MyIsraelRental's "burst" status ad picture (docs/ads/blueprints/myisraelrental-burst-status.md). One billable
Higgsfield API still, text only: a phone on a desk with blank sticky notes bursting off it. No words in the picture
(A3.7): the screen and the front notes are typed on top in code. HF_KEY from backend/.env.local, never printed.

    python docs/ads/gen/myisraelrental-burst-status/gen.py [take]"""
import io
import sys
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[4]
load_dotenv(ROOT / "backend" / ".env.local")
import higgsfield_client  # noqa: E402
from PIL import Image  # noqa: E402

OUT = Path(__file__).resolve().parent / "out"
PROMPT = (
    "Dramatic commercial advertising photograph, vertical, shot on a real camera. A modern black smartphone stands "
    "upright on a small black stand on a dark walnut desk, facing the camera straight on, centred, its screen a plain "
    "glowing white rectangle with nothing on it. The phone fills about 46 percent of the picture's width; its top is at "
    "about 34 percent of the picture's height and the bottom of its stand at about 66 percent. Below that, the walnut "
    "desk runs to the bottom of the picture, falling into shadow. Moment: real paper yellow sticky notes, slightly "
    "curled, with visible paper texture and soft shadows, bursting outward from behind the phone, frozen in mid-air, "
    "tumbling at different angles: big sharp ones near the phone's sides, smaller blurred ones farther out, all of "
    "them between 24 and 70 percent of the picture's height. The top 22 percent of the picture is dark and empty. "
    "Light: a strong warm back light behind the phone making the notes glow at their edges, the room dark, real depth "
    "of field. Nothing written anywhere: blank notes, blank screen, no text, no letters, no logos, no hands, no people."
)


def main(take: str) -> None:
    OUT.mkdir(exist_ok=True)
    final = {}
    r = higgsfield_client.subscribe(
        "higgsfield-ai/soul/standard",
        arguments={"prompt": PROMPT, "resolution": "1080p", "aspect_ratio": "9:16", "num_images": 1},
        on_queue_update=lambda s: final.update(s=s),
    )
    if not isinstance(final.get("s"), higgsfield_client.Completed) or not (r or {}).get("images"):
        raise SystemExit(f"not made: {type(final.get('s')).__name__}")
    out = OUT / f"burst-{take}.jpg"
    out.write_bytes(urllib.request.urlopen(r["images"][0]["url"], timeout=60).read())
    print("saved", out, Image.open(out).size)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "1")
