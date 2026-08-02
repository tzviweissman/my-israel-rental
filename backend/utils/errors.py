"""Turning a caught exception into something a user can act on.

The rule
--------
**Never interpolate a caught third-party exception into an API `detail`.**
Log the real one; return a sentence written for the person reading it.

Why
---
Three times in one day a raw library error reached a real user:

* ``Client error '422 Unknown Error' for url '…/subscriptions/I-…/cancel'``
  — for a subscription that was never going to bill them.
* ``Client error '401 Unauthorized' for url '…/v1/oauth2/token'``
  — when the actual problem was sandbox credentials pointed at live.
* A ``wa.me`` link built from a number no one could parse.

Each came with a link to MDN explaining what the HTTP status means in
general, which is exactly the information the reader already had. The
detail that would have helped — *which* subscription state, *which*
credential pair — was in the response body or in our own context, and the
library's ``str(e)`` carried none of it.

The asymmetry is the point: at the boundary we usually know far more about
the likely cause than the library does. `api_error` makes writing that
down the path of least resistance.

Nothing here hides information from developers — the full exception, with
traceback, still goes to the log.
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import HTTPException


def api_error(
    *,
    status_code: int,
    message: str,
    exc: BaseException | None = None,
    logger: logging.Logger | None = None,
    context: str = "",
    extra: dict[str, Any] | None = None,
) -> HTTPException:
    """Build an HTTPException whose detail is written, not leaked.

    ``message`` is what the user sees. It should say what happened in their
    terms and, where we know it, what to do about it — not what class was
    raised.

    ``exc`` is logged with a traceback and never reaches the response.

    Returns the exception so call sites read ``raise api_error(...) from e``,
    which keeps the original chained for anyone reading a traceback.
    """
    if logger is not None:
        detail = f"{context}: {exc!r}" if context else repr(exc)
        if extra:
            detail = f"{detail} | {extra}"
        if exc is not None:
            logger.exception(detail)
        else:
            logger.error(detail)
    return HTTPException(status_code=status_code, detail=message)


def is_our_error(exc: BaseException) -> bool:
    """True for exceptions we raised deliberately, whose text is safe to show.

    A ``ValueError`` from our own validator carries a message we wrote for a
    human. An ``httpx.HTTPStatusError`` does not. Only the former should ever
    reach a response body, and only where the call site is confident about
    which it's catching — this helper exists to make that decision explicit
    rather than accidental.
    """
    return isinstance(exc, (ValueError, RuntimeError)) and bool(str(exc).strip())
