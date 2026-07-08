"""Property routes — shared helpers used by every sub-module.

Extracted from ``properties.py`` in the 2026-07 refactor.
"""

# Set of rental_type values that Stays browses. Kept here so
# `_normalize_rental_types` can drop bad enum values before they land in
# the query filter.
_VALID_RENTAL_TYPES = {"long-term", "short-term", "vacation", "sublease"}


# Whitelist of fields the Bulk Manager is permitted to set/update.
# Mirrors the editable surface of ``PropertyCreate``; excludes
# server-managed fields like owner_id, status, images, videos, created_at.
# Lives here so ``bulk.py`` and ``crud.py`` share one source of truth.
_BULK_EDITABLE_FIELDS: set[str] = {
    "title", "description", "rental_type", "property_type",
    "bedrooms", "bathrooms", "floor",
    "area", "address",
    "square_meters", "porch_square_meters", "porches",
    "has_elevator", "is_shabbat_elevator", "is_tama", "sukkah_compatible",
    "has_agent_fee", "agent_fee_price", "agent_fee_currency",
    "has_cleaning_fee", "cleaning_fee_price", "cleaning_fee_currency",
    "max_guests",
    "condition", "furniture_option", "amenities",
    "monthly_price", "nightly_price", "currency",
    "cancellation_policy", "custom_cancellation_policy",
    "available_from", "starting_date", "minimum_booking_days",
    "checkin_time", "checkout_time",
}


def _normalize_rental_types(doc: dict) -> None:
    """Rewrite `rental_types` in-place so it's a de-duplicated list that
    always includes the primary `rental_type`. Empty / missing input →
    single-element list. Filters out unknown enum values silently."""
    primary = doc.get("rental_type")
    incoming = doc.get("rental_types") or []
    merged = [primary] + [t for t in incoming if t != primary]
    seen: set[str] = set()
    cleaned: list[str] = []
    for t in merged:
        if t and t in _VALID_RENTAL_TYPES and t not in seen:
            seen.add(t)
            cleaned.append(t)
    doc["rental_types"] = cleaned or ([primary] if primary else [])
