"""MyIsraelRental businesses ad, "the magnifier" (Tzvi, 24 Nov 2026, from Pinterest pin 8e43e0): one picture per look.

    backend/.venv/Scripts/python docs/ads/gen/myisraelrental-magnifier-status/gen.py <photo|3d|flat> [take]

Through scripts/hf.py: priced first (Marketing Studio image, 2 credits at 2k by Higgsfield's estimate, 24 Nov 2026),
logged in docs/higgsfield-log.jsonl, never paid twice for a file already made. The layout picture (A3.11) goes in as
Image 1. The street is generic and carries no words (A3.2, A3.7); the grey outside the lens is made exact in code
afterwards (build.py), so the model only has to keep the lens shop warm and the rest muted."""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
sys.path.insert(0, str(ROOT / "scripts"))
import hf  # noqa: E402

SCENE = (
    "Image 1 is a rough layout: follow its arrangement exactly. The top {sky} of the picture is plain empty pale sky "
    "with nothing in it. Across the middle, a row of six small independent shops side by side, seen straight on at eye "
    "level: a bakery, a florist with buckets of flowers, a barber, a small cafe with two chairs outside, a hardware "
    "shop, a tailor. Plain modern facades, awnings and shop windows, every sign board completely blank, no letters, "
    "no numbers, no logos anywhere, no flags, nothing that belongs to one country. Below them a plain, empty, light "
    "grey pavement filling the bottom quarter. Floating in mid-air in front of the shops, exactly where the blue ring "
    "is in Image 1, a large magnifying glass with a thick glossy blue rim (colour #167AB8) and a short blue handle "
    "towards the lower right; its clear lens sits over the third shop, the barber, and shows it magnified, sharp and "
    "close. The whole street outside the lens is muted, almost black-and-white soft greys; only what is seen through "
    "the lens is in full warm colour, its lights on, inviting. The blue rim is the only other colour. No people, no "
    "hands, no cars, no text."
)
LOOKS = {
    "photo": "A real photograph, shot on a full-frame camera with a 50mm lens: real materials, soft bright daylight from "
             "the left, real shadows under the awnings, fine detail, crisp. ",
    "3d": "A still from a 3D animated film: a stylised miniature street with soft rounded shapes, clay-like materials, "
          "gentle global illumination and soft shadows, like a premium animated feature. ",
    "flat": "A flat vector illustration: clean simple shapes, no outlines, subtle grain, a limited palette of soft "
            "greys, white and the one blue, the lens shop in warm flat colours. ",
}

# Take 3 (Tzvi, 24 Nov 2026: "make it a 5"): the take-2 street was in flat even daylight (A11.5). One low golden
# light now shapes it: the grey street in cool shade, the found shop glowing and spilling warm light forward.
GOLDEN = (" Light: late-afternoon golden sun, low from the left, long soft shadows; the grey shops sit in cool blue-grey "
          "shade, and the one shop inside the lens glows warm gold from its own lit windows, its light spilling onto "
          "the pavement in front of it, so it is clearly the brightest thing in the picture. The sky is a soft, plain "
          "gradient from pale warm cream at the bottom to pale blue at the top. The glass rim catches a bright warm "
          "highlight on its left side. Real depth: the shops beyond the lens fall slightly soft.")

look = sys.argv[1] if len(sys.argv) > 1 else ""
if look not in LOOKS:
    sys.exit(f"which look? {', '.join(LOOKS)}")
take = sys.argv[2] if len(sys.argv) > 2 else "1"
h = hf._client()
hf.make("marketing-studio/image/sunburst",
        {"prompt": LOOKS[look] + SCENE.format(sky="quarter") + (GOLDEN if int(take) >= 3 else ""), "image_urls": [h.upload_file(str(HERE / "layout.png"))],
         "aspect_ratio": "9:16", "resolution": "2k", "quality": "medium", "enhance_prompt": False},
        HERE / "out" / f"{look}-{take}.jpg", why=f"myisraelrental magnifier ad, {look} look sample, take {take}",
        credits=2, max_credits=3)
