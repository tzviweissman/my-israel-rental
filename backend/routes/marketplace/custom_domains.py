"""A business's own web address (Tzvi, 15 Oct 2026, from the Shopify list:
"a business can use its own domain, e.g. www.mybakery.co.il").

How a request on www.mybakery.co.il reaches the business's page:

  1. The domain is added to the frontend service on Railway, which gives
     two DNS records: a CNAME to route it and a TXT to prove ownership.
     Railway then issues the HTTPS certificate.
  2. The owner adds both records where they bought the domain.
  3. frontend/server.js asks `/marketplace/domains/{host}` which business
     the host belongs to and serves that business's page at "/", exactly
     as it does for <slug>.myisraelrental.com. Any other path goes to the
     main site. The page's API calls go to /api on the same host, which
     server.js proxies, so nothing cross-site is involved.

Step 1 is automatic when the backend has a Railway token
(RAILWAY_PROJECT_TOKEN, a project token for the production environment,
or RAILWAY_API_TOKEN). Without one, the request is saved, the site's
admins are emailed to add the domain in Railway, and the owner's page
says it is being set up. Either way "Check now" calls the domain's own
/api/health over HTTPS: only a 200 from our server, through a valid
certificate, marks it live.

The owner only (not staff): it changes where the business lives.
"""
from __future__ import annotations

import os
import re
from datetime import datetime
from typing import Any, Optional
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from routes.deps import db, logger, verify_token
from utils.rate_limit import check_rate

router = APIRouter(prefix="/marketplace", tags=["marketplace"])
IL = ZoneInfo("Asia/Jerusalem")

RAILWAY_API = "https://backboard.railway.com/graphql/v2"
# The production frontend service ("My Israel Rental Frontend"). Railway
# sets RAILWAY_PROJECT_ID / RAILWAY_ENVIRONMENT_ID in every container.
_PROJECT = os.environ.get("RAILWAY_PROJECT_ID", "f8293b5e-79d6-4b60-8ed1-fd5ffc72ff0d")
_ENV = os.environ.get("RAILWAY_ENVIRONMENT_ID", "883ca4de-b069-4084-9777-9e7321ce09a3")
_FRONTEND = os.environ.get("RAILWAY_FRONTEND_SERVICE_ID", "87986381-12d7-4138-9783-0617a030995f")

_LABEL = r"(?!-)[a-z0-9-]{1,63}(?<!-)"
_DOMAIN = re.compile(rf"^(?:{_LABEL}\.)+[a-z]{{2,24}}$")
# Hosts that are already ours, or a platform's: never a business's domain.
_OURS = ("myisraelrental.com", "railway.app", "railway.com", "up.railway.app", "localhost")


def norm_domain(raw: str) -> str:
    d = (raw or "").strip().lower()
    d = re.sub(r"^[a-z]+://", "", d).split("/")[0].split("?")[0].split("#")[0]
    return re.sub(r":\d+$", "", d).rstrip(".")


def _check_domain(d: str) -> None:
    if len(d) > 253 or not _DOMAIN.match(d):
        raise HTTPException(status_code=422, detail="That does not look like a web address. Write it like www.mybakery.co.il")
    if any(d == o or d.endswith("." + o) for o in _OURS):
        raise HTTPException(status_code=422, detail="Use an address you own, not one of ours")


def _now() -> str:
    return datetime.now(IL).isoformat(timespec="seconds")


async def _owner_business(business_id: str, user: dict[str, Any]) -> dict[str, Any]:
    from utils.business_access import business_access
    return await business_access(db, business_id, user, None)


# ---------------------------------------------------------------------------
# Railway
# ---------------------------------------------------------------------------

def _railway_headers() -> Optional[dict[str, str]]:
    if os.environ.get("RAILWAY_PROJECT_TOKEN"):
        return {"Project-Access-Token": os.environ["RAILWAY_PROJECT_TOKEN"]}
    if os.environ.get("RAILWAY_API_TOKEN"):
        return {"Authorization": f"Bearer {os.environ['RAILWAY_API_TOKEN']}"}
    return None


async def _railway(query: str, variables: dict[str, Any]) -> dict[str, Any]:
    headers = _railway_headers()
    if not headers:
        raise RuntimeError("no Railway token")
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.post(RAILWAY_API, json={"query": query, "variables": variables}, headers=headers)
    body = r.json()
    if body.get("errors"):
        raise RuntimeError("; ".join(e.get("message", "") for e in body["errors"])[:300])
    return body["data"]


_STATUS = "status { verificationToken certificateStatus dnsRecords { hostlabel requiredValue currentValue status } }"


def _records(domain: str, status: dict[str, Any]) -> list[dict[str, Any]]:
    """What the owner adds at their DNS provider, from Railway's answer."""
    out = []
    for rec in status.get("dnsRecords") or []:
        host = rec.get("hostlabel") or "@"
        out.append({"type": "CNAME", "name": host, "value": rec.get("requiredValue"), "ok": rec.get("status") == "VALID"})
    if status.get("verificationToken"):
        host = (out[0]["name"] if out else "@")
        out.append({"type": "TXT", "name": "_railway-verify" + ("" if host == "@" else "." + host),
                    "value": status["verificationToken"], "ok": None})
    return out


async def _connect(domain: str) -> dict[str, Any]:
    data = await _railway(
        f"mutation c($input: CustomDomainCreateInput!) {{ customDomainCreate(input: $input) {{ id domain {_STATUS} }} }}",
        {"input": {"projectId": _PROJECT, "environmentId": _ENV, "serviceId": _FRONTEND, "domain": domain}})
    cd = data["customDomainCreate"]
    return {"railway_id": cd["id"], "records": _records(domain, cd.get("status") or {}),
            "certificate": (cd.get("status") or {}).get("certificateStatus")}


async def _refresh(railway_id: str, domain: str) -> dict[str, Any]:
    data = await _railway(f"query q($id: String!, $p: String!) {{ customDomain(id: $id, projectId: $p) {{ id {_STATUS} }} }}",
                          {"id": railway_id, "p": _PROJECT})
    st = (data.get("customDomain") or {}).get("status") or {}
    return {"records": _records(domain, st), "certificate": st.get("certificateStatus")}


async def _disconnect(railway_id: str) -> None:
    await _railway("mutation d($id: String!) { customDomainDelete(id: $id) }", {"id": railway_id})


async def _tell_admins(biz: dict[str, Any], domain: str) -> None:
    from .orders import _email, _esc
    async for a in db.users.find({"role": "admin"}, {"email": 1}).limit(5):
        await _email(a.get("email"), f"Connect a domain: {domain}",
                     f"<p>{_esc(biz.get('name'))} wants to use <b>{_esc(domain)}</b> for its page.</p>"
                     "<p>Add it to the frontend service in Railway (Settings, Networking, Custom domain). "
                     "The owner's dashboard shows the DNS records once it is added there.</p>",
                     tag="custom-domain-request")


# ---------------------------------------------------------------------------
# the owner's endpoints
# ---------------------------------------------------------------------------

def _out(biz: dict[str, Any]) -> dict[str, Any]:
    cd = biz.get("custom_domain") or {}
    return {"domain": cd.get("domain"), "status": cd.get("status"), "records": cd.get("records") or [],
            "checked_at": cd.get("checked_at"), "automatic": _railway_headers() is not None}


class DomainIn(BaseModel):
    domain: str = Field(..., min_length=4, max_length=260)


@router.get("/businesses/{business_id}/custom-domain")
async def get_domain(business_id: str, user=Depends(verify_token)):
    return _out(await _owner_business(business_id, user))


@router.put("/businesses/{business_id}/custom-domain")
async def set_domain(business_id: str, body: DomainIn, user=Depends(verify_token)):
    biz = await _owner_business(business_id, user)
    d = norm_domain(body.domain)
    _check_domain(d)
    cur = biz.get("custom_domain") or {}
    if cur.get("domain") == d:
        return _out(biz)
    if cur.get("railway_id"):
        try:
            await _disconnect(cur["railway_id"])
        except Exception as e:  # the old one lingering in Railway is harmless
            logger.warning("[domains] could not remove %s: %s", cur.get("domain"), e)
    doc: dict[str, Any] = {"domain": d, "status": "setting_up", "records": [], "added_at": _now()}
    try:
        await db.businesses.update_one({"_id": business_id}, {"$set": {"custom_domain": doc, "custom_domain_host": d}})
    except DuplicateKeyError as exc:
        raise HTTPException(status_code=409, detail="Another business on the site already uses that address") from exc
    if _railway_headers():
        try:
            doc.update(await _connect(d), status="waiting_dns")
        except Exception as e:
            logger.warning("[domains] connect %s failed: %s", d, e)
            doc["status"] = "setting_up"
            await _tell_admins(biz, d)
    else:
        await _tell_admins(biz, d)
    await db.businesses.update_one({"_id": business_id}, {"$set": {"custom_domain": doc}})
    logger.info("[domains] business=%s domain=%s status=%s", business_id, d, doc["status"])
    return _out({**biz, "custom_domain": doc})


@router.post("/businesses/{business_id}/custom-domain/check")
async def check_domain(business_id: str, request: Request, user=Depends(verify_token)):
    check_rate(request, bucket="domain_check", limit=30, window_seconds=600)
    biz = await _owner_business(business_id, user)
    cd = biz.get("custom_domain") or {}
    if not cd.get("domain"):
        raise HTTPException(status_code=404, detail="No address set")
    if cd.get("railway_id") and _railway_headers():
        try:
            cd.update(await _refresh(cd["railway_id"], cd["domain"]))
        except Exception as e:
            logger.warning("[domains] refresh %s failed: %s", cd["domain"], e)
    cd["status"] = "live" if await reaches_us(cd["domain"]) else ("waiting_dns" if cd.get("records") else "setting_up")
    cd["checked_at"] = _now()
    await db.businesses.update_one({"_id": business_id}, {"$set": {"custom_domain": cd}})
    return _out({**biz, "custom_domain": cd})


async def reaches_us(domain: str) -> bool:
    """HTTPS to the domain answers with our health check: DNS, routing and
    the certificate are all in place."""
    try:
        async with httpx.AsyncClient(timeout=8, follow_redirects=False) as c:
            r = await c.get(f"https://{domain}/api/health")
        return r.status_code == 200 and "status" in r.text
    except Exception:
        return False


@router.delete("/businesses/{business_id}/custom-domain")
async def remove_domain(business_id: str, user=Depends(verify_token)):
    biz = await _owner_business(business_id, user)
    cd = biz.get("custom_domain") or {}
    if cd.get("railway_id") and _railway_headers():
        try:
            await _disconnect(cd["railway_id"])
        except Exception as e:
            logger.warning("[domains] could not remove %s: %s", cd.get("domain"), e)
    await db.businesses.update_one({"_id": business_id}, {"$unset": {"custom_domain": "", "custom_domain_host": ""}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# which business a host belongs to (frontend/server.js)
# ---------------------------------------------------------------------------

@router.get("/domains/{host}")
async def resolve_domain(host: str, request: Request):
    check_rate(request, bucket="domain_resolve", limit=600, window_seconds=60)
    biz = await db.businesses.find_one({"custom_domain_host": norm_domain(host), "active": {"$ne": False}}, {"slug": 1})
    if not biz or not biz.get("slug"):
        raise HTTPException(status_code=404, detail="Not a business address")
    return {"slug": biz["slug"]}


async def ensure_domain_indexes() -> None:
    await db.businesses.create_index("custom_domain_host", unique=True, sparse=True)
