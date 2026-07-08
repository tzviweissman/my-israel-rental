"""Admin routes for the "paid document services" catalog (Arnona,
name-change, etc.).

Extracted from ``admin.py`` in the 2026-07 refactor. Nothing behavioural
changed — same endpoints, same shapes, same auth gate.
"""
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException

from models_response import MessageResponse, ServiceRequestOut, ServiceRevenueResponse
from routes.deps import db, verify_token
from routes.payments import SERVICE_PRETTY, VALID_DOC_SERVICES
from utils.events import publish

router = APIRouter()
api_router = router


@api_router.get("/admin/document-services", response_model=list[ServiceRequestOut])
async def get_all_document_services(payload: dict = Depends(verify_token)) -> list[dict]:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    services = await db.document_services.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for svc in services:
        user = await db.users.find_one({"id": svc.get("user_id")}, {"_id": 0, "name": 1, "email": 1})
        svc["user_name"] = user.get("name", "Unknown") if user else "Unknown"
        svc["user_email"] = user.get("email", "") if user else ""
    return services


@api_router.put("/admin/document-services/{service_id}/status", response_model=MessageResponse)
async def update_service_status(service_id: str, status: str, payload: dict = Depends(verify_token)) -> dict:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    if status not in ["pending", "in_progress", "completed", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    await db.document_services.update_one({"id": service_id}, {"$set": {"status": status}})
    await publish("invalidate", {"prefixes": ["/api/admin/document-services", "/api/admin/dashboard"]})
    return {"message": f"Service status updated to {status}"}


@api_router.get("/admin/document-services/revenue", response_model=ServiceRevenueResponse)
async def get_document_services_revenue(
    window_days: int = 30,
    payload: dict = Depends(verify_token),
) -> dict:
    """Per-service revenue breakdown for the admin dashboard widget.

    Sums the per-row ``paid_amount_usd`` field on ``document_services``
    entries created within the last ``window_days``. Pass ``window_days=0``
    to get the all-time total.
    """
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    window_days = max(0, min(window_days, 3650))

    match: dict = {"paid": True}
    if window_days > 0:
        cutoff = (datetime.now(UTC) - timedelta(days=window_days)).isoformat()
        match["created_at"] = {"$gte": cutoff}

    pipeline = [
        {"$match": match},
        {
            "$group": {
                "_id": "$service_type",
                "count": {"$sum": 1},
                "revenue_usd": {"$sum": {"$ifNull": ["$paid_amount_usd", 0]}},
            }
        },
    ]
    cursor = db.document_services.aggregate(pipeline)
    raw = await cursor.to_list(100)

    # Make sure every catalog service is represented (even if it earned $0
    # this window) so the widget can always render the full ladder.
    by_type = {row["_id"]: row for row in raw if row.get("_id")}
    rows = []
    for service_type in VALID_DOC_SERVICES:
        agg = by_type.get(service_type) or {}
        rows.append({
            "service_type": service_type,
            "label": SERVICE_PRETTY.get(service_type, service_type),
            "count": int(agg.get("count", 0)),
            "revenue_usd": round(float(agg.get("revenue_usd", 0.0)), 2),
        })
    rows.sort(key=lambda r: r["revenue_usd"], reverse=True)

    return {
        "window_days": window_days,
        "total_revenue_usd": round(sum(r["revenue_usd"] for r in rows), 2),
        "total_filings": sum(r["count"] for r in rows),
        "rows": rows,
    }
