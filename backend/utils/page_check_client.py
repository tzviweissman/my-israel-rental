"""Hands a page version to the page-check service (page-check/, its own
Railway service on the private network) to render and judge.

Off unless PAGE_CHECK_URL and PAGE_CHECK_SECRET are both set; the caller
then reports that no check was requested, and an admin can run the check
locally instead. The service answers at once and posts its verdict later
to /api/marketplace/businesses/{id}/page-versions/{vid}/check with the same
secret. Neither the secret nor the preview token is ever logged.
"""
from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger(__name__)


async def request_check(biz: dict, version_id: str, token: str) -> bool:
    url = os.environ.get("PAGE_CHECK_URL", "").rstrip("/")
    secret = os.environ.get("PAGE_CHECK_SECRET", "")
    if not (url and secret):
        return False
    job = {"business_id": biz["_id"], "slug": biz.get("slug") or biz["_id"], "version_id": version_id, "token": token}
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            r = await http.post(f"{url}/check", json=job, headers={"X-Page-Check-Secret": secret})
        if r.status_code >= 300:
            logger.warning("page check refused version %s: HTTP %s", version_id, r.status_code)
            return False
        return True
    except httpx.HTTPError as e:
        logger.warning("page check unreachable for version %s: %s", version_id, type(e).__name__)
        return False
