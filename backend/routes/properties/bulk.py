"""Property bulk-edit endpoints — apply a partial update or attach
images across many properties in one call.

Extracted from ``properties.py`` in the 2026-07 refactor.
"""
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from models_response import BulkEditResponse
from routes.deps import db, verify_token
from utils.events import publish

from .shared import _BULK_EDITABLE_FIELDS

router = APIRouter()
api_router = router


class BulkEditBody(BaseModel):
    property_ids: list[str]
    updates: dict
    # Optional: prefix to apply on top of each property's existing title.
    title_prefix: str | None = None
    # Optional: how to merge the `amenities` field — replace (default) or append.
    amenities_mode: str | None = "replace"
    # Optional: per-property update map ``{pid: {field: value, …}}`` used by
    # the Undo flow to restore each property's previous values in a single
    # round-trip. When set, the per-property values OVERRIDE the global
    # ``updates`` for that property; properties not listed fall back to the
    # global ``updates`` (so callers can mix modes if they ever need to).
    per_property_updates: dict[str, dict] | None = None


class BulkImagesBody(BaseModel):
    property_ids: list[str]
    image_urls: list[str]
    # If present, scope each url-list to a specific property id; takes
    # precedence over `image_urls` (which is the fan-out-to-all path).
    per_property: dict[str, list[str]] | None = None


def _filter_updates(updates: dict) -> dict:
    """Drop keys not in the editable whitelist; keep ``None``/``""`` so callers
    can intentionally clear a field."""
    return {k: v for k, v in updates.items() if k in _BULK_EDITABLE_FIELDS}


@api_router.post("/properties/bulk-edit", response_model=BulkEditResponse)
async def bulk_edit_properties(body: BulkEditBody, payload: dict = Depends(verify_token)) -> dict:
    """Patch a whitelisted set of fields across many owned properties.

    Returns ``snapshots`` for each successfully updated property so the
    frontend can offer a one-click Undo (re-POST the snapshots back here).
    """
    updates = _filter_updates(body.updates or {})
    has_prefix = bool((body.title_prefix or "").strip())
    per_prop_raw = body.per_property_updates or {}
    # Filter the per-property maps through the same whitelist; this keeps
    # the Undo path immune to any drift between client- and server-side
    # field lists, and stops malicious clients from sneaking in fields like
    # ``owner_id`` via the per-property channel.
    per_prop: dict[str, dict] = {pid: _filter_updates(d) for pid, d in per_prop_raw.items()}
    if not updates and not has_prefix and not any(per_prop.values()):
        raise HTTPException(status_code=400, detail="Nothing to update")
    if not body.property_ids:
        raise HTTPException(status_code=400, detail="No properties selected")

    is_admin = payload.get("role") == "admin"
    user_id = payload["user_id"]

    updated: list[dict] = []
    skipped: list[dict] = []

    for pid in body.property_ids:
        existing = await db.properties.find_one({"id": pid}, {"_id": 0})
        if not existing:
            skipped.append({"id": pid, "reason": "not_found"})
            continue
        if not is_admin and existing.get("owner_id") != user_id:
            skipped.append({"id": pid, "reason": "forbidden"})
            continue

        # Per-property override beats the global updates for the matching id.
        # When the per-property map for this id is empty (or absent), fall
        # back to the shared ``updates`` so call sites that mix modes still
        # work as expected.
        per_prop_patch = per_prop.get(pid)
        patch: dict[str, Any] = dict(per_prop_patch) if per_prop_patch else dict(updates)

        # If neither global nor per-property channel had anything for this
        # id and there's no title prefix, skip cleanly so we don't issue an
        # empty $set or fabricate an empty snapshot.
        if not patch and not has_prefix:
            skipped.append({"id": pid, "reason": "no_changes"})
            continue

        # Title prefix: prepended to the existing title once, idempotently.
        if has_prefix:
            prefix = (body.title_prefix or "").strip()
            current_title = patch.get("title", existing.get("title", ""))
            if not current_title.startswith(prefix):
                patch["title"] = f"{prefix} {current_title}".strip()

        # Amenities append-mode keeps existing amenities and unions the new set.
        if (body.amenities_mode == "append") and ("amenities" in patch):
            existing_amenities = existing.get("amenities") or []
            incoming = patch["amenities"] or []
            seen = set()
            merged: list[str] = []
            for a in [*existing_amenities, *incoming]:
                if a and a not in seen:
                    seen.add(a)
                    merged.append(a)
            patch["amenities"] = merged

        # Build a snapshot of the fields we're touching so Undo can revert
        # exactly those keys (and only those keys).
        snapshot = {k: existing.get(k) for k in patch.keys()}

        await db.properties.update_one({"id": pid}, {"$set": patch})

        updated.append({"id": pid, "snapshot": snapshot})

    if updated:
        await publish("invalidate", {"prefixes": ["/api/properties", "/api/admin/properties"]})

    return {"updated": updated, "skipped": skipped, "summary": {"updated": len(updated), "skipped": len(skipped)}}


@api_router.post("/properties/bulk-images", response_model=BulkEditResponse)
async def bulk_attach_images(body: BulkImagesBody, payload: dict = Depends(verify_token)) -> dict:
    """Append already-uploaded image URLs to one or many owned properties.

    Two modes:
      • ``image_urls``  – fan the same list out to every id in ``property_ids``.
      • ``per_property`` – {pid: [url, url, …]} for distinct sets per property.
    """
    if not body.property_ids:
        raise HTTPException(status_code=400, detail="No properties selected")

    is_admin = payload.get("role") == "admin"
    user_id = payload["user_id"]

    updated: list[dict] = []
    skipped: list[dict] = []

    for pid in body.property_ids:
        existing = await db.properties.find_one({"id": pid}, {"_id": 0})
        if not existing:
            skipped.append({"id": pid, "reason": "not_found"})
            continue
        if not is_admin and existing.get("owner_id") != user_id:
            skipped.append({"id": pid, "reason": "forbidden"})
            continue

        urls: list[str] = []
        if body.per_property and pid in body.per_property:
            urls = [u for u in body.per_property[pid] if u]
        else:
            urls = [u for u in (body.image_urls or []) if u]

        if not urls:
            skipped.append({"id": pid, "reason": "no_urls"})
            continue

        await db.properties.update_one({"id": pid}, {"$push": {"images": {"$each": urls}}})
        updated.append({"id": pid, "added": len(urls)})

    if updated:
        await publish("invalidate", {"prefixes": ["/api/properties", "/api/admin/properties"]})

    return {"updated": updated, "skipped": skipped, "summary": {"updated": len(updated), "skipped": len(skipped)}}


# --- Saved Searches (renter availability alerts) ---


