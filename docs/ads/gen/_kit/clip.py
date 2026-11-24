"""Template for a moving ad's real-movement clip (A10.10, Tzvi 16 Nov 2026). Copy to docs/ads/gen/<name>/clip.py.

Steam, a pour, bubbles, a bite or the product turning look drawn when code does them; a short image-to-video clip of
the business's own product does them for real, and the kit plays it under the words frame by frame:
    python docs/ads/gen/<name>/clip.py --go        (one billable clip; HF_KEY from backend/.env.local, never printed)
    node scripts/new-moving-ad.mjs --clip <name> docs/ads/gen/<name>/out/clip.mp4

Before --go: blueprint stages 1 to 4 answered (the ad-gate hook refuses otherwise), the price read through the API
(get_cost) and written in the blueprint's A10.10 answer, and the start picture is THEIR photo, laid on the 9:16 ad
with scripts/ad-fit-picture.py. One cause, one motion (memory: one-cause-one-motion); keep the product exactly."""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(ROOT / "scripts"))
import hf  # noqa: E402  priced first, logged in docs/higgsfield-log.jsonl, resumable (scripts/hf.py)

START = HERE / "ground.jpg"          # their photo on the ad's shape (ad-fit-picture.py)
MODEL = "minimax/h3/image-to-video"  # hf.make prints the API's price before sending
NAME = HERE.name                     # the ad's folder name, for the spending log
PRODUCT = None                       # "<business>/<item>" from docs/products/ adds its saved traits to the prompt
PROMPT = ("One continuous locked-off shot. <the one motion>. Keep the product exactly as it is: shape, colour, count, "
          "texture and any words on it. No hands, no people, no new objects, no text, no cuts.")

if "--go" not in sys.argv or "<the one motion>" in PROMPT:
    sys.exit("write PROMPT's one motion and read the price first; then run with --go")
from higgsfield_client import upload_file  # noqa: E402

hf.make(MODEL, {"duration": 6, "resolution": "2K", "aspect_ratio": "9:16", "prompt": PROMPT,
                "image_url": upload_file(str(START))},
        HERE / "out" / "clip.mp4", why=f"{NAME} moving ad clip", product=PRODUCT, max_credits=15)
