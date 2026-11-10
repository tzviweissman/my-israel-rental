"""L.A. Cholent's WhatsApp status ad picture (docs/ads/blueprints/la-cholent-status.md). One billable Higgsfield API still.

    python docs/ads/gen/la-cholent-status/gen.py [take]

Image 1 is their own photo of the sealed kit tubs (scrollcraft/builds/la-cholent/src/medium.jpg, rule A3.3); image 2
is the slow cooker their site already shows (assets/pot.webp), a prop. Four tubs, as in their photo: no added copies
(A9.6). No words in the picture except their own tub labels (A3.7). HF_KEY from backend/.env.local, never printed."""
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
BUILD = ROOT / "scrollcraft" / "builds" / "la-cholent"
TUBS = BUILD / "src" / "medium.jpg"
POT = BUILD / "assets" / "pot.webp"
PROMPT = (
    "Professional food advertising photograph, vertical. Image 1 is the real product: keep it exactly, the four clear "
    "plastic sealed tubs with the brown raw cholent kit inside and the dark label on each lid, the same four tubs, the "
    "same labels. Image 2 shows the kind of slow cooker: a brushed stainless steel slow cooker with a black glass lid "
    "and black handles. Composition, strictly: the TOP THIRD of the picture is empty warm dark background, a softly "
    "lit dark kitchen wall, nothing in it. The slow cooker stands on a white marble counter in the middle of the "
    "picture, centred, lid on, filling about 60 percent of the width, its lid top at about 40 percent of the picture's "
    "height. The four tubs from image 1 stand in front of it on the marble, in two rows of two, slightly angled so "
    "their labels face the camera, their front edge at about 78 percent of the picture's height. Below that, only "
    "marble. Moment: a thin, soft wisp of steam rises from the lid's vent. Light: warm low candle-coloured light from "
    "the left, a gold glow on the steel, a gentle fall to dark at the edges, real depth. No text, no letters and no "
    "logos anywhere except the tubs' own labels; no hands, no people, no other props, no food outside the tubs."
)


def jpg(path: Path) -> Path:
    out = OUT / f"{path.stem}-src.jpg"
    buf = io.BytesIO()
    Image.open(path).convert("RGB").save(buf, "JPEG", quality=92)
    out.write_bytes(buf.getvalue())
    return out


def main(take: str) -> None:
    OUT.mkdir(exist_ok=True)
    final = {}
    r = higgsfield_client.subscribe(
        "marketing-studio/image/sunburst",
        arguments={"prompt": PROMPT, "image_urls": [higgsfield_client.upload_file(jpg(TUBS)), higgsfield_client.upload_file(jpg(POT))],
                   "aspect_ratio": "9:16", "resolution": "2k", "quality": "medium", "enhance_prompt": False},
        on_queue_update=lambda s: final.update(s=s),
    )
    if not isinstance(final.get("s"), higgsfield_client.Completed):
        raise SystemExit(f"not made: {type(final.get('s')).__name__}")
    url = ((r or {}).get("images") or [{}])[0].get("url")
    if not url:
        raise SystemExit("not made: no image")
    out = OUT / f"pot-{take}.jpg"
    out.write_bytes(urllib.request.urlopen(url, timeout=60).read())
    print("saved", out, Image.open(out).size)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "1")
