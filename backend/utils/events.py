"""In-memory pub/sub broker for admin SSE events.

Rationale
=========
Several super admins may have the dashboard open at the same time. When one
admin marks a property as booked, the others should see that change reflected
within a second or two — not after the next 30-second SWR revalidation.

Scope and limits
================
- **In-memory only.** Events are not persisted; they're delivered to whoever
  is currently connected. This is fine for an admin dashboard with a handful
  of users at most.
- **Single-process.** Does NOT broadcast across multiple backend replicas.
  If we ever scale horizontally, swap this for Redis pub/sub or NATS.
- **Bounded queues.** Each subscriber gets a ``maxsize=100`` queue. Events
  are dropped (not awaited) when a queue is full — a slow client never
  blocks the publisher.
- **Hard cap on subscribers.** ``MAX_SUBSCRIBERS = 100`` total connections.
  Past that, ``subscribe()`` rejects with ``RuntimeError``.

Public API
==========
``subscribe()``     – open a new subscription, returns an ``asyncio.Queue``.
``unsubscribe(q)``  – release a subscription.
``publish(...)``    – fan-out a typed event to every active queue.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any

logger = logging.getLogger(__name__)

MAX_SUBSCRIBERS = 100
QUEUE_MAXSIZE = 100

_subscribers: list[asyncio.Queue] = []


async def subscribe() -> asyncio.Queue:
    """Register a new subscriber and return its queue.

    Raises ``RuntimeError`` if we'd exceed ``MAX_SUBSCRIBERS``.
    """
    if len(_subscribers) >= MAX_SUBSCRIBERS:
        raise RuntimeError("too many event subscribers")
    q: asyncio.Queue = asyncio.Queue(maxsize=QUEUE_MAXSIZE)
    _subscribers.append(q)
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    """Release a subscription. Safe to call twice."""
    try:
        _subscribers.remove(q)
    except ValueError:
        pass


async def publish(event_type: str, payload: dict[str, Any]) -> None:
    """Fan out an event to every connected subscriber.

    Slow clients with full queues silently drop the event — they'll catch up
    on the next 30 s SWR revalidation.
    """
    msg = {
        "type": event_type,
        "payload": payload,
        "ts": datetime.now(UTC).isoformat(),
    }
    for q in list(_subscribers):
        try:
            q.put_nowait(msg)
        except asyncio.QueueFull:
            logger.debug("dropping admin event for slow subscriber")


def subscriber_count() -> int:
    """Diagnostic helper for tests / health endpoints."""
    return len(_subscribers)
