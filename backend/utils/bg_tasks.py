"""Fire-and-forget tasks that are not allowed to vanish.

`asyncio.create_task` returns a Task the event loop holds only WEAKLY. A
bare `asyncio.create_task(coro)` with the result thrown away can be
garbage-collected mid-flight - the coroutine simply stops, no exception,
no log. routes/auth.py and routes/chat.py each keep their own strong-ref
set for exactly this reason; the translation tasks on gigs, jobs and
requests did not, and were exposed to the same silent death.

One registry for all of them. `spawn` keeps the task alive until it is
done, then lets it go.
"""
from __future__ import annotations

import asyncio
from collections.abc import Coroutine
from typing import Any

_TASKS: set[asyncio.Task] = set()


def spawn(coro: Coroutine[Any, Any, Any]) -> asyncio.Task:
    """Schedule `coro` and hold a strong reference until it finishes."""
    task = asyncio.create_task(coro)
    _TASKS.add(task)
    task.add_done_callback(_TASKS.discard)
    return task
