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


def row_error(
    exc: BaseException,
    *,
    logger: logging.Logger | None = None,
    context: str = "",
    extra: dict[str, Any] | None = None,
) -> str:
    """A per-row error string for bulk operations.

    Bulk import and multi-file upload report failures in a list rather than
    by raising, so they bypass `api_error` entirely — this is the same rule
    for that shape.

    The tradeoff here is real and worth stating: an admin looking at "row 12
    failed" genuinely wants to know why. But `str(exc)` on an arbitrary
    exception gives them ``KeyError('price')`` at best and a file path or
    connection string at worst — informative to a developer reading a log,
    not to the person looking at an import screen.

    So the reader gets the exception TYPE in plain words plus their own row
    identifier, and the full exception goes to the log where a developer can
    match it up. Enough to see the shape of the problem ("eight rows failed
    the same way") without pasting internals into a browser.
    """
    if logger is not None:
        detail = f"{context}: {exc!r}" if context else repr(exc)
        if extra:
            detail = f"{detail} | {extra}"
        logger.exception(detail)
    name = type(exc).__name__
    friendly = {
        "KeyError": "a required column was missing",
        "ValueError": "a value wasn't in the expected format",
        "TypeError": "a value wasn't in the expected format",
        "DuplicateKeyError": "this row already exists",
    }.get(name)
    return f"Couldn't import this row — {friendly}." if friendly else (
        "Couldn't import this row. The full error is in the server log."
    )


def is_our_error(exc: BaseException) -> bool:
    """True for exceptions we raised deliberately, whose text is safe to show.

    A ``ValueError`` from our own validator carries a message we wrote for a
    human. An ``httpx.HTTPStatusError`` does not. Only the former should ever
    reach a response body, and only where the call site is confident about
    which it's catching — this helper exists to make that decision explicit
    rather than accidental.
    """
    return isinstance(exc, (ValueError, RuntimeError)) and bool(str(exc).strip())
