"""Auto-extracted from server.py during the 2026-04 refactor."""
import asyncio
import hashlib
import os
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse

from models import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LanguagePreference,
    ResetPasswordRequest,
    RoleUpdate,
    UserLogin,
    UserRegister,
    WhatsAppNumberUpdate,
)
from models_response import MessageResponse, PasswordResetResponse, TokenResponse, UserPublic
from routes.deps import create_token, db, logger, verify_token
from utils.email import (
    send_password_reset_email,
    send_welcome_email,
)
from utils.rate_limit import check_rate

router = APIRouter()
api_router = router  # alias so existing @api_router decorators work verbatim


# --- Email verification helpers -------------------------------------------
VERIFY_TOKEN_TTL = timedelta(hours=24)
RESEND_COOLDOWN = timedelta(seconds=60)


def _hash_token(raw: str) -> str:
    """Hash a verification token before persisting. Mirrors how we'd
    hash a password reset token — we never store the raw value at rest."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _frontend_origin(req: Request | None = None) -> str:
    """Resolve the frontend origin for building absolute links inside
    transactional emails. Prefers FRONTEND_URL, falls back to Referer."""
    origin = os.environ.get("FRONTEND_URL", "")
    if not origin and req is not None:
        referer = req.headers.get("referer", "")
        if referer:
            from urllib.parse import urlparse
            parsed = urlparse(referer)
            origin = f"{parsed.scheme}://{parsed.netloc}"
    return origin or "https://myisraelrental.com"


def _new_verification_token() -> tuple[str, str, str]:
    """Return (raw_token, hashed_token, expires_at_iso) for a brand-new
    email verification token."""
    raw = secrets.token_urlsafe(32)
    return raw, _hash_token(raw), (datetime.now(UTC) + VERIFY_TOKEN_TTL).isoformat()


async def _send_verification_email(user: dict, raw_token: str, req: Request | None) -> None:
    link = f"{_frontend_origin(req)}/verify-email?token={raw_token}"
    try:
        await send_welcome_email(
            user["email"], user.get("name", ""), user.get("role", "renter"),
            verification_link=link,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Failed to send verification email to {user['email']}: {e}")


@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserRegister, req: Request) -> dict:
    # Rate-limit signups per IP to slow bulk account creation abuse.
    check_rate(req, bucket="auth-register", limit=5, window_seconds=600)

    # SEC-001 fix: reject any attempt to self-register as admin/manager.
    # Only renter/owner may be created via the public signup form; admin
    # and manager accounts are provisioned by an existing admin via the
    # admin user-management endpoints. Falls back to 'renter' if a client
    # sends something unexpected (e.g. empty string).
    requested_role = (user_data.role or "").strip().lower()
    if requested_role not in {"renter", "owner"}:
        raise HTTPException(
            status_code=400,
            detail="Registration role must be 'renter' or 'owner'",
        )

    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = bcrypt.hashpw(user_data.password.encode('utf-8'), bcrypt.gensalt())
    user_id = str(uuid.uuid4())

    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password": hashed_password.decode('utf-8'),
        "name": user_data.name,
        "role": requested_role,
        "phone": user_data.phone,
        "created_at": datetime.now(UTC).isoformat(),
        # Email verification was rolled back on 2026-06 at the user's
        # request. New signups are marked verified immediately so they
        # can log in straight away. The verification helpers below remain
        # in place behind dormant endpoints in case we re-enable later.
        "email_verified": True,
    }

    await db.users.insert_one(user_doc)
    token = create_token(user_id, requested_role)

    # Fire-and-forget welcome email (no verification link).
    try:
        asyncio.create_task(send_welcome_email(user_data.email, user_data.name, requested_role))
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Failed to queue welcome email for {user_data.email}: {e}")

    return {
        "token": token,
        "user": {
            "id": user_id, "email": user_data.email, "name": user_data.name,
            "role": requested_role, "email_verified": True,
        },
    }


@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin, req: Request) -> dict:
    # Rate-limit per (IP, email) so an attacker can't brute-force one
    # account by rotating IPs OR one IP by rotating emails: 10 attempts
    # per 5 minutes keyed to email, 30 per 5 minutes keyed to IP alone.
    check_rate(req, bucket="auth-login-email", limit=10, window_seconds=300, key_extra=credentials.email.lower())
    check_rate(req, bucket="auth-login-ip", limit=30, window_seconds=300)

    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not bcrypt.checkpw(credentials.password.encode('utf-8'), user['password'].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(user['id'], user['role'])
    return {
        "token": token,
        "user": {
            "id": user['id'], "email": user['email'], "name": user['name'],
            "role": user['role'], "email_verified": user.get('email_verified', True),
        },
    }


@api_router.get("/auth/verify-email")
async def verify_email(token: str, req: Request):
    """Mark a user as verified and redirect them to the frontend.

    The link in the welcome email points here; on success we 302 to
    /verify-email?status=success on the frontend so the SPA can show a
    confirmation. Failure modes redirect with `?status=invalid` or
    `?status=expired` so the UI can show the right copy + a resend CTA.
    """
    frontend = _frontend_origin(req)
    if not token:
        return RedirectResponse(url=f"{frontend}/verify-email?status=invalid")

    token_hash = _hash_token(token)
    user = await db.users.find_one(
        {"verification_token_hash": token_hash},
        {"_id": 0, "id": 1, "email_verified": 1, "verification_token_expires_at": 1},
    )
    if user is None:
        return RedirectResponse(url=f"{frontend}/verify-email?status=invalid")

    if user.get("email_verified"):
        return RedirectResponse(url=f"{frontend}/verify-email?status=already")

    try:
        if datetime.fromisoformat(user["verification_token_expires_at"]) < datetime.now(UTC):
            return RedirectResponse(url=f"{frontend}/verify-email?status=expired")
    except (KeyError, ValueError, TypeError):
        return RedirectResponse(url=f"{frontend}/verify-email?status=invalid")

    await db.users.update_one(
        {"id": user["id"]},
        {
            "$set": {"email_verified": True},
            "$unset": {"verification_token_hash": "", "verification_token_expires_at": ""},
        },
    )
    return RedirectResponse(url=f"{frontend}/verify-email?status=success")


@api_router.post("/auth/resend-verification", response_model=MessageResponse)
async def resend_verification(request: ForgotPasswordRequest, req: Request) -> dict:
    """Re-send the verification email by email address.

    Public (no JWT required) so a user who's been blocked at /auth/login
    can recover. Uses the same anti-enumeration pattern as
    /auth/forgot-password: always responds with the same generic message
    regardless of whether the email exists, and rate-limits per-user via
    `verification_email_last_sent_at` (60s cooldown).
    """
    generic = {"message": "If an account exists for that email, a verification link has been re-sent. Please check your inbox (and spam folder)."}
    user = await db.users.find_one({"email": request.email}, {"_id": 0})
    if not user:
        return generic
    if user.get("email_verified"):
        return generic

    last = user.get("verification_email_last_sent_at")
    if last:
        try:
            if datetime.now(UTC) - datetime.fromisoformat(last) < RESEND_COOLDOWN:
                # Don't reveal cooldown info to enumeration attackers;
                # return the generic message anyway.
                return generic
        except (ValueError, TypeError):
            pass

    raw_token, token_hash, expires_at = _new_verification_token()
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "verification_token_hash": token_hash,
            "verification_token_expires_at": expires_at,
            "verification_email_last_sent_at": datetime.now(UTC).isoformat(),
        }},
    )
    asyncio.create_task(_send_verification_email(user, raw_token, req))
    return generic


@api_router.get("/auth/me", response_model=UserPublic)
async def get_current_user(payload: dict = Depends(verify_token)) -> dict:
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user



@api_router.post("/auth/forgot-password", response_model=PasswordResetResponse)
async def forgot_password(request: ForgotPasswordRequest, req: Request) -> dict:
    """Generate a reset token and email it to the user.

    For security, the token is *never* returned in the HTTP response — it is
    only deliverable via the email link. We also respond with a generic
    success message even when the email is not registered, to prevent
    account-enumeration attacks.
    """
    # Rate-limit password-reset requests to slow enumeration + email-flood.
    check_rate(req, bucket="auth-forgot", limit=5, window_seconds=600, key_extra=request.email.lower())
    check_rate(req, bucket="auth-forgot-ip", limit=15, window_seconds=600)

    user = await db.users.find_one({"email": request.email}, {"_id": 0})

    # Generic public-facing response used in both the "user found" and
    # "user not found" branches so attackers cannot probe which emails exist.
    generic_response = {
        "message": "If an account exists for that email, a reset link has been sent.",
        "email_sent": True,
    }

    if not user:
        # Return the same shape without touching the DB — same latency cost is
        # fine for a non-hot-path endpoint.
        return generic_response

    reset_token = str(uuid.uuid4())
    expires_at = (datetime.now(UTC) + timedelta(hours=1)).isoformat()

    await db.password_resets.delete_many({"email": request.email})
    await db.password_resets.insert_one({
        "token": reset_token,
        "email": request.email,
        "user_id": user['id'],
        "expires_at": expires_at,
        "used": False,
        "created_at": datetime.now(UTC).isoformat()
    })

    # Build the reset link using the frontend origin
    origin = os.environ.get('FRONTEND_URL', '')
    if not origin:
        referer = req.headers.get('referer', '')
        if referer:
            from urllib.parse import urlparse
            parsed = urlparse(referer)
            origin = f"{parsed.scheme}://{parsed.netloc}"
    if not origin:
        origin = "http://localhost:3000"

    reset_link = f"{origin}/auth/reset-password?token={reset_token}"

    try:
        await send_password_reset_email(request.email, user.get('name', ''), reset_link)
    except Exception:  # noqa: BLE001
        # Don't reveal delivery failures to the caller
        pass

    return generic_response



@api_router.post("/auth/reset-password", response_model=MessageResponse)
async def reset_password(request: ResetPasswordRequest) -> dict:
    reset_doc = await db.password_resets.find_one({"token": request.token, "used": False}, {"_id": 0})
    if not reset_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    expires_at = datetime.fromisoformat(reset_doc['expires_at'])
    if datetime.now(UTC) > expires_at:
        raise HTTPException(status_code=400, detail="Reset token has expired")

    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    hashed = bcrypt.hashpw(request.new_password.encode('utf-8'), bcrypt.gensalt())
    await db.users.update_one(
        {"id": reset_doc['user_id']},
        {"$set": {"password": hashed.decode('utf-8')}}
    )
    await db.password_resets.update_one(
        {"token": request.token},
        {"$set": {"used": True}}
    )

    return {"message": "Password has been reset successfully"}



@api_router.post("/auth/change-password", response_model=MessageResponse)
async def change_password(request: ChangePasswordRequest, payload: dict = Depends(verify_token)) -> dict:
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not bcrypt.checkpw(request.current_password.encode('utf-8'), user['password'].encode('utf-8')):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")

    hashed = bcrypt.hashpw(request.new_password.encode('utf-8'), bcrypt.gensalt())
    await db.users.update_one(
        {"id": payload['user_id']},
        {"$set": {"password": hashed.decode('utf-8')}}
    )

    return {"message": "Password changed successfully"}



@api_router.put("/auth/language", response_model=MessageResponse)
async def set_language(pref: LanguagePreference, payload: dict = Depends(verify_token)) -> dict:
    """Persist the user's preferred UI language so it follows them across devices."""
    if pref.language not in ("en", "he"):
        raise HTTPException(status_code=400, detail="language must be 'en' or 'he'")
    await db.users.update_one(
        {"id": payload['user_id']},
        {"$set": {"preferred_language": pref.language}},
    )
    return {"message": "Language preference saved"}


@api_router.put("/auth/whatsapp", response_model=MessageResponse)
async def set_whatsapp_number(
    payload_in: WhatsAppNumberUpdate,
    payload: dict = Depends(verify_token),
) -> dict:
    """Update the user's WhatsApp/phone number. Empty string clears it.

    We store this in the same ``phone`` column the rest of the codebase
    already uses so existing callers (email signatures, chat lister
    contact info, etc.) keep working without changes. New WhatsApp-send
    code reads the same field.
    """
    raw = (payload_in.whatsapp_number or '').strip()
    # Light normalisation: collapse internal whitespace, strip everything
    # except digits and a leading +. We don't try to validate country
    # codes — that's a job for the WhatsApp provider on send.
    cleaned = '+' if raw.startswith('+') else ''
    cleaned += ''.join(ch for ch in raw if ch.isdigit())
    if cleaned and len(cleaned.lstrip('+')) < 6:
        raise HTTPException(status_code=400, detail="WhatsApp number looks too short")
    await db.users.update_one(
        {"id": payload['user_id']},
        {"$set": {"phone": cleaned}},
    )
    return {"message": "WhatsApp number saved"}



@api_router.put("/auth/role")
async def set_user_role(payload_in: RoleUpdate, payload: dict = Depends(verify_token)) -> dict:
    """Self-service "I picked the wrong role at signup" fix.

    Allowed transitions:
      • renter ↔ owner  — owners can demote back to renter (their
        listings stay in the DB but no longer manageable via the
        dashboard until they re-promote).
      • manager → renter — managers can step down to renter.

    Blocked:
      • Admin self-flips of any kind (privilege boundary).
      • Any target other than 'renter' or 'owner' (no self-promotion
        to manager or admin).
    """
    target = (payload_in.role or "").strip().lower()
    if target not in {"renter", "owner"}:
        raise HTTPException(
            status_code=400,
            detail="Target role must be 'renter' or 'owner' — promotion to manager/admin requires admin help",
        )

    current_role = payload.get("role")
    if current_role == "admin":
        # Admins must not be flippable via a self-service endpoint —
        # privilege boundary. They can only be changed by another admin
        # through the user-management UI.
        raise HTTPException(status_code=403, detail=f"Cannot switch role from '{current_role}' here")
    if current_role == target:
        raise HTTPException(status_code=400, detail=f"You are already a {target}")

    # Allowed transition set
    allowed = {
        ("renter", "owner"),
        ("owner", "renter"),
        ("manager", "renter"),
    }
    if (current_role, target) not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Switching from '{current_role}' to '{target}' is not allowed via this endpoint",
        )

    res = await db.users.update_one(
        {"id": payload["user_id"], "role": current_role},
        {"$set": {"role": target}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found or role already changed")

    user = await db.users.find_one(
        {"id": payload["user_id"]},
        {"_id": 0, "id": 1, "email": 1, "name": 1, "role": 1, "email_verified": 1, "phone": 1, "preferred_language": 1},
    )
    new_token = create_token(user["id"], user["role"])
    message = (
        "You're now set up as a lister. Welcome aboard!" if target == "owner"
        else "Switched back to renter. You can switch to lister again any time from Settings."
    )
    return {"token": new_token, "user": user, "message": message}
