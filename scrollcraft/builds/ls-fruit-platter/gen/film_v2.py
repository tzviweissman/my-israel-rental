"""The opening film v2 burst clip (see opening-film-v2-brief.md), one billable
Higgsfield API call: Kling 3.0 Pro image-to-video, first and last frame pinned.
HF_KEY comes from backend/.env.local; never read or printed here.

    python film_v2.py <out.mp4>
"""
import sys
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[4] / "backend" / ".env.local")
import higgsfield_client  # noqa: E402

START = "https://d2ol7oe51mr4n9.cloudfront.net/user_3HWGlZDXVCAOoMKfZq628Ml9cM5/ca5441ad-858b-4c75-ad06-9da6c4805171.png"  # gen/v2-start.jpg
END = "https://d8j0ntlcm91z4.cloudfront.net/user_3HWGlZDXVCAOoMKfZq628Ml9cM5/hf_20261025_181234_d8d5c05f-03ee-4434-8bc0-7ce536c5b390.png"  # gen/opening-end-v2.jpg
PROMPT = (
    "One continuous shot, locked camera that slowly pulls back a little, no cuts. The two freshly cut watermelon halves "
    "lying on the red studio ground roll apart, one to the left and one to the right, and rock gently to a stop; they stay "
    "in view the whole time and end hollowed out, exactly where they are in the last frame. As they part, the fruit bursts "
    "upward from between them in slow motion: watermelon wedges, green grapes, red grapes, pale melon slices, pineapple "
    "pieces and a pineapple crown, kiwi, lychees and a halved pomegranate, with a few juice droplets. The fruit hangs in the "
    "air for a moment, then falls and lands neatly arranged on a long wooden board with a handle that slides into place "
    "between the two halves, settling into exactly the last frame. Every piece stays visible and solid, nothing disappears "
    "or appears from nowhere. Same warm red studio light and glow throughout. Realistic food, opaque fruit, natural weight."
)

out = sys.argv[1]
final = {}
r = higgsfield_client.subscribe(
    "kling-video/v3.0/pro/image-to-video",
    arguments={"prompt": PROMPT, "image_url": START, "last_image_url": END, "duration": 8, "sound": "off"},
    on_queue_update=lambda s: final.update(s=s),
)
if not isinstance(final.get("s"), higgsfield_client.Completed) or not (r or {}).get("video"):
    sys.exit(f"FAILED: {type(final.get('s')).__name__} {sorted((r or {}).keys())}")
urllib.request.urlretrieve(r["video"]["url"], out)
print("saved", out)
