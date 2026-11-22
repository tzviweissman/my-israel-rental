"""Chicken Munch Chanukah 3D ad: one image-to-video clip per shot (out/s1..s5.jpg). One billable clip per run; HF_KEY
from backend/.env.local, never printed.

    python docs/ads/gen/chicken-munch-chanukah-moving/clip3d.py <c1..c5> --go

One cause, one motion in each; the box and the faces stay as they are (A3.3, one-look-per-product)."""
import sys
import time
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).resolve().parent
load_dotenv(HERE.parents[3] / "backend" / ".env.local")
MODEL = "minimax/h3/image-to-video"
KEEP = (" Keep the 3D animated film look, the characters, their costumes, the temple, the light and the takeaway box exactly "
        "as they are. Smooth, natural, expressive cartoon animation. No text, no new people, no cuts.")
CLIPS = {
    "c1": ("s1.jpg", "He peers into the jar, frowns, pulls his head back and looks into the next jar, searching eagerly; "
           "the oil lamps flicker; a slow gentle push-in of the camera." + KEEP),
    "c2": ("s2.jpg", "He lifts the little oil jug higher; the golden glow from it grows brighter on his delighted face and "
           "sparkles float up; he gasps with joy; slow push-in." + KEEP),
    "c3": ("s3.jpg", "He turns his head from the oil jug in his hand to the takeaway box on the table and back, rubbing his "
           "chin, thinking very hard; the camera slowly moves past his shoulder toward the box, which stays still and "
           "sharp." + KEEP),
    "c4": ("s4.jpg", "Grinning, he flicks the oil jug back over his shoulder; it tumbles away out of frame behind him; he "
           "strides happily toward the camera." + KEEP),
    "c4b": ("s4b.jpg", "With a flick of his right wrist he tosses the oil jug backwards over his right shoulder; the jug "
            "tumbles away behind him and out of frame; his right hand comes back down to his side and he walks happily "
            "toward the camera. He has exactly two arms the whole time: his right arm throws, his left arm swings "
            "naturally at his side; no other hand or arm appears." + KEEP),
    "c6": ("s6.jpg", "He walks slowly and proudly toward the camera carrying the open takeaway box in both hands, grinning; "
           "his two friends walk behind him, laughing and reaching toward the box; the lamps flicker; the camera slowly "
           "pulls back with them. The box stays sharp and exactly the same, held steady in front of his chest." + KEEP),
    "c5": ("s5.jpg", "The three friends eat happily: they bite their chicken tenders, chew, laugh and nod to each other; the "
           "menorah flames flicker; the box stays still and sharp on the table; the camera holds still." + KEEP),
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
