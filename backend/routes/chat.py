"""Auto-extracted from server.py during the 2026-04 refactor."""
import asyncio
import logging
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException

from models import ChatMessage, EditMessage, TranslateMessageRequest, TypingPing
from models_response import (
    ConversationOut,
    IdMessageResponse,
    MessageOut,
    MessageResponse,
    TranslatedMessageResponse,
    TypingStatusResponse,
)
from routes.deps import db, verify_token
from utils.chat_translate import detect_language, translate_chat_message
from utils.email import send_chat_message_email
from utils.mentions import current_user_role_in_property, extract_mentions
from utils.whatsapp import send_renter_message_notification

router = APIRouter()
api_router = router  # alias so existing @api_router decorators work verbatim

logger = logging.getLogger(__name__)

# How long a typing ping is considered "live" for the counterparty.
_TYPING_TTL_SECONDS = 5

# Strong references for fire-and-forget email tasks. Python's asyncio
# only holds weak refs to running tasks — without this set, the GC can
# collect a task mid-Postmark-call and the email vanishes silently.
# We add on schedule + discard on completion, so the set stays small.
# https://docs.python.org/3/library/asyncio-task.html#asyncio.create_task
_bg_email_tasks: set[asyncio.Task] = set()


def _schedule_bg_email(coro) -> asyncio.Task:
    """Wrap ``asyncio.create_task`` with strong-reference tracking so the
    event-loop scheduler can't garbage-collect our fire-and-forget task
    before it finishes talking to Postmark."""
    task = asyncio.create_task(coro)
    _bg_email_tasks.add(task)
    task.add_done_callback(_bg_email_tasks.discard)
    return task


@api_router.post("/chat/messages", response_model=IdMessageResponse)
async def send_message(chat_data: ChatMessage, payload: dict = Depends(verify_token)) -> dict:
    message_id = str(uuid.uuid4())
    mentions = extract_mentions(chat_data.message)
    # Image-only / video-only messages are allowed — but message must be
    # non-empty if no media is attached.
    has_media = bool(chat_data.image_url or chat_data.video_url)
    if not chat_data.message.strip() and not has_media:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    message_doc = {
        "id": message_id,
        "property_id": chat_data.property_id,
        "sender_id": payload['user_id'],
        "receiver_id": chat_data.receiver_id,
        "message": chat_data.message,
        "image_url": chat_data.image_url,
        "video_url": chat_data.video_url,
        # Stored at write-time so the inbox can flag unread @-mentions of the
        # current user without re-scanning every message body on each fetch.
        "mentions": mentions,
        "created_at": datetime.now(UTC).isoformat(),
        "read": False
    }
    
    await db.messages.insert_one(message_doc)
    
    # Notification body adapts to what was sent — image vs video vs text.
    if chat_data.message.strip():
        notif_body = "You have a new message"
    elif chat_data.video_url:
        notif_body = "Sent you a video 🎬"
    elif chat_data.image_url:
        notif_body = "Sent you a photo 📷"
    else:
        notif_body = "You have a new message"
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": chat_data.receiver_id,
        "type": "new_message",
        "property_id": chat_data.property_id,
        # Capture the sender so the lister can deep-link straight into the
        # conversation (knowing who they are replying to).
        "sender_id": payload['user_id'],
        "message": notif_body,
        "read": False,
        "created_at": datetime.now(UTC).isoformat()
    }
    await db.notifications.insert_one(notification)

    # Fire-and-forget email to the recipient — routed through
    # ``_schedule_bg_email`` so the task keeps a strong reference and
    # can't get garbage-collected before Postmark responds. Response
    # stays snappy; Postmark's HTTP call runs on the worker thread
    # inside ``send_email()`` itself.
    _schedule_bg_email(
        _send_chat_email_safe(
            sender_id=payload["user_id"],
            receiver_id=chat_data.receiver_id,
            property_id=chat_data.property_id,
            message_body=chat_data.message,
            image_url=chat_data.image_url,
            video_url=chat_data.video_url,
        )
    )

    return {"id": message_id, "message": "Message sent successfully"}


async def _recipient_is_actively_in_chat(
    *, sender_id: str, receiver_id: str, property_id: str, window_seconds: int = 120
) -> bool:
    """Did the recipient open/read a message from this sender in the last N
    seconds? If so they're already inside the conversation and we shouldn't
    pile on with a "new message" email."""
    cutoff = (datetime.now(UTC) - timedelta(seconds=window_seconds)).isoformat()
    recent = await db.messages.find_one(
        {
            "property_id": property_id,
            "sender_id": sender_id,
            "receiver_id": receiver_id,
            "read": True,
            "read_at": {"$gte": cutoff},
        },
        {"_id": 0, "id": 1},
    )
    return bool(recent)


async def _was_recently_emailed(
    *, sender_id: str, receiver_id: str, property_id: str, window_seconds: int = 300
) -> bool:
    """Did we already email this recipient for this conversation in the last
    N seconds? Throttles bursts so a 20-message exchange doesn't generate
    20 emails."""
    cutoff = (datetime.now(UTC) - timedelta(seconds=window_seconds)).isoformat()
    last = await db.chat_email_throttle.find_one(
        {
            "receiver_id": receiver_id,
            "sender_id": sender_id,
            "property_id": property_id,
            "sent_at": {"$gte": cutoff},
        },
        {"_id": 0, "sent_at": 1},
    )
    return bool(last)


async def _send_chat_email_safe(
    *,
    sender_id: str,
    receiver_id: str,
    property_id: str,
    message_body: str,
    image_url: str | None,
    video_url: str | None = None,
) -> None:
    """Resolve sender/receiver/property and email the recipient. Swallows all
    errors — chat sends must never fail because of an email problem."""
    try:
        if not receiver_id or sender_id == receiver_id:
            return

        # Rule A: throttle so a rapid back-and-forth doesn't spam inboxes.
        if await _was_recently_emailed(
            sender_id=sender_id, receiver_id=receiver_id, property_id=property_id
        ):
            return

        # Rule B: skip if the recipient is actively reading this conversation.
        if await _recipient_is_actively_in_chat(
            sender_id=sender_id, receiver_id=receiver_id, property_id=property_id
        ):
            return

        receiver = await db.users.find_one(
            {"id": receiver_id},
            {"_id": 0, "email": 1, "name": 1, "phone": 1, "preferred_language": 1},
        )
        if not receiver or not receiver.get("email"):
            return
        sender = await db.users.find_one(
            {"id": sender_id}, {"_id": 0, "name": 1}
        )
        sender_name = (sender or {}).get("name") or "Someone"
        prop = await db.properties.find_one(
            {"id": property_id}, {"_id": 0, "title": 1}
        )
        # Fall back to the Jobs Board when the id doesn't match a live
        # property — chat threads spawned from a poster clicking
        # "Message" on an applicant are keyed by the job UUID. Prefixed
        # with "Job:" so the email subject reads naturally:
        #   "New message about Job: Need a barber for a wedding"
        if not prop:
            job = await db.marketplace_jobs.find_one(
                {"_id": property_id}, {"_id": 0, "title": 1}
            )
            if job and job.get("title"):
                property_title = f"Job: {job['title']}"
            else:
                # Third source: the Requests board. A thread opened from
                # "Message seeker" is keyed by the request UUID, so without
                # this the subject degrades to "your conversation" and the
                # seeker cannot tell which of their requests it is about.
                req = await db.requests.find_one(
                    {"_id": property_id}, {"_id": 0, "title": 1}
                )
                property_title = (
                    f"Request: {req['title']}" if req and req.get("title")
                    else "your conversation"
                )
        else:
            property_title = prop.get("title") or "your conversation"

        sent = await send_chat_message_email(
            to_email=receiver["email"],
            receiver_name=receiver.get("name") or "",
            sender_name=sender_name,
            message_snippet=message_body or "",
            has_image=bool(image_url) or bool(video_url),
            property_id=property_id,
            property_title=property_title,
            sender_id=sender_id,
        )

        # Record the send (even on Postmark failure) so we still throttle —
        # otherwise a permanently-bouncing inbox would retry every message.
        await db.chat_email_throttle.update_one(
            {
                "receiver_id": receiver_id,
                "sender_id": sender_id,
                "property_id": property_id,
            },
            {
                "$set": {
                    "sent_at": datetime.now(UTC).isoformat(),
                    "delivered": bool(sent),
                }
            },
            upsert=True,
        )

        # Fire WhatsApp ping alongside the email. Uses the same throttle
        # gate (we're inside it) so a back-and-forth burst doesn't spam
        # the lister. Graceful no-op when WhatsApp env vars aren't set.
        if receiver.get("phone"):
            try:
                await send_renter_message_notification(
                    recipient_phone=receiver["phone"],
                    recipient_name=receiver.get("name") or "",
                    sender_name=sender_name,
                    # Deep link: the in-app chat page expects a property_id
                    # query param so the conversation opens directly.
                    conversation_path=f"chat?property_id={property_id}&peer_id={sender_id}",
                    language=receiver.get("preferred_language") or "en",
                )
            except Exception as exc:  # noqa: BLE001
                logger.warning("WhatsApp notify failed (chat): %s", exc)
    except Exception as e:  # noqa: BLE001 - never let chat sends fail
        logger.error("chat email task failed: %s", e)


@api_router.delete("/chat/messages/{message_id}", response_model=MessageResponse)
async def delete_message(
    message_id: str, payload: dict = Depends(verify_token)
) -> dict:
    """Hard-delete a single message. Only the sender may delete their own.

    Both participants stop seeing the message after this. Notifications are
    not affected — the recipient may have already opened the chat."""
    msg = await db.messages.find_one({"id": message_id}, {"_id": 0, "sender_id": 1})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.get("sender_id") != payload['user_id']:
        raise HTTPException(status_code=403, detail="You can only delete your own messages")
    await db.messages.delete_one({"id": message_id})
    return {"message": "Message deleted"}


# Edit window (seconds): callers may amend their own message for the first 5
# minutes after sending, mirroring WhatsApp/Slack-style etiquette.
_EDIT_WINDOW_SECONDS = 5 * 60


@api_router.put("/chat/messages/{message_id}", response_model=MessageResponse)
async def edit_message(
    message_id: str,
    body: EditMessage,
    payload: dict = Depends(verify_token),
) -> dict:
    """Edit a single message body. Sender-only, within the 5-minute window.

    Sets ``edited_at`` so the UI can render an *edited* tag. Stale cached
    translations are wiped so the next translate request re-runs Claude."""
    if not body.message or not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    msg = await db.messages.find_one(
        {"id": message_id},
        {"_id": 0, "sender_id": 1, "created_at": 1},
    )
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.get("sender_id") != payload['user_id']:
        raise HTTPException(status_code=403, detail="You can only edit your own messages")
    try:
        created = datetime.fromisoformat(msg['created_at'])
    except (KeyError, ValueError):
        raise HTTPException(status_code=400, detail="Message timestamp invalid") from None
    age = (datetime.now(UTC) - created).total_seconds()
    if age > _EDIT_WINDOW_SECONDS:
        raise HTTPException(
            status_code=400,
            detail=f"Edit window expired ({_EDIT_WINDOW_SECONDS // 60} minutes after sending)",
        )
    now_iso = datetime.now(UTC).isoformat()
    new_text = body.message.strip()
    await db.messages.update_one(
        {"id": message_id},
        {
            "$set": {
                "message": new_text,
                "edited_at": now_iso,
                # Re-extract mentions on edit so removing/adding "@owner" in
                # an edit is reflected in the inbox flag.
                "mentions": extract_mentions(new_text),
            },
            # Cached translations no longer match the new content
            "$unset": {"translations": ""},
        },
    )
    return {"message": "Message updated"}


@api_router.get("/chat/messages/{property_id}", response_model=list[MessageOut])
async def get_messages(
    property_id: str,
    with_user: str | None = None,
    payload: dict = Depends(verify_token),
) -> list[dict]:
    user_id = payload['user_id']
    # Default: all messages this user has on the property (legacy behaviour for renters
    # who only ever talk to the owner). Owners may have multiple renters per property,
    # so the frontend can pin the conversation to a single counterparty via `with_user`.
    if with_user:
        query: dict = {
            "property_id": property_id,
            "$or": [
                {"sender_id": user_id, "receiver_id": with_user},
                {"sender_id": with_user, "receiver_id": user_id},
            ],
        }
    else:
        query = {
            "property_id": property_id,
            "$or": [
                {"sender_id": user_id},
                {"receiver_id": user_id},
            ],
        }
    messages = await db.messages.find(query, {"_id": 0}).sort("created_at", 1).to_list(1000)

    mark_filter: dict = {"property_id": property_id, "receiver_id": user_id}
    if with_user:
        mark_filter["sender_id"] = with_user
    # Stamp read_at so the chat-email throttle can detect "recipient is
    # actively in the chat" and suppress noisy emails on fast exchanges.
    await db.messages.update_many(
        {**mark_filter, "read": {"$ne": True}},
        {"$set": {"read": True, "read_at": datetime.now(UTC).isoformat()}},
    )
    
    return messages


@api_router.get("/chat/conversations", response_model=list[ConversationOut])
async def get_conversations(payload: dict = Depends(verify_token)) -> list[dict]:
    messages = await db.messages.find(
        {"$or": [{"sender_id": payload['user_id']}, {"receiver_id": payload['user_id']}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)

    # ── Batched lookups ────────────────────────────────────────────────
    # Navigation.js polls this endpoint every 20s for every signed-in
    # user, and it used to issue 2-3 sequential `find_one` calls PER
    # conversation (properties, sometimes marketplace_jobs, users). At
    # ~160ms per Atlas round-trip a 10-conversation inbox cost ~5s. Now
    # it's a fixed 2-3 round-trips regardless of inbox size.
    #
    # First pass walks the (already created_at-desc sorted) messages to
    # find each conversation's newest message and collect the ids we need;
    # the second pass builds the response in the exact same order as before.
    latest_by_conv: dict = {}
    for msg in messages:
        other_user_id = msg['receiver_id'] if msg['sender_id'] == payload['user_id'] else msg['sender_id']
        conv_key = f"{msg['property_id']}_{other_user_id}"
        if conv_key not in latest_by_conv:
            latest_by_conv[conv_key] = (msg, other_user_id)

    property_ids = {msg['property_id'] for msg, _ in latest_by_conv.values()}
    user_ids = {uid for _, uid in latest_by_conv.values()}

    properties_by_id: dict = {}
    if property_ids:
        for row in await db.properties.find(
            {"id": {"$in": list(property_ids)}},
            {"_id": 0, "id": 1, "title": 1, "owner_id": 1},
        ).to_list(len(property_ids)):
            properties_by_id[row["id"]] = row

    # Any "property_id" with no live property may actually be a Jobs Board
    # job UUID — a job-scoped chat thread created when a poster clicked
    # "Message" on an applicant. Look those up in one extra query so the
    # inbox shows a meaningful title instead of "Unknown".
    jobs_by_id: dict = {}
    missing_ids = [pid for pid in property_ids if pid not in properties_by_id]
    if missing_ids:
        for row in await db.marketplace_jobs.find(
            {"_id": {"$in": missing_ids}},
            {"_id": 1, "title": 1, "poster_user_id": 1},
        ).to_list(len(missing_ids)):
            jobs_by_id[row["_id"]] = row

    # Same again for the Requests board — a thread from "Message seeker"
    # is keyed by the request UUID. Only the ids that matched neither a
    # property nor a job are looked up, so this is one extra query and
    # only when something is actually unresolved.
    requests_by_id: dict = {}
    still_missing = [pid for pid in missing_ids if pid not in jobs_by_id]
    if still_missing:
        for row in await db.requests.find(
            {"_id": {"$in": still_missing}},
            {"_id": 1, "title": 1, "poster_user_id": 1},
        ).to_list(len(still_missing)):
            requests_by_id[row["_id"]] = row

    # And gigs — a thread from a marketplace listing is keyed by the gig
    # UUID. Same one-extra-query pattern, only for ids nothing else
    # claimed.
    #
    # This also carries the BUSINESS the gig belongs to (spec M7): a
    # person who runs two businesses cannot otherwise tell which hat a
    # message is about, and answering as the wrong business is worse than
    # answering late.
    gigs_by_id: dict = {}
    businesses_by_id: dict = {}
    unresolved = [pid for pid in still_missing if pid not in requests_by_id]
    if unresolved:
        for row in await db.marketplace_gigs.find(
            {"_id": {"$in": unresolved}},
            {"_id": 1, "title": 1, "provider_user_id": 1, "business_id": 1},
        ).to_list(len(unresolved)):
            gigs_by_id[row["_id"]] = row
        biz_ids = [g.get("business_id") for g in gigs_by_id.values() if g.get("business_id")]
        if biz_ids:
            for row in await db.businesses.find(
                {"_id": {"$in": biz_ids}},
                {"_id": 1, "name": 1},
            ).to_list(len(biz_ids)):
                businesses_by_id[row["_id"]] = row

    users_by_id: dict = {}
    if user_ids:
        for row in await db.users.find(
            {"id": {"$in": list(user_ids)}},
            {"_id": 0, "id": 1, "name": 1, "email": 1},
        ).to_list(len(user_ids)):
            users_by_id[row["id"]] = row

    conversations = {}
    for conv_key, (msg, other_user_id) in latest_by_conv.items():
        property_data = properties_by_id.get(msg['property_id'])
        job_data = jobs_by_id.get(msg['property_id'])
        request_data = requests_by_id.get(msg['property_id'])
        gig_data = gigs_by_id.get(msg['property_id'])
        other_user = users_by_id.get(other_user_id)

        # Was the CURRENT user @-mentioned by their counterpart in the
        # last message? Only true when (a) the message wasn't sent by
        # me and (b) my role-token appears in the message's stored
        # mentions list. Drives the inbox bell + gold ring.
        my_role = current_user_role_in_property(payload['user_id'], property_data)
        sent_by_me = msg['sender_id'] == payload['user_id']
        mentions_me = bool(
            not sent_by_me and my_role and my_role in (msg.get('mentions') or [])
        )

        # Choose a display title for the conversation preview. Job
        # threads get a "Job:" prefix so the inbox visually
        # distinguishes them from property threads at a glance.
        if property_data:
            display_title = property_data.get('title', 'Unknown')
        elif job_data:
            display_title = f"Job: {job_data.get('title', 'Untitled')}"
        elif request_data:
            display_title = f"Request: {request_data.get('title', 'Untitled')}"
        elif gig_data:
            display_title = gig_data.get('title', 'Untitled')
        else:
            display_title = 'Unknown'

        # Which business this thread concerns, when it concerns one and
        # the reader is the side that owns it. A customer does not need to
        # be told which of the provider's businesses they contacted; the
        # provider does.
        business_name = None
        if gig_data and gig_data.get('provider_user_id') == payload['user_id']:
            biz = businesses_by_id.get(gig_data.get('business_id'))
            if biz:
                business_name = biz.get('name')

        conversations[conv_key] = {
            "property_id": msg['property_id'],
            "property_title": display_title,
            "property_missing": (
                property_data is None and job_data is None
                and request_data is None and gig_data is None
            ),
            "is_job_thread": job_data is not None,
            "is_request_thread": request_data is not None,
            "is_gig_thread": gig_data is not None,
            # None unless this reader owns the business the thread is about.
            "business_name": business_name,
            "other_user": other_user if other_user else {},
            "last_message": msg['message'],
            "last_message_time": msg['created_at'],
            "last_message_from_me": sent_by_me,
            "last_message_mentions_me": mentions_me,
            "unread": not msg['read'] and msg['receiver_id'] == payload['user_id']
        }

    return list(conversations.values())



@api_router.post("/chat/typing", response_model=MessageResponse)
async def post_typing(ping: TypingPing, payload: dict = Depends(verify_token)) -> dict:
    """Record that the caller is typing in the (property, with_user) thread.
    Upserted with the current timestamp; counterparty polls
    ``GET /chat/typing/{property_id}?with_user=…`` and treats anything within
    the TTL window as actively typing."""
    user_id = payload['user_id']
    await db.typing.update_one(
        {"property_id": ping.property_id, "user_id": user_id, "target_user": ping.with_user},
        {"$set": {"updated_at": datetime.now(UTC).isoformat()}},
        upsert=True,
    )
    return {"message": "ok"}


@api_router.get("/chat/typing/{property_id}", response_model=TypingStatusResponse)
async def get_typing(
    property_id: str,
    with_user: str,
    payload: dict = Depends(verify_token),
) -> dict:
    """Return whether ``with_user`` is currently typing to the caller in
    ``property_id``. A ping older than ``_TYPING_TTL_SECONDS`` is ignored."""
    cutoff = (datetime.now(UTC) - timedelta(seconds=_TYPING_TTL_SECONDS)).isoformat()
    doc = await db.typing.find_one(
        {
            "property_id": property_id,
            "user_id": with_user,
            "target_user": payload['user_id'],
            "updated_at": {"$gte": cutoff},
        },
        {"_id": 0, "updated_at": 1},
    )
    return {"typing": doc is not None}



@api_router.post(
    "/chat/messages/{message_id}/translate",
    response_model=TranslatedMessageResponse,
)
async def translate_message(
    message_id: str,
    body: TranslateMessageRequest,
    payload: dict = Depends(verify_token),
) -> dict:
    """Translate a single chat message into ``target_lang`` ('en' or 'he').

    The result is cached on the message document so subsequent reads are
    instant. Only participants in the conversation may call this."""
    if body.target_lang not in ("en", "he"):
        raise HTTPException(status_code=400, detail="target_lang must be 'en' or 'he'")

    msg = await db.messages.find_one({"id": message_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    user_id = payload['user_id']
    if user_id not in (msg.get('sender_id'), msg.get('receiver_id')):
        raise HTTPException(status_code=403, detail="Not a participant in this conversation")

    cached = (msg.get('translations') or {}).get(body.target_lang)
    source_lang = detect_language(msg.get('message', ''))
    if cached:
        return {
            "message_id": message_id,
            "source_lang": source_lang,
            "target_lang": body.target_lang,
            "translated_text": cached,
        }

    translated = await translate_chat_message(msg['message'], body.target_lang)
    await db.messages.update_one(
        {"id": message_id},
        {"$set": {f"translations.{body.target_lang}": translated}},
    )
    return {
        "message_id": message_id,
        "source_lang": source_lang,
        "target_lang": body.target_lang,
        "translated_text": translated,
    }
