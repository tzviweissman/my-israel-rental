"""The admin overview's numbers on the LIVE database, computed by the same code the page calls (read only).

    backend/.venv/Scripts/python scripts/live-overview.py [today|7d|30d|all]

Why (Tzvi, 17 Nov 2026): the live admin page needs his sign-in, so after a stats change the numbers were
checked with hand-written queries that could drift from what the page shows. This runs the endpoint
itself (get_admin_metrics in backend/routes/admin/core.py), which only counts and reads. Run it from the
repo root with the code you want to check checked out. The database address comes from Railway and is
never printed.
"""
import asyncio
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _railway_var(name: str) -> str:
    # shutil.which finds railway.cmd on Windows; shell=True with a list ran only "railway" on Mac and Linux (code review 20 Nov 2026).
    out = subprocess.run([shutil.which("railway") or "railway", "variables", "--service", "my-israel-rental Backend", "--kv"],
                         capture_output=True, text=True).stdout
    return next((ln.split("=", 1)[1] for ln in out.splitlines() if ln.startswith(name + "=")), "")


async def main(rng: str) -> None:
    # Set BEFORE routes.deps is imported: its load_dotenv never overrides a variable already set.
    for k in ("MONGO_URL", "DB_NAME"):
        os.environ[k] = _railway_var(k)
        if not os.environ[k]:
            sys.exit(f"could not read {k} from Railway (is the railway CLI linked here?)")
    os.environ.setdefault("JWT_SECRET", "unused-by-this-read")
    sys.path.insert(0, str(ROOT / "backend"))
    os.chdir(ROOT / "backend")
    from routes.admin.core import get_admin_metrics
    m = await get_admin_metrics(payload={"role": "admin"}, range=rng)
    print(f"range: {rng}")
    for group in ("flow", "stock"):
        for k, v in m[group].items():
            print(f"  {k:22} {v:>8,}")
    for k in ("views_since", "site_since", "restaurants_since"):
        print(f"  {k:22} {m.get(k)}")
    print("website orders by business:", json.dumps(m.get("website_orders"), ensure_ascii=False, indent=1))


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "all"))
