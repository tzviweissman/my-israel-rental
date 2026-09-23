"""The paid page upgrade: one check, in one place (Tzvi, 23 Sep 2026).

A separate add-on, not part of Pro. Off by default. When on for a person,
their business, service and property pages also get the clarity layer
(docs/ai-page-builder-spec.md, "Clarity floor"); when off, their pages are
the standard page plus the proof line beside the button, which everyone
gets.

Stored on the user as `page_upgrade: true`, because it belongs to the
person and covers everything they list. Today an admin switches it on by
hand (PUT /admin/users/{id}/page-upgrade); payment, when it exists, sets
the same field. Every upgraded behaviour reads this function's answer,
sent to each page as the single boolean `page_upgrade` in the payload it
already loads. The frontend never decides it again.
"""
from __future__ import annotations

from typing import Optional

from routes.deps import db


async def has_page_upgrade(owner_id: Optional[str]) -> bool:
    if not owner_id:
        return False
    user = await db.users.find_one({"id": owner_id}, {"_id": 0, "page_upgrade": 1})
    return bool((user or {}).get("page_upgrade"))
