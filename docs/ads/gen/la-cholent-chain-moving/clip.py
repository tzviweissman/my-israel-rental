"""L.A. Cholent chain moving ad: the two real-footage beats (docs/ads/blueprints/la-cholent-chain-moving.md, A10.10,
A10.15). From the kit's clip.py. One billable clip per run; HF_KEY from backend/.env.local, never printed.

    python docs/ads/gen/la-cholent-chain-moving/clip.py <c1|c2> --go

c1 starts from shot 1 (out/s1.jpg): the hand tips the tub, the kit drops into the pot, the hand takes the tub away.
c2 starts from shot 2 (out/s2.jpg): the hand lifts the lid away and steam rolls up. Shot 3 is code moving a still.
One cause, one motion each; keep the product and the set exactly."""
import sys
import time
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
load_dotenv(HERE.parents[3] / "backend" / ".env.local")

MODEL = "minimax/h3/image-to-video"
KEEP = (" Keep everything else exactly as it is: the same stainless slow cooker, the same matte dark stone, the same "
        "glass jug, the same warm light from the left. Locked-off overhead camera, no camera move, no zoom, no cuts. No "
        "text, no new objects, no second hand, no people.")
CLIPS = {
    "c1": ("s1.jpg", "One continuous overhead shot. The hand tips the clear tub further over the open slow cooker; the "
           "thick red-brown raw cholent kit slides out in one heavy mass and drops into the steel crock, settling at the "
           "bottom; then the hand lifts the empty tub up and away out of the frame to the right. The kit keeps its "
           "grains and beans and colour." + KEEP),
    "c2": ("s2.jpg", "One continuous overhead shot. The hand takes the black knob and lifts the fogged glass lid "
           "straight up and away out of the frame to the right; as it opens, thick white steam rolls up out of the pot "
           "and spreads over the frame, and the cooked brown cholent inside shows through the steam." + KEEP),
}

clip = sys.argv[1] if len(sys.argv) > 1 else ""
if clip not in CLIPS or "--go" not in sys.argv:
    sys.exit("python clip.py <c1|c2> --go")
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
