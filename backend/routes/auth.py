"""Auto-extracted from server.py during the 2026-04 refactor."""
import asyncio
import os
import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request

from models import ChangePasswordRequest, ForgotPasswordRequest, ResetPasswordRequest, UserLogin, UserRegister
from routes.deps import create_token, db, logger, verify_token
from utils.email import (
    send_password_reset_email,
    send_welcome_email,
)

router = APIRouter()
api_router = router  # alias so existing @api_router decorators work verbatim


@api_router.post("/auth/register")
async def register(user_data: UserRegister) -> dict:
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
        "role": user_data.role,
        "phone": user_data.phone,
        "created_at": datetime.now(UTC).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    token = create_token(user_id, user_data.role)

    # Send welcome email via Postmark (fire and forget — don't block registration)
    try:
        asyncio.create_task(send_welcome_email(user_data.email, user_data.name, user_data.role))
    except Exception as e:
        logger.warning(f"Failed to queue welcome email for {user_data.email}: {e}")

    return {"token": token, "user": {"id": user_id, "email": user_data.email, "name": user_data.name, "role": user_data.role}}


@api_router.post("/auth/login")
async def login(credentials: UserLogin) -> dict:
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not bcrypt.checkpw(credentials.password.encode('utf-8'), user['password'].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user['id'], user['role'])
    return {"token": token, "user": {"id": user['id'], "email": user['email'], "name": user['name'], "role": user['role']}}


@api_router.get("/auth/me")
async def get_current_user(payload: dict = Depends(verify_token)) -> dict:
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user



@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, req: Request) -> dict:
    user = await db.users.find_one({"email": request.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="No account found with that email address.")

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

    email_sent = await send_password_reset_email(request.email, user.get('name', ''), reset_link)

    return {
        "message": "Password reset link has been generated.",
        "reset_token": reset_token,
        "email_sent": email_sent
    }



@api_router.post("/auth/reset-password")
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



@api_router.post("/auth/change-password")
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
