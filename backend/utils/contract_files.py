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

from datetime import UTC, datetime, timedelta
from pathlib import PurePosixPath

from fastapi import HTTPException

from routes.deps import CONTRACT_DIR, db, logger

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


# ---------------------------------------------------------------------------
# Signing links
# ---------------------------------------------------------------------------

# How long a signing link keeps working AFTER the contract has been signed.
#
# Only after, and that asymmetry is the decision, not an oversight. The
# 10 Sep audit named two halves of one finding: a link that can still SIGN,
# and a link that can still READ a finished agreement forever. The first
# half is already closed - `sign_contract_public` refuses a contract whose
# `signed` is true. This closes the second.
#
# An UNSIGNED link deliberately keeps no deadline. It is held by an external
# person who has no account here and never will, and the owner's only
# control over it is a "copy link" button (SubleaseListItem.jsx) with no way
# to mint a fresh one. Expiring an unsigned link would therefore strand a
# live signature request with nothing either party could click - a dead end
# traded for an exposure that only begins once the document is finished.
# Giving the owner a "send a new link" action is what unlocks that half; it
# is not built, so the deadline is not imposed.
#
# 30 days is generous because this link is the signer's ONLY route to their
# own executed copy: `/contracts/sign/{token}/file` serves the signed PDF
# once one exists, and that person cannot authenticate to fetch it any other
# way. Cutting this window short takes a legal document away from a party to
# it.
SIGN_TOKEN_GRACE_DAYS = 30


def sign_token_expiry(signed_at: datetime) -> str:
    """When a link signed at `signed_at` stops working, as an ISO string."""
    return (signed_at + timedelta(days=SIGN_TOKEN_GRACE_DAYS)).isoformat()


async def load_contract_by_sign_token(sign_token: str) -> dict:
    """Resolve a signing link to its contract, or refuse it.

    ONE PLACE, for the same reason the file resolver above is one place.
    Three routes are keyed on `sign_token` and they do not sit together -
    two in routes/subleases.py, and the one that serves BYTES in
    routes/contracts.py - so an expiry rule written at the call sites is an
    expiry rule that gets added to two of them. Every route that accepts a
    signing link asks here.

    A contract with no `sign_token_expires_at` is treated as live. That is
    what every row written before this existed looks like, and re-dating
    them from `created_at` would retroactively kill links that are legitimately
    still in flight.
    """
    contract = await db.contracts.find_one({"sign_token": sign_token}, {"_id": 0})
    if not contract:
        # Same wording and status the routes already used, so an unknown
        # link says the same thing wherever it is used.
        raise HTTPException(status_code=404, detail="Contract not found or link is invalid")

    expires_at = contract.get("sign_token_expires_at")
    if expires_at:
        try:
            deadline = datetime.fromisoformat(str(expires_at))
        except ValueError:
            # An unparseable date is not a reason to refuse someone their
            # own contract. Treat it as live and say so in the log.
            logger.warning(
                "contract %s has an unreadable sign_token_expires_at: %r",
                contract.get("id"), expires_at,
            )
            return contract
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=UTC)
        if datetime.now(UTC) > deadline:
            # 410, not 404: the link was real and is now closed, and the
            # person holding it should be told the difference so they ask
            # the owner for a copy rather than assuming they were phished.
            raise HTTPException(
                status_code=410,
                detail=(
                    "This signing link has expired. The contract was signed more than "
                    f"{SIGN_TOKEN_GRACE_DAYS} days ago - please ask the owner to send you a copy."
                ),
            )
    return contract
