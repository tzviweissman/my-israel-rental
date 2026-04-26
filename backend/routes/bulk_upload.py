"""Bulk property upload — parse, preview, commit, attach images.

5-step owner wizard on the frontend (Template → Input → Preview → Images → Done).
Backend workflow:
  1. GET  /properties/bulk/template    → download CSV/XLSX template
  2. POST /properties/bulk/parse       → dry-run: parse file/text, validate every row,
                                          return preview + errors (no DB writes)
  3. POST /properties/bulk/commit      → create every valid row in a single transaction
  4. POST /properties/bulk/images      → (optional) upload a ZIP, match files by name,
                                          attach to the newly-created properties

The CSV format is defined by COLUMNS below — matching the fields in PropertyCreate.
Lists (amenities, image_filenames) use `;` as the separator because commas collide
with the CSV delimiter and most owners know semicolons from ICS/export formats.
"""
import csv
import io
import json
import uuid
import zipfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ValidationError

from models import PropertyCreate
from routes.deps import UPLOAD_DIR, db, verify_token

router = APIRouter()
api_router = router


# Columns accepted in the CSV/XLSX/paste input. Order is authoritative — this
# is what we emit for the template too.
COLUMNS = [
    "title", "description", "rental_type", "property_type",
    "bedrooms", "bathrooms", "floor", "area", "address",
    "square_meters", "porch_square_meters", "porches",
    "has_elevator", "is_shabbat_elevator", "is_tama", "sukkah_compatible",
    "condition", "furniture_option", "amenities",
    "monthly_price", "nightly_price", "currency",
    "cancellation_policy", "available_from", "starting_date", "minimum_booking_days",
    "image_filenames",
]

REQUIRED = {"title", "rental_type", "property_type", "bedrooms", "area"}

_BOOL_TRUE = {"true", "yes", "y", "1", "x", "✓"}
_BOOL_FALSE = {"false", "no", "n", "0", ""}


class BulkCommitBody(BaseModel):
    rows: List[dict]


def _parse_bool(val: Any) -> bool:
    if isinstance(val, bool):
        return val
    s = str(val or "").strip().lower()
    if s in _BOOL_TRUE:
        return True
    if s in _BOOL_FALSE:
        return False
    raise ValueError(f"expected yes/no, got '{val}'")


def _parse_number(val: Any, caster: Any, field: str) -> Any:
    if val in (None, "", "-"):
        return None
    try:
        return caster(val)
    except (ValueError, TypeError):
        raise ValueError(f"'{field}' must be a number (got '{val}')")


def _split_list(val: Any) -> list:
    if not val:
        return []
    if isinstance(val, list):
        return [str(x).strip() for x in val if str(x).strip()]
    return [x.strip() for x in str(val).split(";") if x.strip()]


def _normalize_row(raw: dict) -> dict:
    """Turn one input-dict (string-valued) into a PropertyCreate-ready dict.
    Raises ValueError with a friendly message on the first bad field."""
    row = {k: (raw.get(k) if raw.get(k) not in (None, "") else None) for k in COLUMNS}

    # Required fields
    for field in REQUIRED:
        if not row.get(field):
            raise ValueError(f"'{field}' is required")

    # Enums (soft-validate — backend Pydantic will hard-enforce)
    rt = str(row["rental_type"]).strip().lower().replace(" ", "-")
    if rt not in {"long-term", "short-term", "vacation", "storage"}:
        raise ValueError(f"rental_type must be long-term/short-term/vacation/storage (got '{row['rental_type']}')")
    row["rental_type"] = rt

    for bool_field in ("has_elevator", "is_shabbat_elevator", "is_tama", "sukkah_compatible"):
        row[bool_field] = _parse_bool(row.get(bool_field))

    for int_field in ("bedrooms", "bathrooms", "floor", "porches", "minimum_booking_days"):
        row[int_field] = _parse_number(row.get(int_field), lambda v: int(float(v)), int_field)

    for num_field in ("square_meters", "porch_square_meters", "monthly_price", "nightly_price"):
        row[num_field] = _parse_number(row.get(num_field), float, num_field)

    row["amenities"] = _split_list(row.get("amenities"))
    row["image_filenames"] = _split_list(row.get("image_filenames"))

    # Currency default
    if row.get("currency"):
        row["currency"] = str(row["currency"]).strip().upper()
    else:
        row["currency"] = "ILS"

    # Defaults that match PropertyCreate
    row.setdefault("property_type", "apartment")
    row["bathrooms"] = row.get("bathrooms") or 1
    row["floor"] = row.get("floor") or 1
    row["porches"] = row.get("porches") or 0
    row["condition"] = row.get("condition") or "good"
    row["furniture_option"] = row.get("furniture_option") or "no_furniture"
    row["cancellation_policy"] = row.get("cancellation_policy") or "flexible"

    return row


def _validate_row(row: dict) -> str | None:
    """Run Pydantic validation. Returns None if OK, otherwise a short error string."""
    # Strip fields that PropertyCreate doesn't know about (image_filenames is
    # our own meta, not a DB field).
    payload = {k: v for k, v in row.items() if k != "image_filenames"}
    try:
        PropertyCreate(**payload)
        return None
    except ValidationError as e:
        first = e.errors()[0]
        loc = ".".join(str(x) for x in first["loc"])
        return f"{loc}: {first['msg']}"


# ------------------------ PARSERS ------------------------

def _parse_csv(text: str) -> List[dict]:
    reader = csv.DictReader(io.StringIO(text))
    return [{(k or "").strip().lower(): v for k, v in row.items()} for row in reader]


def _parse_xlsx(content: bytes) -> List[dict]:
    from openpyxl import load_workbook
    wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []
    headers = [str(h).strip().lower() if h else "" for h in rows[0]]
    out = []
    for r in rows[1:]:
        if r is None or all(c in (None, "") for c in r):
            continue
        out.append({headers[i]: r[i] if i < len(r) else None for i in range(len(headers)) if headers[i]})
    return out


def _parse_paste(text: str) -> List[dict]:
    """Accept tab- or comma-separated paste content."""
    text = text.strip()
    if not text:
        return []
    delimiter = "\t" if "\t" in text.splitlines()[0] else ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    return [{(k or "").strip().lower(): v for k, v in row.items()} for row in reader]


# ------------------------ ENDPOINTS ------------------------

@api_router.get("/properties/bulk/template")
async def download_template(fmt: str = "csv") -> StreamingResponse:
    """Stream a blank CSV template with instructions in row 2."""
    if fmt not in ("csv", "xlsx"):
        raise HTTPException(status_code=400, detail="fmt must be csv or xlsx")

    samples = {
        "title": "Cozy Jerusalem Apartment",
        "description": "Bright 2BR with a balcony",
        "rental_type": "long-term",
        "property_type": "apartment",
        "bedrooms": "2", "bathrooms": "1", "floor": "3",
        "area": "Jerusalem - Rehavia", "address": "King George 10",
        "square_meters": "75", "porch_square_meters": "8", "porches": "1",
        "has_elevator": "yes", "is_shabbat_elevator": "no",
        "is_tama": "no", "sukkah_compatible": "yes",
        "condition": "good", "furniture_option": "furnished",
        "amenities": "WiFi;AC;Washing Machine",
        "monthly_price": "6500", "nightly_price": "", "currency": "ILS",
        "cancellation_policy": "flexible",
        "available_from": "2026-09-01", "starting_date": "",
        "minimum_booking_days": "",
        "image_filenames": "apt1_front.jpg;apt1_kitchen.jpg",
    }
    if fmt == "csv":
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(COLUMNS)
        w.writerow([samples.get(c, "") for c in COLUMNS])
        buf.seek(0)
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=bulk_properties_template.csv"},
        )
    # xlsx
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Properties"
    ws.append(COLUMNS)
    ws.append([samples.get(c, "") for c in COLUMNS])
    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    return StreamingResponse(
        out,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=bulk_properties_template.xlsx"},
    )


@api_router.post("/properties/bulk/parse")
async def parse_bulk(
    file: UploadFile | None = File(None),
    text: str | None = Form(None),
    payload: dict = Depends(verify_token),
) -> dict:
    """Dry run: parse the input and return [{row, normalized, errors}]. No DB writes."""
    if payload.get("role") not in ("owner", "manager", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and managers can bulk-upload")

    raw_rows: List[dict] = []
    if file is not None:
        content = await file.read()
        name = (file.filename or "").lower()
        if name.endswith(".csv"):
            raw_rows = _parse_csv(content.decode("utf-8-sig"))
        elif name.endswith(".xlsx"):
            raw_rows = _parse_xlsx(content)
        else:
            raise HTTPException(status_code=400, detail="Upload a .csv or .xlsx file")
    elif text:
        raw_rows = _parse_paste(text)
    else:
        raise HTTPException(status_code=400, detail="Provide a file or pasted text")

    if not raw_rows:
        return {"rows": [], "summary": {"total": 0, "valid": 0, "invalid": 0}}

    preview = []
    for i, raw in enumerate(raw_rows, start=1):
        entry: dict[str, Any] = {"index": i, "raw": raw, "errors": []}
        try:
            normalized = _normalize_row(raw)
            err = _validate_row(normalized)
            if err:
                entry["errors"].append(err)
            entry["normalized"] = normalized
        except ValueError as e:
            entry["errors"].append(str(e))
        preview.append(entry)

    total = len(preview)
    valid = sum(1 for p in preview if not p["errors"])
    return {"rows": preview, "summary": {"total": total, "valid": valid, "invalid": total - valid}}


@api_router.post("/properties/bulk/commit")
async def commit_bulk(body: BulkCommitBody, payload: dict = Depends(verify_token)) -> dict:
    """Create every row in `body.rows`. Rows must already be normalized (call /parse first)."""
    if payload.get("role") not in ("owner", "manager", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and managers can bulk-upload")

    created = []
    skipped = []
    for i, row in enumerate(body.rows, start=1):
        # Always re-normalize + re-validate. Coercions are idempotent so it's safe
        # to run even if the caller already sent clean values.
        try:
            normalized = _normalize_row(row)
            err = _validate_row(normalized)
            if err:
                skipped.append({"index": i, "title": row.get("title"), "error": err})
                continue
            property_id = str(uuid.uuid4())
            image_filenames = normalized.pop("image_filenames", [])
            doc = PropertyCreate(**{k: v for k, v in normalized.items() if k != "image_filenames"}).model_dump()
            doc.update({
                "id": property_id,
                "owner_id": payload["user_id"],
                "images": [],
                "videos": [],
                "created_at": datetime.now(UTC).isoformat(),
                "status": "active",
                "liked_by": [],
                "pending_image_filenames": image_filenames,  # resolved later by /bulk/images
                "bulk_created": True,  # drives the "NEW" badge on the dashboard for 24h
            })
            await db.properties.insert_one(doc)
            created.append({"index": i, "id": property_id, "title": doc["title"], "image_filenames": image_filenames})
        except Exception as e:
            skipped.append({"index": i, "title": row.get("title"), "error": str(e)})

    return {"created": created, "skipped": skipped, "summary": {"created": len(created), "skipped": len(skipped)}}


@api_router.post("/properties/bulk/images")
async def attach_bulk_images(
    file: UploadFile = File(...),
    mapping: str = Form(...),
    payload: dict = Depends(verify_token),
) -> dict:
    """Unzip `file`, match entries by filename, and attach to properties.

    `mapping` is a JSON string: {property_id: [filename1, filename2, ...]}.
    Owner must own each property_id.
    """
    if payload.get("role") not in ("owner", "manager", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and managers can bulk-upload")

    try:
        property_map: dict = json.loads(mapping)
    except Exception:
        raise HTTPException(status_code=400, detail="mapping must be JSON: {property_id: [filenames]}")

    content = await file.read()
    try:
        zf = zipfile.ZipFile(io.BytesIO(content))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="file is not a valid .zip")

    # Build filename → zip-entry lookup (basename only; owners often zip a folder)
    entries = {Path(n).name: n for n in zf.namelist() if not n.endswith("/")}

    results: dict[str, list] = {"attached": [], "missing": [], "not_owned": []}
    for prop_id, filenames in property_map.items():
        prop = await db.properties.find_one({"id": prop_id}, {"_id": 0, "owner_id": 1, "images": 1})
        if not prop:
            results["not_owned"].append(prop_id)
            continue
        if prop.get("owner_id") != payload["user_id"] and payload.get("role") != "admin":
            results["not_owned"].append(prop_id)
            continue

        new_image_urls = list(prop.get("images") or [])
        attached_any = False
        for fname in filenames:
            entry = entries.get(Path(fname).name)
            if entry is None:
                results["missing"].append({"property_id": prop_id, "filename": fname})
                continue
            # Extract to uploads/
            data = zf.read(entry)
            ext = Path(fname).suffix.lower() or ".jpg"
            if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"):
                results["missing"].append({"property_id": prop_id, "filename": fname, "reason": "unsupported type"})
                continue
            safe_name = f"{uuid.uuid4().hex}{ext}"
            out_path = UPLOAD_DIR / safe_name
            out_path.write_bytes(data)
            new_image_urls.append(f"/api/uploads/{safe_name}")
            results["attached"].append({"property_id": prop_id, "filename": fname, "url": f"/api/uploads/{safe_name}"})
            attached_any = True

        # Only patch the doc if we actually attached something — otherwise preserve
        # `pending_image_filenames` so the owner can re-try with a different zip.
        if attached_any:
            await db.properties.update_one(
                {"id": prop_id},
                {"$set": {"images": new_image_urls}, "$unset": {"pending_image_filenames": ""}},
            )

    return results


@api_router.post("/properties/bulk/images/attach")
async def attach_bulk_images_flat(
    mapping: str = Form(...),
    files: List[UploadFile] = File(...),
    payload: dict = Depends(verify_token),
) -> dict:
    """Attach N individual image uploads to properties by a property_id→[filename] map.

    This is the flat-file sibling of /properties/bulk/images. Owners drop
    loose files (from the "Needs Images" filter drop-zone) instead of zipping
    first — the frontend just sends the raw File objects alongside a mapping.
    """
    if payload.get("role") not in ("owner", "manager", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and managers can bulk-upload")

    try:
        property_map: dict = json.loads(mapping)
    except Exception:
        raise HTTPException(status_code=400, detail="mapping must be JSON: {property_id: [filenames]}")

    # Read every uploaded file into a dict keyed by basename (matches the zip path)
    file_bytes: dict = {}
    for f in files:
        name = Path(f.filename or "").name
        if name:
            file_bytes[name] = await f.read()

    allowed_exts = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif")
    results: dict[str, list] = {"attached": [], "missing": [], "not_owned": []}
    for prop_id, filenames in property_map.items():
        prop = await db.properties.find_one({"id": prop_id}, {"_id": 0, "owner_id": 1, "images": 1})
        if not prop:
            results["not_owned"].append(prop_id)
            continue
        if prop.get("owner_id") != payload["user_id"] and payload.get("role") != "admin":
            results["not_owned"].append(prop_id)
            continue

        new_image_urls = list(prop.get("images") or [])
        attached_any = False
        for fname in filenames:
            basename = Path(fname).name
            data = file_bytes.get(basename)
            if data is None:
                results["missing"].append({"property_id": prop_id, "filename": fname})
                continue
            ext = Path(basename).suffix.lower() or ".jpg"
            if ext not in allowed_exts:
                results["missing"].append({"property_id": prop_id, "filename": fname, "reason": "unsupported type"})
                continue
            safe_name = f"{uuid.uuid4().hex}{ext}"
            out_path = UPLOAD_DIR / safe_name
            out_path.write_bytes(data)
            new_image_urls.append(f"/api/uploads/{safe_name}")
            results["attached"].append({"property_id": prop_id, "filename": fname, "url": f"/api/uploads/{safe_name}"})
            attached_any = True

        if attached_any:
            await db.properties.update_one(
                {"id": prop_id},
                {"$set": {"images": new_image_urls}, "$unset": {"pending_image_filenames": ""}},
            )

    return results
