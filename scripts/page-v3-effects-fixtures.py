"""Page builder v3: business payloads carrying effects, for the effects gate
(scripts/check-page-v3-effects.mjs). Local only, read-only.

Takes one business from the local API, gives it pictures from
frontend/public/images/mockups/bakery, and writes a set of payloads, each a
valid brief (build_brief validates it) with a different set of effects:
real picks for every preset, plus sets chosen so that every effect the page
draws without the engine appears at least once.
  Run: python scripts/page-v3-effects-fixtures.py [slug] > fixtures.json
"""
import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from utils.design_brief import DesignBrief, build_brief  # noqa: E402
from utils.page_effects import EFFECTS, available, effects_problems, material, pick_effects  # noqa: E402

SLUG = sys.argv[1] if len(sys.argv) > 1 else "rp-exp"
PRESETS = ("candlelight", "bold-pantry", "jerusalem-stone", "studio", "field", "workshop")
PICS = ["hero", "hands", "rack", "shopfront", "item-challah", "item-babka", "item-sourdough"]

biz = json.load(urllib.request.urlopen(f"http://localhost:8001/api/marketplace/business/{SLUG}"))
biz["cover_url"] = "/images/mockups/bakery/hero.jpg"
gig = biz["listings"][0]
gig["gallery"] = [f"/images/mockups/bakery/{p}.jpg" for p in PICS[1:]]
photos = [{"ref": "cover", "kind": "photo"}] + [
    {"ref": f"listing:{gig['id']}:gallery:{i}", "kind": "photo"} for i in range(len(PICS) - 1)]

out = []


def add(label, biz, base, effects, show):
    brief = DesignBrief(**{**base.model_dump(), "effects": effects, "showstopper": show})
    out.append({"label": label, "biz": {**biz, "page_v3": True,
                                        "design_brief": json.loads(brief.model_dump_json())}})


# Their pictures and long name, then no pictures, a short name (the hero
# panel, letters animating) and ordering written as steps, which only an
# owner writes: between them every effect has its material.
STEPS = [{"text": t, "lang": lang, "source": "order_settings"} for lang, ts in (
    ("en", ("Choose your pot", "Order by Thursday", "We deliver Friday")),
    ("he", ("בוחרים סיר", "מזמינים עד חמישי", "משלוח ביום שישי"))) for t in ts]
OCCASIONS_HE = ["משפחה שמגיעה", "ארוחות שבת", "ליל חמישי", "קידושים", "שלום זכר", "שמחות בכל גודל"]
bare = {**biz, "name": "Lechem", "cover_url": None, "brand_film": None,
        "listings": [{**gig, "gallery": []}] + biz["listings"][1:]}
done = set()
for tag, b, pics in (("rich", biz, photos), ("bare", bare, [])):
    base = build_brief(b, photos=pics)
    # Steps everywhere, Hebrew occasions where the record has English ones:
    # the rails need their list in both languages.
    occ = base.model_dump()["occasions"]
    occ_he = [{"text": t, "lang": "he", "source": "description_he"} for t in OCCASIONS_HE[:len(occ)]]
    base = DesignBrief(**{**base.model_dump(), "steps": STEPS, "occasions": occ + occ_he})
    m = material(base, b)
    add(f"{tag}-none", b, base, [], "hero")   # the page as it was, to compare
    for preset in PRESETS:
        for seed in range(2 if tag == "rich" else 1):
            effects, show = pick_effects(m, preset, seed=seed)
            add(f"{tag}-{preset}-{seed}", b, base, effects, show)
    # Each bold moment the business can carry, on its own.
    for e in available(m):
        if EFFECTS[e]["tier"] == "peak":
            add(f"{tag}-peak-{e}", b, base, [e], e)
    # Cover every effect that is not a bold moment, greedily,
    # one valid set at a time, each with the hero as its bold moment.
    left = [e for e in available(m) if EFFECTS[e]["tier"] != "peak" and e not in done]
    n = 0
    while left:
        cur = []
        for e in list(left):
            if not effects_problems(cur + [e], "hero", m, with_record=True):
                cur.append(e)
                left.remove(e)
        if not cur:
            sys.exit(f"cannot place: {left}")
        add(f"{tag}-cover-{n}", b, base, cur, "hero")
        done.update(cur)
        n += 1

missing = {e for e in EFFECTS if EFFECTS[e]["tier"] != "peak"} - done
if missing:
    sys.exit(f"no fixture carries: {sorted(missing)}")
json.dump(out, sys.stdout)
print(f"{len(out)} payloads", file=sys.stderr)
