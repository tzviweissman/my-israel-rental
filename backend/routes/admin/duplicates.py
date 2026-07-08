"""Admin routes for duplicate-listing detection, review, and cleanup.

Extracted from ``admin.py`` in the 2026-07 refactor. Every endpoint,
helper, and background hook (``run_duplicate_auto_cleanup``) preserves
its previous signature and behaviour — the split is purely organizational.
"""
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from routes.deps import db, logger, verify_token
from utils.events import publish

router = APIRouter()
api_router = router


@api_router.get("/admin/duplicates")
async def list_duplicate_listings(payload: dict = Depends(verify_token)) -> dict:
    """Return groups of properties that share (owner_id, normalized address,
    rental_type) so the admin can review and clean up legacy duplicates.

    Each group has 2+ properties. Useful as a one-shot audit after we
    shipped the dedupe gate — pre-existing dupes weren't blocked at the
    door, so admins need a way to find them.
    """
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    from utils.dedupe import dedupe_signature
    # Pull the fields needed to group AND to help the admin decide which
    # copy to keep (image count, cover URL, age).
    rows = await db.properties.find(
        {"status": {"$in": ["active", "pending", "draft"]}},
        {
            "_id": 0, "id": 1, "owner_id": 1, "title": 1, "address": 1,
            "rental_type": 1, "created_at": 1, "images": 1,
            "description": 1, "monthly_price": 1, "nightly_price": 1,
            "bedrooms": 1, "floor": 1,
        },
    ).to_list(5000)

    # Group by composite dedupe signature (owner_id, normalized_address,
    # rental_type, bedrooms, floor). Distinct units in the same building
    # — common in Jerusalem — no longer collapse into a single bogus group.
    groups: dict[tuple, list[dict]] = {}
    for r in rows:
        sig = dedupe_signature(
            owner_id=r.get("owner_id"),
            address=r.get("address"),
            rental_type=r.get("rental_type"),
            bedrooms=r.get("bedrooms"),
            floor=r.get("floor"),
        )
        if sig is None:
            continue
        # Trim each property to the shape the admin UI needs — keeps the
        # response payload small even when there are dozens of groups.
        images = r.get("images") or []
        groups.setdefault(sig, []).append({
            "id": r["id"],
            "title": r.get("title"),
            "created_at": r.get("created_at"),
            "image_count": len(images),
            "cover_url": images[0] if images else None,
            "description_length": len(r.get("description") or ""),
            "monthly_price": r.get("monthly_price"),
            "nightly_price": r.get("nightly_price"),
            "bedrooms": r.get("bedrooms"),
            "floor": r.get("floor"),
        })

    # Keep only groups with 2+ properties
    out = []
    for sig, props in groups.items():
        if len(props) < 2:
            continue
        owner_id, addr, rt, bedrooms, floor = sig
        owner = await db.users.find_one({"id": owner_id}, {"_id": 0, "name": 1, "email": 1})
        out.append({
            "owner_id": owner_id,
            "owner_name": owner.get("name") if owner else None,
            "owner_email": owner.get("email") if owner else None,
            "address": addr,
            "rental_type": rt,
            "bedrooms": bedrooms,
            "floor": floor,
            "properties": sorted(props, key=lambda p: p.get("created_at", "")),
        })
    # Newest collisions first — they're the freshest cleanup targets.
    out.sort(key=lambda g: max(p.get("created_at", "") for p in g["properties"]), reverse=True)
    return {"groups": out, "total_groups": len(out)}


class DuplicateResolveRequest(BaseModel):
    """Bulk-resolve duplicate groups.

    `mode`:
      - "keep_newest"  → delete all but the most recently created listing in each group
      - "keep_oldest"  → delete all but the earliest-created (preserves booking history)
      - "keep_richest" → delete all but the one with the most images + longest description

    `keys` (optional) restricts the action to specific groups. Each key is
    "<owner_id>|<normalized_address>|<rental_type>". When omitted, all
    groups returned by `/admin/duplicates` are resolved.
    """
    mode: str = "keep_richest"
    keys: list[str] | None = None
    # When True, only resolve groups where every duplicate has functionally
    # identical user-facing data (title, description, amenities, prices,
    # image URLs). Used by the auto-cleanup endpoint / background task so
    # we never silently delete a listing that's only "similar" to another.
    strict_only: bool = False


def _norm_str(s: str | None) -> str:
    """Case-insensitive, whitespace-collapsed string comparator."""
    if not s:
        return ""
    return " ".join(s.strip().lower().split())


def _group_is_strictly_identical(props: list[dict]) -> bool:
    """True when every property in the group agrees on every field a
    renter would see. Used by the auto-resolve path — we only auto-delete
    listings that are pixel-for-pixel the same twin, never merely
    "similar" listings (different price, different title, missing photos)
    which need human judgement.
    """
    if len(props) < 2:
        return False
    # Numeric / categorical fields: exact equality.
    numeric_fields = (
        "monthly_price", "nightly_price", "currency", "bathrooms",
        "square_meters", "property_type",
    )
    for f in numeric_fields:
        vals = {p.get(f) for p in props}
        # None + missing collapse to a single value, which is fine.
        if len(vals) > 1:
            return False
    # Text fields: normalized comparison (case / whitespace tolerant).
    for f in ("title", "description"):
        vals = {_norm_str(p.get(f)) for p in props}
        if len(vals) > 1:
            return False
    # Set-valued fields: order-independent equality.
    amenity_sets = {frozenset(p.get("amenities") or []) for p in props}
    if len(amenity_sets) > 1:
        return False
    image_sets = {frozenset(p.get("images") or []) for p in props}
    if len(image_sets) > 1:
        return False
    return True


@api_router.post("/admin/duplicates/resolve")
async def resolve_duplicates(
    req: DuplicateResolveRequest, payload: dict = Depends(verify_token)
) -> dict:
    """Bulk-delete the redundant listings in each duplicate group based on a
    chosen "keep" strategy. Returns the count of properties deleted and a
    brief report keyed by group.
    """
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    if req.mode not in {"keep_newest", "keep_oldest", "keep_richest"}:
        raise HTTPException(
            status_code=400,
            detail="mode must be one of: keep_newest, keep_oldest, keep_richest",
        )

    from utils.dedupe import dedupe_signature
    rows = await db.properties.find(
        {"status": {"$in": ["active", "pending", "draft"]}},
        {
            "_id": 0, "id": 1, "owner_id": 1, "address": 1, "rental_type": 1,
            "created_at": 1, "images": 1, "videos": 1, "description": 1,
            "bedrooms": 1, "floor": 1,
            # Extra fields loaded so `strict_only` can compare every
            # user-visible piece of data. Small overhead when strict_only
            # is off — worth it to keep both paths using the same query.
            "title": 1, "amenities": 1, "monthly_price": 1, "nightly_price": 1,
            "currency": 1, "bathrooms": 1, "square_meters": 1, "property_type": 1,
        },
    ).to_list(5000)

    # Same grouping logic as /admin/duplicates — composite signature so
    # distinct units at the same building address don't collide. Holiday
    # pricing lives on a single listing (lump + per-night toggle), not
    # split across two — so holiday_tags is not part of the signature.
    groups: dict[tuple, list[dict]] = {}
    for r in rows:
        sig = dedupe_signature(
            owner_id=r.get("owner_id"),
            address=r.get("address"),
            rental_type=r.get("rental_type"),
            bedrooms=r.get("bedrooms"),
            floor=r.get("floor"),
        )
        if sig is None:
            continue
        groups.setdefault(sig, []).append(r)

    target_keys = (
        set(req.keys) if req.keys is not None else None
    )

    # Bulk-prefetch per-property activity counts (messages + bookings)
    # in one round-trip each. Used below to bias keeper-selection toward
    # the twin that already has chat history — that way the renter's
    # bookmarked URL keeps working instead of pointing at a deleted id.
    all_prop_ids = [r["id"] for r in rows]
    activity: dict[str, int] = {pid: 0 for pid in all_prop_ids}
    if all_prop_ids:
        async for row in db.messages.aggregate([
            {"$match": {"property_id": {"$in": all_prop_ids}}},
            {"$group": {"_id": "$property_id", "n": {"$sum": 1}}},
        ]):
            activity[row["_id"]] = activity.get(row["_id"], 0) + row["n"]
        async for row in db.bookings.aggregate([
            {"$match": {"property_id": {"$in": all_prop_ids}}},
            {"$group": {"_id": "$property_id", "n": {"$sum": 1}}},
        ]):
            # Bookings count as activity too — they're even more valuable
            # to preserve a stable property_id for than chats.
            activity[row["_id"]] = activity.get(row["_id"], 0) + row["n"]

    def score_richness(p: dict) -> tuple[int, int, str]:
        # Bigger is better: image count first, then description length,
        # then created_at as a stable tie-breaker (newer wins ties).
        return (
            len(p.get("images") or []),
            len(p.get("description") or ""),
            p.get("created_at") or "",
        )

    deleted_total = 0
    reattached_total = {"messages": 0, "bookings": 0, "likes": 0, "nudges": 0, "blocks": 0, "subleases": 0}
    report: list[dict] = []
    for sig, props in groups.items():
        if len(props) < 2:
            continue
        owner_id, addr, rt, bedrooms, floor = sig
        # Group key string: matches the shape returned by /admin/duplicates
        # so the frontend can target specific groups via `keys`.
        key_str = f"{owner_id}|{addr}|{rt}|{bedrooms or ''}|{floor or ''}"
        if target_keys is not None and key_str not in target_keys:
            continue

        # Strict-only guardrail: skip groups where properties differ on
        # any user-visible field. Used by the auto-cleanup path so we
        # only ever silently delete an EXACT twin — never a listing
        # that's only "similar". Any group that fails this check gets
        # surfaced for manual review via the normal /admin/duplicates
        # endpoint instead.
        if req.strict_only and not _group_is_strictly_identical(props):
            continue

        # When at least one twin already has chat/booking history,
        # restrict the keeper candidates to ONLY those. This keeps the
        # renter's bookmarked URL alive (no re-attach needed) and beats
        # the requested mode for ties. If multiple twins have history,
        # the requested mode picks between them; if exactly one has
        # history, it always wins.
        active_props = [p for p in props if activity.get(p["id"], 0) > 0]
        keeper_candidates = active_props if active_props else props
        # All non-candidates become losers regardless of mode — we never
        # delete a property with chat history when an inactive twin
        # exists to absorb the delete.
        forced_losers = [p for p in props if p not in keeper_candidates]

        if req.mode == "keep_newest":
            sorted_candidates = sorted(keeper_candidates, key=lambda p: p.get("created_at") or "")
            keeper = sorted_candidates[-1]
            mode_losers = sorted_candidates[:-1]
        elif req.mode == "keep_oldest":
            sorted_candidates = sorted(keeper_candidates, key=lambda p: p.get("created_at") or "")
            keeper = sorted_candidates[0]
            mode_losers = sorted_candidates[1:]
        else:  # keep_richest
            sorted_candidates = sorted(keeper_candidates, key=score_richness)
            keeper = sorted_candidates[-1]
            mode_losers = sorted_candidates[:-1]
        losers = forced_losers + mode_losers

        loser_ids = [p["id"] for p in losers]
        if not loser_ids:
            continue

        keeper_id = keeper["id"]
        # Re-attach everything that was hanging off the losers to the keeper
        # BEFORE we delete the loser docs. Without this, a renter's
        # inquiry about the deleted twin becomes a dead chat that opens
        # to "Property not found". Duplicates are by definition the
        # same physical apartment (same owner + same address + same
        # rental_type), so moving the chats/bookings/likes is safe.
        msgs_r = await db.messages.update_many(
            {"property_id": {"$in": loser_ids}},
            {"$set": {"property_id": keeper_id}},
        )
        bookings_r = await db.bookings.update_many(
            {"property_id": {"$in": loser_ids}},
            {"$set": {"property_id": keeper_id}},
        )
        nudges_r = await db.chat_nudges.update_many(
            {"property_id": {"$in": loser_ids}},
            {"$set": {"property_id": keeper_id}},
        )
        blocks_r = await db.admin_blocks.update_many(
            {"property_id": {"$in": loser_ids}},
            {"$set": {"property_id": keeper_id}},
        )
        subleases_r = await db.subleases.update_many(
            {"original_property_id": {"$in": loser_ids}},
            {"$set": {"original_property_id": keeper_id}},
        )
        # Likes need extra care: a user might have liked BOTH the keeper
        # and a loser. Re-pointing would create a duplicate row. Drop the
        # loser-side likes for any user who already liked the keeper, then
        # re-point the rest.
        keeper_likers = {
            row["user_id"]
            async for row in db.liked_properties.find(
                {"property_id": keeper_id}, {"_id": 0, "user_id": 1}
            )
        }
        if keeper_likers:
            await db.liked_properties.delete_many({
                "property_id": {"$in": loser_ids},
                "user_id": {"$in": list(keeper_likers)},
            })
        likes_r = await db.liked_properties.update_many(
            {"property_id": {"$in": loser_ids}},
            {"$set": {"property_id": keeper_id}},
        )

        reattached_total["messages"] += msgs_r.modified_count
        reattached_total["bookings"] += bookings_r.modified_count
        reattached_total["likes"] += likes_r.modified_count
        reattached_total["nudges"] += nudges_r.modified_count
        reattached_total["blocks"] += blocks_r.modified_count
        reattached_total["subleases"] += subleases_r.modified_count

        # Merge images + videos from losers into the keeper BEFORE we
        # delete them. Without this step, picking a keeper with chat
        # history (active_props preference) or a newer-but-empty twin
        # would wipe out photo URLs that lived on the loser docs — the
        # admin re-mirror tool would then report "no image URLs" for
        # listings the admin is sure had photos at import time.
        # Order: keeper's images first (so its preferred cover stays
        # the cover), then any new URLs from each loser in turn.
        # Dedupe is by exact URL string. Cap matches the importer.
        keeper_imgs = list(keeper.get("images") or [])
        keeper_vids = list(keeper.get("videos") or [])
        seen_img_urls = {u for u in keeper_imgs if u}
        seen_vid_urls = {u for u in keeper_vids if u}
        for loser in losers:
            for u in (loser.get("images") or []):
                if u and u not in seen_img_urls:
                    keeper_imgs.append(u)
                    seen_img_urls.add(u)
            for u in (loser.get("videos") or []):
                if u and u not in seen_vid_urls:
                    keeper_vids.append(u)
                    seen_vid_urls.add(u)
        merged_imgs = keeper_imgs[:30]
        merged_vids = keeper_vids[:5]
        merged_image_count_delta = len(merged_imgs) - len(keeper.get("images") or [])
        if merged_image_count_delta > 0 or len(merged_vids) > len(keeper.get("videos") or []):
            # Some merged URLs may be raw source URLs (not on Cloudinary);
            # mark the keeper for the re-mirror sweep so a subsequent
            # /admin/properties/remirror call (or the next import pass)
            # uploads them to the CDN.
            needs_mirror = any(
                "cloudinary.com" not in (u or "") for u in merged_imgs + merged_vids
            )
            update_doc = {"images": merged_imgs, "videos": merged_vids}
            if needs_mirror:
                update_doc["mirror_pending"] = True
            await db.properties.update_one({"id": keeper_id}, {"$set": update_doc})

        res = await db.properties.delete_many({"id": {"$in": loser_ids}})
        deleted_total += res.deleted_count
        report.append({
            "key": key_str,
            "kept_id": keeper_id,
            "deleted_ids": loser_ids,
            "deleted_count": res.deleted_count,
            "images_merged": max(0, merged_image_count_delta),
            "reattached": {
                "messages": msgs_r.modified_count,
                "bookings": bookings_r.modified_count,
                "likes": likes_r.modified_count,
                "nudges": nudges_r.modified_count,
                "blocks": blocks_r.modified_count,
                "subleases": subleases_r.modified_count,
            },
        })

    if deleted_total:
        await publish("invalidate", {
            "prefixes": ["/api/admin/properties", "/api/admin/dashboard", "/api/properties"],
        })
    return {
        "mode": req.mode,
        "deleted": deleted_total,
        "groups_resolved": len(report),
        "reattached": reattached_total,
        "report": report,
    }


# ---------------------------------------------------------------------------
# Auto-cleanup — safe autopilot for perfectly-identical twins
# ---------------------------------------------------------------------------
#
# Every 30 minutes (see `server.py` startup hook) and on demand from the
# admin UI, we scan for property groups whose members agree on every
# user-visible field (title, description, amenities, prices, image set)
# and merge them into one, re-attaching all chats / bookings / likes to
# the surviving listing. This is the "if all information is the same,
# just clean it up" behaviour the admin asked for — no clicks needed.
#
# The strict-identity check lives in `_group_is_strictly_identical` and
# is enforced in the shared resolve loop via `req.strict_only=True`. Any
# group that fails the strict check is left alone for the admin to
# resolve manually via the Duplicates modal.


async def run_duplicate_auto_cleanup(logger_prefix: str = "auto-cleanup") -> dict:
    """Run one pass of strict-identical duplicate resolution. Returns
    the same shape as `/admin/duplicates/resolve` so the background task
    and the admin endpoint can share formatting. Records the summary in
    `db.admin_auto_cleanup_log` for the "last run" widget.
    """
    req = DuplicateResolveRequest(mode="keep_richest", strict_only=True)
    # Reuse the existing resolver — it already knows how to re-attach
    # chats, bookings, likes, nudges, blocks, subleases and to merge
    # images across the losers. We fake a payload of {'role': 'admin'}
    # because this function is invoked from trusted server-side callers.
    result = await resolve_duplicates(req, payload={"role": "admin", "user_id": "system"})
    await db.admin_auto_cleanup_log.insert_one({
        "at": datetime.now(UTC).isoformat(),
        "deleted": result.get("deleted", 0),
        "groups_resolved": result.get("groups_resolved", 0),
        "reattached": result.get("reattached", {}),
    })
    logger.info(
        "[%s] deleted=%d groups_resolved=%d reattached=%s",
        logger_prefix,
        result.get("deleted", 0),
        result.get("groups_resolved", 0),
        result.get("reattached", {}),
    )
    return result


@api_router.post("/admin/duplicates/auto-resolve")
async def auto_resolve_duplicates(payload: dict = Depends(verify_token)) -> dict:
    """Admin-triggered strict-identical dedupe. Deletes only twins that
    match on every user-visible field; anything else is left for manual
    review. Chats, bookings, likes and photos are re-attached to the
    survivor before deletion.
    """
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return await run_duplicate_auto_cleanup(logger_prefix="admin-triggered")


@api_router.get("/admin/duplicates/auto-status")
async def get_auto_cleanup_status(payload: dict = Depends(verify_token)) -> dict:
    """Return the last N auto-cleanup runs so the Duplicates modal can
    show "Last run: X min ago · Y properties merged" and give the admin
    a sense of what the background task has been doing.
    """
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    cursor = db.admin_auto_cleanup_log.find({}, {"_id": 0}).sort("at", -1).limit(20)
    runs = await cursor.to_list(20)
    return {"runs": runs}
