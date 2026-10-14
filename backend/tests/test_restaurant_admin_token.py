"""The restaurant admin token (routes/restaurants.py, restaurant_admin).

A header with non-ASCII characters made hmac.compare_digest raise, so the
API answered 500 instead of 401 (site audit, 13 Oct 2026). Any wrong token
is just not the token.
"""
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

SECRET = "s" * 40


class _Req:
    def __init__(self, token):
        self.headers = {"X-Restaurant-Admin-Token": token} if token is not None else {}


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setenv("RESTAURANT_ADMIN_TOKEN", SECRET)


@pytest.mark.asyncio
@pytest.mark.parametrize("token", ["wrong", "סוד", "tokén" * 8, ""])
async def test_a_wrong_token_is_401_not_500(token):
    from routes.restaurants import restaurant_admin
    with pytest.raises(HTTPException) as e:
        await restaurant_admin(_Req(token), None)
    assert e.value.status_code == 401


@pytest.mark.asyncio
async def test_the_right_token_is_admin():
    from routes.restaurants import restaurant_admin
    out = await restaurant_admin(_Req(SECRET), None)
    assert out["role"] == "admin"
