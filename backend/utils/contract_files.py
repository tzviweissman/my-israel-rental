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

import asyncio
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


# ---------------------------------------------------------------------------
# Durable storage: private Cloudinary, with the server's disk as a cache
# ---------------------------------------------------------------------------
#
# WHY (18 Oct 2026). Contracts used to live only on a Railway volume. A
# service with a volume cannot run two deployments at once, so every backend
# update had a gap of a minute or two where requests hung, and a person
# saving their business got "Could not reach the server". With every
# contract kept in Cloudinary as a private (`authenticated`) raw asset, the
# disk is only a cache and the volume can go.
#
# THE RULE, for every route:
#   * after writing a contract file to CONTRACT_DIR, `await keep_contract_file(path)`
#     before the database points at it;
#   * to read one, `await ensure_contract_file(stored, public_id=...)` instead
#     of resolve_private_contract_file: it returns the local path, fetching
#     the file back from Cloudinary into CONTRACT_DIR when this copy of the
#     server has not seen it;
#   * to delete one, `forget_contract_file(stored)`.
# Each file's Cloudinary id is derived from its name, so no database field
# is needed: myisraelrental/contracts/<filename>. Rows migrated in July carry
# their own `*_public_id`, which ensure_contract_file takes as a fallback.
#
# Still never public: Cloudinary refuses an unsigned fetch of an
# authenticated asset (401), and the bytes are fetched server-side and
# served by the same permission-checked endpoints as before.

from pathlib import Path  # noqa: E402

from utils.cloud_storage import (  # noqa: E402
    CLOUDINARY_ENABLED,
    CONTRACT_FOLDER,
    delete_contract_from_cloudinary,
    fetch_contract_from_cloudinary,
    upload_contract_to_cloudinary,
)


def _basename(stored: str) -> str:
    name = PurePosixPath(str(stored or "").replace("\\", "/")).name
    return "" if name in ("", ".", "..") else name


def contract_cloud_id(stored: str) -> str:
    """The Cloudinary public id a contract file is kept under."""
    return f"{CONTRACT_FOLDER}/{_basename(stored)}"


async def keep_contract_file(path: Path) -> None:
    """Copy a just-written contract to Cloudinary, or refuse the request.

    Refusing is the point: a file that exists only on this server's disk is
    gone at the next update, so a save that cannot be made durable must fail
    now, while the person is still there to try again. With Cloudinary not
    configured (local development) the disk is all there is, and that is fine.
    """
    if not CLOUDINARY_ENABLED:
        return
    data = await asyncio.to_thread(path.read_bytes)
    res = await upload_contract_to_cloudinary(data, public_id_hint=path.name)
    if not res or not res.get("public_id"):
        logger.error("contract %s could not be stored in Cloudinary", path.name)
        raise HTTPException(status_code=503, detail="We couldn't save the contract just now. Please try again in a moment.")
    await db.contract_cloud.update_one(
        {"_id": path.name}, {"$set": {"public_id": res["public_id"], "at": datetime.now(UTC).isoformat()}}, upsert=True,
    )


async def ensure_contract_file(stored: str, *, public_id: str | None = None):
    """The local path of a contract, fetched from Cloudinary if needed.

    Same safety as resolve_private_contract_file (basename only, inside
    CONTRACT_DIR). Returns None when the file exists nowhere.
    """
    local = resolve_private_contract_file(stored)
    if local is not None:
        return local
    name = _basename(stored)
    if not name or not CLOUDINARY_ENABLED:
        return None
    data = await fetch_contract_from_cloudinary(contract_cloud_id(name))
    if data is None and public_id:
        data = await fetch_contract_from_cloudinary(public_id)
    if data is None:
        return None
    target = CONTRACT_DIR.resolve() / name
    await asyncio.to_thread(target.write_bytes, data)
    return target


def forget_contract_file(stored: str) -> bool:
    """Delete a contract from this disk and from Cloudinary."""
    name = _basename(stored)
    if not name:
        return False
    local = resolve_private_contract_file(name)
    if local is not None:
        local.unlink(missing_ok=True)
    if CLOUDINARY_ENABLED:
        delete_contract_from_cloudinary(contract_cloud_id(name))
    return True


async def mirror_local_contracts() -> dict:
    """Copy every contract file on this disk that Cloudinary does not hold.

    Run at startup. While the volume is still attached this is the
    migration; afterwards it is a no-op, since every new file was kept as it
    was written. `contract_cloud` records what is done, so a restart does not
    upload everything again.
    """
    counts = {"copied": 0, "already": 0, "failed": 0}
    if not CLOUDINARY_ENABLED:
        return counts
    for path in sorted(CONTRACT_DIR.iterdir()):
        if not path.is_file() or path.name.startswith("."):
            continue
        if await db.contract_cloud.find_one({"_id": path.name}, {"_id": 1}):
            counts["already"] += 1
            continue
        try:
            await keep_contract_file(path)
            counts["copied"] += 1
        except Exception:  # noqa: BLE001 - one bad file must not stop the rest
            counts["failed"] += 1
    logger.info("[contracts] mirror to Cloudinary: %s", counts)
    return counts
