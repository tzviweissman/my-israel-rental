"""Admin routes for chat oversight (list all conversations, re-attach
orphaned chats to a surviving listing) and the owner-nudge system —
both the admin-triggered "poke this owner now" button and the every-30-min
background sweep that emails owners with stale renter inquiries.

Extracted from ``admin.py`` in the 2026-07 refactor. Public names —
``run_auto_owner_nudge_pass`` and ``AUTO_NUDGE_LOOP_INTERVAL_SEC`` — are
preserved verbatim so ``server.py``'s startup hook keeps importing them.
"""
import asyncio
import uuid
from datetime import UTC, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from models_response import ConversationOut, MessageResponse
from routes.deps import db, logger, verify_token
from utils.events import publish

router = APIRouter()
api_router = router


class ReattachChatsRequest(BaseModel):
    """Move every chat / booking / like / block that points at one
    property_id over to another. Used to rescue orphan conversations
    when a duplicate listing was deleted in the past without re-linking.
    """
    from_property_id: str
    to_property_id: str


@api_router.post("/admin/chats/reattach")
async def admin_reattach_chats(
    req: ReattachChatsRequest, payload: dict = Depends(verify_token),
) -> dict:
    """Manually re-point all references from one property_id to another.

    Use case: a duplicate was deleted before we shipped the
    auto-reattach on duplicate-resolve. The renter's chat now opens
    "Property not found"; pasting the dead id + the surviving twin's id
    here fixes it. Validates the target exists. Source must NOT exist
    (we don't merge two live listings via this API)."""
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    src = (req.from_property_id or "").strip()
    dst = (req.to_property_id or "").strip()
    if not src or not dst:
        raise HTTPException(status_code=400, detail="Both property ids are required")
    if src == dst:
        raise HTTPException(status_code=400, detail="Source and target must differ")

    dst_doc = await db.properties.find_one({"id": dst}, {"_id": 0, "id": 1, "title": 1})
    if not dst_doc:
        raise HTTPException(status_code=404, detail=f"Target property '{dst}' not found")
    src_doc = await db.properties.find_one({"id": src}, {"_id": 0, "id": 1})
    if src_doc:
        raise HTTPException(
            status_code=400,
            detail=f"Source property '{src}' still exists — use the duplicate resolver to merge two live listings",
        )

    msgs_r = await db.messages.update_many(
        {"property_id": src}, {"$set": {"property_id": dst}},
    )
    bookings_r = await db.bookings.update_many(
        {"property_id": src}, {"$set": {"property_id": dst}},
    )
    nudges_r = await db.chat_nudges.update_many(
        {"property_id": src}, {"$set": {"property_id": dst}},
    )
    blocks_r = await db.admin_blocks.update_many(
        {"property_id": src}, {"$set": {"property_id": dst}},
    )
    subleases_r = await db.subleases.update_many(
        {"original_property_id": src}, {"$set": {"original_property_id": dst}},
    )
    # Likes need the same de-dupe pass as the duplicate resolver: a user
    # who already liked the destination would otherwise end up with a
    # second row that points at the same property.
    keeper_likers = {
        row["user_id"]
        async for row in db.liked_properties.find(
            {"property_id": dst}, {"_id": 0, "user_id": 1}
        )
    }
    if keeper_likers:
        await db.liked_properties.delete_many({
            "property_id": src, "user_id": {"$in": list(keeper_likers)},
        })
    likes_r = await db.liked_properties.update_many(
        {"property_id": src}, {"$set": {"property_id": dst}},
    )

    await publish("invalidate", {
        "prefixes": ["/api/chat", "/api/admin/chats", "/api/properties"],
    })
    return {
        "from_property_id": src,
        "to_property_id": dst,
        "to_property_title": dst_doc.get("title"),
        "reattached": {
            "messages": msgs_r.modified_count,
            "bookings": bookings_r.modified_count,
            "likes": likes_r.modified_count,
            "nudges": nudges_r.modified_count,
            "blocks": blocks_r.modified_count,
            "subleases": subleases_r.modified_count,
        },
    }


@api_router.get("/admin/chats", response_model=list[ConversationOut])
async def get_all_chats(payload: dict = Depends(verify_token)) -> list[dict]:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    messages = await db.messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)

    # A message without a sender, receiver or property is not a
    # conversation. It used to be a KeyError here, which made the admin's
    # ENTIRE chat view a 500 - the one place an admin would look to find
    # the bad row. Logged and skipped instead.
    complete = []
    for m in messages:
        if all(m.get(k) for k in ("sender_id", "receiver_id", "property_id")):
            complete.append(m)
        else:
            logger.warning("GET /admin/chats skipped message %s missing a party or property", m.get("id"))
    messages = complete

    # Pre-fetch every user + property referenced by these messages in a
    # couple of bulk queries — avoids the per-message find_one round-trips
    # that used to dominate the runtime for large message sets.
    user_ids = {m["sender_id"] for m in messages} | {m["receiver_id"] for m in messages}
    prop_ids = {m["property_id"] for m in messages}
    users_by_id = {
        u["id"]: u
        for u in await db.users.find(
            {"id": {"$in": list(user_ids)}},
            {"_id": 0, "id": 1, "name": 1, "role": 1, "email": 1},
        ).to_list(len(user_ids) + 1)
    }
    props_by_id = {
        p["id"]: p
        for p in await db.properties.find(
            {"id": {"$in": list(prop_ids)}},
            {"_id": 0, "id": 1, "title": 1, "owner_id": 1},
        ).to_list(len(prop_ids) + 1)
    }

    conversations: dict[str, dict] = {}
    for msg in messages:
        conv_key = f"{msg['property_id']}_{min(msg['sender_id'], msg['receiver_id'])}_{max(msg['sender_id'], msg['receiver_id'])}"
        if conv_key not in conversations:
            prop = props_by_id.get(msg["property_id"])
            sender = users_by_id.get(msg["sender_id"]) or {}
            receiver = users_by_id.get(msg["receiver_id"]) or {}
            conversations[conv_key] = {
                "conv_key": conv_key,
                "property_id": msg["property_id"],
                "property_title": (prop or {}).get("title", "Unknown"),
                "owner_id": (prop or {}).get("owner_id"),
                # True when the referenced property has been deleted — lets
                # the admin UI render a "Listing removed — re-attach to a
                # surviving listing?" badge with a one-click resolver.
                "property_missing": prop is None,
                "participants": [
                    {"id": msg["sender_id"], "name": sender.get("name", "Unknown"), "role": sender.get("role", ""), "email": sender.get("email", "")},
                    {"id": msg["receiver_id"], "name": receiver.get("name", "Unknown"), "role": receiver.get("role", ""), "email": receiver.get("email", "")},
                ],
                "messages": [],
                # Filled in below — `messages` is iterated newest-first so
                # the first encountered message is the latest one.
                "last_message_time": msg["created_at"],
                "last_message_sender_id": msg["sender_id"],
                "last_message_preview": (msg.get("message") or "")[:160],
            }
        conversations[conv_key]["messages"].append({
            "sender_id": msg["sender_id"],
            "message": msg["message"],
            "image_url": msg.get("image_url"),
            "video_url": msg.get("video_url"),
            "created_at": msg["created_at"],
        })

    # Sort each conv's messages chronologically (oldest → newest) so the UI
    # reads top-to-bottom like a normal chat thread. Then compute the
    # "owner unresponsive" signal: the *renter* sent the latest message
    # AND it's been > 24h with no owner reply. Per-conv metadata also
    # carries last_nudge_sent_at so the frontend can hide the nudge
    # button after a recent email was sent.
    now = datetime.now(UTC)
    out: list[dict] = []
    for conv in conversations.values():
        conv["messages"].sort(key=lambda m: m.get("created_at") or "")
        owner_id = conv.get("owner_id")
        # Identify the renter participant — whichever participant isn't the owner.
        renter = next(
            (p for p in conv["participants"] if p["id"] != owner_id),
            None,
        )
        last_sender_role = "owner" if conv["last_message_sender_id"] == owner_id else "renter"
        # Hours since the most recent message, only if last sender is the
        # renter (we don't nudge owners who've already replied).
        hours_since = None
        unresponsive = False
        try:
            last_dt = datetime.fromisoformat(conv["last_message_time"].replace("Z", "+00:00"))
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=UTC)
            hours_since = (now - last_dt).total_seconds() / 3600.0
        except Exception:
            hours_since = None
        if last_sender_role == "renter" and hours_since is not None and hours_since >= 12:
            unresponsive = True

        # Read throttle: when was the last nudge email sent for this conv?
        nudge_doc = await db.chat_nudges.find_one({"conv_key": conv["conv_key"]}, {"_id": 0, "sent_at": 1})
        last_nudge_at = (nudge_doc or {}).get("sent_at")

        conv["last_sender_role"] = last_sender_role
        conv["hours_since_last_message"] = round(hours_since, 1) if hours_since is not None else None
        conv["owner_unresponsive"] = unresponsive
        conv["renter_id"] = (renter or {}).get("id")
        conv["last_nudge_sent_at"] = last_nudge_at
        out.append(conv)

    # Sort the whole list newest-first so the admin sees the active
    # conversations at the top of the page.
    out.sort(key=lambda c: c.get("last_message_time") or "", reverse=True)
    return out


class NudgeOwnerRequest(BaseModel):
    """Sends a courtesy email reminding the property owner to reply to a
    renter inquiry. Throttled to one nudge per ``conv_key`` per 24h to
    avoid spamming owners after the admin auto-batches a scan."""
    conv_key: str


@api_router.post("/admin/chats/nudge-owner")
async def nudge_owner(req: NudgeOwnerRequest, payload: dict = Depends(verify_token)) -> dict:
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")

    # conv_key shape from get_all_chats: "<property_id>_<user_a>_<user_b>"
    try:
        property_id, user_a, user_b = req.conv_key.split("_", 2)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Malformed conv_key") from e

    prop = await db.properties.find_one({"id": property_id}, {"_id": 0, "title": 1, "owner_id": 1})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    owner_id = prop.get("owner_id")
    renter_id = user_b if user_a == owner_id else (user_a if user_b == owner_id else None)
    if not owner_id or not renter_id:
        raise HTTPException(status_code=400, detail="Couldn't identify owner / renter for this conversation")

    owner = await db.users.find_one({"id": owner_id}, {"_id": 0, "name": 1, "email": 1})
    renter = await db.users.find_one({"id": renter_id}, {"_id": 0, "name": 1})
    if not owner or not owner.get("email"):
        raise HTTPException(status_code=400, detail="Owner has no email on file")

    # Re-verify the conversation is still actually waiting on the owner —
    # don't send a nudge if they've replied in the interim (UI may be stale).
    latest = await db.messages.find_one(
        {
            "property_id": property_id,
            "$or": [
                {"sender_id": owner_id, "receiver_id": renter_id},
                {"sender_id": renter_id, "receiver_id": owner_id},
            ],
        },
        {"_id": 0, "sender_id": 1, "created_at": 1},
        sort=[("created_at", -1)],
    )
    if not latest or latest["sender_id"] == owner_id:
        raise HTTPException(
            status_code=409,
            detail="Owner has already replied — no nudge needed.",
        )

    # 24h throttle.
    now = datetime.now(UTC)
    existing = await db.chat_nudges.find_one({"conv_key": req.conv_key}, {"_id": 0, "sent_at": 1})
    if existing and existing.get("sent_at"):
        try:
            sent_dt = datetime.fromisoformat(existing["sent_at"].replace("Z", "+00:00"))
            if sent_dt.tzinfo is None:
                sent_dt = sent_dt.replace(tzinfo=UTC)
            hours_since = (now - sent_dt).total_seconds() / 3600.0
            if hours_since < 24:
                raise HTTPException(
                    status_code=429,
                    detail=f"A nudge was already sent {round(hours_since, 1)}h ago — try again after 24h.",
                )
        except HTTPException:
            raise
        except Exception:
            pass

    # Compose the courtesy email — shared helper drives the copy so the
    # admin-manual and auto-loop nudges stay in lockstep.
    prop_title = prop.get("title") or "your listing"

    # Record the throttle row BEFORE dispatching so a second click within
    # seconds gets 429'd (the response hasn't returned yet).
    await db.chat_nudges.update_one(
        {"conv_key": req.conv_key},
        {"$set": {
            "conv_key": req.conv_key,
            "property_id": property_id,
            "owner_id": owner_id,
            "renter_id": renter_id,
            "sent_at": now.isoformat(),
            "sent_by_admin": payload.get("user_id"),
            "source": "admin",
            "email_status": "queued",
        }},
        upsert=True,
    )

    asyncio.create_task(_send_owner_nudge_email(
        property_id=property_id,
        owner=owner,
        renter=renter,
        prop_title=prop_title,
        source="admin",
    ))

    return {
        "owner_email": owner["email"],
        "owner_name": owner.get("name"),
        "sent_at": now.isoformat(),
    }


# ---------------------------------------------------------------------------
# Auto owner-nudge — background pass that emails owners whose renter-inbound
# conversation has been unanswered for AUTO_NUDGE_STALE_HOURS. Same email
# body + throttle collection as the admin-triggered version, so:
#   * the admin UI's "Nudge sent Xh ago" pill stays accurate,
#   * an admin click will 429 if the auto-pass fired within 24h,
#   * and vice versa (auto skips if an admin nudge already fired).
# ---------------------------------------------------------------------------

AUTO_NUDGE_STALE_HOURS = 12
AUTO_NUDGE_THROTTLE_HOURS = 24
AUTO_NUDGE_LOOP_INTERVAL_SEC = 1800  # 30 min


async def _send_owner_nudge_email(
    *,
    property_id: str,
    owner: dict,
    renter: Optional[dict],
    prop_title: str,
    source: str,
) -> None:
    """Compose + dispatch the courtesy email. Shared by the admin-manual
    route and the auto-pass runner. Copy references the 12h delay so it
    matches the automated cadence."""
    from utils.email import send_email, FRONTEND_URL

    inbox_link = f"{(FRONTEND_URL or 'https://myisraelrental.com').rstrip('/')}/chat/{property_id}"
    renter_name = (renter or {}).get("name") or "a prospective renter"
    tag = "auto-owner-nudge" if source == "auto" else "admin-owner-nudge"

    await send_email(
        to_email=owner["email"],
        subject=f"Reminder: {renter_name} is waiting to hear from you about {prop_title}",
        html_body=(
            f"<p>Hi {owner.get('name') or ''},</p>"
            f"<p><b>{renter_name}</b> messaged you about <b>{prop_title}</b> on MyIsraelRental "
            f"more than 12 hours ago and hasn't heard back yet.</p>"
            f"<p>Replies within a day dramatically increase the chance the listing gets rented — "
            f"prospective tenants usually message several owners in parallel and lock in with whoever replies first.</p>"
            f"<p style='margin:24px 0;'>"
            f"<a href=\"{inbox_link}\" style='background:#1E6A6A;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;'>Open the conversation</a>"
            f"</p>"
            f"<p style='color:#888;font-size:13px;'>If you no longer have this listing available, "
            f"please mark it as unavailable in your dashboard so we stop showing it. "
            f"You can turn these reminders off from Dashboard → Settings.</p>"
        ),
        tag=tag,
        skip_suppression_check=False,
    )


async def run_auto_owner_nudge_pass(logger_prefix: str = "auto-nudge") -> dict:
    """Single pass: find every conversation whose latest message is from a
    renter and has been sitting unanswered for ``AUTO_NUDGE_STALE_HOURS``,
    then send a throttled email to the owner. Returns a small stats blob
    for the log entry so admins can see what the last run did."""
    now = datetime.now(UTC)
    cutoff = now - timedelta(hours=AUTO_NUDGE_STALE_HOURS)
    cutoff_iso = cutoff.isoformat()

    # Aggregate the newest message per (property, participant-pair) —
    # matches the same key shape used by the admin chats view so both
    # feeds converge on the same conv_key namespace.
    stats = {"scanned": 0, "sent": 0, "throttled": 0, "already_replied": 0, "no_email": 0, "opted_out": 0, "errors": 0}
    async for msg in db.messages.aggregate([
        {"$match": {"created_at": {"$lte": cutoff_iso}}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": {
                "property_id": "$property_id",
                "pair": {"$cond": [
                    {"$lt": ["$sender_id", "$receiver_id"]},
                    ["$sender_id", "$receiver_id"],
                    ["$receiver_id", "$sender_id"],
                ]},
            },
            "latest": {"$first": "$$ROOT"},
        }},
    ]):
        stats["scanned"] += 1
        latest = msg.get("latest") or {}
        property_id = latest.get("property_id")
        sender_id = latest.get("sender_id")
        receiver_id = latest.get("receiver_id")
        created_iso = latest.get("created_at")
        if not (property_id and sender_id and receiver_id and created_iso):
            continue

        # Skip if the freshest message is already newer than the cutoff.
        try:
            created_dt = datetime.fromisoformat(created_iso.replace("Z", "+00:00"))
            if created_dt.tzinfo is None:
                created_dt = created_dt.replace(tzinfo=UTC)
        except Exception:  # noqa: BLE001
            continue
        if created_dt > cutoff:
            continue

        prop = await db.properties.find_one(
            {"id": property_id}, {"_id": 0, "title": 1, "owner_id": 1},
        )
        if not prop:
            continue
        owner_id = prop.get("owner_id")
        if not owner_id:
            continue

        # We only nudge when the renter is the *latest* sender.
        if sender_id == owner_id:
            stats["already_replied"] += 1
            continue
        renter_id = sender_id if receiver_id == owner_id else (receiver_id if sender_id == owner_id else None)
        if not renter_id or renter_id == owner_id:
            continue

        conv_key = f"{property_id}_{min(owner_id, renter_id)}_{max(owner_id, renter_id)}"

        # Throttle — one nudge (of any source) per conv per 24h.
        existing = await db.chat_nudges.find_one({"conv_key": conv_key}, {"_id": 0, "sent_at": 1})
        if existing and existing.get("sent_at"):
            try:
                sent_dt = datetime.fromisoformat(existing["sent_at"].replace("Z", "+00:00"))
                if sent_dt.tzinfo is None:
                    sent_dt = sent_dt.replace(tzinfo=UTC)
                if (now - sent_dt).total_seconds() / 3600.0 < AUTO_NUDGE_THROTTLE_HOURS:
                    stats["throttled"] += 1
                    continue
            except Exception:  # noqa: BLE001
                pass

        owner = await db.users.find_one({"id": owner_id}, {"_id": 0, "name": 1, "email": 1, "auto_nudge_opt_out": 1})
        if not owner or not owner.get("email"):
            stats["no_email"] += 1
            continue
        # Explicit opt-out — a single boolean under users.auto_nudge_opt_out.
        # Absent field defaults to False so this is opt-in-to-quiet.
        if owner.get("auto_nudge_opt_out"):
            stats["opted_out"] += 1
            continue

        renter = await db.users.find_one({"id": renter_id}, {"_id": 0, "name": 1})

        # Write the throttle row BEFORE emailing so a concurrent second
        # pass (or an admin click) inside the same second can't double-fire.
        await db.chat_nudges.update_one(
            {"conv_key": conv_key},
            {"$set": {
                "conv_key": conv_key,
                "property_id": property_id,
                "owner_id": owner_id,
                "renter_id": renter_id,
                "sent_at": now.isoformat(),
                "sent_by_admin": None,
                "source": "auto",
                "email_status": "queued",
            }},
            upsert=True,
        )
        try:
            await _send_owner_nudge_email(
                property_id=property_id,
                owner=owner,
                renter=renter,
                prop_title=prop.get("title") or "your listing",
                source="auto",
            )
            stats["sent"] += 1
        except Exception as e:  # noqa: BLE001
            stats["errors"] += 1
            logger.warning("[%s] send_email failed for conv=%s: %s", logger_prefix, conv_key, e)

    # Persist a run log so admins can see the last runs from the Chats tab.
    await db.admin_auto_nudge_log.insert_one({
        "_id": str(uuid.uuid4()),
        "ran_at": now.isoformat(),
        **stats,
    })
    logger.info("[%s] pass complete: %s", logger_prefix, stats)
    return stats


@api_router.get("/admin/auto-owner-nudge/status")
async def auto_owner_nudge_status(payload: dict = Depends(verify_token)) -> dict:
    """Return the last 20 auto-nudge runs so the admin Chats tab can render
    a "auto-nudges on · 12h threshold" strip with counts."""
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    runs = await db.admin_auto_nudge_log.find({}, {"_id": 0}).sort("ran_at", -1).to_list(20)
    return {
        "enabled": True,
        "stale_hours": AUTO_NUDGE_STALE_HOURS,
        "throttle_hours": AUTO_NUDGE_THROTTLE_HOURS,
        "runs": runs,
    }


@api_router.post("/admin/auto-owner-nudge/run-now")
async def auto_owner_nudge_run_now(payload: dict = Depends(verify_token)) -> dict:
    """Admin escape hatch — triggers a scan on demand. Same code path as
    the background loop, so any bug shows up here without waiting 30 min."""
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    stats = await run_auto_owner_nudge_pass(logger_prefix="auto-nudge-manual")
    return stats


@api_router.put("/user/auto-nudge-opt-out", response_model=MessageResponse)
async def set_auto_nudge_opt_out(request: Request, payload: dict = Depends(verify_token)) -> dict:
    """Owner-facing toggle. Owners who don't want the 12h auto-reminder
    can flip this flag from Dashboard → Settings. Doesn't affect the
    admin-triggered nudge (admins can still push a reminder manually)."""
    body = await request.json()
    opt_out = bool(body.get("opt_out", False))
    await db.users.update_one({"id": payload["user_id"]}, {"$set": {"auto_nudge_opt_out": opt_out}})
    return {"message": "Auto-nudge preference saved"}
