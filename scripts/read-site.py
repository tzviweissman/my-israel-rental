"""Try the sign-up's website reader (/socials/read) on a real business, before a reader change ships.

    backend/.venv/Scripts/python scripts/read-site.py https://burntmeatboards.com [--instagram URL] [--copy-photos] [--save FILE]

Prints what the sign-up form would be filled with: name, type, area, contacts, kashrut, delivery, FAQs, and every
product with its price, section and photo count. Costs one paid reader call (a few cents). Saves nothing: photos
are NOT copied to Cloudinary unless --copy-photos is given (each original address is counted as a copy instead).
Why it exists: on 16 Nov 2026 the unit tests passed while the real site came back as catering with 11 guessed
products instead of its 38; only a run on the real site showed it.
"""
import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND))
START = Path.cwd()  # --save FILE is relative to where the script was run from
os.chdir(BACKEND)
from dotenv import load_dotenv  # noqa: E402

# A worktree has no backend/.env of its own: fall back to the main checkout's.
for env in (BACKEND / ".env", BACKEND.parents[3] / "backend" / ".env" if len(BACKEND.parents) > 3 else None):
    if env and env.exists():
        load_dotenv(env)
        break


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("website")
    ap.add_argument("--instagram")
    ap.add_argument("--facebook")
    ap.add_argument("--copy-photos", action="store_true")
    ap.add_argument("--save", metavar="FILE", help="also write what the form is filled with, for the local ?fill=1 test (CLAUDE.md, Local dev)")
    args = ap.parse_args()

    import routes.marketplace.product_extract as pe
    import utils.cloud_storage as cs

    pe.check_rate = lambda *a, **k: None
    if not args.copy_photos:
        async def keep(url, **_):
            return {"url": url}
        cs.mirror_url_to_cloudinary = keep
    links = {k: v for k, v in {"website": args.website, "instagram": args.instagram, "facebook": args.facebook}.items() if v}
    out = await pe.read_socials(None, {"links": links}, {"user_id": "read-site-script"})
    f = out.get("fields") or {}
    if args.save:
        (START / args.save).write_text(json.dumps({**f, "socials": links}, ensure_ascii=False), encoding="utf8")
    items = f.pop("items", None) or []
    faqs = f.pop("faqs", None) or []
    print("Read:", ", ".join(out["read"]) or "nothing")
    print(json.dumps(f, ensure_ascii=False, indent=1))
    print(f"\nFAQs ({len(faqs)}):")
    for q in faqs:
        print(" -", q["q"])
    print(f"\nProducts ({len(items)}, {sum(bool(i.get('images')) for i in items)} with photos,"
          f" {sum(len(i.get('images') or []) for i in items)} photos):")
    for i in items:
        print(f" - {i.get('name')} | {i.get('price')} {i.get('currency') or ''} | {i.get('group') or 'main'}"
              f" | {len(i.get('images') or [])} photos")
    print("\nPictures:", json.dumps(out.get("pictures"), ensure_ascii=False)[:400])


asyncio.run(main())
