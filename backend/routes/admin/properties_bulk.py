"""Admin routes for bulk property management — hard delete + restore,
featured toggles, admin-managed toggle, mark-booked / block CRUD, and
the status toggle.

Extracted from ``routes/admin/core.py`` in the 2026-07 refactor. Every
endpoint keeps its exact URL, request/response shape, and side effects
(cache invalidation via ``publish``, tombstone/undo support).
"""
import uuid
from datetime import UTC, datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from models_response import (
    AdminBlockOut,
    AdminBulkMarkBookedResponse,
    AdminMarkBookedResponse,
    AdminToggleStatusResponse,
    MessageResponse,
    PropertyOut,
)
from routes.deps import db, logger, verify_token
from utils.events import publish

router = APIRouter()
api_router = router


class BulkDeletePropertiesRequest(BaseModel):
    """Super-admin: hard-delete many properties at once.

    Cascades cleanup across collections that reference the property by
    ``property_id`` so we don't leave orphan chats / blocks / bookings
    pointing at deleted listings. Subleases that referenced the deleted
    properties are detached (set ``original_property_id`` to None) so
    they survive as standalone listings.

    When ``auto_rescue_duplicates`` is true (admin opt-in for "I'm just
    clearing out known dupes"), for each row we look up a surviving
    duplicate twin (same owner + address + rental_type + bedrooms +
    floor, excluding the ids being deleted). If a twin is found we
    reattach the row's chats / bookings / likes / nudges / blocks /
    subleases AND merge its images + videos into the twin BEFORE the
    cascade-delete runs. Rows without a twin go through the standard
    tombstone path so the Undo button still works for those.
    """
    property_ids: list[str] = Field(..., max_length=500)
    auto_rescue_duplicates: bool = False


@api_router.delete("/admin/properties/bulk")
async def admin_bulk_delete_properties(
    req: BulkDeletePropertiesRequest, payload: dict = Depends(verify_token),
) -> dict:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    if not req.property_ids:
        raise HTTPException(status_code=400, detail="property_ids must not be empty")

    # Only operate on ids that actually exist so the count we report back
    # to the UI is honest (not "deleted 50" when 30 of them never existed).
    existing_props = await db.properties.find(
        {"id": {"$in": req.property_ids}}, {"_id": 0}
    ).to_list(len(req.property_ids))
    valid_ids = [p["id"] for p in existing_props]
    if not valid_ids:
        return {
            "deleted": 0, "skipped": len(req.property_ids),
            "messages_deleted": 0, "bookings_deleted": 0,
            "snapshot_id": None,
            "rescued_count": 0, "rescue_totals": {},
        }

    # ---- Auto-rescue pass (opt-in). For each property scheduled for
    # deletion, see if a duplicate twin exists in the rest of the DB
    # (excluding everything ALSO being deleted in this batch). If so,
    # reattach related rows and merge images into the twin BEFORE the
    # snapshot+cascade runs. ----
    rescued_ids: set[str] = set()
    rescue_totals = {
        "messages": 0, "bookings": 0, "likes": 0, "nudges": 0,
        "blocks": 0, "subleases": 0, "images_merged": 0,
    }
    if req.auto_rescue_duplicates:
        from utils.dedupe import find_duplicate
        valid_ids_set = set(valid_ids)
        for prop in existing_props:
            # The duplicate lookup must also exclude any other id in this
            # delete batch so we don't reattach onto a sibling that's
            # about to be wiped too.
            twin = await find_duplicate(
                db,
                owner_id=prop.get("owner_id"),
                address=prop.get("address"),
                rental_type=prop.get("rental_type"),
                bedrooms=prop.get("bedrooms"),
                floor=prop.get("floor"),
                exclude_property_id=prop["id"],
            )
            if not twin or twin["id"] in valid_ids_set:
                continue
            twin_id = twin["id"]
            prop_id = prop["id"]

            # Likes-collision guard (same as single delete path).
            twin_likers = {
                row["user_id"]
                async for row in db.liked_properties.find(
                    {"property_id": twin_id}, {"_id": 0, "user_id": 1}
                )
            }
            if twin_likers:
                await db.liked_properties.delete_many({
                    "property_id": prop_id,
                    "user_id": {"$in": list(twin_likers)},
                })

            msgs_r = await db.messages.update_many(
                {"property_id": prop_id}, {"$set": {"property_id": twin_id}}
            )
            bookings_r = await db.bookings.update_many(
                {"property_id": prop_id}, {"$set": {"property_id": twin_id}}
            )
            likes_r = await db.liked_properties.update_many(
                {"property_id": prop_id}, {"$set": {"property_id": twin_id}}
            )
            nudges_r = await db.chat_nudges.update_many(
                {"property_id": prop_id}, {"$set": {"property_id": twin_id}}
            )
            blocks_r = await db.admin_blocks.update_many(
                {"property_id": prop_id}, {"$set": {"property_id": twin_id}}
            )
            subleases_r = await db.subleases.update_many(
                {"original_property_id": prop_id},
                {"$set": {"original_property_id": twin_id}},
            )

            # Merge images + videos into the twin (dedupe by URL, cap
            # 30/5, mirror_pending=True for non-CDN URLs).
            twin_full = await db.properties.find_one(
                {"id": twin_id}, {"_id": 0, "images": 1, "videos": 1}
            ) or {}
            twin_imgs = list(twin_full.get("images") or [])
            twin_vids = list(twin_full.get("videos") or [])
            seen_imgs = {u for u in twin_imgs if u}
            seen_vids = {u for u in twin_vids if u}
            for u in (prop.get("images") or []):
                if u and u not in seen_imgs:
                    twin_imgs.append(u)
                    seen_imgs.add(u)
            for u in (prop.get("videos") or []):
                if u and u not in seen_vids:
                    twin_vids.append(u)
                    seen_vids.add(u)
            merged_imgs = twin_imgs[:30]
            merged_vids = twin_vids[:5]
            new_image_count = max(0, len(merged_imgs) - len(twin_full.get("images") or []))
            if new_image_count > 0 or len(merged_vids) > len(twin_full.get("videos") or []):
                needs_mirror = any(
                    "cloudinary.com" not in (u or "") for u in merged_imgs + merged_vids
                )
                patch = {"images": merged_imgs, "videos": merged_vids}
                if needs_mirror:
                    patch["mirror_pending"] = True
                await db.properties.update_one({"id": twin_id}, {"$set": patch})

            rescued_ids.add(prop_id)
            rescue_totals["messages"] += msgs_r.modified_count
            rescue_totals["bookings"] += bookings_r.modified_count
            rescue_totals["likes"] += likes_r.modified_count
            rescue_totals["nudges"] += nudges_r.modified_count
            rescue_totals["blocks"] += blocks_r.modified_count
            rescue_totals["subleases"] += subleases_r.modified_count
            rescue_totals["images_merged"] += new_image_count

    # Ids that DIDN'T find a twin (or rescue was off) still go through
    # the snapshot+cascade path so the Undo button keeps working.
    tombstone_ids = [pid for pid in valid_ids if pid not in rescued_ids]
    tombstone_props = [p for p in existing_props if p["id"] not in rescued_ids]

    # ---- Snapshot every row about to be touched so the admin can Undo. ----
    # We capture the *full* documents (sans `_id` since pymongo strips it)
    # so a restore is a straight `insert_many` — no schema reconstruction
    # needed. Includes the featured-list state and a list of detached
    # sublease ids so we can re-link them on restore. Only the rows that
    # weren't auto-rescued land in the tombstone (rescued rows had their
    # related data moved into the twin and don't need restoring).
    snapshot_id = str(uuid.uuid4())
    now_iso = datetime.now(UTC).isoformat()
    if not tombstone_ids:
        # Everything was rescued — no tombstone needed, no snapshot id.
        snapshot_id = None
        related = {k: [] for k in
                   ("messages", "bookings", "admin_blocks", "chat_nudges", "liked_properties")}
        featured_present = []
        detached_sub_ids = []
    else:
        related = {
            "messages": await db.messages.find(
                {"property_id": {"$in": tombstone_ids}}, {"_id": 0}
            ).to_list(20000),
            "bookings": await db.bookings.find(
                {"property_id": {"$in": tombstone_ids}}, {"_id": 0}
            ).to_list(20000),
            "admin_blocks": await db.admin_blocks.find(
                {"property_id": {"$in": tombstone_ids}}, {"_id": 0}
            ).to_list(20000),
            "chat_nudges": await db.chat_nudges.find(
                {"property_id": {"$in": tombstone_ids}}, {"_id": 0}
            ).to_list(20000),
            "liked_properties": await db.liked_properties.find(
                {"property_id": {"$in": tombstone_ids}}, {"_id": 0}
            ).to_list(20000),
        }
        settings = await db.site_settings.find_one({"key": "global"}, {"_id": 0, "featured_property_ids": 1}) or {}
        featured_present = [pid for pid in (settings.get("featured_property_ids") or []) if pid in set(tombstone_ids)]
        detached_sub_ids = [
            s["id"]
            async for s in db.subleases.find(
                {"original_property_id": {"$in": tombstone_ids}}, {"_id": 0, "id": 1}
            )
        ]
        await db.property_tombstones.insert_one({
            "id": snapshot_id,
            "deleted_at": now_iso,
            "deleted_by": payload.get("user_id"),
            "property_ids": tombstone_ids,
            "properties": tombstone_props,
            "related": related,
            "featured_property_ids_present": featured_present,
            "detached_sublease_ids": detached_sub_ids,
        })

        # Detach any subleases that referenced these properties (keep them
        # as standalone listings — same behavior as the single delete path
        # when no twin exists).
        await db.subleases.update_many(
            {"original_property_id": {"$in": tombstone_ids}},
            {"$set": {"original_property_id": None}},
        )

        # Courtesy heads-up to renters left mid-conversation or with a
        # pending booking on any tombstoned property. Runs BEFORE the
        # messages/bookings cascade below so we can still resolve renter
        # identities. Best-effort — failures are logged, never blocking.
        # Only tombstoned rows get the notice; rescued ones had their
        # chats + bookings moved to the twin and don't need alerting.
        from utils.email import notify_renters_of_property_deletion
        for prop in tombstone_props:
            try:
                summary = await notify_renters_of_property_deletion(prop)
                if summary["notified"]:
                    logger.info(
                        "property-removed notice: emailed %d renter(s) after bulk delete of %s",
                        summary["notified"], prop.get("id"),
                    )
            except Exception as e:  # noqa: BLE001
                logger.error("property-removed notice failed for %s: %s", prop.get("id"), e)

    # Cascade cleanup of everything tied to the tombstoned ids only.
    # Rescued rows already had their related rows moved to the twin so
    # they shouldn't be wiped here.
    msgs_res = await db.messages.delete_many({"property_id": {"$in": tombstone_ids}}) if tombstone_ids else None
    bookings_res = await db.bookings.delete_many({"property_id": {"$in": tombstone_ids}}) if tombstone_ids else None
    if tombstone_ids:
        await db.admin_blocks.delete_many({"property_id": {"$in": tombstone_ids}})
        await db.chat_nudges.delete_many({"property_id": {"$in": tombstone_ids}})
        await db.liked_properties.delete_many({"property_id": {"$in": tombstone_ids}})

        # Pull the deleted ids out of the global featured list so the
        # homepage stops trying to render ghost cards.
        await db.site_settings.update_one(
            {"key": "global"},
            {"$pull": {"featured_property_ids": {"$in": tombstone_ids}}},
        )

    # The actual property doc delete still runs for ALL valid ids — both
    # rescued and tombstoned — since the rescue moved everything *off*
    # the loser doc; the loser itself still needs to go.
    props_res = await db.properties.delete_many({"id": {"$in": valid_ids}})

    await publish("invalidate", {
        "prefixes": [
            "/api/admin/properties", "/api/admin/dashboard", "/api/admin/chats",
            "/api/properties",
        ],
    })
    return {
        "deleted": props_res.deleted_count,
        "skipped": len(req.property_ids) - len(valid_ids),
        "messages_deleted": msgs_res.deleted_count if msgs_res else 0,
        "bookings_deleted": bookings_res.deleted_count if bookings_res else 0,
        "snapshot_id": snapshot_id,
        "rescued_count": len(rescued_ids),
        "rescue_totals": rescue_totals,
    }


class BulkRestoreRequest(BaseModel):
    """Restore a tombstone created by /admin/properties/bulk delete."""
    snapshot_id: str


@api_router.post("/admin/properties/bulk-restore")
async def admin_bulk_restore_properties(
    req: BulkRestoreRequest, payload: dict = Depends(verify_token),
) -> dict:
    """Undo a recent bulk-delete by reinserting the snapshotted documents.

    Idempotent in a "best-effort" sense — if a property id was recreated
    between delete and restore, the snapshot insert is skipped (we don't
    clobber the new doc). Snapshots remain valid until the
    ``property_tombstones`` row is removed.
    """
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    snap = await db.property_tombstones.find_one({"id": req.snapshot_id}, {"_id": 0})
    if not snap:
        raise HTTPException(status_code=404, detail="Snapshot not found or already restored")

    # Restore the properties themselves — only the ones that don't currently
    # exist (so we don't overwrite a fresh recreation with the same id).
    props_to_restore = snap.get("properties") or []
    existing_now = {
        p["id"]
        for p in await db.properties.find(
            {"id": {"$in": [p["id"] for p in props_to_restore]}}, {"_id": 0, "id": 1}
        ).to_list(len(props_to_restore))
    }
    fresh_props = [p for p in props_to_restore if p["id"] not in existing_now]
    if fresh_props:
        await db.properties.insert_many(fresh_props)

    # Restore the related rows. We use insert_many per collection;
    # duplicate ids (from a concurrent admin reseed) are silently swallowed.
    related = snap.get("related") or {}
    for coll_name, rows in related.items():
        if not rows:
            continue
        try:
            await db[coll_name].insert_many(rows, ordered=False)
        except Exception:
            # Best-effort: an inserted-since dup shouldn't block the rest.
            pass

    # Restore featured-list membership for any ids that were featured before.
    feat_ids = snap.get("featured_property_ids_present") or []
    if feat_ids:
        await db.site_settings.update_one(
            {"key": "global"},
            {"$addToSet": {"featured_property_ids": {"$each": feat_ids}}},
            upsert=True,
        )

    # Re-link any subleases that were detached.
    detached = snap.get("detached_sublease_ids") or []
    if detached:
        # Each detached sublease referenced one of the property_ids in
        # snap.property_ids — but we don't know which, so we can't safely
        # re-attach by id. We accept this — the subleases survived as
        # standalone listings; the admin can manually link if needed.
        pass

    # Tombstone consumed — remove it so a second "Undo" doesn't duplicate.
    await db.property_tombstones.delete_one({"id": req.snapshot_id})

    await publish("invalidate", {
        "prefixes": [
            "/api/admin/properties", "/api/admin/dashboard", "/api/admin/chats",
            "/api/properties",
        ],
    })
    return {
        "restored": len(fresh_props),
        "snapshot_id": req.snapshot_id,
    }


@api_router.get("/admin/properties", response_model=list[PropertyOut])
async def get_all_properties_admin(payload: dict = Depends(verify_token)) -> list[dict]:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    properties = await db.properties.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)

    # Pull every admin block in one go and group by property
    blocks_by_prop: dict = {}
    async for block in db.admin_blocks.find({}, {"_id": 0}):
        blocks_by_prop.setdefault(block["property_id"], []).append(block)

    # Fetch featured-property-ids set once; used to stamp `is_featured`
    # on every row so the admin UI can show a ★ toggle inline.
    settings = await db.site_settings.find_one({"key": "global"}, {"_id": 0, "featured_property_ids": 1})
    featured_ids = set((settings or {}).get("featured_property_ids") or [])

    now_iso = datetime.now(UTC).isoformat()

    for prop in properties:
        owner = await db.users.find_one({"id": prop.get("owner_id")}, {"_id": 0, "name": 1, "email": 1})
        prop["owner_name"] = owner.get("name", "Unknown") if owner else "Unknown"
        prop["owner_email"] = owner.get("email", "") if owner else ""

        prop_blocks = blocks_by_prop.get(prop["id"], [])
        # A block is "active" if its date window covers "now"
        # (indefinite = null end, or start_date null = open-ended past)
        active_blocks = []
        for b in prop_blocks:
            bs = b.get("start_date")
            be = b.get("end_date")
            if (bs is None or bs <= now_iso) and (be is None or be >= now_iso):
                active_blocks.append(b)
        prop["admin_blocks"] = prop_blocks
        prop["admin_blocked_now"] = len(active_blocks) > 0
        prop["active_admin_block"] = active_blocks[0] if active_blocks else None
        prop["is_featured"] = prop["id"] in featured_ids

    return properties


@api_router.put("/admin/properties/{property_id}/managed", response_model=AdminToggleStatusResponse)
async def toggle_property_admin_managed(
    property_id: str,
    payload: dict = Depends(verify_token),
) -> dict:
    """Super-admin: flip the `managed_by_admin` flag on a property.

    This is the "I'm managing this property for the owner" marker. It does
    not change ownership or permissions — admins already have full control.
    It just lets us filter the listings table to "Properties I manage" so
    super-admins can find them quickly when handling the day-to-day
    (renters, maintenance, contracts) on the owner's behalf.
    """
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0, "id": 1, "managed_by_admin": 1})
    if prop is None:
        raise HTTPException(status_code=404, detail="Property not found")
    new_value = not bool(prop.get("managed_by_admin"))
    await db.properties.update_one(
        {"id": property_id},
        {"$set": {
            "managed_by_admin": new_value,
            "managed_by_admin_id": payload["user_id"] if new_value else None,
            "managed_by_admin_at": datetime.now(UTC).isoformat() if new_value else None,
        }},
    )
    await publish("invalidate", {"prefixes": ["/api/admin/properties", "/api/admin/dashboard"]})
    return {
        "message": "Managing this property" if new_value else "No longer managing",
        "status": "managed" if new_value else "unmanaged",
    }


class BulkFeaturedBody(BaseModel):
    property_ids: list[str]
    featured: bool


@api_router.post("/admin/properties/bulk-featured", response_model=AdminToggleStatusResponse)
async def bulk_set_featured(
    body: BulkFeaturedBody,
    payload: dict = Depends(verify_token),
) -> dict:
    """Super-admin: add or remove many properties from the Featured grid
    in a single round-trip. Idempotent — adding an already-featured
    property (or removing a non-featured one) is a no-op.
    """
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    if not body.property_ids:
        raise HTTPException(status_code=400, detail="No properties provided")

    # Validate every id exists so we don't silently inject ghost ids
    existing = await db.properties.find(
        {"id": {"$in": body.property_ids}}, {"_id": 0, "id": 1}
    ).to_list(len(body.property_ids))
    valid_ids = {p["id"] for p in existing}
    missing = [pid for pid in body.property_ids if pid not in valid_ids]
    if missing:
        raise HTTPException(status_code=404, detail=f"Properties not found: {missing}")

    settings = await db.site_settings.find_one({"key": "global"}, {"_id": 0, "featured_property_ids": 1}) or {}
    current = list(settings.get("featured_property_ids") or [])
    if body.featured:
        for pid in body.property_ids:
            if pid not in current:
                current.append(pid)
        verb = "added to"
    else:
        current = [pid for pid in current if pid not in set(body.property_ids)]
        verb = "removed from"

    await db.site_settings.update_one(
        {"key": "global"},
        {"$set": {
            "featured_property_ids": current,
            "updated_at": datetime.now(UTC).isoformat(),
        }},
        upsert=True,
    )
    await publish("invalidate", {"prefixes": ["/api/admin/properties", "/api/admin/settings"]})
    return {
        "message": f"{len(body.property_ids)} properties {verb} featured listings",
        "status": "featured" if body.featured else "unfeatured",
    }


@api_router.put("/admin/properties/{property_id}/featured", response_model=AdminToggleStatusResponse)
async def toggle_property_featured(
    property_id: str,
    payload: dict = Depends(verify_token),
) -> dict:
    """Super-admin: add/remove a property from the homepage Featured grid.

    Mutates `site_settings.featured_property_ids`. Idempotent in both
    directions — clicking the toggle twice ends up at the same state.
    Publishes cache-invalidation so admin dashboards refresh instantly.
    """
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0, "id": 1})
    if prop is None:
        raise HTTPException(status_code=404, detail="Property not found")

    settings = await db.site_settings.find_one({"key": "global"}, {"_id": 0, "featured_property_ids": 1}) or {}
    current = list(settings.get("featured_property_ids") or [])
    if property_id in current:
        current.remove(property_id)
        new_state = False
    else:
        current.append(property_id)
        new_state = True

    await db.site_settings.update_one(
        {"key": "global"},
        {"$set": {
            "featured_property_ids": current,
            "updated_at": datetime.now(UTC).isoformat(),
        }},
        upsert=True,
    )
    await publish("invalidate", {"prefixes": ["/api/admin/properties", "/api/admin/settings"]})
    return {
        "message": "Added to featured listings" if new_state else "Removed from featured listings",
        "status": "featured" if new_state else "unfeatured",
    }


class AdminBlockIn(BaseModel):
    start_date: str | None = None  # ISO string; None => starts now
    end_date: str | None = None    # ISO string; None => indefinite
    indefinite: bool | None = False


@api_router.post("/admin/properties/{property_id}/mark-booked", response_model=AdminMarkBookedResponse)
async def admin_mark_property_booked(
    property_id: str,
    block: AdminBlockIn,
    payload: dict = Depends(verify_token),
) -> dict:
    """Super-admin: block a property for a date range or indefinitely.

    The block is additive — existing renter bookings are NOT modified.
    When renters search with overlapping dates, the property is filtered out.
    """
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    prop = await db.properties.find_one({"id": property_id}, {"_id": 0, "id": 1})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    start = block.start_date or None
    end = None if block.indefinite else (block.end_date or None)

    # Validate that end_date > start_date if both provided
    if start and end and end <= start:
        raise HTTPException(status_code=400, detail="end_date must be after start_date")

    block_doc = {
        "id": str(uuid.uuid4()),
        "property_id": property_id,
        "start_date": start,
        "end_date": end,
        "indefinite": bool(block.indefinite) or end is None,
        "created_by": payload["user_id"],
        "created_at": datetime.now(UTC).isoformat(),
    }
    await db.admin_blocks.insert_one(block_doc)
    block_doc.pop("_id", None)
    await publish("invalidate", {"prefixes": ["/api/admin/properties"]})
    return {"message": "Property marked as booked", "block": block_doc}


@api_router.get("/admin/properties/{property_id}/blocks", response_model=list[AdminBlockOut])
async def admin_list_property_blocks(property_id: str, payload: dict = Depends(verify_token)) -> list[dict]:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    blocks = await db.admin_blocks.find(
        {"property_id": property_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return blocks


@api_router.delete("/admin/properties/blocks/{block_id}", response_model=MessageResponse)
async def admin_remove_block(block_id: str, payload: dict = Depends(verify_token)) -> dict:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.admin_blocks.delete_one({"id": block_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Block not found")
    await publish("invalidate", {"prefixes": ["/api/admin/properties"]})
    return {"message": "Block removed"}


class BulkMarkBookedIn(BaseModel):
    property_ids: List[str]
    start_date: str | None = None
    end_date: str | None = None
    indefinite: bool | None = False


@api_router.post("/admin/properties/bulk-mark-booked", response_model=AdminBulkMarkBookedResponse)
async def admin_bulk_mark_booked(
    data: BulkMarkBookedIn,
    payload: dict = Depends(verify_token),
) -> dict:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    if not data.property_ids:
        raise HTTPException(status_code=400, detail="property_ids must not be empty")

    start = data.start_date or None
    end = None if data.indefinite else (data.end_date or None)
    if start and end and end <= start:
        raise HTTPException(status_code=400, detail="end_date must be after start_date")

    # Only insert blocks for properties that actually exist
    existing_ids = set()
    async for prop in db.properties.find(
        {"id": {"$in": data.property_ids}}, {"_id": 0, "id": 1}
    ):
        existing_ids.add(prop["id"])

    now = datetime.now(UTC).isoformat()
    docs = [
        {
            "id": str(uuid.uuid4()),
            "property_id": pid,
            "start_date": start,
            "end_date": end,
            "indefinite": bool(data.indefinite) or end is None,
            "created_by": payload["user_id"],
            "created_at": now,
        }
        for pid in data.property_ids
        if pid in existing_ids
    ]
    if docs:
        await db.admin_blocks.insert_many(docs)
        await publish("invalidate", {"prefixes": ["/api/admin/properties"]})
    return {
        "message": f"{len(docs)} properties marked as booked",
        "created": len(docs),
        "skipped": len(data.property_ids) - len(docs),
    }


@api_router.put("/admin/properties/{property_id}/status", response_model=AdminToggleStatusResponse)
async def toggle_property_status(property_id: str, payload: dict = Depends(verify_token)) -> dict:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    new_status = "inactive" if prop.get("status") == "active" else "active"
    await db.properties.update_one({"id": property_id}, {"$set": {"status": new_status}})
    await publish("invalidate", {"prefixes": ["/api/admin/properties", "/api/admin/dashboard"]})
    return {"message": f"Property {new_status}", "status": new_status}
