"""A business's own questions on its forms (Tzvi, 14 Oct 2026: the
Shopify idea, "let businesses add their own fields").

A gym asks for a signed waiver and an emergency contact at sign-up; a
bakery asks about allergies on every order. Rather than build each one,
the business writes the question and picks its kind:

    text      a short answer
    longtext  a few lines
    checkbox  a box to tick. Required means it must be ticked: a waiver or
              terms ("I agree to the gym rules").
    choice    one of the options the business lists
    number    a number
    date      a date

Two forms for now: `membership` (memberships.py, the sign-up) and `order`
(orders.py, the website order form). Fields live on the business document,
`custom_fields.<form>`. Each submission stores the answers with a copy of
the question, so renaming or removing a question later never changes what
a customer actually answered.
"""
from __future__ import annotations

import re
import uuid
from datetime import date
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from routes.deps import db, verify_token

router = APIRouter(prefix="/marketplace", tags=["marketplace"])

FORMS = ("membership", "order")
TYPES = ("text", "longtext", "checkbox", "choice", "number", "date")
MAX_FIELDS = 12


class FieldIn(BaseModel):
    id: Optional[str] = Field(None, max_length=40)
    label: str = Field(..., min_length=1, max_length=200)
    type: Literal["text", "longtext", "checkbox", "choice", "number", "date"] = "text"
    required: bool = False
    options: list[str] = Field(default_factory=list, max_length=20)
    help: Optional[str] = Field(None, max_length=300)


class FieldsIn(BaseModel):
    fields: list[FieldIn] = Field(default_factory=list, max_length=MAX_FIELDS)


def _clean(fields: list[FieldIn]) -> list[dict[str, Any]]:
    out, seen = [], set()
    for f in fields:
        fid = f.id if f.id and re.fullmatch(r"[A-Za-z0-9_-]{1,40}", f.id) and f.id not in seen else uuid.uuid4().hex[:10]
        seen.add(fid)
        opts = [o.strip()[:80] for o in f.options if o and o.strip()] if f.type == "choice" else []
        if f.type == "choice" and len(opts) < 2:
            raise HTTPException(status_code=422, detail=f"“{f.label}” needs at least two options to choose from")
        out.append({"id": fid, "label": f.label.strip(), "type": f.type, "required": f.required,
                    "options": opts, "help": (f.help or "").strip() or None})
    return out


def public_fields(biz: dict[str, Any], form: str) -> list[dict[str, Any]]:
    return list(((biz.get("custom_fields") or {}).get(form)) or [])


def check_answers(biz: dict[str, Any], form: str, answers: Optional[dict[str, Any]]) -> list[dict[str, Any]]:
    """The customer's answers, checked against the business's questions.
    Returns [{id, label, type, value}] in the business's order; raises 400
    with the question's own wording when a required one is missing."""
    answers = answers or {}
    out = []
    for f in public_fields(biz, form):
        raw = answers.get(f["id"])
        t = f["type"]
        if t == "checkbox":
            val: Any = raw is True or str(raw).lower() in ("true", "1", "yes", "on")
            if f.get("required") and not val:
                raise HTTPException(status_code=400, detail=f"Please tick: {f['label']}")
        else:
            val = "" if raw is None else str(raw).strip()[: (2000 if t == "longtext" else 300)]
            if not val:
                if f.get("required"):
                    raise HTTPException(status_code=400, detail=f"Please answer: {f['label']}")
                continue
            if t == "choice" and val not in f.get("options", []):
                raise HTTPException(status_code=400, detail=f"Please choose one of the options for: {f['label']}")
            if t == "number":
                try:
                    float(val)
                except ValueError as exc:
                    raise HTTPException(status_code=400, detail=f"Please enter a number for: {f['label']}") from exc
            if t == "date":
                try:
                    date.fromisoformat(val)
                except ValueError as exc:
                    raise HTTPException(status_code=400, detail=f"Please enter a date for: {f['label']}") from exc
        out.append({"id": f["id"], "label": f["label"], "type": t, "value": val})
    return out


def answers_text(answers: list[dict[str, Any]]) -> str:
    """One line per answer, for the order notes and plain-text surfaces."""
    lines = []
    for a in answers:
        v = a["value"]
        if a["type"] == "checkbox":
            v = "Yes" if v else "No"
        lines.append(f"{a['label']}: {v}")
    return "\n".join(lines)


async def _owned(business_id: str, user: dict[str, Any]) -> dict[str, Any]:
    biz = await db.businesses.find_one({"_id": business_id})
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    if biz.get("owner_user_id") != user["user_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your business")
    return biz


@router.get("/businesses/{business_id}/custom-fields")
async def get_fields(business_id: str, user=Depends(verify_token)):
    biz = await _owned(business_id, user)
    return {f: public_fields(biz, f) for f in FORMS}


@router.put("/businesses/{business_id}/custom-fields/{form}")
async def set_fields(business_id: str, form: Literal["membership", "order"], body: FieldsIn, user=Depends(verify_token)):
    await _owned(business_id, user)
    fields = _clean(body.fields)
    await db.businesses.update_one({"_id": business_id}, {"$set": {f"custom_fields.{form}": fields}})
    return {"form": form, "fields": fields}
