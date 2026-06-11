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


# Header substrings that strongly signal a CSV is a property list vs a
# user list. Used by ``_detect_schema_kind`` when the admin sends
# ``schema_kind="auto"`` from the unified Import UI.
_PROPERTY_HEADER_HINTS = (
    "bed", "bath", "rent", "price", "monthly", "nightly", "sqm", "sq m",
    "m2", "m²", "square", "address", "neighborhood", "area", "location",
    "property", "apt", "apartment", "title", "rooms", "amenit",
    "furnish", "floor", "available", "image", "photo", "picture", "video",
    "owner email", "landlord", "rental",
)
_USER_HEADER_HINTS = ("role",)


def _detect_schema_kind(headers: list[str]) -> str:
    """Heuristic: is this CSV a list of properties or a list of users?

    Returns ``"property"`` or ``"user"``. Defaults to ``"property"`` when
    the signal is ambiguous (properties are the much more common import).
    """
    lowered = [h.lower() for h in headers]
    has_email = any("email" in h for h in lowered)
    has_role = any(h in {"role", "user role", "user_role"} for h in lowered)
    # A "role" column is a strong user-import signal; promote it over any
    # property-shaped substring matches (e.g. "Email Address" contains
    # "address", which would otherwise wrongly trip the property branch).
    if has_email and has_role:
        return "user"
    has_property_signal = any(
        any(hint in h for hint in _PROPERTY_HEADER_HINTS) for h in lowered
    )
    if has_property_signal:
        return "property"
    # Tiny user-only header set ({email,name,phone}) with no property hints.
    user_only = lowered and all(
        any(u in h for u in ("email", "name", "phone")) for h in lowered
    )
    if user_only:
        return "user"
    return "property"


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
    """Generic comma/semicolon/pipe splitter for short string lists
    like amenities. Do NOT use for URL lists — Cloudinary transformation
    URLs (``c_fill,w_400,h_300``) get shredded. Use ``_split_urls``
    instead for image/video columns.
    """
    if v in (None, ""):
        return []
    if isinstance(v, list):
        return [str(p).strip() for p in v if str(p).strip()]
    s = str(v)
    parts = re.split(r"\s*[;|]\s*|\s*,\s*", s)
    return [p.strip() for p in parts if p.strip()]


def _split_urls(v: Any) -> list[str]:
    """URL-aware splitter for image/video columns.

    Splits on ``;``, ``|``, and newlines. Splits on commas (and whitespace)
    ONLY when the next chunk looks like a new URL — this protects
    Cloudinary transformation URLs which use commas internally
    (``c_fill,w_400,h_300``). Without this guard, a single transform URL
    would be shredded into 3 broken pieces and every mirror call would
    fail silently, leaving the listing with no photos. This is exactly
    the symptom several real imports have shown.
    """
    if v in (None, ""):
        return []
    if isinstance(v, list):
        return [str(p).strip() for p in v if str(p).strip()]
    s = str(v)
    # Hard separators first: ; | newline.
    # Then: ", " (comma + whitespace) ONLY when followed by http(s)://.
    # Then: whitespace before http(s):// (handles space-separated URL lists).
    pattern = r"\s*[;|\n]\s*|,\s*(?=https?://)|\s+(?=https?://)"
    parts = re.split(pattern, s)
    out = []
    for p in parts:
        p = p.strip().strip(",")
        if p:
            out.append(p)
    return out


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


async def _resolve_or_create_owner(
    *, email: str, name: str | None, phone: str | None
) -> tuple[str, bool]:
    """Look up the user by email; if missing, create a placeholder owner
    account and fire-and-forget the "set your password" email so the new
    owner can finish onboarding without an admin handoff.

    Returns ``(owner_id, was_created)``. The caller decides what to do
    with the ``was_created`` flag (typically: log it in an import report).
    """
    email_lc = (email or "").strip().lower()
    if not email_lc:
        raise ValueError("Missing owner email")

    owner = await db.users.find_one({"email": email_lc}, {"_id": 0, "id": 1})
    if owner is not None:
        return owner["id"], False

    # Brand-new account — generate a throwaway hash, the owner picks the
    # real password via the reset link.
    tmp_password = secrets.token_urlsafe(20)
    pwd_hash = bcrypt.hashpw(tmp_password.encode(), bcrypt.gensalt()).decode()
    new_user_id = str(uuid.uuid4())
    display_name = (name or email_lc).strip() or email_lc
    await db.users.insert_one({
        "id": new_user_id,
        "email": email_lc,
        "password": pwd_hash,
        "name": display_name,
        "role": "owner",
        "phone": (phone or "").strip(),
        "created_at": datetime.now(UTC).isoformat(),
        "email_verified": True,
        "admin_imported": True,
    })

    raw_token = await _issue_reset_token(new_user_id, email_lc)
    link = f"{_frontend_origin()}/auth/reset-password?token={raw_token}"
    asyncio.create_task(send_email(
        to_email=email_lc,
        subject="Your MyIsraelRental account is ready — set your password",
        html_body=(
            f"<p>Hi {display_name},</p>"
            "<p>An administrator has set up your account on <b>MyIsraelRental.com</b> "
            "and added your listing(s).</p>"
            "<p>To get started, please set your password using the link below "
            "(valid for 24 hours):</p>"
            f"<p><a href=\"{link}\" style='background:#1E6A6A;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;'>Set my password</a></p>"
            f"<p>Or copy and paste: {link}</p>"
        ),
        tag="admin-imported-owner",
        skip_suppression_check=True,
    ))
    return new_user_id, True


# --- Preview endpoint ----------------------------------------------------

class CsvPreviewRequest(BaseModel):
    csv_text: str
    # "property" | "user" | "auto" — when "auto" the backend inspects the
    # CSV headers and decides which canonical schema to map against. The
    # unified Import tab in the admin UI always sends "auto".
    schema_kind: str = "auto"


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
        detected_schema_kind: "property" | "user",
      }
    """
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    if not req.csv_text.strip():
        raise HTTPException(status_code=400, detail="Empty CSV")

    # Wrap CSV parse + AI mapping in a try/except so any unexpected
    # parse error (weird encoding, malformed quoting, etc.) surfaces as
    # a useful 400 with a message — instead of a bare 500 that the
    # frontend can only render as a generic "Preview failed".
    try:
        headers, rows = _parse_csv(req.csv_text)
    except Exception as e:  # noqa: BLE001
        logger.exception("admin import preview: CSV parse failed")
        raise HTTPException(
            status_code=400,
            detail=f"Couldn't parse CSV: {type(e).__name__}: {str(e)[:160]}. "
                   "Check the file is valid CSV and try again.",
        ) from e
    if not headers:
        raise HTTPException(status_code=400, detail="No headers detected in CSV")

    # Auto-detection runs only when the admin didn't pin a schema explicitly.
    schema_kind = req.schema_kind
    if schema_kind == "auto":
        schema_kind = _detect_schema_kind(headers)

    try:
        column_map = await _ai_map_columns(headers, schema=schema_kind)
    except Exception:  # noqa: BLE001
        # _ai_map_columns already has an internal try/except + fallback,
        # but belt-and-braces in case the fallback itself raises.
        logger.exception("admin import preview: column mapping failed entirely")
        column_map = {h: None for h in headers}
        # Don't raise — the admin can still set the mapping manually.

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
        "detected_schema_kind": schema_kind,
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
    # Per-row tally of image/video URLs that arrived in the CSV vs. how
    # many actually landed on the property after Cloudinary mirroring.
    # Surfaces silent failures (Cloudinary off, bad URLs, rate limits)
    # that were previously dropping photos with no warning.
    media_report: list[dict] = []
    from utils.cloud_storage import CLOUDINARY_ENABLED

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

            owner_id, was_created = await _resolve_or_create_owner(
                email=owner_email, name=owner_name, phone=owner_phone,
            )
            if was_created:
                owners_created.append({"email": owner_email, "id": owner_id})

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
            image_urls = _split_urls(remapped.get("images"))
            video_urls = _split_urls(remapped.get("videos"))
            mirror_failures = []
            if req.mirror_images and image_urls and CLOUDINARY_ENABLED:
                results = await asyncio.gather(*[
                    mirror_url_to_cloudinary(u, is_video=False) for u in image_urls[:30]
                ], return_exceptions=False)
                mirrored = []
                for src_url, r in zip(image_urls[:30], results):
                    if r and r.get("url"):
                        mirrored.append(r["url"])
                    else:
                        mirror_failures.append(src_url)
                doc["images"] = mirrored
            else:
                # Either mirroring is off, or Cloudinary isn't configured —
                # keep the original URLs so the listing still has pictures
                # instead of silently dropping them.
                doc["images"] = image_urls
            if req.mirror_images and video_urls and CLOUDINARY_ENABLED:
                results = await asyncio.gather(*[
                    mirror_url_to_cloudinary(u, is_video=True) for u in video_urls[:5]
                ], return_exceptions=False)
                mirrored_vids = []
                for src_url, r in zip(video_urls[:5], results):
                    if r and r.get("url"):
                        mirrored_vids.append(r["url"])
                    else:
                        mirror_failures.append(src_url)
                doc["videos"] = mirrored_vids
            else:
                doc["videos"] = video_urls

            await db.properties.insert_one(doc)
            created.append({
                "id": doc["id"],
                "title": doc["title"],
                "images_count": len(doc.get("images", [])),
                "videos_count": len(doc.get("videos", [])),
            })
            # Track partial failures so the admin sees "12 listings created,
            # 4 with missing photos" instead of being told it all worked.
            if mirror_failures or (not doc.get("images") and image_urls):
                media_report.append({
                    "index": i,
                    "title": doc.get("title"),
                    "csv_image_count": len(image_urls),
                    "saved_image_count": len(doc.get("images", [])),
                    "failed_urls": mirror_failures[:5],
                })
        except Exception as e:  # noqa: BLE001
            skipped.append({"index": i, "title": raw.get("title") or raw.get("Name"), "error": f"Unexpected error: {e}"})

    return {
        "summary": {
            "total": len(rows),
            "created": len(created),
            "skipped": len(skipped),
            "owners_created": len(owners_created),
            "with_missing_photos": len(media_report),
            "cloudinary_enabled": bool(CLOUDINARY_ENABLED),
        },
        "created": created,
        "skipped": skipped,
        "owners_created": owners_created,
        "media_issues": media_report,
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



# --- Quick Add: single property via inline form -------------------------

class QuickAddPropertyRequest(BaseModel):
    """Single-property "quick add" request used by the admin Import tab.

    Differs from the bulk CSV flow in that:
      * Image / video URLs come from the frontend after the admin uploads
        the actual files via the existing Cloudinary signed-upload path
        (``uploadFilesFast``) — no CSV column needed.
      * Owner is auto-created from ``owner_email`` (with optional name /
        phone) if not already in the DB, and emailed a "set password"
        link, exactly like the bulk CSV flow.
      * Re-submissions with the same ``owner_email`` accumulate under
        the same owner account — perfect for "I have 5 listings from one
        landlord, add them one at a time" workflows.
    """
    owner_email: str
    owner_name: str | None = None
    owner_phone: str | None = None
    title: str
    area: str | None = None
    address: str | None = None
    description: str | None = None
    rental_type: str | None = "long-term"
    property_type: str | None = "apartment"
    bedrooms: int | None = None
    bathrooms: int | None = None
    floor: int | None = None
    square_meters: int | None = None
    monthly_price: float | None = None
    nightly_price: float | None = None
    currency: str | None = "ILS"
    available_from: str | None = None
    image_urls: list[str] = []
    video_urls: list[str] = []


@api_router.post("/admin/import/quick-add")
async def quick_add_property(
    req: QuickAddPropertyRequest, payload: dict = Depends(verify_token)
) -> dict:
    """Create one property under an auto-resolved owner account.

    Returns ``{owner: {id, email, was_created}, property: {id, title}}``
    so the frontend can show a friendly confirmation and offer to "Add
    another listing for this same owner" without re-typing the email.
    """
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    email = (req.owner_email or "").strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="owner_email is required")
    if not req.title or not req.title.strip():
        raise HTTPException(status_code=400, detail="title is required")

    try:
        owner_id, was_created = await _resolve_or_create_owner(
            email=email, name=req.owner_name, phone=req.owner_phone,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    # Reuse the same canonical-row → property doc builder so coercions /
    # defaults stay identical to the CSV path.
    remapped = {
        "title": req.title,
        "description": req.description or "",
        "area": req.area or "",
        "address": req.address or "",
        "rental_type": req.rental_type or "long-term",
        "property_type": req.property_type or "apartment",
        "bedrooms": req.bedrooms,
        "bathrooms": req.bathrooms,
        "floor": req.floor,
        "square_meters": req.square_meters,
        "monthly_price": req.monthly_price,
        "nightly_price": req.nightly_price,
        "currency": req.currency or "ILS",
        "available_from": req.available_from or "",
    }
    doc = _build_property_doc(remapped, owner_id)
    # Photos / videos arrive already-Cloudinary-hosted from the frontend
    # uploader, so no mirroring step is needed.
    doc["images"] = [u for u in req.image_urls if u and isinstance(u, str)]
    doc["videos"] = [u for u in req.video_urls if u and isinstance(u, str)]

    # Dedupe (same rule as bulk path) — skip if a collision exists.
    dup = await find_duplicate(
        db, owner_id=owner_id, address=doc["address"], rental_type=doc["rental_type"],
    )
    if dup:
        raise HTTPException(
            status_code=409,
            detail=(
                f"This owner already has a listing at the same address with "
                f"rental_type='{doc['rental_type']}' (title: \"{dup.get('title')}\"). "
                "Pick a different address or rental_type."
            ),
        )

    await db.properties.insert_one(doc)
    return {
        "owner": {"id": owner_id, "email": email, "was_created": was_created},
        "property": {"id": doc["id"], "title": doc["title"], "area": doc["area"]},
    }
