"""Draw the rough layout a generated ad picture must follow (ad rule A3.11, Tzvi 10 Nov 2026).

    backend/.venv/Scripts/python scripts/ad-layout-sketch.py <layout.json> <layout.png>

Why: told in words where things go ("the phone at 27 percent from the left", "notes between 24 and 70 percent of
the height", "about thirty notes"), the text-only model centred the phone and drew eight notes. Image models copy
the arrangement of a picture they are given far better than they follow numbers. So the layout is drawn first as
flat boxes and given to the reference-image model (marketing-studio/image/sunburst) as an image, with the words
"photograph this layout for real"; the owner's real product photo, when there is one, goes in as another image.
Exact parts (a phone's screen, a label) are still laid on afterwards in code.

layout.json:
    {"shape": "story" | "feed" | "square" | "portrait" (3:4, the model's nearest to a tall frame with room above),
     "ground": "#2b2b2b",                                 optional: the main tone of the scene
     "boxes": [{"what": "phone", "x": 0.4, "y": 0.34, "w": 0.2, "h": 0.32, "colour": "#9aa0a6", "angle": 0},
               {"what": "ring", "form": "ring", "band": 0.08, "x": 0.2, "y": 0.4, "w": 0.34, "h": 0.25}],
     "keep_empty": [{"what": "headline", "x": 0.05, "y": 0.11, "w": 0.9, "h": 0.17},
                    {"what": "foot", "x": 0.04, "y": 0.76, "w": 0.92, "h": 0.12, "over": ["desk"]}]}
x, y, w, h are shares of the width and height. Boxes are drawn in order, later ones in front. keep_empty areas are
left undrawn and checked: no box may cover one, except grounds listed in its "over" (the foot on the desk)."""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

SIZES = {"story": (1080, 1920), "feed": (1080, 1350), "square": (1080, 1080), "portrait": (1080, 1440)}


def main(spec_path: str, out_path: str) -> None:
    spec = json.loads(Path(spec_path).read_text(encoding="utf8"))
    W, H = SIZES[spec.get("shape", "story")]
    im = Image.new("RGB", (W, H), spec.get("ground", "#2b2b2b"))
    for b in spec.get("boxes", []):
        w, h = round(b["w"] * W), round(b["h"] * H)
        if b.get("form") == "ring":
            # A ring seen from the front: an outline, its thickness a share of its width ("band", default 0.08).
            tile = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            ImageDraw.Draw(tile).ellipse([0, 0, w - 1, h - 1], outline=b.get("colour", "#dfe3ea"), width=max(4, round(w * b.get("band", 0.08))))
        else:
            tile = Image.new("RGBA", (w, h), b.get("colour", "#9aa0a6"))
            ImageDraw.Draw(tile).rectangle([0, 0, w - 1, h - 1], outline=(0, 0, 0, 90), width=3)
        if b.get("angle"):
            tile = tile.rotate(b["angle"], expand=True, resample=Image.BICUBIC)
        cx, cy = round((b["x"] + b["w"] / 2) * W), round((b["y"] + b["h"] / 2) * H)
        im.paste(tile, (cx - tile.width // 2, cy - tile.height // 2), tile)
    # Areas kept for the words are not drawn (a painted patch is copied by the model): no box may cover them.
    bad = []
    for e in spec.get("keep_empty", []):
        for bx in spec.get("boxes", []):
            ox = min(e["x"] + e["w"], bx["x"] + bx["w"]) - max(e["x"], bx["x"])
            oy = min(e["y"] + e["h"], bx["y"] + bx["h"]) - max(e["y"], bx["y"])
            if ox > 0.01 and oy > 0.01 and bx.get("what") not in e.get("over", []):
                bad.append(f'{bx.get("what", "box")} covers the {e.get("what", "empty area")}')
    if bad:
        raise SystemExit("the layout puts things where the words go: " + "; ".join(bad) +
                         ' (list a ground such as "desk" in that area\'s "over" if the words sit on it on purpose)')
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    im.save(out_path)
    print(f"wrote {out_path} ({W}x{H}, {len(spec.get('boxes', []))} boxes, {len(spec.get('keep_empty', []))} kept empty)")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(*sys.argv[1:])
