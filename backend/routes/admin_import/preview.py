"""CSV preview endpoint — AI-maps columns, returns sample rows +
mapping overrides for the admin to review before committing.

Extracted from ``admin_import.py`` in the 2026-07 refactor.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from routes.deps import verify_token, logger

from .helpers import (
    PROPERTY_FIELDS,
    USER_FIELDS,
    _ai_map_columns,
    _detect_schema_kind,
    _fallback_map,
    _parse_csv,
)

router = APIRouter()
api_router = router


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

