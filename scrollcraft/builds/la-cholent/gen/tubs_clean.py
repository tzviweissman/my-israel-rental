"""Take the beans and the potato out of the three size-card tub shots (Tzvi, 11 Nov 2026: "la cholent doesnt put
potatoes or beans in the original/classic version"). One Higgsfield API edit per shot, about 0.25 credits each.

    python scrollcraft/builds/la-cholent/gen/tubs_clean.py gold olive steel

Image 1 is the shot in use (assets/tub-<name>.webp); only the props change. HF_KEY from backend/.env.local, never printed."""
import io
import sys
import urllib.request
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[4]
load_dotenv(ROOT / "backend" / ".env.local")
import higgsfield_client  # noqa: E402
from PIL import Image  # noqa: E402

GEN = Path(__file__).resolve().parent
ASSETS = GEN.parent / "assets"
PROMPT = (
    "Edit this product photograph. Remove every bean (all the small white, brown and speckled beans on the stone and "
    "on the table) remove the potato and remove the small pile of pale grains on the table. In their place show only what was behind them: the same dark slate stone and "
    "the same plain coloured table and background, with the same light and shadows. Keep everything else exactly as "
    "it is: the clear sealed tub, its cling film, its label and every word on it, the slate block, the raw marrow bone, "
    "the camera, the framing and the colours. Add nothing new."
)


def main(names: list[str]) -> None:
    for name in names:
        src = GEN / f"tub-{name}-src.jpg"
        buf = io.BytesIO()
        Image.open(ASSETS / f"tub-{name}.webp").convert("RGB").save(buf, "JPEG", quality=95)
        src.write_bytes(buf.getvalue())
        final = {}
        r = higgsfield_client.subscribe(
            "marketing-studio/image/sunburst",
            arguments={"prompt": PROMPT, "image_urls": [higgsfield_client.upload_file(src)], "aspect_ratio": "4:3",
                       "resolution": "2k", "quality": "medium", "enhance_prompt": False},
            on_queue_update=lambda s: final.update(s=s),
        )
        if not isinstance(final.get("s"), higgsfield_client.Completed):
            raise SystemExit(f"{name}: not made: {type(final.get('s')).__name__}")
        url = ((r or {}).get("images") or [{}])[0].get("url")
        if not url:
            raise SystemExit(f"{name}: not made: no image")
        out = GEN / f"tub-{name}-clean.png"
        out.write_bytes(urllib.request.urlopen(url, timeout=60).read())
        print("saved", out, Image.open(out).size)


if __name__ == "__main__":
    main(sys.argv[1:] or ["gold", "olive", "steel"])
