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
    "Premium food advertising photograph, a styled product shoot, portrait 3:4, filling the whole frame. Image 1 is the "
    "real product: keep it exactly, the four clear plastic sealed tubs with the brown raw cholent kit inside and the "
    "dark label on each lid, the same four tubs, the same labels, sharp and clearly readable. Image 2 shows the kind of "
    "slow cooker: brushed stainless steel with a black glass lid. Set: a dark walnut wood table in warm candlelight. "
    "The four tubs stand at the front centre in two rows of two, big, filling about 70 percent of the width, slightly "
    "angled so the labels face the camera, their front edge at about 84 percent of the picture's height. The slow "
    "cooker stands behind them, lid on, a soft wisp of steam rising from its vent, its lid top at about 30 percent of "
    "the height. Styled around them, near the left and right edges only, never in front of the tubs: on the left a "
    "golden braided challah on a wooden board with a linen napkin; on the right a small wooden board with two raw "
    "beef marrow bones and a few cubes of raw diced beef, a sprig of thyme. Behind, far out of focus, two lit "
    "Shabbat candles in silver candlesticks, warm glowing points. The top 22 percent of the picture is plain dark warm "
    "background, the candle glows below that line; below the tubs the walnut table falls into shadow. Light: warm "
    "golden key light from the left, gentle fill from the front so the tubs and labels are bright and clear, rich "
    "shadows, real depth, appetising and premium. No cooked food, no plates of cholent, no text, no letters and no "
    "logos anywhere except the tubs' own labels; no hands, no people."
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
                   "aspect_ratio": sys.argv[2] if len(sys.argv) > 2 else "9:16", "resolution": "2k", "quality": "medium", "enhance_prompt": False},
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
