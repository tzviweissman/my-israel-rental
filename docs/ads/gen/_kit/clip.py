"""Template for a moving ad's real-movement clip (A10.10, Tzvi 16 Nov 2026). Copy to docs/ads/gen/<name>/clip.py.

Steam, a pour, bubbles, a bite or the product turning look drawn when code does them; a short image-to-video clip of
the business's own product does them for real, and the kit plays it under the words frame by frame:
    python docs/ads/gen/<name>/clip.py --go        (one billable clip; HF_KEY from backend/.env.local, never printed)
    node scripts/new-moving-ad.mjs --clip <name> docs/ads/gen/<name>/out/clip.mp4

Before --go: blueprint stages 1 to 4 answered (the ad-gate hook refuses otherwise), the price read through the API
(get_cost) and written in the blueprint's A10.10 answer, and the start picture is THEIR photo, laid on the 9:16 ad
with scripts/ad-fit-picture.py. One cause, one motion (memory: one-cause-one-motion); keep the product exactly."""
import sys
import time
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
load_dotenv(HERE.parents[3] / "backend" / ".env.local")

START = HERE / "ground.jpg"          # their photo on the ad's shape (ad-fit-picture.py)
MODEL = "minimax/h3/image-to-video"  # as in scrollcraft builds; check its price with get_cost first
PROMPT = ("One continuous locked-off shot. <the one motion>. Keep the product exactly as it is: shape, colour, count, "
          "texture and any words on it. No hands, no people, no new objects, no text, no cuts.")

if "--go" not in sys.argv or "<the one motion>" in PROMPT:
    sys.exit("write PROMPT's one motion and read the price first; then run with --go")
import higgsfield_client as h  # noqa: E402

out = HERE / "out" / "clip.mp4"
out.parent.mkdir(exist_ok=True)
ctl = h.submit(MODEL, arguments={"duration": 6, "resolution": "2K", "aspect_ratio": "9:16", "prompt": PROMPT,
                                 "image_url": h.upload_file(str(START))})
(out.parent / "clip.req").write_text(f"{ctl.request_id}\n")
print("submitted", ctl.request_id, flush=True)
for _ in range(240):
    try:
        st = ctl.status()
    except Exception as e:  # noqa: BLE001
        print("status retry", type(e).__name__, flush=True)
        time.sleep(10)
        continue
    if isinstance(st, h.Completed):
        url = (h.sync_client.result(ctl.request_id) or {}).get("video", {}).get("url")
        if not url:
            sys.exit("FAILED: no video")
        urllib.request.urlretrieve(url, out)
        sys.exit(print("saved", out))
    if isinstance(st, tuple(h.DONE_STATUSES)):
        sys.exit(f"FAILED: {type(st).__name__}")
    time.sleep(10)
sys.exit("FAILED: timeout")
