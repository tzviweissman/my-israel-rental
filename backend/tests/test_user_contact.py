"""Keep the WhatsApp read side and write side pointing at the same field.

The bug this guards: `PUT /auth/whatsapp` persists `users.phone`, while the
property detail endpoint and the gig detail fallback both read
`users.whatsapp_number` — a field nothing has ever written. Both halves looked
right in isolation, so the WhatsApp button was dead for every owner (0 of 47
across all 204 production listings) with no error anywhere to notice.

Pure logic plus a source-level assertion; no database, no network.
"""
from __future__ import annotations

import ast
import pathlib

import pytest

from utils.user_contact import WHATSAPP_PROJECTION, user_whatsapp

BACKEND = pathlib.Path(__file__).resolve().parent.parent


class TestUserWhatsapp:
    def test_reads_the_field_settings_actually_writes(self) -> None:
        assert user_whatsapp({"phone": "050-123-4567"}) == "050-123-4567"

    def test_dedicated_field_wins_when_present(self) -> None:
        assert user_whatsapp({"whatsapp_number": "+972501112222", "phone": "039999999"}) == (
            "+972501112222"
        )

    def test_falls_through_blank_dedicated_field(self) -> None:
        # The real shape of every production user today: dedicated field
        # absent or empty, number sitting in `phone`.
        assert user_whatsapp({"whatsapp_number": "  ", "phone": "0521234567"}) == "0521234567"

    @pytest.mark.parametrize(
        "user",
        [None, {}, {"phone": ""}, {"phone": "   "}, {"phone": None}, {"name": "No number"}],
    )
    def test_empty_when_unusable(self, user) -> None:
        # "" is meaningful: it tells the frontend to render in-app chat
        # rather than a WhatsApp button that opens an empty compose screen.
        assert user_whatsapp(user) == ""

    def test_strips_surrounding_whitespace(self) -> None:
        assert user_whatsapp({"phone": "  +972 50 123 4567  "}) == "+972 50 123 4567"

    def test_coerces_non_string(self) -> None:
        # Bulk import has handed us numeric phone values before.
        assert user_whatsapp({"phone": 972501234567}) == "972501234567"

    def test_projection_covers_every_field_read(self) -> None:
        """A narrow projection is what made the original bug possible.

        If someone adds a field to the resolver but not to the projection,
        callers using WHATSAPP_PROJECTION silently get "" back forever.
        """
        probe = {field: f"value-{field}" for field in WHATSAPP_PROJECTION}
        assert user_whatsapp(probe) != "", "projection omits every field the resolver reads"
        for field in WHATSAPP_PROJECTION:
            assert user_whatsapp({field: "0501234567"}) == "0501234567", (
                f"{field} is projected but not read by user_whatsapp"
            )


def _writes_of(path: pathlib.Path, func_name: str) -> set[str]:
    """Field names assigned inside a `$set` dict literal in `func_name`."""
    tree = ast.parse(path.read_text(encoding="utf-8"))
    fields: set[str] = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.AsyncFunctionDef) or node.name != func_name:
            continue
        for sub in ast.walk(node):
            if isinstance(sub, ast.Dict):
                for k, v in zip(sub.keys, sub.values):
                    if isinstance(k, ast.Constant) and k.value == "$set" and isinstance(v, ast.Dict):
                        fields.update(
                            kk.value for kk in v.keys
                            if isinstance(kk, ast.Constant) and isinstance(kk.value, str)
                        )
    return fields


def test_settings_write_target_is_readable() -> None:
    """Whatever `PUT /auth/whatsapp` persists must be a field we read back.

    This is the assertion that would have caught the original bug: it fails
    the moment the write target and the read fields diverge, without needing
    a database or an end-to-end request.
    """
    written = _writes_of(BACKEND / "routes" / "auth.py", "set_whatsapp_number")
    assert written, "could not find the $set in set_whatsapp_number — did it get renamed?"
    assert written & set(WHATSAPP_PROJECTION), (
        f"set_whatsapp_number writes {sorted(written)}, but user_whatsapp only reads "
        f"{sorted(WHATSAPP_PROJECTION)} — a number saved in Settings would never "
        f"reach the WhatsApp button."
    )
