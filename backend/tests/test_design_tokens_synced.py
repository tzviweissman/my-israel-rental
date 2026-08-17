"""The two copies of design-tokens.css must stay byte-identical.

`brand/design-tokens.css` is the locked source of truth. The app cannot
import it directly: Create React App's ModuleScopePlugin refuses any import
from outside `frontend/src/`, and relaxing that means editing the craco
config, which CLAUDE.md says to confirm before touching.

So there is a copy at `frontend/src/styles/design-tokens.css`, imported first
in `index.js`. A copy is a drift hazard by construction — someone edits the
brand file, the app keeps shipping the old palette, and nothing errors.
Colours simply stay subtly wrong, which is exactly the failure mode this
project keeps paying for.

This test removes the hazard: edit one and forget the other, and the suite
goes red with the command needed to fix it.

Deliberately a byte comparison rather than a parse. A parser would have to
decide what counts as a meaningful difference, and the answer for a locked
token file is "any difference at all" — including a comment, which is often
where the intent lives.
"""
from __future__ import annotations

import hashlib
import pathlib

REPO = pathlib.Path(__file__).resolve().parent.parent.parent
SOURCE = REPO / "brand" / "design-tokens.css"
COPY = REPO / "frontend" / "src" / "styles" / "design-tokens.css"


def test_both_files_exist() -> None:
    """Fail loudly rather than passing vacuously if either side moved."""
    assert SOURCE.exists(), (
        f"{SOURCE} is missing — it is the locked source of truth for the "
        "design system. If it moved, update this test to follow it."
    )
    assert COPY.exists(), (
        f"{COPY} is missing. The app imports it from index.js; without it the "
        "build fails. Restore with:\n"
        "  cp brand/design-tokens.css frontend/src/styles/design-tokens.css"
    )


def test_copy_is_byte_identical_to_source() -> None:
    source = SOURCE.read_bytes()
    copy = COPY.read_bytes()
    if source == copy:
        return

    # Point at the first differing line, so the failure says WHAT drifted
    # rather than only that something did.
    s_lines = source.decode("utf-8", "replace").splitlines()
    c_lines = copy.decode("utf-8", "replace").splitlines()
    first = next(
        (
            i
            for i in range(max(len(s_lines), len(c_lines)))
            if (s_lines[i] if i < len(s_lines) else None)
            != (c_lines[i] if i < len(c_lines) else None)
        ),
        None,
    )
    detail = ""
    if first is not None:
        detail = (
            f"\n\nFirst difference at line {first + 1}:\n"
            f"  brand/ : {s_lines[first] if first < len(s_lines) else '<missing>'}\n"
            f"  src/   : {c_lines[first] if first < len(c_lines) else '<missing>'}"
        )

    raise AssertionError(
        "design-tokens.css has drifted between the locked source and the copy "
        "the app actually ships.\n"
        f"  brand/design-tokens.css              sha256 {hashlib.sha256(source).hexdigest()[:16]}  "
        f"({len(s_lines)} lines)\n"
        f"  frontend/src/styles/design-tokens.css sha256 {hashlib.sha256(copy).hexdigest()[:16]}  "
        f"({len(c_lines)} lines)"
        f"{detail}\n\n"
        "The brand file is authoritative. Re-sync with:\n"
        "  cp brand/design-tokens.css frontend/src/styles/design-tokens.css"
    )
