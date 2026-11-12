"""Builds the admin Ads area's scene pictures (frontend/public/ads/scenes/<scene>-<shape>[-rtl].jpg) from the paid
pictures in out/, so they can be remade at any time without paying again:

  1. for Hebrew the picture is mirrored first, so the words (right-aligned) sit over the plain wall and the action
     (the flying envelopes, the crane) is on the left, as it is on the right under English words;
  2. our real screen is laid into the phone or billboard (rule A3.12), measured from the picture, after mirroring,
     so its words read the right way;
  3. the empty desk at the very bottom is trimmed and the picture laid at full width with scripts/ad-fit-picture.py
     (A3.9), lowered by DROP px so the plain wall carries on above it;
  4. the post shape is the status without the strips a status keeps clear for the phone's bars and some wall,
     never shrunk.

    backend/.venv/Scripts/python docs/ads/gen/myisraelrental-series-status/build_scenes.py"""
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageOps

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
OUT = ROOT / "frontend" / "public" / "ads" / "scenes"
sys.path.insert(0, str(HERE))
from lay_screens import run  # noqa: E402

AUTO = ROOT / "docs" / "ads" / "gen" / "myisraelrental-automation-status"
# scene: (paid picture, screen, how it fits, the seed inside the white area as shares, light, drop, post crop top)
SCENES = {
    "factory": (AUTO / "out" / "factory-1.jpg", AUTO / "orders-screen.png", "top", (0.22, 0.54), 200, 120, 230),
    "moving": (HERE / "out" / "rentals-story-1.jpg", HERE / "screen-rentals.png", "top", (0.22, 0.52), 200, 120, 250),
    "shop": (HERE / "out" / "shop-story-1.jpg", HERE / "screen-shop.jpg", "top", (0.25, 0.54), 200, 245, 225),
    "inbox": (HERE / "out" / "email-story-1.jpg", None, None, None, 200, 120, 250),
    "press": (HERE / "out" / "ads-story-1.jpg", HERE / "screen-ads.jpg", "contain", (0.72, 0.48), 150, 120, 250),
}


def build(scene: str, rtl: bool, tmp: Path) -> None:
    src, screen, fit, seed, light, drop, post_top = SCENES[scene]
    raw = Image.open(src).convert("RGB")
    if rtl:
        raw = ImageOps.mirror(raw)
        seed = seed and (1 - seed[0], seed[1])
    work = tmp / f"{scene}-{int(rtl)}.jpg"
    raw.save(work, quality=95)
    im = run(work, seed, screen, fit, light) if screen else raw
    w, h = im.size
    trimmed = tmp / f"{scene}-{int(rtl)}-trim.jpg"
    im.crop((0, 0, w, h - int((drop + 10) * w / 1080))).save(trimmed, quality=95)
    fitted = tmp / f"{scene}-{int(rtl)}"
    fitted.mkdir(exist_ok=True)
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "ad-fit-picture.py"), str(trimmed), str(fitted), str(drop)],
                       capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(f"{scene}: {r.stdout}{r.stderr}")
    status = Image.open(fitted / "ground.jpg").convert("RGB")
    end = "-rtl" if rtl else ""
    status.save(OUT / f"{scene}-status{end}.jpg", quality=86)
    status.crop((0, post_top, 1080, post_top + 1350)).save(OUT / f"{scene}-post{end}.jpg", quality=86)
    print(scene, "rtl" if rtl else "ltr")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as t:
        for name in SCENES:
            for rtl in (False, True):
                build(name, rtl, Path(t))
