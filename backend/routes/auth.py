"""Authentication routes"""
from fastapi import APIRouter, HTTPException, Depends, Request, Body
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime, timezone, timedelta
import bcrypt
import uuid
import asyncio
import logging
import os

from models import UserRegister, UserLogin, ForgotPasswordRequest, ResetPasswordRequest, ChangePasswordRequest
from utils.auth import create_token, verify_token
from utils.email import send_email

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


def get_db():
    """Dependency to get database - will be injected from main"""
    pass


@router.post("/register")
async def register(user_data: UserRegister, db: AsyncIOMotorDatabase = Depends(get_db)):
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
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    token = create_token(user_id, user_data.role)

    # Send welcome email (fire and forget)
    try:
        welcome_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 30px; background: #f9f9f9; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #1E6A6A; font-size: 24px; margin: 0;">MyIsraelRental</h1>
                <p style="color: #D4AF37; font-size: 12px; letter-spacing: 2px; margin-top: 4px;">YOUR HOME IN ISRAEL</p>
            </div>
            <div style="background: white; padding: 32px; border-radius: 10px; border: 1px solid #e5e5e5;">
                <h2 style="color: #333; font-size: 20px; margin-top: 0;">Welcome, {user_data.name}!</h2>
                <p style="color: #555; font-size: 14px; line-height: 1.7;">
                    Thank you for joining <strong style="color: #1E6A6A;">MyIsraelRental</strong>. We're excited to have you on board!
                </p>
                <div style="text-align: center; margin-top: 24px;">
                    <a href="https://myisraelrental.com/dashboard" style="background-color: #1E6A6A; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: bold; display: inline-block;">
                        Go to Your Dashboard
                    </a>
                </div>
            </div>
        </div>
        """
        asyncio.create_task(send_email(user_data.email, "Welcome to MyIsraelRental! 🏠", welcome_html))
    except Exception as e:
        logger.warning(f"Failed to queue welcome email: {e}")

    return {"token": token, "user": {"id": user_id, "email": user_data.email, "name": user_data.name, "role": user_data.role}}


@router.post("/login")
async def login(credentials: UserLogin, db: AsyncIOMotorDatabase = Depends(get_db)):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not bcrypt.checkpw(credentials.password.encode('utf-8'), user['password'].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user['id'], user['role'])
    return {"token": token, "user": {"id": user['id'], "email": user['email'], "name": user['name'], "role": user['role']}}


@router.get("/me")
async def get_current_user(payload = Depends(verify_token), db: AsyncIOMotorDatabase = Depends(get_db)):
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, req: Request = None, db: AsyncIOMotorDatabase = Depends(get_db)):
    user = await db.users.find_one({"email": request.email}, {"_id": 0})
    if not user:
        return {"message": "If that email exists, a reset link has been sent", "reset_token": None, "email_sent": False}

    reset_token = str(uuid.uuid4())
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()

    await db.password_resets.delete_many({"email": request.email})
    await db.password_resets.insert_one({
        "token": reset_token,
        "email": request.email,
        "user_id": user['id'],
        "expires_at": expires_at,
        "used": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    origin = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
    reset_link = f"{origin}/auth/reset-password?token={reset_token}"

    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px;">
        <h2>Password Reset Request</h2>
        <p>Click the button below to reset your password:</p>
        <a href="{reset_link}" style="background-color: #1E6A6A; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px;">
            Reset My Password
        </a>
        <p>This link expires in 1 hour.</p>
    </div>
    """

    email_sent = await send_email(request.email, "Reset Your Password — MyIsraelRental", html_body)

    return {"message": "Password reset link has been generated.", "reset_token": reset_token, "email_sent": email_sent}


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    reset_doc = await db.password_resets.find_one({"token": request.token, "used": False}, {"_id": 0})
    if not reset_doc:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    expires_at = datetime.fromisoformat(reset_doc['expires_at'])
    if datetime.now(timezone.utc) > expires_at:
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


@router.post("/change-password")
async def change_password(request: ChangePasswordRequest, payload=Depends(verify_token), db: AsyncIOMotorDatabase = Depends(get_db)):
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
