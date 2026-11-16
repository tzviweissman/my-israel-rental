"""L.A. Cholent's Chanukah moving ad: the approved still's picture with a menorah (docs/ads/blueprints/la-cholent-chanukah-moving.md).
One billable Higgsfield API still.

    backend/.venv/Scripts/python docs/ads/gen/la-cholent-chanukah-moving/gen.py [take]

Image 1 is the approved status ad's picture (docs/ads/gen/la-cholent-status/out/pot-3.jpg), kept as it is; image 2
is their own photo of the sealed kit tubs (scrollcraft/builds/la-cholent/src/medium.jpg, rule A3.3); image 3 is the
layout (layout.png from scripts/ad-layout-sketch.py, rule A3.11): the menorah box to the right of the slow cooker.
Its candles are unlit: ad.html lights them in code, one at a time. No words in the picture except the tubs' own
labels (A3.7). HF_KEY from backend/.env.local, never printed."""
import io
import sys
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[4]
load_dotenv(ROOT / "backend" / ".env.local")
import higgsfield_client  # noqa: E402
from PIL import Image  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
SCENE = ROOT / "docs" / "ads" / "gen" / "la-cholent-status" / "out" / "pot-3.jpg"
TUBS = ROOT / "scrollcraft" / "builds" / "la-cholent" / "src" / "medium.jpg"
LAYOUT = HERE / "layout.png"
PROMPT = (
    "Premium food advertising photograph, portrait 3:4. Image 1 is the finished photograph: keep it exactly as it is, "
    "the same camera, framing, warm candle-dark light and every object in the same place: the four clear sealed tubs "
    "of brown raw cholent kit with their dark L.A. CHOLENT labels at the front (they are the real product shown in "
    "image 2, keep their labels and the kit inside unchanged), the brushed steel slow cooker with its black lid and "
    "knob behind them, the braided challah on the left, the wooden board with marrow bones and diced beef on the right, "
    "the dark walnut table. Change one thing only, as the layout in image 3 shows: the two Shabbat candlesticks behind "
    "the slow cooker on the right become a classic silver Chanukah menorah standing on the table just to the right of "
    "the slow cooker, seen at an angle so its straight row of eight white candles recedes into the picture, with the "
    "raised shamash candle in the middle, every candle whole, white and NOT lit, black wicks visible, no flames, no "
    "glow from the candles. The tops of the candles stay below the top fifth of the picture, which remains plain dark "
    "warm background. The warm golden key light from the left stays. No text, no letters and no logos anywhere except "
    "the tubs' own labels; no hands, no people, no cooked food."
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
        arguments={"prompt": PROMPT, "image_urls": [higgsfield_client.upload_file(jpg(p)) for p in (SCENE, TUBS, LAYOUT)],
                   "aspect_ratio": "3:4", "resolution": "2k", "quality": "medium", "enhance_prompt": False},
        on_queue_update=lambda s: final.update(s=s),
    )
    if not isinstance(final.get("s"), higgsfield_client.Completed):
        raise SystemExit(f"not made: {type(final.get('s')).__name__}")
    url = ((r or {}).get("images") or [{}])[0].get("url")
    if not url:
        raise SystemExit("not made: no image")
    out = OUT / f"menorah-{take}.jpg"
    out.write_bytes(urllib.request.urlopen(url, timeout=60).read())
    print("saved", out, Image.open(out).size)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "1")
