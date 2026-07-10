"""Services Marketplace — Jobs (customer-posted work requests).

Upwork-style reverse marketplace. Any signed-in user can post a job
saying "I need someone to…". Providers browse the Jobs board or get
notified via email when a matching job in their category lands, then
apply in-platform with a message + optional price quote. The customer
sees all applicants in one place and picks one.

Public read endpoints so jobs are indexable + browsable without a login
(same discovery pattern as gigs). Applying + editing + notifications
require auth.

Data model:
  * ``marketplace_jobs`` — one doc per posted job.
  * ``marketplace_job_applications`` — one per (job_id, provider_user_id).
    A provider can only apply to a given job once — enforced by
    (job_id + provider_user_id) idempotency in the POST handler.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from routes.deps import db, logger, verify_token
from utils.email import send_email
from utils.translate import translate_marketing_to_hebrew

from .shared import UTC, _validate_category, CATEGORIES, FRONTEND_URL


router = APIRouter(prefix="/marketplace", tags=["marketplace"])


# ---------------- Pydantic models ----------------

class JobIn(BaseModel):
    title: str = Field(..., min_length=6, max_length=140)
    category: str
    description: str = Field(..., min_length=10, max_length=4000)
    # Fixed amount ("I'll pay 800 ILS") or open ("open to offers").
    # No ranges in v1 — the UI stays lean.
    budget_type: str = Field("open", pattern="^(fixed|open)$")
    budget_amount: Optional[float] = None
    budget_currency: str = Field("ILS", pattern="^(ILS|USD)$")
    preferred_date: Optional[str] = None    # ISO YYYY-MM-DD
    area: str = Field(..., min_length=2, max_length=120)


class JobPatch(BaseModel):
    title: Optional[str] = Field(None, min_length=6, max_length=140)
    description: Optional[str] = Field(None, min_length=10, max_length=4000)
    budget_type: Optional[str] = Field(None, pattern="^(fixed|open)$")
    budget_amount: Optional[float] = None
    budget_currency: Optional[str] = Field(None, pattern="^(ILS|USD)$")
    preferred_date: Optional[str] = None
    area: Optional[str] = Field(None, min_length=2, max_length=120)
    status: Optional[str] = Field(None, pattern="^(open|awarded|closed)$")


class ApplicationIn(BaseModel):
    message: str = Field(..., min_length=10, max_length=2000)
    quoted_price: Optional[float] = None
    quoted_currency: str = Field("ILS", pattern="^(ILS|USD)$")


# ---------------- Helpers ----------------

MAX_OPEN_JOBS_PER_USER = 5


def _pub_job(doc: dict[str, Any]) -> dict[str, Any]:
    """Coerce a raw Mongo doc into the API-safe shape the frontend expects."""
    out = {k: v for k, v in doc.items() if k != "_id"}
    out["id"] = doc.get("_id")
    return out


async def _job_or_404(job_id: str) -> dict[str, Any]:
    job = await db.marketplace_jobs.find_one({"_id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


async def _translate_bg(job_id: str, title: str, description: str) -> None:
    """Background LLM translation to Hebrew — same pattern as gigs. Uses
    a background task so posting a job stays fast; the Hebrew fields
    appear once the LLM call returns."""
    try:
        title_he = await translate_marketing_to_hebrew(title) if title else None
        desc_he = await translate_marketing_to_hebrew(description) if description else None
        updates: dict[str, Any] = {}
        if title_he:
            updates["title_he"] = title_he
        if desc_he:
            updates["description_he"] = desc_he
        if updates:
            await db.marketplace_jobs.update_one({"_id": job_id}, {"$set": updates})
    except Exception as e:  # noqa: BLE001
        logger.warning("[jobs] Hebrew translation failed for %s: %s", job_id, e)


async def _notify_matching_providers(job: dict[str, Any]) -> None:
    """Fire an email to every provider whose gigs cover the job's
    category. Deduped by provider_user_id (a provider with several gigs
    in one category still gets one email). Runs as a background task —
    the posting flow returns immediately.
    """
    try:
        cat = job.get("category")
        if not cat:
            return
        # Find distinct provider_user_ids that have at least one
        # published gig in the matched category.
        provider_ids = await db.marketplace_gigs.distinct(
            "provider_user_id",
            {"category": cat, "status": "published"},
        )
        if not provider_ids:
            return
        # Fetch user emails in one round-trip. Skip the poster themselves.
        poster_id = job.get("poster_user_id")
        users = await db.users.find(
            {"_id": {"$in": list(provider_ids)}},
        ).to_list(len(provider_ids))
        # Pretty label for the category chip in the email.
        cat_label = next((c["label"] for c in CATEGORIES if c["slug"] == cat), cat)
        job_link = f"{FRONTEND_URL}/services/jobs/{job['_id']}"
        budget_line = ""
        if job.get("budget_type") == "fixed" and job.get("budget_amount"):
            sym = "₪" if job.get("budget_currency", "ILS") == "ILS" else "$"
            budget_line = f"<p style=\"margin:0 0 8px;color:#334\">💰 <b>{sym}{job['budget_amount']:g}</b> · fixed</p>"
        else:
            budget_line = "<p style=\"margin:0 0 8px;color:#334\">💰 Open to offers</p>"
        for user in users:
            uid = user.get("_id")
            if uid == poster_id:
                continue
            to_email = user.get("email")
            if not to_email:
                continue
            html = f"""
              <p>Hi {user.get('full_name') or 'there'},</p>
              <p>A new job in <b>{cat_label}</b> was just posted on MyIsraelRental
              that matches your services:</p>
              <div style="border:1px solid #eee;border-radius:12px;padding:16px;margin:16px 0;background:#fafafa">
                <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#111">{job.get('title')}</p>
                <p style="margin:0 0 8px;color:#555;font-size:14px">{(job.get('description') or '')[:280]}{'…' if len(job.get('description') or '') > 280 else ''}</p>
                {budget_line}
                <p style="margin:0 0 8px;color:#334">📍 {job.get('area', '')}</p>
                {('<p style="margin:0 0 8px;color:#334">🗓 ' + job['preferred_date'] + '</p>') if job.get('preferred_date') else ''}
              </div>
              <p><a href="{job_link}" style="display:inline-block;padding:10px 18px;background:#1E6A6A;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">View job &amp; apply</a></p>
              <p style="color:#666;font-size:12px;margin-top:24px">You're getting this because you have a published gig in <b>{cat_label}</b>. You can turn these off from your dashboard.</p>
            """
            await send_email(
                to_email,
                subject=f"New job in {cat_label}: {job.get('title')}",
                html_body=html,
                tag="job-match",
            )
    except Exception as e:  # noqa: BLE001
        logger.warning("[jobs] match-notify failed for %s: %s", job.get("_id"), e)


# ---------------- Public browse ----------------

@router.get("/jobs")
async def list_jobs(
    category: Optional[str] = None,
    area: Optional[str] = None,
    status: str = "open",
    limit: int = Query(60, ge=1, le=120),
):
    """Public job feed. Anyone can browse — no auth required."""
    q: dict[str, Any] = {"status": status}
    if category:
        q["category"] = category
    if area:
        q["area"] = {"$regex": f"^{area}", "$options": "i"}
    cur = db.marketplace_jobs.find(q).sort("created_at", -1).limit(limit)
    return [_pub_job(d) async for d in cur]


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    job = await _job_or_404(job_id)
    out = _pub_job(job)
    # Include poster display name + response bucket for social proof.
    poster = await db.users.find_one(
        {"_id": job.get("poster_user_id")},
        {"full_name": 1, "created_at": 1},
    ) or await db.users.find_one(
        {"id": job.get("poster_user_id")},
        {"full_name": 1, "created_at": 1},
    )
    if poster:
        out["poster"] = {
            "display_name": poster.get("full_name") or "Member",
            "member_since": (poster.get("created_at") or "")[:10],
        }
    # Applications count (public — social proof for the poster's job).
    out["applications_count"] = await db.marketplace_job_applications.count_documents(
        {"job_id": job_id},
    )
    return out


# ---------------- Authed ops ----------------

@router.post("/jobs")
async def create_job(payload: JobIn, user=Depends(verify_token)):
    _validate_category(payload.category)
    if payload.budget_type == "fixed" and not (payload.budget_amount and payload.budget_amount > 0):
        raise HTTPException(status_code=400, detail="Fixed budget needs an amount greater than 0")

    open_count = await db.marketplace_jobs.count_documents({
        "poster_user_id": user["user_id"],
        "status": "open",
    })
    if open_count >= MAX_OPEN_JOBS_PER_USER:
        raise HTTPException(
            status_code=400,
            detail=f"Only {MAX_OPEN_JOBS_PER_USER} open jobs allowed at a time — close one first",
        )

    now = datetime.now(UTC).isoformat()
    doc = {
        "_id": str(uuid.uuid4()),
        "poster_user_id": user["user_id"],
        "title": payload.title.strip(),
        "title_he": None,
        "category": payload.category,
        "description": payload.description.strip(),
        "description_he": None,
        "budget_type": payload.budget_type,
        "budget_amount": payload.budget_amount if payload.budget_type == "fixed" else None,
        "budget_currency": payload.budget_currency,
        "preferred_date": payload.preferred_date,
        "area": payload.area.strip(),
        "status": "open",
        "created_at": now,
        "updated_at": now,
    }
    await db.marketplace_jobs.insert_one(doc)

    # Fire the notification email + Hebrew translation asynchronously so
    # the POST returns fast. If either fails, the job is still live.
    asyncio.create_task(_notify_matching_providers(doc))
    asyncio.create_task(_translate_bg(doc["_id"], doc["title"], doc["description"]))

    return _pub_job(doc)


@router.patch("/jobs/{job_id}")
async def patch_job(job_id: str, payload: JobPatch, user=Depends(verify_token)):
    job = await _job_or_404(job_id)
    if job.get("poster_user_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your job")
    update = payload.model_dump(exclude_none=True)
    if not update:
        return _pub_job(job)
    update["updated_at"] = datetime.now(UTC).isoformat()
    if update.get("budget_type") == "fixed":
        amt = update.get("budget_amount", job.get("budget_amount"))
        if not (amt and amt > 0):
            raise HTTPException(status_code=400, detail="Fixed budget needs an amount greater than 0")
    await db.marketplace_jobs.update_one({"_id": job_id}, {"$set": update})
    job.update(update)
    return _pub_job(job)


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, user=Depends(verify_token)):
    job = await _job_or_404(job_id)
    if job.get("poster_user_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not your job")
    await db.marketplace_jobs.delete_one({"_id": job_id})
    await db.marketplace_job_applications.delete_many({"job_id": job_id})
    return {"ok": True}


# ---------------- Applications ----------------

@router.post("/jobs/{job_id}/apply")
async def apply_to_job(job_id: str, payload: ApplicationIn, user=Depends(verify_token)):
    job = await _job_or_404(job_id)
    if job.get("status") != "open":
        raise HTTPException(status_code=400, detail="This job is no longer accepting applications")
    if job.get("poster_user_id") == user["user_id"]:
        raise HTTPException(status_code=400, detail="You can't apply to your own job")

    # Idempotency — one application per provider per job.
    existing = await db.marketplace_job_applications.find_one({
        "job_id": job_id,
        "provider_user_id": user["user_id"],
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already applied to this job")

    now = datetime.now(UTC).isoformat()
    doc = {
        "_id": str(uuid.uuid4()),
        "job_id": job_id,
        "provider_user_id": user["user_id"],
        "message": payload.message.strip(),
        "quoted_price": payload.quoted_price,
        "quoted_currency": payload.quoted_currency,
        "status": "pending",
        "created_at": now,
    }
    await db.marketplace_job_applications.insert_one(doc)

    # Best-effort email to the poster so they see the new application.
    try:
        poster = await db.users.find_one({"_id": job.get("poster_user_id")}) \
            or await db.users.find_one({"id": job.get("poster_user_id")})
        applicant = await db.users.find_one({"_id": user["user_id"]}) \
            or await db.users.find_one({"id": user["user_id"]})
        if poster and poster.get("email"):
            job_link = f"{FRONTEND_URL}/services/jobs/{job_id}"
            html = f"""
              <p>Hi {poster.get('full_name') or 'there'},</p>
              <p><b>{applicant.get('full_name') or 'A provider'}</b> just applied to your job
              <i>"{job.get('title')}"</i>.</p>
              <p>Their message:</p>
              <blockquote style="border-left:3px solid #1E6A6A;padding:8px 12px;margin:12px 0;color:#333;background:#f5f7f7">
                {payload.message[:500]}{'…' if len(payload.message) > 500 else ''}
              </blockquote>
              <p><a href="{job_link}" style="display:inline-block;padding:10px 18px;background:#1E6A6A;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">See all applicants</a></p>
            """
            asyncio.create_task(send_email(
                poster["email"],
                subject=f"New applicant for \"{job.get('title')}\"",
                html_body=html,
                tag="job-application",
            ))
    except Exception as e:  # noqa: BLE001
        logger.warning("[jobs] applicant-notify failed: %s", e)

    out = {k: v for k, v in doc.items() if k != "_id"}
    out["id"] = doc["_id"]
    return out


@router.get("/jobs/{job_id}/applications")
async def list_applications(job_id: str, user=Depends(verify_token)):
    """Only the job's poster can see the full applicant list."""
    job = await _job_or_404(job_id)
    if job.get("poster_user_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only the job poster can view applications")

    apps = await db.marketplace_job_applications.find(
        {"job_id": job_id},
    ).sort("created_at", -1).to_list(200)

    # Enrich with provider display info in one round-trip.
    provider_ids = list({a["provider_user_id"] for a in apps})
    users = {u["_id"]: u for u in await db.users.find({"_id": {"$in": provider_ids}}).to_list(len(provider_ids))}
    providers = {p["user_id"]: p for p in await db.marketplace_providers.find({"user_id": {"$in": provider_ids}}).to_list(len(provider_ids))}
    out: list[dict[str, Any]] = []
    for a in apps:
        pid = a["provider_user_id"]
        u = users.get(pid, {})
        p = providers.get(pid, {})
        row = {k: v for k, v in a.items() if k != "_id"}
        row["id"] = a["_id"]
        row["provider"] = {
            "user_id": pid,
            "display_name": p.get("display_name") or u.get("full_name") or "Provider",
            "response_bucket": p.get("response_bucket"),
        }
        out.append(row)
    return out


@router.get("/my-jobs")
async def my_jobs(user=Depends(verify_token)):
    """Jobs the current user has posted, most recent first."""
    cur = db.marketplace_jobs.find({"poster_user_id": user["user_id"]}).sort("created_at", -1)
    rows = [_pub_job(d) async for d in cur]
    # Attach applications counts in a single aggregation.
    job_ids = [r["id"] for r in rows]
    if job_ids:
        pipeline = [
            {"$match": {"job_id": {"$in": job_ids}}},
            {"$group": {"_id": "$job_id", "n": {"$sum": 1}}},
        ]
        counts = {c["_id"]: c["n"] async for c in db.marketplace_job_applications.aggregate(pipeline)}
        for r in rows:
            r["applications_count"] = counts.get(r["id"], 0)
    return rows


@router.get("/provider/job-matches")
async def provider_job_matches(user=Depends(verify_token)):
    """Every open job whose category matches at least one of the calling
    provider's published gig categories. Used by the provider dashboard's
    "Job Requests" panel."""
    my_cats = await db.marketplace_gigs.distinct(
        "category",
        {"provider_user_id": user["user_id"], "status": "published"},
    )
    if not my_cats:
        return []
    cur = db.marketplace_jobs.find({
        "status": "open",
        "category": {"$in": my_cats},
        "poster_user_id": {"$ne": user["user_id"]},
    }).sort("created_at", -1).limit(50)
    rows = [_pub_job(d) async for d in cur]
    # Mark which jobs the provider has already applied to so the UI can
    # switch the CTA from "Apply" to "Applied".
    if rows:
        my_apps = await db.marketplace_job_applications.find(
            {"provider_user_id": user["user_id"], "job_id": {"$in": [r["id"] for r in rows]}},
            {"job_id": 1, "_id": 0},
        ).to_list(len(rows))
        applied_ids = {a["job_id"] for a in my_apps}
        for r in rows:
            r["already_applied"] = r["id"] in applied_ids
    return rows
