"""Keep a list endpoint alive when one row in it is malformed.

THE BUG THIS EXISTS FOR. Three routes declare `response_model=
list[PropertyOut]`, and FastAPI validates that list as a unit: one
document missing a field PropertyOut requires (`area`, `property_type`)
makes the whole response a 500. For GET /api/properties that is the
endpoint behind /stays, the home page and every search - one bad row and
every visitor sees nothing. Measured locally with twenty-three rows a
test had seeded without `area`: the bare list answered 500 while
`?page=1&limit=2` answered 200, because that page happened to miss them.

Nothing about that is specific to tests. An import, a migration or an
admin tool that writes a partial document would do the same in
production, and the first sign would be the outage.

So: validate per row, drop what does not fit, and LOG each dropped id at
warning. The page works and the data problem is visible in the logs,
instead of being visible only as the outage.
"""
from __future__ import annotations

import logging
from typing import Any

from models_response import PropertyOut


def keep_valid_rows(rows: list[dict[str, Any]], model: type, *, route: str, logger: logging.Logger) -> list[dict[str, Any]]:
    """Return the rows `model` accepts; log and drop the rest.

    Any collection endpoint with `response_model=list[X]` has the same
    failure: one bad document, whole response 500. The subleases list
    had 75 rows a test had seeded without `available_from` and answered
    500 for everyone; this is the same guard for any model.
    """
    kept: list[dict[str, Any]] = []
    for row in rows:
        try:
            model.model_validate(row)
        except Exception as e:  # noqa: BLE001 - pydantic ValidationError; broad on purpose
            logger.warning(
                "%s dropped malformed %s %s (%s): %s",
                route, model.__name__, row.get("id"), row.get("title"), str(e).splitlines()[0][:160],
            )
            continue
        kept.append(row)
    return kept


def keep_valid_property_rows(rows: list[dict[str, Any]], *, route: str, logger: logging.Logger) -> list[dict[str, Any]]:
    """Return the rows PropertyOut accepts; log and drop the rest."""
    return keep_valid_rows(rows, PropertyOut, route=route, logger=logger)
