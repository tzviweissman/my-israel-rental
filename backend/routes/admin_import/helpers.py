"""Admin CSV import — shared helpers and constants.

Extracted from ``admin_import.py`` in the 2026-07 refactor. Contains
the canonical schema definitions, the Claude-backed AI column mapper
with its deterministic fallback, all row parsing/coercion utilities,
the "build property doc" transformer, and the owner-resolve/create
flow used by the property-commit endpoint.

External test files import several of these helpers directly. Re-exports
in ``__init__.py`` keep those imports working unchanged.
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

from fastapi import HTTPException

import bcrypt
from routes.deps import db, logger, EMERGENT_LLM_KEY
from utils.email import send_email


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
    s = str(v)
    # Strip currency symbols + tokens so cells like "$1,200", "5000 USD",
    # "₪ 4,500/month", "NIS 3500" all coerce cleanly. The per-row currency
    # sniff happens separately on the original string.
    for token in ("$", "₪", "€"):
        s = s.replace(token, "")
    for token in ("USD", "usd", "NIS", "nis", "ILS", "ils", "EUR", "eur",
                  "shekel", "Shekel", "SHEKEL", "dollar", "Dollar", "DOLLAR",
                  "/month", "/Month", "/MONTH", "/night", "/Night", "/NIGHT",
                  "per month", "per night"):
        s = s.replace(token, "")
    s = s.replace(",", "").strip()
    try:
        return float(s)
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


def _sniff_currency(remapped: dict, raw: dict, default: str = "ILS") -> str:
    """Look across the price cells + any explicit currency cell to decide
    what currency this row is in. Lets a CSV with no currency column
    (or a mixed one) classify each row correctly instead of dumping
    every vacation listing priced in dollars into ILS.

    Order of preference:
      1. Explicit currency cell — accept ``ILS``/``NIS``/``₪`` → ILS,
         ``USD``/``$`` → USD, ``EUR``/``€`` → EUR.
      2. Symbols anywhere in monthly_price / nightly_price / price cells.
      3. The provided default.
    """
    def _norm(token: Any) -> str | None:
        t = str(token or "").strip().lower()
        if not t:
            return None
        if "₪" in t or "ils" in t or "nis" in t or "shekel" in t or "שח" in t or "ש״ח" in t:
            return "ILS"
        if "$" in t or "usd" in t or "dollar" in t:
            return "USD"
        if "€" in t or "eur" in t:
            return "EUR"
        return None

    # 1. Explicit currency cell on the remapped row.
    explicit = _norm(remapped.get("currency"))
    if explicit:
        return explicit
    # 2. Price cells — peek at the raw value for symbols/words. Check
    #    canonical monthly/nightly first, then any source column whose
    #    name contains "price".
    for key in ("monthly_price", "nightly_price"):
        sym = _norm(remapped.get(key))
        if sym:
            return sym
    for col, val in raw.items():
        if "price" in (col or "").lower():
            sym = _norm(val)
            if sym:
                return sym
    return default


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


def _build_property_doc(row_remapped: dict, owner_id: str, default_rental_type: str = "long-term") -> dict:
    """Convert a remapped row (canonical-field keyed) into a property doc
    ready to insert. Applies defaults + coercions identical to the manual
    create flow.

    ``default_rental_type`` is used when the CSV row has no rental_type
    value of its own. Critical when the file is e.g. ``vacation_rentals.csv``
    without an explicit column — previously every such row silently fell
    through to ``long-term`` and then sat invisible on the Vacation tab.
    """
    # Decide which rental_type this row ends up as so we can route a
    # generic "price" column to the correct nightly/monthly field. A
    # vacation_rentals.csv with a single ``price`` column was previously
    # mapped to ``monthly_price``, leaving every imported vacation card
    # showing ₪0/night because ``nightly_price`` was empty.
    effective_rt = (row_remapped.get("rental_type") or default_rental_type or "long-term").lower()
    mp = _coerce_float(row_remapped.get("monthly_price"))
    np = _coerce_float(row_remapped.get("nightly_price"))
    if effective_rt in ("vacation", "short-term") and (mp and mp > 0) and not (np and np > 0):
        np, mp = mp, None  # treat the generic price as a nightly rate
    elif effective_rt == "long-term" and (np and np > 0) and not (mp and mp > 0):
        mp, np = np, None  # treat the generic price as a monthly rate

    doc = {
        "id": str(uuid.uuid4()),
        "owner_id": owner_id,
        "title": (row_remapped.get("title") or "Imported listing")[:160],
        "description": row_remapped.get("description") or "",
        "area": row_remapped.get("area") or "",
        "address": row_remapped.get("address") or "",
        "rental_type": effective_rt,
        "property_type": (row_remapped.get("property_type") or "apartment").lower(),
        "bedrooms": _coerce_int(row_remapped.get("bedrooms")) or 1,
        "bathrooms": _coerce_int(row_remapped.get("bathrooms")) or 1,
        "floor": _coerce_int(row_remapped.get("floor")) or 0,
        "square_meters": _coerce_int(row_remapped.get("square_meters")) or 0,
        "monthly_price": mp or 0,
        "nightly_price": np or 0,
        "currency": (row_remapped.get("currency") or "ILS").upper(),        "available_from": row_remapped.get("available_from") or "",
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
