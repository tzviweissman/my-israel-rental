"""Widen the three size-card shots to 21:9 so the wide, short cards show the whole slate and bone (Tzvi, 11 Nov 2026:
"we cant see the board the cholent is sitting on or the items next to it"). Rule 3c.12: extend, never crop. The 4:3
shot is padded in the middle of a 21:9 canvas, one Higgsfield API edit fills the sides (about 0.25 credits), then the
original is pasted back over the middle so the product is untouched.

    python scrollcraft/builds/la-cholent/gen/tubs_wide.py gold large steel

HF_KEY from backend/.env.local, never printed."""
import io
import sys
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[4]
load_dotenv(ROOT / "backend" / ".env.local")
import higgsfield_client  # noqa: E402
from PIL import Image, ImageFilter  # noqa: E402

GEN = Path(__file__).resolve().parent
ASSETS = GEN.parent / "assets"
SRC = {"gold": GEN / "tub-gold-clean.png", "large": GEN / "tub-large-2.png", "steel": GEN / "tub-steel-clean.png"}
PROMPT = (
    "This is a studio product photograph in the middle, with plain blurred bands on the left and right. Extend the "
    "photograph to fill the whole wide frame: continue the same plain coloured studio wall, the same table surface, "
    "its horizon line and the same soft light and shadow out to both edges, seamlessly. Add nothing: no objects, no "
    "food, no props, no text. Keep the middle exactly as it is."
)


def main(names):
    for name in names:
        im = Image.open(SRC[name]).convert("RGB")
        w, h = im.size
        W = round(h * 21 / 9)
        canvas = im.resize((W, h)).filter(ImageFilter.GaussianBlur(60))
        x = (W - w) // 2
        canvas.paste(im, (x, 0))
        src = GEN / f"wide-{name}-src.jpg"
        buf = io.BytesIO(); canvas.save(buf, "JPEG", quality=92); src.write_bytes(buf.getvalue())
        final = {}
        r = higgsfield_client.subscribe(
            "marketing-studio/image/sunburst",
            arguments={"prompt": PROMPT, "image_urls": [higgsfield_client.upload_file(src)], "aspect_ratio": "21:9",
                       "resolution": "2k", "quality": "medium", "enhance_prompt": False},
            on_queue_update=lambda s: final.update(s=s),
        )
        if not isinstance(final.get("s"), higgsfield_client.Completed):
            raise SystemExit(f"{name}: not made: {type(final.get('s')).__name__}")
        url = ((r or {}).get("images") or [{}])[0].get("url")
        out = Image.open(io.BytesIO(urllib.request.urlopen(url, timeout=60).read())).convert("RGB").resize((W, h), Image.LANCZOS)
        # the original back over the middle, its edges feathered into the filled sides
        mask = Image.new("L", (w, h), 255)
        edge = max(8, w // 40)
        for i in range(edge):
            v = round(255 * i / edge)
            for y in (0,):
                pass
            mask.paste(v, (i, 0, i + 1, h)); mask.paste(v, (w - 1 - i, 0, w - i, h))
        out.paste(im, (x, 0), mask)
        out.save(GEN / f"wide-{name}.png")
        out.resize((1680, 720), Image.LANCZOS).save(ASSETS / f"tub-{name}-wide.webp", quality=86)
        print("saved", name, out.size)


if __name__ == "__main__":
    main(sys.argv[1:] or list(SRC))
