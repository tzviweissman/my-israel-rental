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
import re
import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from routes.deps import db, logger, verify_token
from utils.email import send_email
from utils.notification_tokens import create_deeplink_token, create_snooze_token
from utils.translate import translate_marketing_to_hebrew

from .notification_prefs import DEFAULT_MODE as DEFAULT_PREF_MODE
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


class SavedSearchIn(BaseModel):
    """Provider-defined subscription to matching new jobs.

    Category is required; area is optional and prefix-matched (so saving
    ``area='Tel Aviv'`` matches ``Tel Aviv, Florentin``, ``Tel Aviv``,
    etc.). Once saved, per-post pings for matching jobs are suppressed
    in favour of a single daily digest email.
    """
    category: str
    area: Optional[str] = Field(None, max_length=120)


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
    """Fire a per-post email to every provider whose gigs cover the
    job's category AND whose notification preference is 'instant' or
    'both' AND who hasn't snoozed the category. Runs as a background
    task — the posting flow returns immediately.

    Providers set to 'digest' mode are skipped here entirely (they'll
    see the job in tomorrow's grouped digest). Providers on the legacy
    saved-search opt-in are ALSO grandfathered into digest-only for
    backwards compat.
    """
    try:
        cat = job.get("category")
        if not cat:
            return
        # Distinct provider_user_ids with at least one published gig
        # in the matched category.
        provider_ids = await db.marketplace_gigs.distinct(
            "provider_user_id",
            {"category": cat, "status": "published"},
        )
        if not provider_ids:
            return

        # Load prefs + snoozes in one round-trip. Providers with no
        # prefs row default to 'digest' — matches the safer-default
        # policy so day-one signups don't get instantly spammed.
        prefs_by_uid: dict[str, dict[str, Any]] = {}
        async for p in db.job_notification_preferences.find(
            {"user_id": {"$in": provider_ids}},
        ):
            prefs_by_uid[p["user_id"]] = p

        # Legacy saved-search subscribers: digest-only grandfather.
        job_area = (job.get("area") or "").lower()
        digest_subscribed_ids: set[str] = set()
        async for s in db.marketplace_job_searches.find(
            {"category": cat, "provider_user_id": {"$in": list(provider_ids)}},
        ):
            saved_area = (s.get("area") or "").strip().lower()
            if not saved_area or job_area.startswith(saved_area):
                digest_subscribed_ids.add(s["provider_user_id"])

        # Users are keyed by UUID stored in `id` (mirror of user_id used
        # everywhere else). Querying by `_id` (ObjectId) always missed
        # and silently sent zero emails — matches the same bug fixed in
        # _list_applications last iteration.
        poster_id = job.get("poster_user_id")
        users_by_id = {
            u["id"]: u
            async for u in db.users.find({"id": {"$in": provider_ids}})
        }
        cat_label = next((c["label"] for c in CATEGORIES if c["slug"] == cat), cat)
        now_iso = datetime.now(UTC).isoformat()

        # Format the subject line once. Spec:
        # "New job match: [Category] in [Location] — $[Budget]"
        # Budget-open jobs drop the em-dash tail so the subject stays clean.
        sym = "₪" if job.get("budget_currency", "ILS") == "ILS" else "$"
        if job.get("budget_type") == "fixed" and job.get("budget_amount"):
            budget_subject = f" — {sym}{int(job['budget_amount'])}"
            budget_body = f"{sym}{int(job['budget_amount'])} · fixed"
        else:
            budget_subject = ""
            budget_body = "Open to offers"
        subject = f"New job match: {cat_label} in {job.get('area', 'Israel')}{budget_subject}"

        timeline_body = job.get("preferred_date") or "Flexible"

        for uid in provider_ids:
            if uid == poster_id:
                continue
            user = users_by_id.get(uid)
            if not user:
                continue
            to_email = user.get("email")
            if not to_email:
                continue

            # Mode check. Default = 'digest' so untouched providers get
            # the daily digest instead of getting bombed on day one.
            pref = prefs_by_uid.get(uid, {})
            mode = pref.get("mode") or DEFAULT_PREF_MODE
            if uid in digest_subscribed_ids and mode == DEFAULT_PREF_MODE:
                # Legacy saved-search subscriber — grandfather them into
                # digest-only silence for the instant channel.
                continue
            if mode == "digest":
                continue

            # Snooze check.
            snoozed = any(
                s.get("category") == cat and (s.get("until") or "") > now_iso
                for s in (pref.get("snoozed_categories") or [])
            )
            if snoozed:
                continue

            # Signed deep-link so the CTA lands them logged-in.
            deeplink = create_deeplink_token(uid, job["_id"])
            snooze_tok = create_snooze_token(uid, cat)
            cta_url = f"{FRONTEND_URL}/auth/deeplink?t={deeplink}&goto=/services/jobs/{job['_id']}"
            snooze_url = f"{FRONTEND_URL}/notification-snooze?t={snooze_tok}"
            settings_url = f"{FRONTEND_URL}/dashboard/settings?section=notifications"

            html = f"""
              <p>Hi {user.get('name') or 'there'},</p>
              <p>A new job in <b>{cat_label}</b> just went live on MyIsraelRental — and it matches what you offer.</p>
              <div style="border:1px solid #eee;border-radius:12px;padding:18px;margin:18px 0;background:#fafafa">
                <p style="margin:0 0 10px;font-size:16px;font-weight:700;color:#111">{job.get('title')}</p>
                <p style="margin:0 0 12px;color:#555;font-size:14px;line-height:1.5">{(job.get('description') or '')[:280]}{'…' if len(job.get('description') or '') > 280 else ''}</p>
                <table cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;color:#334">
                  <tr><td style="padding:2px 0;width:80px;color:#888">Budget</td><td style="padding:2px 0"><b>{budget_body}</b></td></tr>
                  <tr><td style="padding:2px 0;color:#888">Location</td><td style="padding:2px 0"><b>{job.get('area','')}</b></td></tr>
                  <tr><td style="padding:2px 0;color:#888">Timeline</td><td style="padding:2px 0"><b>{timeline_body}</b></td></tr>
                </table>
              </div>
              <p style="margin:24px 0">
                <a href="{cta_url}" style="display:inline-block;padding:12px 22px;background:#1E6A6A;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">View &amp; Bid</a>
              </p>
              <p style="color:#666;font-size:12px;margin-top:28px;line-height:1.6">
                Getting too many? <a href="{snooze_url}" style="color:#1E6A6A">Snooze {cat_label} for 7 days</a>
                &nbsp;·&nbsp; <a href="{settings_url}" style="color:#1E6A6A">Notification settings</a>
              </p>
            """
            await send_email(
                to_email,
                subject=subject,
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
        q["area"] = {"$regex": f"^{re.escape(area)}", "$options": "i"}
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
    # Users store their UUID in the `id` field (mirror of user_id used
    # everywhere else in the app); `_id` is the raw Mongo ObjectId which
    # nothing else references. Key the dict by `id` to match how
    # provider_user_id is written to applications.
    users = {
        u["id"]: u
        async for u in db.users.find({"id": {"$in": provider_ids}})
    }
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
            # The users collection stores the readable label as `name`
            # (not `full_name`). Prefer the provider profile's
            # display_name when set, otherwise the user's name, and
            # finally a neutral fallback so the row never renders blank.
            "display_name": p.get("display_name") or u.get("name") or "Provider",
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


# ---------------- Saved searches (daily digest) ----------------

@router.post("/job-searches")
async def create_saved_search(payload: SavedSearchIn, user=Depends(verify_token)):
    _validate_category(payload.category)
    # De-dupe on (user, category, normalised area) so re-clicking Save
    # doesn't create ghosts.
    normalised_area = (payload.area or "").strip() or None
    existing = await db.marketplace_job_searches.find_one({
        "provider_user_id": user["user_id"],
        "category": payload.category,
        "area": normalised_area,
    })
    if existing:
        raise HTTPException(status_code=400, detail="You already have this search saved")
    now = datetime.now(UTC).isoformat()
    doc = {
        "_id": str(uuid.uuid4()),
        "provider_user_id": user["user_id"],
        "category": payload.category,
        "area": normalised_area,
        "created_at": now,
        "last_digest_sent_at": None,
    }
    await db.marketplace_job_searches.insert_one(doc)
    out = {k: v for k, v in doc.items() if k != "_id"}
    out["id"] = doc["_id"]
    return out


@router.get("/job-searches")
async def list_saved_searches(user=Depends(verify_token)):
    cur = db.marketplace_job_searches.find({"provider_user_id": user["user_id"]}).sort("created_at", -1)
    out = []
    async for s in cur:
        row = {k: v for k, v in s.items() if k != "_id"}
        row["id"] = s["_id"]
        out.append(row)
    return out


@router.delete("/job-searches/{search_id}")
async def delete_saved_search(search_id: str, user=Depends(verify_token)):
    res = await db.marketplace_job_searches.delete_one({
        "_id": search_id,
        "provider_user_id": user["user_id"],
    })
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Saved search not found")
    return {"ok": True}


def _admin_only(user: dict) -> None:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")


@router.post("/job-searches/send-digest")
async def send_digest(user=Depends(verify_token)):
    """Admin-triggered (or cron-triggered) daily digest.

    Every saved search whose ``last_digest_sent_at`` is older than 20h
    contributes to one email per provider — grouped by category, capped
    at 10 jobs per category with a "+N more, view all" tail, and with a
    "Adjust your notification settings" footer link. Idempotent within
    the 20h window.

    Providers whose ``mode`` is 'instant' are opted OUT of the digest
    (they get per-post pings instead).
    """
    _admin_only(user)
    from datetime import timedelta
    now = datetime.now(UTC)
    cutoff_iso = (now - timedelta(hours=20)).isoformat()

    searches = await db.marketplace_job_searches.find({
        "$or": [
            {"last_digest_sent_at": None},
            {"last_digest_sent_at": {"$lt": cutoff_iso}},
        ],
    }).to_list(500)
    if not searches:
        return {"sent": 0, "reason": "nothing due"}

    # Group by user so a provider with multiple saved searches gets one
    # email with all matches in one place instead of several.
    by_user: dict[str, list[dict]] = {}
    for s in searches:
        by_user.setdefault(s["provider_user_id"], []).append(s)

    # Pre-load prefs for every user in one round-trip so we can filter
    # digest-off ('instant' mode) and honor per-category snoozes.
    prefs_by_uid: dict[str, dict[str, Any]] = {}
    async for p in db.job_notification_preferences.find(
        {"user_id": {"$in": list(by_user.keys())}},
    ):
        prefs_by_uid[p["user_id"]] = p
    now_iso = now.isoformat()

    sent_count = 0
    for uid, user_searches in by_user.items():
        pref = prefs_by_uid.get(uid, {})
        mode = pref.get("mode") or DEFAULT_PREF_MODE
        if mode == "instant":
            # This user wants per-post pings ONLY, no daily digest.
            continue
        snoozed_cats = {
            s["category"]
            for s in (pref.get("snoozed_categories") or [])
            if (s.get("until") or "") > now_iso
        }

        u = await db.users.find_one({"id": uid}) or await db.users.find_one({"_id": uid})
        if not u or not u.get("email"):
            continue

        # Filter saved searches by snooze state.
        active_searches = [s for s in user_searches if s["category"] not in snoozed_cats]
        if not active_searches:
            continue

        # Build a match query that OR's every active saved search — one
        # round-trip against the jobs collection.
        or_clauses: list[dict[str, Any]] = []
        min_created = min(
            (s.get("last_digest_sent_at") or s.get("created_at") or "1970-01-01")
            for s in active_searches
        )
        for s in active_searches:
            clause: dict[str, Any] = {"category": s["category"]}
            if s.get("area"):
                clause["area"] = {"$regex": f"^{re.escape(s['area'])}", "$options": "i"}
            or_clauses.append(clause)
        jobs = await db.marketplace_jobs.find({
            "status": "open",
            "poster_user_id": {"$ne": uid},
            "created_at": {"$gte": min_created},
            "$or": or_clauses,
        }).sort("created_at", -1).limit(200).to_list(200)
        if not jobs:
            continue

        # Group by category. Within each group, sort by newest first
        # and cap at 10 with a "+N more" tail. Category label maps to
        # the pretty CATEGORIES table so the section header reads
        # "Home Repair · 3 new jobs" not "home-repair · 3 new jobs".
        by_cat: dict[str, list[dict]] = {}
        for j in jobs:
            by_cat.setdefault(j["category"], []).append(j)

        cat_label_map = {c["slug"]: c["label"] for c in CATEGORIES}
        sections_html: list[str] = []
        total_shown = 0
        for cat_slug, cat_jobs in sorted(by_cat.items(), key=lambda x: -len(x[1])):
            cat_label = cat_label_map.get(cat_slug, cat_slug)
            visible = cat_jobs[:10]
            hidden = len(cat_jobs) - len(visible)
            total_shown += len(visible)
            rows_html = "".join(
                f"<li style=\"margin-bottom:10px;list-style:none;padding-left:0\">"
                f"<a href=\"{FRONTEND_URL}/services/jobs/{j['_id']}\" "
                f"style=\"color:#1E6A6A;font-weight:600;text-decoration:none\">{j.get('title')}</a>"
                f"<br/><span style=\"color:#666;font-size:12px\">"
                f"📍 {j.get('area','')}"
                f"{' · 💰 ' + ('₪' if j.get('budget_currency','ILS') == 'ILS' else '$') + str(int(j['budget_amount'])) if j.get('budget_type') == 'fixed' and j.get('budget_amount') else ' · 💰 open to offers'}"
                f"{' · 🗓 ' + j['preferred_date'] if j.get('preferred_date') else ''}"
                "</span></li>"
                for j in visible
            )
            more_line = ""
            if hidden > 0:
                more_url = f"{FRONTEND_URL}/services/jobs?category={cat_slug}"
                more_line = (
                    f"<p style=\"margin:4px 0 12px 0;font-size:12px\">"
                    f"<a href=\"{more_url}\" style=\"color:#1E6A6A\">+{hidden} more, view all →</a>"
                    "</p>"
                )
            snooze_tok = create_snooze_token(uid, cat_slug)
            snooze_url = f"{FRONTEND_URL}/notification-snooze?t={snooze_tok}"
            sections_html.append(f"""
              <div style="margin:20px 0">
                <h3 style="margin:0 0 8px;color:#0F3A3A;font-size:14px;text-transform:uppercase;letter-spacing:0.5px">
                  {cat_label} <span style="color:#888;font-weight:400">· {len(cat_jobs)} new</span>
                </h3>
                <ul style="padding:0;margin:0">{rows_html}</ul>
                {more_line}
                <p style="margin:4px 0 0;font-size:11px">
                  <a href="{snooze_url}" style="color:#999">Snooze {cat_label} for 7 days</a>
                </p>
              </div>
            """)

        settings_url = f"{FRONTEND_URL}/dashboard/settings?section=notifications"
        html = f"""
          <p>Hi {u.get('name') or 'there'},</p>
          <p>Here are the new jobs matching your saved searches — grouped by category for a quick scan:</p>
          {''.join(sections_html)}
          <hr style="border:none;border-top:1px solid #eee;margin:28px 0"/>
          <p style="color:#666;font-size:12px;line-height:1.6">
            Want fewer emails?
            <a href="{settings_url}" style="color:#1E6A6A;font-weight:600">Adjust your notification settings →</a>
          </p>
        """
        await send_email(
            u["email"],
            subject=f"Your daily jobs digest — {total_shown} new match{'es' if total_shown != 1 else ''}",
            html_body=html,
            tag="job-digest",
        )
        sent_count += 1

    # Stamp all processed searches so they don't re-fire until tomorrow.
    ids = [s["_id"] for s in searches]
    await db.marketplace_job_searches.update_many(
        {"_id": {"$in": ids}},
        {"$set": {"last_digest_sent_at": now.isoformat()}},
    )
    return {"sent": sent_count, "searches_processed": len(searches)}
