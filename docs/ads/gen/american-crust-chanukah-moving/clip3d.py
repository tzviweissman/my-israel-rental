"""American Crust Chanukah 3D ad: one image-to-video clip per shot (out/s1..s5.jpg). One billable clip per run; HF_KEY
from backend/.env.local, never printed.

    python docs/ads/gen/american-crust-chanukah-moving/clip3d.py <c1..c5> --go

One cause, one motion in each; the pack is held steady so their real label can be laid on it in code (A28.2)."""
import sys
import time
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
load_dotenv(HERE.parents[3] / "backend" / ".env.local")
MODEL = "minimax/h3/image-to-video"
KEEP = (" Keep the 3D animated film look, the characters, their costumes, the temple, the light and the pack exactly as they "
        "are. Smooth, natural, expressive cartoon animation. Every character has exactly two arms. No text, no new people, "
        "no cuts.")
CLIPS = {
    "c1": ("s1.jpg", "He lifts the big jar upside down, shakes it, nothing falls out; he drops it on its side and it rolls "
           "away; he hurries to the next jar; the lamps flicker." + KEEP),
    "c2": ("s2.jpg", "He slowly lifts the lid of the small jar; warm golden light pours out and grows brighter on his "
           "amazed face; tiny sparkles rise; slow push-in." + KEEP),
    "c3": ("s3.jpg", "He holds the bagel dough pack perfectly still in front of his chest, label to the camera, beaming; "
           "his two friends lean in closer, gasp and point at it; the camera holds still. The pack does not move." + KEEP),
    "c4": ("s4.jpg", "He slides the long wooden paddle out of the glowing oven toward the camera; the six baked bagels on "
           "it stay exactly the same; steam rises from them." + KEEP),
    "c5": ("s5.jpg", "The three friends eat their bagels happily, bite, chew, laugh and nod; the menorah flames flicker; "
           "the pack and the bagels on the table stay still and sharp; the camera holds still." + KEEP),
}

clip = sys.argv[1] if len(sys.argv) > 1 else ""
if clip not in CLIPS or "--go" not in sys.argv:
    sys.exit("python clip3d.py <c1..c5> --go")
import higgsfield_client as h  # noqa: E402

start, prompt = CLIPS[clip]
out = HERE / "out" / f"{clip}.mp4"
ctl = h.submit(MODEL, arguments={"duration": 6, "resolution": "2K", "aspect_ratio": "9:16", "prompt": prompt,
                                 "image_url": h.upload_file(str(HERE / "out" / start))})
(out.parent / f"{clip}.req").write_text(f"{ctl.request_id}\n")
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
