"""Where contract files live, and how a stored reference becomes a path.

ONE PLACE, on purpose. This rule has been broken three separate times in
this codebase, and once it cost a real contract permanently: a signed
agreement written into the public `uploads/` tree is downloadable by
anyone holding the URL, with no permission check anywhere near it. Every
time it came back, it came back because a second module decided for itself
where a contract goes.

So the rule is here and the routes ask:

  * contracts live under CONTRACT_DIR (`backend/private_contracts`), which
    is never mounted as StaticFiles;
  * a stored reference is resolved by BASENAME ONLY, so a value containing
    "../" resolves to nothing rather than to somewhere else on the disk;
  * both the legacy public-URL shape ("/api/uploads/signed_x.pdf") and a
    bare filename resolve, because rows written before the move still hold
    the first and must keep working.

A NOTE ON THAT LEGACY SHAPE, since it is the thing most likely to mislead
the next person: `contract_url` and `signed_contract_url` LOOK like URLs
and are not. Nothing fetches them. They are identifiers, the file is
private, and the only way to read one is through a permission-checked
endpoint. Do not build an `<a href>` from either.
"""
from __future__ import annotations

from pathlib import PurePosixPath

from routes.deps import CONTRACT_DIR

CONTRACT_MEDIA_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "heic": "image/heic",
    "heif": "image/heif",
}


def resolve_private_contract_file(stored: str):
    """Map a stored contract reference to a real file inside CONTRACT_DIR.

    Returns the resolved Path, or None when it is missing or would land
    outside CONTRACT_DIR.
    """
    if not stored:
        return None
    # Basename only - this is what defeats "../" in a stored value.
    filename = PurePosixPath(str(stored).replace("\\", "/")).name
    if not filename or filename in (".", ".."):
        return None
    root = CONTRACT_DIR.resolve()
    candidate = (root / filename).resolve()
    if not str(candidate).startswith(str(root)):
        return None
    return candidate if candidate.exists() else None


def contract_reference(filename: str) -> str:
    """The string to STORE for a contract file.

    Kept in the legacy `/api/uploads/...` shape rather than "corrected" to
    a bare filename, and that is deliberate: every row written before the
    move holds this shape, the resolver reads both, and introducing a
    second shape would mean every reader has to handle two forever. It is
    an identifier, not a location - see the module docstring.
    """
    return f"/api/uploads/{filename}"
