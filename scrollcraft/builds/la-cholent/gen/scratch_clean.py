"""Take the beans and potatoes out of the from-scratch kitchen still (Tzvi, 11 Nov 2026: L.A. Cholent's classic
recipe has no potatoes or beans). One Higgsfield API edit, about 0.25 credits; the clip is then made from the still in
code (ffmpeg), not generated.

    python scrollcraft/builds/la-cholent/gen/scratch_clean.py

Image 1 is the still in use (gen/scratch-2k.png). HF_KEY from backend/.env.local, never printed."""
import io
import sys
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[4]
load_dotenv(ROOT / "backend" / ".env.local")
import higgsfield_client  # noqa: E402
from PIL import Image  # noqa: E402

GEN = Path(__file__).resolve().parent
PROMPT2 = (
    "Edit this photograph. Change only the contents of the big steel bowl: it holds cloudy water with small pearl barley "
    "grains at the bottom, exactly the same tiny size and colour as the barley spilling from the paper bag on the left, "
    "like rice, many hundreds of them; nothing in the bowl may look like a bean. Keep every other part of the picture "
    "exactly as it is. Add no text."
)
PROMPT = (
    "Edit this photograph of a messy home kitchen counter late at night. Change only these things: the steel bowl now "
    "holds pale pearl barley grains soaking in cloudy water (small oval grains, not beans); remove every potato and "
    "every potato peeling, and in their place lay a few raw beef marrow bones and some raw diced beef on brown "
    "butcher paper, with onion skins and chopped onion still scattered on the cutting board. Keep everything else "
    "exactly as it is: the cold light, the sink full of pots, the tiles, the towel, the paper bag of barley, the knife, "
    "the camera, the framing, the colours and the mess. No beans and no potatoes anywhere. Add no text."
)


def main() -> None:
    src = GEN / "scratch-src.jpg"
    buf = io.BytesIO()
    Image.open(GEN / (sys.argv[1] if len(sys.argv) > 1 else "scratch-2k.png")).convert("RGB").save(buf, "JPEG", quality=95)
    src.write_bytes(buf.getvalue())
    final = {}
    r = higgsfield_client.subscribe(
        "marketing-studio/image/sunburst",
        arguments={"prompt": PROMPT2 if len(sys.argv) > 1 else PROMPT, "image_urls": [higgsfield_client.upload_file(src)], "aspect_ratio": "3:4",
                   "resolution": "2k", "quality": "medium", "enhance_prompt": False},
        on_queue_update=lambda s: final.update(s=s),
    )
    if not isinstance(final.get("s"), higgsfield_client.Completed):
        raise SystemExit(f"not made: {type(final.get('s')).__name__}")
    url = ((r or {}).get("images") or [{}])[0].get("url")
    if not url:
        raise SystemExit("not made: no image")
    out = GEN / ("scratch-clean-2.png" if len(sys.argv) > 1 else "scratch-clean.png")
    out.write_bytes(urllib.request.urlopen(url, timeout=60).read())
    print("saved", out, Image.open(out).size)


if __name__ == "__main__":
    main()
