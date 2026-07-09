"""``routes.admin_import`` package — CSV import + related admin tools.

Sub-modules:
  * ``helpers`` — constants, AI column mapper (Claude + fuzzy fallback),
    row parsing / coercion utilities, property/user record builders,
    owner-resolve/create flow.
  * ``preview`` — POST /admin/import/preview (maps + samples, no writes).
  * ``properties`` — property commit + remirror + repair-prices endpoints.
  * ``users`` — user commit endpoint (bulk-create + set-password emails).
  * ``quick_add`` — single-property quick-add shortcut.

Extracted from the single-file ``admin_import.py`` in the 2026-07
refactor. Every URL and response shape is identical.

Public helper names imported by 4 test files and by
``routes/admin/core.py`` are re-exported here so nothing outside this
package needs to change its import paths.
"""
from fastapi import APIRouter

from . import preview, properties, quick_add, users

# One router that owns every admin-import endpoint.
router = APIRouter()
router.include_router(preview.router)
router.include_router(properties.router)
router.include_router(users.router)
router.include_router(quick_add.router)

# Re-exports for legacy call sites (tests, routes/admin/core.py).
from .helpers import (  # noqa: E402,F401
    _build_property_doc,
    _coerce_float,
    _detect_schema_kind,
    _frontend_origin,
    _issue_reset_token,
    _sniff_currency,
    _split_list,
    _split_urls,
)

__all__ = [
    "router",
    "_build_property_doc",
    "_coerce_float",
    "_detect_schema_kind",
    "_frontend_origin",
    "_issue_reset_token",
    "_sniff_currency",
    "_split_list",
    "_split_urls",
]
