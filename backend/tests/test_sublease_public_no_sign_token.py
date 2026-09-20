"""The public sublease reads must never hand out a contract's sign_token.

It is the only credential on /contracts/sign/{token}; until 20 Sep 2026 both
public endpoints returned it to anyone (security scan F1). Pure: reads the
projection the routes use, no server or database needed.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def test_public_projection_drops_the_token():
    src = (Path(__file__).resolve().parents[1] / "routes" / "subleases.py").read_text(encoding="utf-8")
    assert '_PUBLIC_FIELDS = {"_id": 0, "sign_token": 0}' in src
    for fn in ("list_subleases", "get_sublease_by_id"):
        body = src.split(f"async def {fn}(")[1].split("\n@api_router")[0]
        assert "_PUBLIC_FIELDS" in body, fn
