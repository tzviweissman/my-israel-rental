"""USD ↔ ILS exchange-rate helper.

We pull rates from the keyless https://open.er-api.com/v6/latest/USD
endpoint, cache them in-memory for 6 hours, and fall back to a sensible
default if the call fails — that way alert matching keeps working offline
or if the rate provider has an outage.
"""

from __future__ import annotations

import logging
import time
from typing import Final

import httpx

logger = logging.getLogger(__name__)

# Sensible recent default; only used if the live fetch fails on first call.
_FALLBACK_USD_TO_ILS: Final[float] = 3.75
_CACHE_TTL_SECONDS: Final[int] = 6 * 60 * 60  # 6 hours

_cache: dict[str, float] = {}
_cache_expiry: float = 0.0


async def _refresh_cache() -> None:
    """Fetch the latest USD→X rates and update the in-memory cache."""
    global _cache_expiry
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get("https://open.er-api.com/v6/latest/USD")
            r.raise_for_status()
            data = r.json()
            ils = float(data["rates"]["ILS"])
        _cache["USD->ILS"] = ils
        _cache["ILS->USD"] = 1.0 / ils
        _cache_expiry = time.time() + _CACHE_TTL_SECONDS
    except Exception as exc:  # noqa: BLE001 — network/parsing fallback
        logger.warning("FX fetch failed, using fallback rate: %s", exc)
        if "USD->ILS" not in _cache:
            _cache["USD->ILS"] = _FALLBACK_USD_TO_ILS
            _cache["ILS->USD"] = 1.0 / _FALLBACK_USD_TO_ILS
        # Try again sooner after a failure
        _cache_expiry = time.time() + 60 * 5  # 5 min


async def convert_amount(amount: float, from_currency: str, to_currency: str) -> float:
    """Convert ``amount`` between USD and ILS. Same-currency is a no-op."""
    src = (from_currency or "ILS").upper()
    dst = (to_currency or "ILS").upper()
    if src == dst:
        return amount
    if time.time() >= _cache_expiry:
        await _refresh_cache()
    rate_key = f"{src}->{dst}"
    rate = _cache.get(rate_key)
    if rate is None:
        # Unknown currency pair (e.g. EUR) — bail out without converting.
        logger.warning("No FX rate cached for %s; returning amount unchanged", rate_key)
        return amount
    return amount * rate
