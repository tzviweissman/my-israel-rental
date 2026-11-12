"""Test picture for the Product photo design's "tiny people" idea (docs/ads/blueprints/design-shoot-ideas.md).
One billable Higgsfield API still, made with the very prompt the server uses (utils/ad_shots.prompt_for_idea), on
L.A. Cholent's own photo of their tubs (scrollcraft/builds/la-cholent/src/medium.jpg, rule A3.3). Image 2 is the
kind's empty set, image 3 the layout sketch (backend/assets/ad-sets/layout-tiny-<shape>.png from layout-*.json,
drawn with scripts/ad-layout-sketch.py, rule A3.11). HF_KEY from backend/.env.local, never printed.

    backend/.venv/Scripts/python docs/ads/gen/design-shoot-ideas/gen.py [shape] [take]"""
import sys
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[4]
load_dotenv(ROOT / "backend" / ".env.local")
sys.path.insert(0, str(ROOT / "backend"))
import higgsfield_client  # noqa: E402
from PIL import Image  # noqa: E402

from utils.ad_shots import ASPECT, MODEL, SETS, idea_layout, look_for, prompt_for_idea  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
PRODUCT = ROOT / "scrollcraft" / "builds" / "la-cholent" / "src" / "medium.jpg"
WHAT = ("four sealed square clear plastic tubs of L.A. Cholent, each with a black and white label reading "
        "L.A. CHOLENT By Rabbi Samuels, the cholent mix inside reddish brown")
KIND = "kitchen"


def main(shape: str, take: str) -> None:
    OUT.mkdir(exist_ok=True)
    look = look_for(KIND, "")
    final = {}
    r = higgsfield_client.subscribe(
        MODEL,
        arguments={"prompt": prompt_for_idea("tiny", WHAT, KIND, "", shape),
                   "image_urls": [higgsfield_client.upload_file(PRODUCT), higgsfield_client.upload_file(SETS / f"{look['set']}.jpg"),
                                  higgsfield_client.upload_file(idea_layout("tiny", shape))],
                   "aspect_ratio": ASPECT[shape], "resolution": "2k", "quality": "medium", "enhance_prompt": False},
        on_queue_update=lambda s: final.update(s=s),
    )
    if not isinstance(final.get("s"), higgsfield_client.Completed):
        raise SystemExit(f"not made: {type(final.get('s')).__name__}")
    url = ((r or {}).get("images") or [{}])[0].get("url")
    if not url:
        raise SystemExit("not made: no image")
    out = OUT / f"tiny-{shape}-{take}.jpg"
    out.write_bytes(urllib.request.urlopen(url, timeout=60).read())
    print("saved", out, Image.open(out).size)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "feed", sys.argv[2] if len(sys.argv) > 2 else "1")
