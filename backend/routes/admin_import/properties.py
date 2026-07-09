"""Admin property-import commit + related property repair endpoints.

Endpoints:
  * POST /admin/import/properties/commit  — bulk-create from mapped CSV
  * POST /admin/properties/remirror       — refresh image URLs to Cloudinary
  * POST /admin/properties/repair-prices  — patch prices that landed in wrong fields

The commit path invokes ``_background_mirror_properties`` — a
fire-and-forget task that walks every newly-created listing and re-hosts
its images on Cloudinary.

Extracted from ``admin_import.py`` in the 2026-07 refactor.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from routes.deps import db, logger, verify_token
from utils.cloud_storage import mirror_url_to_cloudinary
from utils.dedupe import find_duplicate

from .helpers import (
    PROPERTY_FIELDS,
    _ai_map_columns,
    _build_property_doc,
    _parse_csv,
    _resolve_or_create_owner,
    _sniff_currency,
    _split_urls,
)

router = APIRouter()
api_router = router


class PropertyCommitRequest(BaseModel):
    csv_text: str
    column_map: dict[str, str | None] | None = None  # admin overrides
    mirror_images: bool = True
    # Default rental_type applied to every row whose CSV doesn't carry one.
    # Critical when the file is e.g. "vacation_rentals.csv" without a
    # rental_type column — previously every row silently defaulted to
    # "long-term", which then sat invisible on the Vacation tab. The
    # importer UI now surfaces this as a required dropdown.
    default_rental_type: str = "long-term"
    # "create" (default) → skip rows whose (owner + address + rental_type)
    #   already exists, insert the rest.
    # "sync_photos" → when a duplicate is found, REPLACE its images/videos
    #   with the CSV's and re-trigger mirroring. New rows still create.
    #   Use after a failed/partial import to backfill missing photos
    #   without re-creating the listings.
    mode: str = "create"


@api_router.post("/admin/import/properties/commit")
async def commit_property_import(req: PropertyCommitRequest, payload: dict = Depends(verify_token)) -> dict:
    """Write the imported properties to the DB.

    Steps per row:
      1. Resolve / create owner via the `owner_email` column (creates a
         placeholder user with a random password if missing, then emails
         them a "set password" reset link).
      2. Apply dedupe (same owner + address + rental_type) — skip with
         a clear error in the report if a collision is found.
      3. Insert with the source URLs immediately (so the listing is
         live and looks complete right away).
      4. Kick off a background task per row to mirror images to
         Cloudinary and patch the doc — keeps the response fast so the
         60s edge-proxy timeout doesn't trip on large imports (37 rows
         × 20 images = 700 mirror calls).
    """
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    headers, rows = _parse_csv(req.csv_text)
    if not rows:
        raise HTTPException(status_code=400, detail="No data rows in CSV")

    column_map = req.column_map or await _ai_map_columns(headers, schema="property")

    created: list[dict] = []
    skipped: list[dict] = []
    owners_created: list[dict] = []
    from utils.cloud_storage import CLOUDINARY_ENABLED

    # Collect (doc_id, image_urls, video_urls) for post-response mirroring.
    to_mirror: list[tuple[str, list[str], list[str]]] = []

    for i, raw in enumerate(rows, start=1):
        try:
            remapped = {
                column_map.get(k): v for k, v in raw.items()
                if column_map.get(k) is not None
            }
            # Per-row currency sniff: lets a CSV without a currency column
            # — or with a mix of NIS/USD prices — classify each listing on
            # its own price-cell symbols ($, ₪, USD, NIS, …) instead of
            # defaulting every row to ILS.
            remapped["currency"] = _sniff_currency(remapped, raw)
            owner_email = (remapped.get("owner_email") or "").strip().lower()
            owner_name = remapped.get("owner_name") or remapped.get("owner_email") or "Owner"
            owner_phone = remapped.get("owner_phone") or ""

            if not owner_email:
                skipped.append({"index": i, "title": raw.get("title") or raw.get("Name"), "error": "Missing owner_email — can't attribute this listing."})
                continue

            owner_id, was_created = await _resolve_or_create_owner(
                email=owner_email, name=owner_name, phone=owner_phone,
            )
            if was_created:
                owners_created.append({"email": owner_email, "id": owner_id})

            # Dedupe — same rule as the manual create endpoint. Apply the
            # admin-selected default rental_type when the CSV row omits one,
            # so an import without a rental_type column matches existing
            # vacation/long-term listings correctly (otherwise the importer
            # creates duplicate "long-term" stubs instead of finding their
            # vacation twins).
            effective_rental_type = (
                remapped.get("rental_type") or req.default_rental_type or "long-term"
            ).lower()
            dup = await find_duplicate(
                db, owner_id=owner_id,
                address=remapped.get("address"),
                rental_type=effective_rental_type,
                bedrooms=remapped.get("bedrooms"),
                floor=remapped.get("floor"),
            )
            if dup:
                # "sync_photos" mode: a duplicate is not an error — it's
                # the WHOLE point. Replace this listing's photos with the
                # CSV's and re-mirror in the background. Lets the admin
                # recover from a half-mirrored import without recreating
                # the listings (which would lose chat history etc).
                if req.mode == "sync_photos":
                    image_urls = _split_urls(remapped.get("images"))
                    video_urls = _split_urls(remapped.get("videos"))
                    if not image_urls and not video_urls:
                        skipped.append({
                            "index": i, "title": dup.get("title"),
                            "error": "No image_urls in this CSV row — nothing to sync.",
                        })
                        continue
                    existing_imgs = dup.get("images") or []
                    # Only skip if EVERY existing image is already on
                    # Cloudinary — a partial mirror (mix of CDN + source
                    # URLs) is still a sync target so we can finish the
                    # job. Empty images is always a sync target.
                    all_cdn = (
                        len(existing_imgs) > 0
                        and all("cloudinary.com" in (u or "") for u in existing_imgs)
                    )
                    if all_cdn and image_urls:
                        # Already fully on Cloudinary — skip to avoid
                        # paying for a duplicate mirror pass.
                        skipped.append({
                            "index": i, "title": dup.get("title"),
                            "error": "Listing already fully on Cloudinary — skipped.",
                        })
                        continue
                    update_set: dict = {
                        "images": image_urls, "videos": video_urls,
                    }
                    if req.mirror_images and CLOUDINARY_ENABLED and (image_urls or video_urls):
                        update_set["mirror_pending"] = True
                    await db.properties.update_one(
                        {"id": dup["id"]}, {"$set": update_set},
                    )
                    created.append({
                        "id": dup["id"],
                        "title": dup.get("title"),
                        "images_count": len(image_urls),
                        "videos_count": len(video_urls),
                        "mirror_pending": update_set.get("mirror_pending", False),
                        "synced": True,
                    })
                    if req.mirror_images and CLOUDINARY_ENABLED and (image_urls or video_urls):
                        to_mirror.append((dup["id"], image_urls[:30], video_urls[:5]))
                    continue
                skipped.append({
                    "index": i, "title": raw.get("title") or raw.get("Name"),
                    "error": (
                        f"Duplicate of existing listing \"{dup.get('title')}\" — same address + "
                        f"{remapped.get('rental_type', 'rental type')} for this owner."
                    ),
                })
                continue

            doc = _build_property_doc(remapped, owner_id, default_rental_type=req.default_rental_type)

            # Always save with the source URLs first so the listing has
            # photos immediately. Background task below will swap them
            # for Cloudinary-hosted URLs without blocking the response.
            image_urls = _split_urls(remapped.get("images"))
            video_urls = _split_urls(remapped.get("videos"))
            doc["images"] = image_urls
            doc["videos"] = video_urls
            if req.mirror_images and CLOUDINARY_ENABLED and (image_urls or video_urls):
                doc["mirror_pending"] = True

            await db.properties.insert_one(doc)
            created.append({
                "id": doc["id"],
                "title": doc["title"],
                "images_count": len(doc.get("images", [])),
                "videos_count": len(doc.get("videos", [])),
                "mirror_pending": doc.get("mirror_pending", False),
            })

            if req.mirror_images and CLOUDINARY_ENABLED and (image_urls or video_urls):
                to_mirror.append((doc["id"], image_urls[:30], video_urls[:5]))
        except Exception as e:  # noqa: BLE001
            skipped.append({"index": i, "title": raw.get("title") or raw.get("Name"), "error": f"Unexpected error: {e}"})

    # Kick off background mirroring AFTER the response data is finalized.
    # Each property gets one task that mirrors all its images concurrently
    # via to_thread + gather, then patches the doc in-place. We do NOT
    # await — the HTTP response returns immediately.
    if to_mirror:
        asyncio.create_task(_background_mirror_properties(to_mirror))

    return {
        "summary": {
            "total": len(rows),
            "created": len(created),
            "skipped": len(skipped),
            "owners_created": len(owners_created),
            "with_missing_photos": 0,
            "cloudinary_enabled": bool(CLOUDINARY_ENABLED),
            "mirror_pending_count": len(to_mirror),
        },
        "created": created,
        "skipped": skipped,
        "owners_created": owners_created,
        "media_issues": [],
    }


async def _background_mirror_properties(
    items: list[tuple[str, list[str], list[str]]],
) -> None:
    """Mirror images for already-inserted properties in the background.

    Runs after the HTTP response is sent. For each property:
      • Mirror all image URLs to Cloudinary in parallel (gather).
      • Mirror videos similarly.
      • Patch the doc with the new URLs and clear ``mirror_pending``.
    Failures fall back to the source URL so the listing never loses photos.
    """
    for prop_id, image_urls, video_urls in items:
        try:
            img_results = []
            vid_results = []
            if image_urls:
                img_results = await asyncio.gather(*[
                    mirror_url_to_cloudinary(u, is_video=False) for u in image_urls
                ], return_exceptions=False)
            if video_urls:
                vid_results = await asyncio.gather(*[
                    mirror_url_to_cloudinary(u, is_video=True) for u in video_urls
                ], return_exceptions=False)
            final_images = [
                (r["url"] if r and r.get("url") else src)
                for src, r in zip(image_urls, img_results)
            ] if image_urls else []
            final_videos = [
                (r["url"] if r and r.get("url") else src)
                for src, r in zip(video_urls, vid_results)
            ] if video_urls else []
            await db.properties.update_one(
                {"id": prop_id},
                {"$set": {
                    "images": final_images,
                    "videos": final_videos,
                    "mirror_pending": False,
                }},
            )
        except Exception as e:  # noqa: BLE001
            logger.exception(f"Background mirror failed for property {prop_id}: {e}")
            await db.properties.update_one(
                {"id": prop_id},
                {"$set": {"mirror_pending": False}},
            )


@api_router.post("/admin/properties/remirror")
async def admin_remirror_properties(payload: dict = Depends(verify_token)) -> dict:
    """Scan the entire properties collection and re-mirror every listing
    whose photos are still on source URLs (not Cloudinary).

    Use when a previous import / mirror pass got interrupted (background
    task killed by a backend restart, edge timeout, etc.) and left
    listings pointing at non-CDN URLs. No CSV upload required — we just
    use the URLs already on each doc.

    Outcomes per property:
      • `queued`       — has at least one source URL, mirror task fired.
      • `already_cdn`  — every image is already on Cloudinary, skipped.
      • `no_images`    — empty `images` array, nothing to mirror.

    For `no_images` listings, the admin must re-upload the CSV with
    "Sync photos onto existing listings" mode — we don't have the
    original URLs anywhere to pull from.
    """
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    from utils.cloud_storage import CLOUDINARY_ENABLED
    if not CLOUDINARY_ENABLED:
        raise HTTPException(
            status_code=503,
            detail="Cloudinary is not configured — set CLOUDINARY_URL in backend/.env to enable mirroring.",
        )

    # Pull every property (we only need id + image + video URLs).
    rows = await db.properties.find(
        {}, {"_id": 0, "id": 1, "images": 1, "videos": 1, "title": 1},
    ).to_list(10000)

    queued: list[dict] = []  # property summaries we fired mirror tasks for
    already_cdn = 0
    no_images: list[dict] = []  # listings the admin still needs to re-import

    to_mirror: list[tuple[str, list[str], list[str]]] = []
    for r in rows:
        imgs = r.get("images") or []
        vids = r.get("videos") or []
        if not imgs and not vids:
            no_images.append({"id": r["id"], "title": r.get("title")})
            continue
        # "Already fully on Cloudinary" = every image URL is a CDN URL.
        # Videos are checked the same way. If both arrays are entirely
        # on Cloudinary, skip — re-mirroring would just burn quota.
        all_cdn_imgs = all("cloudinary.com" in (u or "") for u in imgs)
        all_cdn_vids = all("cloudinary.com" in (u or "") for u in vids) if vids else True
        if all_cdn_imgs and all_cdn_vids:
            already_cdn += 1
            continue
        # Mark mirror_pending immediately so the admin UI can show a
        # spinner without waiting for the background task to start.
        await db.properties.update_one(
            {"id": r["id"]}, {"$set": {"mirror_pending": True}},
        )
        # Cap per-listing to the same limits the importer uses so a
        # rogue 200-image row can't starve the others.
        to_mirror.append((r["id"], imgs[:30], vids[:5]))
        queued.append({"id": r["id"], "title": r.get("title"), "image_count": len(imgs)})

    if to_mirror:
        # Fire-and-forget — response returns immediately. Background task
        # patches each doc with Cloudinary URLs as it finishes.
        asyncio.create_task(_background_mirror_properties(to_mirror))

    return {
        "scanned": len(rows),
        "queued": len(queued),
        "already_cdn": already_cdn,
        "no_images": len(no_images),
        "queued_sample": queued[:20],
        "no_images_sample": no_images[:20],
        "message": (
            f"Queued {len(queued)} listings for re-mirroring. "
            f"{already_cdn} already on Cloudinary. "
            f"{len(no_images)} have no photo URLs — re-upload the CSV with "
            f'"Sync photos onto existing listings" to backfill those.'
        ),
    }


@api_router.post("/admin/properties/repair-prices")
async def admin_repair_misplaced_prices(payload: dict = Depends(verify_token)) -> dict:
    """One-shot data fix for listings whose price landed in the wrong field.

    Earlier CSV imports without explicit ``nightly_price`` / ``monthly_price``
    columns mapped the generic ``price`` column to ``monthly_price`` for
    every row — vacation listings then displayed ₪0/night on the property
    card. The importer now routes correctly (see ``_build_property_doc``),
    but listings that were already imported need a one-time swap.

    Repair rules:
      • ``rental_type='vacation'`` (or ``short-term``) + ``monthly_price>0`` +
        ``nightly_price`` empty → move monthly_price → nightly_price.
      • ``rental_type='long-term'`` + ``nightly_price>0`` + ``monthly_price``
        empty → move nightly_price → monthly_price.
      • Anything else is left untouched.

    Idempotent — running it twice on a healthy DB is a no-op.
    """
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    # Vacation / short-term: monthly was the only one set → move to nightly.
    vacation_q = {
        "rental_type": {"$in": ["vacation", "short-term"]},
        "monthly_price": {"$gt": 0},
        "$or": [{"nightly_price": {"$exists": False}},
                {"nightly_price": None},
                {"nightly_price": 0}],
    }
    long_q = {
        "rental_type": "long-term",
        "nightly_price": {"$gt": 0},
        "$or": [{"monthly_price": {"$exists": False}},
                {"monthly_price": None},
                {"monthly_price": 0}],
    }
    vac_swapped = 0
    long_swapped = 0
    samples_vac = []
    samples_long = []
    async for p in db.properties.find(vacation_q, {"_id": 0, "id": 1, "title": 1, "monthly_price": 1}):
        await db.properties.update_one(
            {"id": p["id"]},
            {"$set": {"nightly_price": p["monthly_price"], "monthly_price": 0}},
        )
        vac_swapped += 1
        if len(samples_vac) < 10:
            samples_vac.append({"id": p["id"], "title": p.get("title"),
                                "moved": p["monthly_price"]})
    async for p in db.properties.find(long_q, {"_id": 0, "id": 1, "title": 1, "nightly_price": 1}):
        await db.properties.update_one(
            {"id": p["id"]},
            {"$set": {"monthly_price": p["nightly_price"], "nightly_price": 0}},
        )
        long_swapped += 1
        if len(samples_long) < 10:
            samples_long.append({"id": p["id"], "title": p.get("title"),
                                 "moved": p["nightly_price"]})

    return {
        "vacation_short_term_swapped": vac_swapped,
        "long_term_swapped": long_swapped,
        "total_repaired": vac_swapped + long_swapped,
        "samples_vacation": samples_vac,
        "samples_long_term": samples_long,
        "message": (
            f"Repaired {vac_swapped} vacation/short-term listings (monthly → nightly) "
            f"and {long_swapped} long-term listings (nightly → monthly)."
        ),
    }


# --- Commit: users -------------------------------------------------------

