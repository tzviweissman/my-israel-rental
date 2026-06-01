"""Admin CSV import — apartments + users.

End-to-end flow:
  1. Admin uploads a CSV via POST /admin/import/preview.
  2. Backend AI-maps unknown columns to our canonical schema using Claude,
     returns a preview with mapping + sample rows + warnings. No writes.
  3. Admin reviews and POSTs the same payload (with optional mapping
     overrides) to /admin/import/properties/commit or /admin/import/users/commit.
  4. Commit step persists, deduplicates, mirrors images to Cloudinary, and
     sends "set password" emails to newly-created users.

The mapper is intentionally tolerant: if Claude is unavailable or returns
an unparseable response, we fall back to a deterministic fuzzy-match so
the feature degrades gracefully.
"""
from __future__ import annotations

import asyncio
import csv
import io
import re
import secrets
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

import bcrypt
from routes.deps import db, logger, verify_token, EMERGENT_LLM_KEY
from utils.cloud_storage import mirror_url_to_cloudinary
from utils.dedupe import find_duplicate
from utils.email import send_email

router = APIRouter()
api_router = router


# Canonical schemas we map CSV columns into.
PROPERTY_FIELDS = {
    "title", "description", "area", "address", "rental_type", "property_type",
    "bedrooms", "bathrooms", "floor", "square_meters", "monthly_price",
    "nightly_price", "currency", "available_from", "starting_date",
    "minimum_booking_days", "condition", "furniture_option",
    "porches", "sukkah_compatible",
    "amenities", "images", "videos",
    # Owner-attribution fields (not stored on the property — used to look up / create the owner)
    "owner_email", "owner_name", "owner_phone",
}

USER_FIELDS = {"email", "name", "phone", "role"}


# --- AI column mapping ---------------------------------------------------

_PROPERTY_SYSTEM = (
    "You are a CSV-column mapper for a real-estate listings platform.\n"
    "Given a list of source column names, map each one to ONE of these canonical fields:\n"
    + ", ".join(sorted(PROPERTY_FIELDS)) +
    "\n\nRules:\n"
    "- If a column has no good match, map it to null.\n"
    "- 'beds' / 'BR' / 'br' / 'rooms' -> bedrooms\n"
    "- 'bath' / 'WC' -> bathrooms\n"
    "- 'price', 'rent', 'monthly' -> monthly_price; 'per night', 'nightly' -> nightly_price\n"
    "- 'neighborhood', 'area', 'location' -> area\n"
    "- 'street address', 'full address' -> address\n"
    "- 'sqm', 'm2', 'size' -> square_meters\n"
    "- 'photo', 'image', 'pic', 'picture', 'photos' (urls) -> images\n"
    "- 'owner email', 'landlord email', 'contact email' -> owner_email\n"
    "- 'long-term'/'short-term'/'vacation' -> rental_type\n"
    "Output ONLY a JSON object {source_col: canonical_field_or_null}."
)


async def _ai_map_columns(source_columns: list[str], schema: str = "property") -> dict[str, str | None]:
    """Use Claude (via emergent integrations) to map source CSV column
    names to our canonical schema. Returns {source_col: canonical_field}.
    """
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        if not EMERGENT_LLM_KEY:
            return _fallback_map(source_columns, schema)
        system = _PROPERTY_SYSTEM if schema == "property" else (
            "Map each source column to one of: " + ", ".join(sorted(USER_FIELDS)) +
            ". Output JSON {col: field_or_null}."
        )
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"csv-map-{uuid.uuid4().hex[:8]}", system_message=system).with_model("anthropic", "claude-sonnet-4-5-20250929")
        prompt = "Source columns: " + " | ".join(source_columns)
        msg = UserMessage(text=prompt)
        raw = await chat.send_message(msg)
        # Extract JSON object from the model output
        import json
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if not m:
            return _fallback_map(source_columns, schema)
        parsed = json.loads(m.group(0))
        allowed = PROPERTY_FIELDS if schema == "property" else USER_FIELDS
        return {k: (v if v in allowed else None) for k, v in parsed.items()}
    except Exception as e:  # noqa: BLE001
        logger.warning(f"AI column mapping failed, using fallback: {e}")
        return _fallback_map(source_columns, schema)


def _fallback_map(source_columns: list[str], schema: str) -> dict[str, str | None]:
    """Deterministic substring fuzzy-match — used when Claude is offline
    or returns garbage. Coarse but predictable."""
    rules = [
        # (token in lowercased source col, canonical field)
        ("title", "title"), ("name", "title"),
        ("description", "description"), ("desc", "description"),
        ("neighborhood", "area"), ("area", "area"), ("location", "area"),
        ("address", "address"), ("street", "address"),
        ("rental type", "rental_type"), ("rental_type", "rental_type"),
        ("type", "property_type"),
        ("bedrooms", "bedrooms"), ("beds", "bedrooms"), (" br", "bedrooms"), ("rooms", "bedrooms"),
        ("bathrooms", "bathrooms"), ("baths", "bathrooms"), ("bath", "bathrooms"),
        ("floor", "floor"),
        ("sqm", "square_meters"), ("m2", "square_meters"), ("square", "square_meters"), ("size", "square_meters"),
        ("monthly", "monthly_price"), ("rent", "monthly_price"), ("price", "monthly_price"),
        ("nightly", "nightly_price"), ("per night", "nightly_price"),
        ("currency", "currency"),
        ("available", "available_from"), ("start", "starting_date"),
        ("minimum", "minimum_booking_days"),
        ("condition", "condition"), ("furniture", "furniture_option"),
        ("porch", "porches"), ("sukkah", "sukkah_compatible"),
        ("amenities", "amenities"),
        ("photo", "images"), ("image", "images"), ("picture", "images"), ("pic", "images"),
        ("video", "videos"),
        ("owner email", "owner_email"), ("landlord email", "owner_email"),
        ("owner name", "owner_name"), ("landlord", "owner_name"),
        ("owner phone", "owner_phone"), ("landlord phone", "owner_phone"),
        # User import
        ("email", "email"),
        ("phone", "phone"),
        ("role", "role"),
    ]
    allowed = PROPERTY_FIELDS if schema == "property" else USER_FIELDS
    out: dict[str, str | None] = {}
    for col in source_columns:
        lc = " " + col.lower() + " "
        match = None
        for token, target in rules:
            if target in allowed and (" " + token + " ") in lc or token in lc:
                if target in allowed:
                    match = target
                    break
        out[col] = match
    # Special case: literal "name" maps to title for property schema, email for user schema
    for col in source_columns:
        if col.lower().strip() == "name":
            out[col] = "title" if schema == "property" else "name"
    return out


# --- CSV helpers ---------------------------------------------------------

def _parse_csv(text: str) -> tuple[list[str], list[dict]]:
    """Robustly parse CSV → (headers, rows). Sniffs the delimiter."""
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",\t;|")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)
    headers = reader.fieldnames or []
    rows = [{(k or "").strip(): (v or "").strip() for k, v in row.items()} for row in reader]
    return headers, rows


def _coerce_int(v: Any) -> int | None:
    if v in (None, ""):
        return None
    try:
        return int(float(str(v).replace(",", "").strip()))
    except (ValueError, TypeError):
        return None


def _coerce_float(v: Any) -> float | None:
    if v in (None, ""):
        return None
    try:
        return float(str(v).replace(",", "").replace("$", "").replace("₪", "").strip())
    except (ValueError, TypeError):
        return None


def _coerce_bool(v: Any) -> bool:
    return str(v).strip().lower() in ("1", "true", "yes", "y", "t")


def _split_list(v: Any) -> list[str]:
    if v in (None, ""):
        return []
    s = str(v)
    # Accept ;, |, or comma-separated. Commas inside URLs are rare; semicolon is most common in exports.
    parts = re.split(r"\s*[;|]\s*|\s*,\s*", s)
    return [p.strip() for p in parts if p.strip()]


def _build_property_doc(row_remapped: dict, owner_id: str) -> dict:
    """Convert a remapped row (canonical-field keyed) into a property doc
    ready to insert. Applies defaults + coercions identical to the manual
    create flow."""
    doc = {
        "id": str(uuid.uuid4()),
        "owner_id": owner_id,
        "title": (row_remapped.get("title") or "Imported listing")[:160],
        "description": row_remapped.get("description") or "",
        "area": row_remapped.get("area") or "",
        "address": row_remapped.get("address") or "",
        "rental_type": (row_remapped.get("rental_type") or "long-term").lower(),
        "property_type": (row_remapped.get("property_type") or "apartment").lower(),
        "bedrooms": _coerce_int(row_remapped.get("bedrooms")) or 1,
        "bathrooms": _coerce_int(row_remapped.get("bathrooms")) or 1,
        "floor": _coerce_int(row_remapped.get("floor")) or 0,
        "square_meters": _coerce_int(row_remapped.get("square_meters")) or 0,
        "monthly_price": _coerce_float(row_remapped.get("monthly_price")) or 0,
        "nightly_price": _coerce_float(row_remapped.get("nightly_price")) or 0,
        "currency": (row_remapped.get("currency") or "ILS").upper(),
        "available_from": row_remapped.get("available_from") or "",
        "starting_date": row_remapped.get("starting_date") or "",
        "minimum_booking_days": _coerce_int(row_remapped.get("minimum_booking_days")),
        "condition": (row_remapped.get("condition") or "renovated").lower(),
        "furniture_option": (row_remapped.get("furniture_option") or "no_furniture").lower(),
        "porches": _coerce_int(row_remapped.get("porches")) or 0,
        "sukkah_compatible": _coerce_bool(row_remapped.get("sukkah_compatible")),
        "amenities": _split_list(row_remapped.get("amenities")),
        "images": [],   # populated post-mirror
        "videos": [],   # populated post-mirror
        "status": "active",
        "liked_by": [],
        "created_at": datetime.now(UTC).isoformat(),
        "admin_imported": True,
    }
    return doc


async def _issue_reset_token(user_id: str, email: str) -> str:
    """Insert a password_resets doc (matching /auth/forgot-password format)
    so the imported user can finish onboarding via /auth/reset-password.
    Returns the raw token to embed in the email link."""
    from datetime import timedelta
    token = str(uuid.uuid4())
    expires_at = (datetime.now(UTC) + timedelta(hours=24)).isoformat()
    await db.password_resets.delete_many({"email": email})
    await db.password_resets.insert_one({
        "token": token,
        "email": email,
        "user_id": user_id,
        "expires_at": expires_at,
        "used": False,
        "created_at": datetime.now(UTC).isoformat(),
    })
    return token


def _frontend_origin() -> str:
    """Resolve frontend origin via the canonical FRONTEND_URL constant
    from email.py (which itself defaults to https://myisraelrental.com)."""
    from utils.email import FRONTEND_URL
    return (FRONTEND_URL or "https://myisraelrental.com").rstrip("/")


# --- Preview endpoint ----------------------------------------------------

class CsvPreviewRequest(BaseModel):
    csv_text: str
    schema_kind: str = "property"  # "property" | "user"


@api_router.post("/admin/import/preview")
async def preview_import(req: CsvPreviewRequest, payload: dict = Depends(verify_token)) -> dict:
    """Parse a pasted CSV, AI-map columns, return preview WITHOUT writing.

    Response shape:
      {
        headers: [...source column names...],
        column_map: { "Beds": "bedrooms", "Email Address": "owner_email", ... },
        sample_rows: [ first 5 rows, remapped to canonical fields ],
        warnings: [ "Column 'foo' has no canonical mapping" ],
        total_rows: 23,
      }
    """
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    if not req.csv_text.strip():
        raise HTTPException(status_code=400, detail="Empty CSV")

    headers, rows = _parse_csv(req.csv_text)
    if not headers:
        raise HTTPException(status_code=400, detail="No headers detected in CSV")

    column_map = await _ai_map_columns(headers, schema=req.schema_kind)

    # Re-map a sample for the preview UI
    def remap_row(row: dict) -> dict:
        return {(column_map.get(k) or f"__unmapped::{k}"): v for k, v in row.items()}

    sample = [remap_row(r) for r in rows[:5]]
    warnings = []
    unmapped = [c for c in headers if column_map.get(c) is None]
    if unmapped:
        warnings.append(f"No canonical mapping for: {', '.join(unmapped)}. Values from these columns will be ignored.")
    return {
        "headers": headers,
        "column_map": column_map,
        "sample_rows": sample,
        "warnings": warnings,
        "total_rows": len(rows),
    }


# --- Commit: properties --------------------------------------------------

class PropertyCommitRequest(BaseModel):
    csv_text: str
    column_map: dict[str, str | None] | None = None  # admin overrides
    mirror_images: bool = True


@api_router.post("/admin/import/properties/commit")
async def commit_property_import(req: PropertyCommitRequest, payload: dict = Depends(verify_token)) -> dict:
    """Write the imported properties to the DB.

    Steps per row:
      1. Resolve / create owner via the `owner_email` column (creates a
         placeholder user with a random password if missing, then emails
         them a "set password" reset link).
      2. Apply dedupe (same owner + address + rental_type) — skip with
         a clear error in the report if a collision is found.
      3. Mirror images to Cloudinary (best-effort, partial success ok).
      4. Insert.

    Image mirroring is fire-and-forget per URL — one broken URL can't
    break the whole row.
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

    for i, raw in enumerate(rows, start=1):
        try:
            remapped = {
                column_map.get(k): v for k, v in raw.items()
                if column_map.get(k) is not None
            }
            owner_email = (remapped.get("owner_email") or "").strip().lower()
            owner_name = remapped.get("owner_name") or remapped.get("owner_email") or "Owner"
            owner_phone = remapped.get("owner_phone") or ""

            if not owner_email:
                skipped.append({"index": i, "title": raw.get("title") or raw.get("Name"), "error": "Missing owner_email — can't attribute this listing."})
                continue

            owner = await db.users.find_one({"email": owner_email}, {"_id": 0, "id": 1})
            if owner is None:
                # Create a placeholder account; send a "set your password" email
                # so the new owner can finish onboarding without an admin handoff.
                tmp_password = secrets.token_urlsafe(20)
                pwd_hash = bcrypt.hashpw(tmp_password.encode(), bcrypt.gensalt()).decode()
                new_user_id = str(uuid.uuid4())
                await db.users.insert_one({
                    "id": new_user_id,
                    "email": owner_email,
                    "password": pwd_hash,
                    "name": owner_name,
                    "role": "owner",
                    "phone": owner_phone,
                    "created_at": datetime.now(UTC).isoformat(),
                    "email_verified": True,
                    "admin_imported": True,
                })
                # Issue a password-reset token + email so the owner can
                # claim the account immediately.
                raw_token = await _issue_reset_token(new_user_id, owner_email)
                link = f"{_frontend_origin()}/auth/reset-password?token={raw_token}"
                asyncio.create_task(send_email(
                    to_email=owner_email,
                    subject="Your MyIsraelRental account is ready — set your password",
                    html_body=(
                        f"<p>Hi {owner_name},</p>"
                        "<p>An administrator has set up your account on <b>MyIsraelRental.com</b> "
                        "and imported your listings.</p>"
                        f"<p>To get started, please set your password using the link below "
                        "(valid for 24 hours):</p>"
                        f"<p><a href=\"{link}\" style='background:#1E6A6A;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;'>Set my password</a></p>"
                        f"<p>Or copy and paste: {link}</p>"
                    ),
                    tag="admin-imported-owner",
                    skip_suppression_check=True,
                ))
                owner_id = new_user_id
                owners_created.append({"email": owner_email, "id": new_user_id})
            else:
                owner_id = owner["id"]

            # Dedupe — same rule as the manual create endpoint
            dup = await find_duplicate(
                db, owner_id=owner_id,
                address=remapped.get("address"),
                rental_type=remapped.get("rental_type"),
            )
            if dup:
                skipped.append({
                    "index": i, "title": raw.get("title") or raw.get("Name"),
                    "error": (
                        f"Duplicate of existing listing \"{dup.get('title')}\" — same address + "
                        f"{remapped.get('rental_type', 'rental type')} for this owner."
                    ),
                })
                continue

            doc = _build_property_doc(remapped, owner_id)

            # Mirror images to Cloudinary so we don't depend on the source host
            image_urls = _split_list(remapped.get("images"))
            video_urls = _split_list(remapped.get("videos"))
            if req.mirror_images and image_urls:
                results = await asyncio.gather(*[
                    mirror_url_to_cloudinary(u, is_video=False) for u in image_urls[:30]
                ], return_exceptions=False)
                doc["images"] = [r["url"] for r in results if r and r.get("url")]
            else:
                doc["images"] = image_urls
            if req.mirror_images and video_urls:
                results = await asyncio.gather(*[
                    mirror_url_to_cloudinary(u, is_video=True) for u in video_urls[:5]
                ], return_exceptions=False)
                doc["videos"] = [r["url"] for r in results if r and r.get("url")]
            else:
                doc["videos"] = video_urls

            await db.properties.insert_one(doc)
            created.append({"id": doc["id"], "title": doc["title"]})
        except Exception as e:  # noqa: BLE001
            skipped.append({"index": i, "title": raw.get("title") or raw.get("Name"), "error": f"Unexpected error: {e}"})

    return {
        "summary": {
            "total": len(rows),
            "created": len(created),
            "skipped": len(skipped),
            "owners_created": len(owners_created),
        },
        "created": created,
        "skipped": skipped,
        "owners_created": owners_created,
    }


# --- Commit: users -------------------------------------------------------

class UserCommitRequest(BaseModel):
    csv_text: str
    column_map: dict[str, str | None] | None = None
    default_role: str = "renter"


@api_router.post("/admin/import/users/commit")
async def commit_user_import(req: UserCommitRequest, payload: dict = Depends(verify_token)) -> dict:
    """Bulk-create users. Each new user gets an autogenerated password
    and a Postmark email containing a "set your password" link."""
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    headers, rows = _parse_csv(req.csv_text)
    if not rows:
        raise HTTPException(status_code=400, detail="No data rows in CSV")

    column_map = req.column_map or await _ai_map_columns(headers, schema="user")

    created: list[dict] = []
    skipped: list[dict] = []

    for i, raw in enumerate(rows, start=1):
        try:
            remapped = {
                column_map.get(k): v for k, v in raw.items()
                if column_map.get(k) is not None
            }
            email = (remapped.get("email") or "").strip().lower()
            name = remapped.get("name") or email
            phone = remapped.get("phone") or ""
            role = (remapped.get("role") or req.default_role).strip().lower()
            if role not in ("renter", "owner", "manager", "admin"):
                role = req.default_role

            if not email:
                skipped.append({"index": i, "error": "Missing email"})
                continue

            existing = await db.users.find_one({"email": email}, {"_id": 0, "id": 1})
            if existing:
                skipped.append({"index": i, "email": email, "error": "Already exists"})
                continue

            tmp_password = secrets.token_urlsafe(20)
            pwd_hash = bcrypt.hashpw(tmp_password.encode(), bcrypt.gensalt()).decode()
            new_user_id = str(uuid.uuid4())
            await db.users.insert_one({
                "id": new_user_id,
                "email": email,
                "password": pwd_hash,
                "name": name,
                "role": role,
                "phone": phone,
                "created_at": datetime.now(UTC).isoformat(),
                "email_verified": True,
                "admin_imported": True,
            })

            raw_token = await _issue_reset_token(new_user_id, email)
            link = f"{_frontend_origin()}/auth/reset-password?token={raw_token}"
            asyncio.create_task(send_email(
                to_email=email,
                subject="Welcome to MyIsraelRental — set your password",
                html_body=(
                    f"<p>Hi {name},</p>"
                    "<p>Your account on <b>MyIsraelRental.com</b> has been created.</p>"
                    f"<p>To activate it, please set your password (link valid 24h):</p>"
                    f"<p><a href=\"{link}\" style='background:#1E6A6A;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;'>Set my password</a></p>"
                    f"<p>Or copy and paste: {link}</p>"
                ),
                tag="admin-imported-user",
                skip_suppression_check=True,
            ))
            created.append({"id": new_user_id, "email": email, "role": role})
        except Exception as e:  # noqa: BLE001
            skipped.append({"index": i, "error": f"Unexpected error: {e}"})

    return {
        "summary": {"total": len(rows), "created": len(created), "skipped": len(skipped)},
        "created": created,
        "skipped": skipped,
    }
