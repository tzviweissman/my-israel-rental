"""The opening film v3, fruit rain (see opening-film-v3-brief.md), one billable
Higgsfield API call: Kling 3.0 Pro image-to-video, first and last frame pinned.
HF_KEY comes from backend/.env.local; never read or printed here.

    python film_v3.py <out.mp4>
"""
import sys
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[4] / "backend" / ".env.local")
import higgsfield_client  # noqa: E402

START = "https://d8j0ntlcm91z4.cloudfront.net/user_3HWGlZDXVCAOoMKfZq628Ml9cM5/hf_20261026_174926_ce1d064f-a13a-463e-a8e2-599f1ff39be9.png"  # gen/v3-start-empty-board.jpg
END = "https://d2ol7oe51mr4n9.cloudfront.net/user_3HWGlZDXVCAOoMKfZq628Ml9cM5/d7da07a1-f4e3-4668-9643-efdeda26d42d.png"  # assets/opening-end.webp
PROMPT = (
    "Locked camera, one continuous shot, no cuts, slow motion. An empty long wooden board with a handle lies on a red "
    "studio ground in warm light. Fruit falls into the frame from above the top edge and lands on the board, one group "
    "after another, each piece visibly falling the whole way down: first watermelon wedges land along the back of the "
    "board with a small bounce and a few juice droplets; then bunches of red grapes and green grapes fall, bounce once "
    "and settle in the middle and at the left end, with dates and walnuts beside them; then pineapple chunks and kiwi "
    "halves rain down at the front left while lychees and a halved pomegranate land at the right end by the handle; then "
    "a neat stack of pale melon slices drops onto the front of the board, tips over and fans out like a deck of cards; "
    "last, a pineapple crown drops into the middle and settles. Every piece keeps its shape and stays where it lands. "
    "Nothing appears except by falling in from above, nothing changes into anything else, nothing disappears. The board, "
    "the red ground and the light never change. Realistic fruit with natural weight, opaque, glistening. It ends exactly "
    "on the last frame."
)

out = sys.argv[1]
final = {}
r = higgsfield_client.subscribe(
    "kling-video/v3.0/pro/image-to-video",
    arguments={"prompt": PROMPT, "image_url": START, "last_image_url": END, "duration": 10, "sound": "off"},
    on_queue_update=lambda s: final.update(s=s),
)
if not isinstance(final.get("s"), higgsfield_client.Completed) or not (r or {}).get("video"):
    sys.exit(f"FAILED: {type(final.get('s')).__name__} {sorted((r or {}).keys())}")
urllib.request.urlretrieve(r["video"]["url"], out)
print("saved", out)
