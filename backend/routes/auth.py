"""Auto-extracted from server.py during the 2026-04 refactor."""
import asyncio
import hashlib
import os
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
import httpx
from fastapi import APIRouter, Body, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

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

# Strong-refs for fire-and-forget email tasks — same reason as
# routes/chat.py's ``_bg_email_tasks``. asyncio only holds weak refs
# to tasks scheduled via ``create_task``, so without this set the GC
# can collect our welcome/reset email tasks mid-flight and Postmark
# never sees the send.
_bg_email_tasks: set[asyncio.Task] = set()


def _schedule_bg_email(coro) -> asyncio.Task:
    task = asyncio.create_task(coro)
    _bg_email_tasks.add(task)
    task.add_done_callback(_bg_email_tasks.discard)
    return task

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

    # SEC-001 fix: reject any attempt to self-register as admin.
    # Renter, owner, manager, and service-provider may be created via
    # the public signup form. Manager was added here because that role
    # is the "I run multiple listings on behalf of clients" persona —
    # it powers bulk-import and public agency pages, and is functionally
    # equivalent to `owner` from an authorization standpoint (the app's
    # permission checks treat manager the same as owner for property
    # CRUD; admin promotion still requires an admin).
    requested_role = (user_data.role or "").strip().lower()
    if requested_role not in {"renter", "owner", "provider", "manager"}:
        raise HTTPException(
            status_code=400,
            detail="Registration role must be 'renter', 'owner', 'manager', or 'provider'",
        )

    # Normalize the incoming email to lowercase so downstream lookups
    # (auth login, postmark webhook, suppression check) don't drift by
    # letter-case. All routes already lowercase the search key; we just
    # need to store it that way once at signup. See also the migration
    # in scripts/backfill_email_lowercase.py for existing users.
    signup_email = (user_data.email or "").strip().lower()

    existing = await db.users.find_one({"email": signup_email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = bcrypt.hashpw(user_data.password.encode('utf-8'), bcrypt.gensalt())
    user_id = str(uuid.uuid4())

    user_doc = {
        "id": user_id,
        "email": signup_email,
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
        _schedule_bg_email(send_welcome_email(signup_email, user_data.name, requested_role))
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Failed to queue welcome email for {signup_email}: {e}")

    return {
        "token": token,
        "user": {
            "id": user_id, "email": signup_email, "name": user_data.name,
            "role": requested_role, "email_verified": True,
        },
    }


@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin, req: Request) -> dict:
    # Rate-limit per (IP, email) so an attacker can't brute-force one
    # account by rotating IPs OR one IP by rotating emails. The email
    # bucket is ip_agnostic because the ingress rotates egress IPs and
    # an attacker on multiple hosts would defeat a per-(IP,email) limit.
    check_rate(req, bucket="auth-login-email", limit=10, window_seconds=300, key_extra=credentials.email.lower(), ip_agnostic=True)
    check_rate(req, bucket="auth-login-ip", limit=30, window_seconds=300)

    # Normalize the login email — legacy pre-2026-07 accounts may have
    # been stored with mixed case, so we look up case-insensitively when
    # the direct lowercase match misses.
    login_email = (credentials.email or "").strip().lower()
    user = await db.users.find_one({"email": login_email}, {"_id": 0})
    if not user:
        # Legacy fallback for rows written before the lowercase migration
        user = await db.users.find_one(
            {"email": {"$regex": f"^{login_email}$", "$options": "i"}},
            {"_id": 0},
        )
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


# ── Emergent-managed Google Sign-In ───────────────────────────────────────
# Front-end kicks off the flow by sending the visitor to
# https://auth.emergentagent.com/?redirect=<our-app>#... — once they finish
# Google's consent, Emergent redirects back with `#session_id=<one-shot>`.
# The client posts that session_id here; we exchange it with Emergent for
# the verified profile, upsert a local user, and mint one of our own JWTs
# so the rest of the app (which already trusts our JWT) works unchanged.
# We deliberately return the same shape as /auth/login so the frontend
# `login()` helper doesn't need a special case.
EMERGENT_AUTH_SESSION_URL = (
    "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
)


@api_router.post("/auth/google/session", response_model=TokenResponse)
async def google_session_exchange(
    payload: dict = Body(..., embed=False),
    req: Request = None,
) -> dict:
    """Exchange a one-shot Emergent session_id for our own JWT + user."""
    # Very light rate limit — this is a public endpoint that talks to a
    # 3rd-party auth server, so we want to keep abuse windows narrow.
    if req is not None:
        check_rate(req, bucket="auth-google-session", limit=20, window_seconds=300)

    session_id = (payload or {}).get("session_id")
    if not isinstance(session_id, str) or not session_id.strip():
        raise HTTPException(status_code=400, detail="session_id is required")

    # Ask Emergent Auth for the profile behind this session_id. Short
    # timeout — the browser is blocking on us to redirect.
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                EMERGENT_AUTH_SESSION_URL,
                headers={"X-Session-ID": session_id.strip()},
            )
    except httpx.RequestError as e:
        logger.warning(f"Emergent Auth unreachable: {e}")
        raise HTTPException(status_code=502, detail="Auth provider unreachable") from e

    if r.status_code != 200:
        # Most common cause: the session_id has already been consumed
        # (StrictMode double-render or a stale bookmark). Surface a 401
        # so the client redirects the visitor back to /auth/login.
        logger.info(f"Emergent Auth returned {r.status_code}: {r.text[:200]}")
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    data = r.json() or {}
    email = (data.get("email") or "").strip().lower()
    name = (data.get("name") or "").strip() or (email.split("@")[0] if email else "Google user")
    picture = data.get("picture") or None
    if not email:
        raise HTTPException(status_code=502, detail="Auth provider returned no email")

    # Upsert by email — if the visitor previously signed up with
    # email/password we link the same account instead of orphaning it.
    existing = await db.users.find_one({"email": (email or "").strip().lower()}, {"_id": 0})
    if existing:
        # Attach the Google identity + picture on first-time link. We
        # don't touch role/password/etc — an existing account keeps its
        # settings.
        set_updates: dict[str, str] = {}
        if picture and not existing.get("picture"):
            set_updates["picture"] = picture
        if not existing.get("google_linked"):
            set_updates["google_linked"] = True
        # A Google user is trivially email-verified.
        if not existing.get("email_verified"):
            set_updates["email_verified"] = True
        if set_updates:
            await db.users.update_one({"id": existing["id"]}, {"$set": set_updates})
            existing.update(set_updates)
        user_doc = existing
    else:
        # Fresh Google-first user. Default role is `renter` — the least
        # privileged option; they can upgrade in the dashboard.
        user_doc = {
            "id": str(uuid.uuid4()),
            "email": email,
            "name": name,
            "picture": picture,
            "role": "renter",
            "email_verified": True,
            "google_linked": True,
            "created_at": datetime.now(UTC).isoformat(),
        }
        await db.users.insert_one(user_doc)
        # Fire-and-forget welcome email (best-effort — errors are logged).
        try:
            _schedule_bg_email(send_welcome_email(email, name, "renter"))
        except Exception as e:  # noqa: BLE001
            logger.warning(f"Failed to queue welcome email for {email}: {e}")

    jwt_token = create_token(user_doc["id"], user_doc.get("role", "renter"))
    return {
        "token": jwt_token,
        "user": {
            "id": user_doc["id"],
            "email": user_doc["email"],
            "name": user_doc.get("name", ""),
            "role": user_doc.get("role", "renter"),
            "email_verified": True,
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
    user = await db.users.find_one({"email": (request.email or "").strip().lower()}, {"_id": 0})
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
    _schedule_bg_email(_send_verification_email(user, raw_token, req))
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
    # Email is ip_agnostic (attacker rotates IPs, but they target one email
    # at a time); IP is kept as a secondary check for pure-enumeration.
    check_rate(req, bucket="auth-forgot-email", limit=5, window_seconds=600, key_extra=request.email.lower(), ip_agnostic=True)
    check_rate(req, bucket="auth-forgot-ip", limit=15, window_seconds=600)

    user = await db.users.find_one({"email": (request.email or "").strip().lower()}, {"_id": 0})

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

    normalized_reset_email = (request.email or "").strip().lower()
    await db.password_resets.delete_many({"email": normalized_reset_email})
    await db.password_resets.insert_one({
        "token": reset_token,
        "email": normalized_reset_email,
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

    # Fire-and-forget so a slow Postmark call doesn't stall the
    # forgot-password response. Same strong-ref pattern as signup.
    _schedule_bg_email(
        send_password_reset_email(normalized_reset_email, user.get('name', ''), reset_link)
    )

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
        {"$set": {
            "password": hashed.decode('utf-8'),
            # Stamp the completion so admin tools can distinguish
            # imported owners who've onboarded from those still holding
            # the throwaway hash. Drives the "Resend set-password" UI.
            "password_set_at": datetime.now(UTC).isoformat(),
        }}
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
    if target not in {"renter", "owner", "provider"}:
        raise HTTPException(
            status_code=400,
            detail="Target role must be 'renter', 'owner', or 'provider' — promotion to manager/admin requires admin help",
        )

    current_role = payload.get("role")
    if current_role == "admin":
        # Admins must not be flippable via a self-service endpoint —
        # privilege boundary. They can only be changed by another admin
        # through the user-management UI.
        raise HTTPException(status_code=403, detail=f"Cannot switch role from '{current_role}' here")
    if current_role == target:
        raise HTTPException(status_code=400, detail=f"You are already a {target}")

    # Allowed transition set. Provider is added alongside owner — same
    # privilege tier (self-selected marketplace participant), so we let
    # a fresh Google-signed renter promote themselves without an admin.
    allowed = {
        ("renter", "owner"),
        ("renter", "provider"),
        ("owner", "renter"),
        ("owner", "provider"),
        ("provider", "renter"),
        ("provider", "owner"),
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
        else "You're now set up as a service provider. Welcome aboard!" if target == "provider"
        else "Switched back to renter. You can switch to lister again any time from Settings."
    )
    return {"token": new_token, "user": user, "message": message}



class DeeplinkConsumeIn(BaseModel):
    token: str


@router.post("/auth/deeplink-consume")
async def deeplink_consume(payload: DeeplinkConsumeIn):
    """Exchange a short-lived (7-day) email deep-link JWT for a full
    30-day session token.

    Used by the "View & Bid" CTA in job-match notification emails so
    that a provider who clicks through lands on the job post already
    authenticated — they can hit "Apply" without a login prompt.

    Auth-in: the signed token itself (no bearer). Auth-out: a normal
    session JWT the client persists in sessionStorage. Failure modes
    (expired, invalid, wrong purpose) return 400 with a friendly
    message so the frontend can render a "log in instead" fallback.
    """
    from utils.notification_tokens import (
        NotificationTokenError,
        verify_notification_token,
    )

    try:
        claims = verify_notification_token(payload.token, "job_deeplink")
    except NotificationTokenError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    user = await db.users.find_one(
        {"id": claims["user_id"]},
        {
            "_id": 0, "id": 1, "email": 1, "name": 1, "role": 1,
            "email_verified": 1, "phone": 1, "preferred_language": 1,
        },
    )
    if not user:
        # Account was deleted between the email being sent and now.
        raise HTTPException(status_code=400, detail="This link is no longer valid.")

    session_token = create_token(user["id"], user.get("role") or "renter")
    return {
        "token": session_token,
        "user": user,
        "job_id": claims.get("job_id"),
    }
