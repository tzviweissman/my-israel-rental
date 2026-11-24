"""Every paid Higgsfield picture or clip goes through here (Tzvi, 24 Nov 2026: "do both improvements").

Why: the same mistakes kept costing credits (the product came out different, prompts lost, model names guessed) and
nothing recorded what was spent or why a result was thrown away. This file does three things on every call:
  1. reads the price from the API before paying (POST /estimate, free) and stops above --max credits;
  2. writes one line per request to docs/higgsfield-log.jsonl (who, model, why, price, result), so spend is known;
  3. with product="<business>/<item>", attaches that business's saved product photo as Image 1 and adds its traits
     to the prompt (docs/products/<business>.json), so every picture of one product shows the same product.
     Higgsfield's own "Elements" cannot do this for us: the API has no way to make one, and only Kling 3.0 takes
     them (docs.higgsfield.ai, read 24 Nov 2026), so the saved product lives in our repo instead.

From a gen script (run with backend/.venv/Scripts/python; HF_KEY from backend/.env.local, never printed):
    sys.path.insert(0, str(ROOT / "scripts")); import hf
    hf.make("marketing-studio/image/sunburst", {"prompt": P, "aspect_ratio": "9:16", "resolution": "2k"},
            OUT / "pop-3.jpg", why="chicken-munch status ad, pop take 3", product="chicken-munch/hot-poppers")
  With a product, do not pass its photo yourself: it is put first in image_urls, so the prompt's "Image 1" is it.
  A finished file is never paid for again; a request already sent (<out>.req) is picked up, not sent twice.

From the command line:
    python scripts/hf.py price <model> '<json arguments>'      the API's price, nothing spent
    python scripts/hf.py models                                every model our scripts name: priced, rate or gone
    python scripts/hf.py spent [days]                         spend by month, model and business; every redo and why
    python scripts/hf.py verdict <out file> kept|redo "<why>"  record what happened to a result (redo needs a why)
    python scripts/hf.py product <business>/<item>             show a saved product
"""
from __future__ import annotations

import inspect
import json
import sys
import time
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOG = ROOT / "docs" / "higgsfield-log.jsonl"
PRODUCTS = ROOT / "docs" / "products"


def _client():
    from dotenv import load_dotenv
    load_dotenv(ROOT / "backend" / ".env.local")
    import higgsfield_client as h
    return h


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _write(entry: dict) -> None:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def _rel(p) -> str:
    p = Path(p).resolve()
    try:
        return p.relative_to(ROOT).as_posix()
    except ValueError:
        return str(p)


def _caller() -> str:
    for fr in reversed(inspect.stack()):
        if Path(fr.filename).resolve() != Path(__file__).resolve() and fr.filename.endswith(".py"):
            return _rel(fr.filename)
    return "scripts/hf.py"


def price(model: str, args: dict) -> dict | None:
    """The API's own price for these arguments: {"credits": float, "usd": float}, or None if it only describes a rate."""
    h = _client()
    try:
        r = h.sync_client._transport.request("POST", f"/estimate/{model}", json=args).json()
    except Exception as e:  # noqa: BLE001
        sys.exit(f"price check refused for {model}: {e} (a wrong model name is refused here, before any spend)")
    if r.get("type") == "estimate":
        return {"credits": float(r.get("credits") or 0), "usd": float(r.get("usd") or 0)}
    return _from_rate(r.get("pricing_description") or "", args)


CREDITS_PER_USD = 16.0  # from the API's own estimates on 24 Nov 2026: 12.48 credits = $0.78, 1.5 = $0.094


def _from_rate(desc: str, args: dict) -> dict | None:
    """Video models priced per second ("1080p: $0.0962" or "$0.13 per generated second") times the duration asked.
    Anything else (Marketing Studio's per-token rate) has no price before it runs: None, and make() wants credits=."""
    import re
    secs = args.get("duration")
    if not secs or "second" not in desc:
        return None
    rates = dict(re.findall(r"(\d+p|\dK):\s*\$(\d+(?:\.\d+)?)", desc))
    res = str(args.get("resolution", "")).lower()
    rate = next((float(v) for k, v in rates.items() if k.lower() == res), None)
    if rate is None and not rates:
        one = re.search(r"\$(\d+(?:\.\d+)?) per (?:generated |video )?second", desc)
        rate = float(one.group(1)) if one else None
    if rate is None:
        return None
    usd = rate * float(secs)
    return {"credits": round(usd * CREDITS_PER_USD, 2), "usd": round(usd, 3), "from_rate": True}


def models() -> None:
    """Every model id our gen scripts name, and what the API says about its price (nothing is spent)."""
    import re
    import subprocess
    files = subprocess.run(["git", "ls-files", "*.py", "*.mjs"], cwd=ROOT, capture_output=True, text=True).stdout.split()
    ids = set()
    for f in files:
        if "gen" in f or f.endswith(("ad_shots.py", "hf.py")):
            text = (ROOT / f).read_text(encoding="utf-8", errors="ignore")
            ids |= set(re.findall(r"""['"]((?:[a-z0-9.-]+/){2,3}[a-z0-9.-]+)['"]""", text))
    def is_path(i: str) -> bool:  # file and folder names caught by the same pattern
        first = i.split("/")[0]
        return (bool(re.search(r"\.[a-z]{2,4}$", i)) or first in ("gen", "src", "assets", "docs", "scripts", "frontend",
                "backend") or (ROOT / "scrollcraft" / "builds" / first).exists())

    h = _client()
    img, vid = "https://example.com/a.jpg", "https://example.com/a.mp4"
    tries = ({"prompt": "x", "duration": 5, "image_url": img}, {"prompt": "x", "duration": 5, "image_urls": [img]},
             {"prompt": "x", "duration": 5, "video_urls": [vid], "image_urls": [img]},
             {"prompt": "x", "video_url": vid, "image_urls": [img]}, {"prompt": "x"})
    for m in sorted(i for i in ids if not is_path(i)):
        kind = None
        for args in tries:
            try:
                r = h.sync_client._transport.request("POST", f"/estimate/{m}", json=args).json()
            except Exception as e:  # noqa: BLE001
                if "model_not_found" in str(e):
                    kind = "GONE (model_not_found): a script naming it gets nothing; switch it to a listed model"
                    break
                continue
            d = r.get("pricing_description", "")
            kind = ("price from the API" if r.get("type") == "estimate" else
                    "rate per second: hf works it out from duration and resolution" if "second" in d else
                    "rate only (per token or similar): pass credits= from get_cost")
            break
        print(f"{m:46} {kind or 'exists, but none of the test arguments fitted: read its page on docs.higgsfield.ai'}")


def product(ref: str) -> dict:
    """A saved product: docs/products/<business>.json -> items -> <item> {name, photo, traits}."""
    business, _, item = ref.partition("/")
    path = PRODUCTS / f"{business}.json"
    if not path.exists():
        sys.exit(f"no saved products for {business}: write {_rel(path)} (see docs/products/README.md)")
    items = json.loads(path.read_text(encoding="utf-8"))["items"]
    if item not in items:
        sys.exit(f"{business} has no saved product '{item}'; saved: {', '.join(items)}")
    p = dict(items[item])
    p["photo_path"] = ROOT / p["photo"]
    if not p["photo_path"].exists():
        sys.exit(f"saved product photo missing: {p['photo']}")
    return p


def _with_product(model: str, args: dict, ref: str) -> dict:
    p = product(ref)
    h = _client()
    args = dict(args)
    keep = (f"The {p['name']} stays exactly as in the real photo: {p['traits']} "
            f"Any extra piece or copy of it looks exactly the same. Keep its shape, colour, size, count and any words on it.")
    if "image_url" in args and "image_urls" not in args:
        # A clip: its start picture is already chosen; the product's traits still go into the words.
        args["prompt"] = f"{args.get('prompt', '')} {keep}".strip()
        return args
    photo = p["photo_path"]
    if photo.suffix.lower() not in (".jpg", ".jpeg", ".png"):  # webp and the like: sent as a jpg
        import tempfile
        from PIL import Image
        photo = Path(tempfile.gettempdir()) / f"hf-product-{photo.stem}.jpg"
        Image.open(p["photo_path"]).convert("RGB").save(photo, quality=95)
    args["image_urls"] = [h.upload_file(str(photo))] + list(args.get("image_urls") or [])
    args["prompt"] = f"Image 1 is the real {p['name']}. {keep} {args.get('prompt', '')}".strip()
    return args


def _download(result: dict, out: Path) -> bool:
    url = None
    if result.get("images"):
        url = result["images"][0].get("url")
    elif isinstance(result.get("video"), dict):
        url = result["video"].get("url")
    if not url:
        return False
    out.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, out)
    return True


def make(model: str, args: dict, out, *, why: str, product: str | None = None, max_credits: float | None = None,
         credits: float | None = None, poll_seconds: int = 10, timeout_minutes: int = 40) -> Path:
    """One paid request, priced first, logged, resumable. Returns the saved file; exits on failure.

    Video models priced per second are worked out from duration and resolution. A per-token rate (Marketing
    Studio image) has no price before it runs: pass credits= from get_cost; without it nothing is sent, so a limit can never be skipped (24 Nov 2026: a
    max_credits test went through on Marketing Studio because its price was unknown)."""
    out = Path(out).resolve()
    if not why.strip():
        sys.exit("say why this is being made (why=...), it goes in the spending log")
    if out.exists():
        print("already made, nothing spent:", _rel(out))
        return out
    h = _client()
    req_file = out.with_name(out.name + ".req")
    base = {"by": _caller(), "model": model, "why": why, "product": product, "out": _rel(out)}
    if req_file.exists():
        request_id = req_file.read_text().split()[0]
        print("picking up the request already sent:", request_id, flush=True)
        ctl = h.sync_client.get_request_controller(request_id)
    else:
        if product:
            args = _with_product(model, args, product)
        cost = price(model, args)
        if not cost:
            if credits is None:
                sys.exit(f"the API gives only a rate for {model}, not a price: read it with get_cost and pass "
                         f"credits=<that number>; nothing spent")
            cost = {"credits": float(credits), "usd": None}
        print(f"price: {cost['credits']:g} credits for {model}", flush=True)
        if max_credits is not None and cost["credits"] > max_credits:
            sys.exit(f"over the limit of {max_credits:g} credits; nothing spent")
        ctl = h.submit(model, arguments=args)
        request_id = ctl.request_id
        req_file.parent.mkdir(parents=True, exist_ok=True)
        req_file.write_text(request_id + "\n")
        _write({"t": _now(), **base, "request": request_id, "status": "sent",
                "credits": cost and cost["credits"], "usd": cost and cost["usd"],
                "prompt": str(args.get("prompt", ""))[:600]})
        print("sent", request_id, flush=True)
    deadline = time.time() + timeout_minutes * 60
    while time.time() < deadline:
        try:
            st = ctl.status()
        except Exception as e:  # noqa: BLE001
            print("status retry", type(e).__name__, flush=True)
            time.sleep(poll_seconds)
            continue
        if isinstance(st, h.Completed):
            ok = _download(h.sync_client.result(request_id) or {}, out)
            _write({"t": _now(), **base, "request": request_id, "status": "done" if ok else "empty"})
            if not ok:
                sys.exit("FAILED: finished with no picture or video")
            req_file.unlink(missing_ok=True)
            print("saved", _rel(out), flush=True)
            if product and out.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp"):
                _match_sheet(out, product)
            return out
        if isinstance(st, tuple(h.DONE_STATUSES)):
            _write({"t": _now(), **base, "request": request_id, "status": type(st).__name__.lower()})
            req_file.unlink(missing_ok=True)
            sys.exit(f"FAILED: {type(st).__name__} (failed, nsfw and cancelled requests are not charged)")
        time.sleep(poll_seconds)
    sys.exit(f"still running after {timeout_minutes} min; run again to pick up {request_id}")


def _match_sheet(out: Path, ref: str) -> None:
    """The picture beside the real product, piece by piece (scripts/product-match-sheet.py, ad rule A9.6)."""
    import subprocess
    sheet = out.with_name(out.stem + "-match.jpg")
    r = subprocess.run([sys.executable, str(ROOT / "scripts" / "product-match-sheet.py"), str(out),
                        str(product(ref)["photo_path"]), str(sheet)], capture_output=True, text=True)
    if r.returncode == 0:
        print("look at every piece beside the real one:", _rel(sheet))
    else:
        print("match sheet not made, compare by hand:", (r.stderr or r.stdout).strip()[-300:])


def verdict(out: str, what: str, why: str = "") -> None:
    if what not in ("kept", "redo"):
        sys.exit("verdict is kept or redo")
    if what == "redo" and not why.strip():
        sys.exit("a redo needs its reason, so the same mistake can be caught next time")
    _write({"t": _now(), "verdict": what, "out": _rel(out), "why": why})
    print("noted:", what, _rel(out))


def _business(r: dict) -> str:
    if r.get("product"):
        return r["product"].split("/")[0]
    parts = r["out"].split("/")
    for i, part in enumerate(parts[:-1]):
        if part in ("builds", "gen") and i + 1 < len(parts) - 1:
            return parts[i + 1]
    return "other"


def spent(days: int | None = None) -> None:
    if not LOG.exists():
        sys.exit("nothing logged yet")
    since = datetime.now(timezone.utc) - timedelta(days=days) if days else None
    rows = [json.loads(x) for x in LOG.read_text(encoding="utf-8").splitlines() if x.strip()]
    rows = [r for r in rows if not since or datetime.fromisoformat(r["t"]) >= since]
    sent = [r for r in rows if r.get("status") == "sent"]
    ends = {r["request"]: r["status"] for r in rows if r.get("request") and r.get("status") != "sent"}
    charged = [r for r in sent if ends.get(r["request"], "done") in ("done", "empty")]  # not ended yet counts as spent
    by = {"month": defaultdict(float), "model": defaultdict(float), "business": defaultdict(float)}
    for r in charged:
        c = r.get("credits") or 0
        by["month"][r["t"][:7]] += c
        by["model"][r["model"]] += c
        by["business"][_business(r)] += c
    print(f"{len(sent)} requests, {len(sent) - len(charged)} failed (not charged), "
          f"{sum(r.get('credits') or 0 for r in charged):g} credits (${sum(r.get('usd') or 0 for r in charged):.2f})")
    for k, d in by.items():
        print(f"\nby {k}:")
        for name, c in sorted(d.items(), key=lambda x: -x[1]):
            print(f"  {c:8.1f}  {name}")
    redos = [r for r in rows if r.get("verdict") == "redo"]
    print(f"\n{len(redos)} redos" + (":" if redos else ""))
    for r in redos:
        print(f"  {r['t'][:10]}  {r['out']}: {r['why']}")
    unjudged = {r["out"] for r in charged} - {r["out"] for r in rows if r.get("verdict")}
    if unjudged:
        print(f"\n{len(unjudged)} results with no verdict yet (python scripts/hf.py verdict <file> kept|redo \"why\")")


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] in ("-h", "--help"):
        sys.exit(__doc__)
    if a[0] == "price" and len(a) == 3:
        print(price(a[1], json.loads(a[2])) or "the API gives only a rate for this model")
    elif a[0] == "models":
        models()
    elif a[0] == "spent":
        spent(int(a[1]) if len(a) > 1 else None)
    elif a[0] == "verdict" and len(a) >= 3:
        verdict(a[1], a[2], " ".join(a[3:]))
    elif a[0] == "product" and len(a) == 2:
        p = product(a[1])
        print(json.dumps({k: v for k, v in p.items() if k != "photo_path"}, indent=2, ensure_ascii=False))
    else:
        sys.exit(__doc__)
