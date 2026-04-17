from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Depends, Header, Request, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from emergentintegrations.llm.chat import LlmChat, UserMessage
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import base64
import json
import shutil
import httpx
import asyncio
from icalendar import Calendar as iCalCalendar, Event as iCalEvent
import pdfplumber
from docx import Document as DocxDocument
from io import BytesIO

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production-12345')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# SMTP / SES Configuration
SMTP_FROM = os.environ.get('SMTP_FROM', '')
AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID', '')
AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY', '')
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')


async def send_email(to_email: str, subject: str, html_body: str):
    """Send an email via AWS SES boto3 API."""
    try:
        import boto3
        ses_client = boto3.client(
            'ses',
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY
        )
        response = ses_client.send_email(
            Source=SMTP_FROM,
            Destination={'ToAddresses': [to_email]},
            Message={
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {'Html': {'Data': html_body, 'Charset': 'UTF-8'}}
            }
        )
        logger.info(f"Email sent to {to_email}: {subject} (MessageId: {response.get('MessageId')})")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False

# Exchange rate cache
_exchange_cache = {"rate": None, "fetched_at": None}

async def get_usd_ils_rate():
    now = datetime.now(timezone.utc)
    if _exchange_cache["rate"] and _exchange_cache["fetched_at"] and (now - _exchange_cache["fetched_at"]).total_seconds() < 3600:
        return _exchange_cache["rate"]
    try:
        async with httpx.AsyncClient(timeout=5) as client_http:
            resp = await client_http.get("https://api.exchangerate-api.com/v4/latest/USD")
            data = resp.json()
            rate = data["rates"]["ILS"]
            _exchange_cache["rate"] = rate
            _exchange_cache["fetched_at"] = now
            return rate
    except Exception:
        return _exchange_cache["rate"] or 3.65


# --- iCal Sync ---
async def parse_ical_feed(url: str):
    """Fetch and parse an iCal feed, return list of {start, end, summary} date ranges."""
    blocked = []
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as http:
            resp = await http.get(url)
            resp.raise_for_status()
            cal = iCalCalendar.from_ical(resp.text)
            for component in cal.walk():
                if component.name == 'VEVENT':
                    dtstart = component.get('dtstart')
                    dtend = component.get('dtend')
                    summary = str(component.get('summary', 'Blocked'))
                    if dtstart and dtend:
                        start = dtstart.dt
                        end = dtend.dt
                        if hasattr(start, 'date'):
                            start = start.date()
                        if hasattr(end, 'date'):
                            end = end.date()
                        blocked.append({
                            "start": str(start),
                            "end": str(end),
                            "summary": summary
                        })
    except Exception as e:
        logging.error(f"iCal fetch error for {url}: {e}")
    return blocked

async def sync_property_ical(property_id: str):
    """Sync all iCal feeds for a single property."""
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0, "ical_urls": 1})
    if not prop or not prop.get("ical_urls"):
        return
    all_blocked = []
    for url_entry in prop["ical_urls"]:
        url = url_entry if isinstance(url_entry, str) else url_entry.get("url", "")
        if not url:
            continue
        dates = await parse_ical_feed(url)
        for d in dates:
            d["source_url"] = url
        all_blocked.extend(dates)
    # Replace all external bookings for this property
    await db.external_bookings.delete_many({"property_id": property_id})
    if all_blocked:
        docs = []
        for b in all_blocked:
            docs.append({
                "id": str(uuid.uuid4()),
                "property_id": property_id,
                "start_date": b["start"],
                "end_date": b["end"],
                "summary": b["summary"],
                "source_url": b["source_url"],
                "synced_at": datetime.now(timezone.utc).isoformat()
            })
        await db.external_bookings.insert_many(docs)
    await db.properties.update_one(
        {"id": property_id},
        {"$set": {"ical_last_synced": datetime.now(timezone.utc).isoformat()}}
    )

async def sync_all_ical_feeds():
    """Background task: sync all vacation properties with iCal URLs every 5 minutes."""
    while True:
        try:
            props = await db.properties.find(
                {"rental_type": "vacation", "ical_urls": {"$exists": True, "$ne": []}},
                {"_id": 0, "id": 1}
            ).to_list(1000)
            for p in props:
                await sync_property_ical(p["id"])
            if props:
                logging.info(f"iCal sync complete: {len(props)} properties synced")
        except Exception as e:
            logging.error(f"iCal background sync error: {e}")
        await asyncio.sleep(300)  # 5 minutes

def create_token(user_id: str, role: str) -> str:
    payload = {
        'user_id': user_id,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str
    phone: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class PropertyCreate(BaseModel):
    title: str
    description: Optional[str] = None
    rental_type: str
    property_type: str
    bedrooms: Optional[float] = None
    bathrooms: Optional[float] = None
    area: str
    address: Optional[str] = None
    square_meters: Optional[float] = None
    porch_square_meters: Optional[float] = None
    floor: Optional[float] = None
    has_elevator: Optional[bool] = False
    is_shabbat_elevator: Optional[bool] = False
    is_tama: Optional[bool] = False
    has_agent_fee: Optional[bool] = False
    agent_fee_price: Optional[float] = None
    agent_fee_currency: Optional[str] = 'ILS'
    porches: Optional[int] = 0
    sukkah_compatible: Optional[bool] = False
    condition: Optional[str] = 'good'
    furniture_option: Optional[str] = 'no_furniture'
    amenities: Optional[List[str]] = []
    monthly_price: Optional[float] = None
    nightly_price: Optional[float] = None
    currency: Optional[str] = 'ILS'
    images: Optional[List[str]] = []
    videos: Optional[List[str]] = []
    ical_url: Optional[str] = None
    cancellation_policy: Optional[str] = 'flexible'
    custom_cancellation_policy: Optional[str] = None
    available_from: Optional[str] = None  # For short-term/vacation
    starting_date: Optional[str] = None  # For long-term (fixed start date)
    minimum_booking_days: Optional[int] = None  # For vacation (in days), for others (in months)

class BookingCreate(BaseModel):
    property_id: str
    start_date: str
    end_date: str
    message: Optional[str] = None
    contract_signed: Optional[bool] = False
    signature_data: Optional[str] = None  # Base64 encoded signature image

class ChatMessage(BaseModel):
    property_id: str
    message: str
    receiver_id: str

class NotificationPreferences(BaseModel):
    rental_type: Optional[str] = None
    min_bedrooms: Optional[int] = None
    max_price: Optional[float] = None
    area: Optional[str] = None

class TranslationRequest(BaseModel):
    text: str
    from_lang: str
    to_lang: str

class ContractSignature(BaseModel):
    contract_id: str
    signer_name: str
    signature_data: str

class SubleaseCreate(BaseModel):
    property_id: str
    available_from: str
    available_to: str
    price: float
    price_type: str  # "flat" or "per_night"
    bedrooms_available: Optional[int] = None
    notes: Optional[str] = None

class DocumentServiceRequest(BaseModel):
    service_type: str
    property_address: str
    tenant_name: str
    tenant_id: str
    additional_info: Optional[str] = None

class SiteSettings(BaseModel):
    whatsapp_number: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    featured_property_ids: Optional[List[str]] = []

class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    message: str


@api_router.get("/exchange-rate")
async def get_exchange_rate():
    rate = await get_usd_ils_rate()
    return {"usd_to_ils": round(rate, 4), "ils_to_usd": round(1 / rate, 4)}

@api_router.post("/auth/register")
async def register(user_data: UserRegister):
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

    # Send welcome email (fire and forget — don't block registration)
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
                <div style="background: #f7f7f7; border-radius: 8px; padding: 16px; margin: 20px 0; border-left: 4px solid #1E6A6A;">
                    <p style="color: #555; font-size: 13px; margin: 0; line-height: 1.6;">
                        <strong style="color: #333;">Your Account Details:</strong><br>
                        Email: {user_data.email}<br>
                        Role: {user_data.role.title()}
                    </p>
                </div>
                <p style="color: #555; font-size: 14px; line-height: 1.7;">
                    Here's what you can do next:
                </p>
                <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                    <tr>
                        <td style="padding: 10px 12px; background: #1E6A6A10; border-radius: 8px 8px 0 0; border-bottom: 1px solid #e5e5e5;">
                            <span style="color: #1E6A6A; font-weight: bold; font-size: 13px;">🏠 Browse Properties</span>
                            <p style="color: #666; font-size: 12px; margin: 4px 0 0;">Find long-term, short-term, or vacation rentals across Israel</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 12px; background: #D4AF3710; border-bottom: 1px solid #e5e5e5;">
                            <span style="color: #D4AF37; font-weight: bold; font-size: 13px;">📋 Sublease Your Property</span>
                            <p style="color: #666; font-size: 12px; margin: 4px 0 0;">List your sublease in just a few clicks</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 10px 12px; background: #f7f7f7; border-radius: 0 0 8px 8px;">
                            <span style="color: #333; font-weight: bold; font-size: 13px;">📄 Government Services</span>
                            <p style="color: #666; font-size: 12px; margin: 4px 0 0;">Arnona discounts, property name changes, and more — handled for you</p>
                        </td>
                    </tr>
                </table>
                <div style="text-align: center; margin-top: 24px;">
                    <a href="https://myisraelrental.com/dashboard" style="background-color: #1E6A6A; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: bold; display: inline-block;">
                        Go to Your Dashboard
                    </a>
                </div>
            </div>
            <div style="text-align: center; margin-top: 20px;">
                <p style="color: #999; font-size: 11px; line-height: 1.5;">
                    Questions? Contact us at <a href="mailto:mir@myisraelrental.com" style="color: #D4AF37;">mir@myisraelrental.com</a>
                    or call <a href="tel:+972553225141" style="color: #D4AF37;">+972 55 322 5141</a>
                </p>
                <p style="color: #bbb; font-size: 10px; margin-top: 8px;">&copy; MyIsraelRental.com — My Israel Rental LLC</p>
            </div>
        </div>
        """
        asyncio.create_task(send_email(user_data.email, "Welcome to MyIsraelRental! 🏠", welcome_html))
    except Exception as e:
        logger.warning(f"Failed to queue welcome email for {user_data.email}: {e}")

    return {"token": token, "user": {"id": user_id, "email": user_data.email, "name": user_data.name, "role": user_data.role}}

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not bcrypt.checkpw(credentials.password.encode('utf-8'), user['password'].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user['id'], user['role'])
    return {"token": token, "user": {"id": user['id'], "email": user['email'], "name": user['name'], "role": user['role']}}

@api_router.get("/auth/me")
async def get_current_user(payload = Depends(verify_token)):
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@api_router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, req: Request = None):
    user = await db.users.find_one({"email": request.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="No account found with that email address.")

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

    # Build the reset link using the frontend origin
    origin = os.environ.get('FRONTEND_URL', '')
    if not origin and req:
        referer = req.headers.get('referer', '')
        if referer:
            from urllib.parse import urlparse
            parsed = urlparse(referer)
            origin = f"{parsed.scheme}://{parsed.netloc}"
    if not origin:
        origin = "http://localhost:3000"

    reset_link = f"{origin}/auth/reset-password?token={reset_token}"

    # Send the reset email
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: #f9f9f9; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #1E6A6A; font-size: 22px; margin: 0;">MyIsraelRental</h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 10px; border: 1px solid #e5e5e5;">
            <h2 style="color: #333; font-size: 18px; margin-top: 0;">Password Reset Request</h2>
            <p style="color: #555; font-size: 14px; line-height: 1.6;">
                Hi {user.get('name', 'there')},<br><br>
                We received a request to reset your password. Click the button below to set a new password:
            </p>
            <div style="text-align: center; margin: 28px 0;">
                <a href="{reset_link}" style="background-color: #1E6A6A; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: bold; display: inline-block;">
                    Reset My Password
                </a>
            </div>
            <p style="color: #888; font-size: 12px; line-height: 1.5;">
                This link expires in 1 hour. If you didn't request this, you can safely ignore this email.<br><br>
                Or copy this link: <a href="{reset_link}" style="color: #D4AF37; word-break: break-all;">{reset_link}</a>
            </p>
        </div>
        <p style="text-align: center; color: #aaa; font-size: 11px; margin-top: 16px;">
            &copy; MyIsraelRental.com
        </p>
    </div>
    """

    email_sent = await send_email(request.email, "Reset Your Password — MyIsraelRental", html_body)

    return {
        "message": "Password reset link has been generated.",
        "reset_token": reset_token,
        "email_sent": email_sent
    }


@api_router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
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


@api_router.post("/auth/change-password")
async def change_password(request: ChangePasswordRequest, payload=Depends(verify_token)):
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

@api_router.post("/properties")
async def create_property(property_data: PropertyCreate, payload = Depends(verify_token)):
    property_id = str(uuid.uuid4())
    property_doc = property_data.model_dump()
    property_doc['id'] = property_id
    property_doc['owner_id'] = payload['user_id']
    property_doc['created_at'] = datetime.now(timezone.utc).isoformat()
    property_doc['views'] = 0
    property_doc['status'] = 'active'
    
    await db.properties.insert_one(property_doc)
    return {"id": property_id, "message": "Property created successfully"}

@api_router.get("/properties")
async def get_properties(
    rental_type: Optional[str] = None,
    min_bedrooms: Optional[float] = None,
    max_price: Optional[float] = None,
    area: Optional[str] = None,
    owner_id: Optional[str] = None,
    min_price: Optional[float] = None,
    currency: Optional[str] = None,
    min_bathrooms: Optional[float] = None,
    max_floor: Optional[float] = None,
    min_porches: Optional[int] = None,
    has_elevator: Optional[bool] = None,
    condition: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    query = {}
    if rental_type:
        query['rental_type'] = rental_type
    if min_bedrooms:
        query['bedrooms'] = {"$gte": min_bedrooms}
    if area:
        query['area'] = {"$regex": area, "$options": "i"}
    if owner_id:
        query['owner_id'] = owner_id
    if min_bathrooms:
        query['bathrooms'] = {"$gte": min_bathrooms}
    if max_floor is not None:
        query['floor'] = {"$lte": max_floor}
    if min_porches:
        query['porches'] = {"$gte": min_porches}
    if has_elevator is not None:
        query['has_elevator'] = has_elevator
    if condition:
        query['condition'] = condition
    
    properties = await db.properties.find(query, {"_id": 0}).to_list(1000)
    
    # Cross-currency price filtering
    if min_price or max_price:
        rate = await get_usd_ils_rate()
        filtered = []
        for p in properties:
            # Use whichever price the property has
            raw_price = p.get('monthly_price') or p.get('nightly_price') or 0
            prop_currency = p.get('currency', 'ILS')
            # Convert property price to the filter currency
            if currency and prop_currency != currency:
                if currency == 'USD' and prop_currency == 'ILS':
                    price_in_filter_currency = raw_price / rate
                elif currency == 'ILS' and prop_currency == 'USD':
                    price_in_filter_currency = raw_price * rate
                else:
                    price_in_filter_currency = raw_price
            else:
                price_in_filter_currency = raw_price
            if min_price and price_in_filter_currency < min_price:
                continue
            if max_price and price_in_filter_currency > max_price:
                continue
            filtered.append(p)
        properties = filtered
    
    # Filter out properties that have overlapping bookings for requested dates
    if date_from and date_to:
        booked_property_ids = set()
        overlapping_bookings = await db.bookings.find(
            {
                "status": {"$in": ["pending", "confirmed"]},
                "start_date": {"$lt": date_to},
                "end_date": {"$gt": date_from}
            },
            {"_id": 0, "property_id": 1}
        ).to_list(10000)
        for b in overlapping_bookings:
            booked_property_ids.add(b['property_id'])
        # Also check external iCal bookings
        external_overlaps = await db.external_bookings.find(
            {
                "start_date": {"$lt": date_to},
                "end_date": {"$gt": date_from}
            },
            {"_id": 0, "property_id": 1}
        ).to_list(10000)
        for b in external_overlaps:
            booked_property_ids.add(b['property_id'])
        properties = [p for p in properties if p['id'] not in booked_property_ids]
    
    return properties

@api_router.get("/properties/{property_id}")
async def get_property(property_id: str):
    property_data = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    await db.properties.update_one({"id": property_id}, {"$inc": {"views": 1}})
    property_data['views'] = property_data.get('views', 0) + 1
    
    owner = await db.users.find_one({"id": property_data.get("owner_id")}, {"_id": 0, "name": 1, "email": 1})
    if owner:
        property_data['owner_name'] = owner.get('name', '')
        property_data['owner_email'] = owner.get('email', '')
    
    return property_data

@api_router.put("/properties/{property_id}")
async def update_property(property_id: str, property_data: PropertyCreate, payload = Depends(verify_token)):
    existing = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if existing['owner_id'] != payload['user_id'] and payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_doc = property_data.model_dump()
    await db.properties.update_one({"id": property_id}, {"$set": update_doc})
    return {"message": "Property updated successfully"}

@api_router.delete("/properties/{property_id}")
async def delete_property(property_id: str, payload = Depends(verify_token)):
    existing = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if existing['owner_id'] != payload['user_id'] and payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.properties.delete_one({"id": property_id})
    return {"message": "Property deleted successfully"}


# --- Liked Properties ---

@api_router.post("/properties/{property_id}/like")
async def toggle_like_property(property_id: str, payload=Depends(verify_token)):
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    existing_like = await db.liked_properties.find_one({
        "user_id": payload['user_id'],
        "property_id": property_id
    })

    if existing_like:
        await db.liked_properties.delete_one({"user_id": payload['user_id'], "property_id": property_id})
        return {"liked": False, "message": "Property removed from favorites"}
    else:
        await db.liked_properties.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": payload['user_id'],
            "property_id": property_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        return {"liked": True, "message": "Property saved to favorites"}


@api_router.get("/liked-properties")
async def get_liked_properties(payload=Depends(verify_token)):
    likes = await db.liked_properties.find(
        {"user_id": payload['user_id']}, {"_id": 0}
    ).sort("created_at", -1).to_list(500)

    property_ids = [like['property_id'] for like in likes]
    if not property_ids:
        return []

    properties = await db.properties.find(
        {"id": {"$in": property_ids}}, {"_id": 0}
    ).to_list(500)

    # Preserve order from likes
    prop_map = {p['id']: p for p in properties}
    result = []
    for pid in property_ids:
        if pid in prop_map:
            prop_map[pid]['liked'] = True
            result.append(prop_map[pid])
    return result


@api_router.get("/liked-property-ids")
async def get_liked_property_ids(payload=Depends(verify_token)):
    likes = await db.liked_properties.find(
        {"user_id": payload['user_id']}, {"_id": 0, "property_id": 1}
    ).to_list(500)
    return [like['property_id'] for like in likes]

@api_router.post("/bookings")
async def create_booking(booking_data: BookingCreate, payload = Depends(verify_token)):
    property_data = await db.properties.find_one({"id": booking_data.property_id}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    # Check if property requires contract signature
    rental_type = property_data.get('rental_type', '')
    has_contract = bool(property_data.get('contract_url'))
    
    if has_contract and rental_type in ['long-term', 'short-term']:
        if not booking_data.contract_signed or not booking_data.signature_data:
            raise HTTPException(status_code=400, detail="Contract signature required for this property")
    
    booking_id = str(uuid.uuid4())
    booking_doc = booking_data.model_dump()
    booking_doc['id'] = booking_id
    booking_doc['renter_id'] = payload['user_id']
    booking_doc['owner_id'] = property_data['owner_id']
    
    # Add signature timestamp if contract was signed
    if booking_data.contract_signed and booking_data.signature_data:
        booking_doc['contract_signed_at'] = datetime.now(timezone.utc).isoformat()
    
    # Auto-confirm for vacation rentals, pending for long-term and short-term
    if property_data.get('rental_type') == 'vacation':
        booking_doc['status'] = 'confirmed'
        notification_message = f"Your booking for {property_data['title']} is confirmed!"
        notification_type = "booking_confirmed"
        # Notify renter of confirmation
        renter_notification = {
            "id": str(uuid.uuid4()),
            "user_id": payload['user_id'],
            "type": notification_type,
            "property_id": booking_data.property_id,
            "booking_id": booking_id,
            "message": notification_message,
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.notifications.insert_one(renter_notification)
    else:
        booking_doc['status'] = 'pending'
        notification_message = f"New booking request for {property_data['title']}"
        notification_type = "booking_request"
    
    booking_doc['created_at'] = datetime.now(timezone.utc).isoformat()
    await db.bookings.insert_one(booking_doc)
    
    # Notify owner of booking request (or confirmation for vacation)
    owner_notification = {
        "id": str(uuid.uuid4()),
        "user_id": property_data['owner_id'],
        "type": notification_type,
        "property_id": booking_data.property_id,
        "booking_id": booking_id,
        "message": notification_message if booking_doc['status'] == 'pending' else f"New vacation rental booking for {property_data['title']}",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(owner_notification)
    
    return {"id": booking_id, "status": booking_doc['status'], "message": "Booking confirmed!" if booking_doc['status'] == 'confirmed' else "Booking request sent successfully"}

@api_router.get("/bookings")
async def get_bookings(payload = Depends(verify_token)):
    query = {}
    if payload['role'] == 'renter':
        query['renter_id'] = payload['user_id']
    elif payload['role'] == 'owner' or payload['role'] == 'manager':
        query['owner_id'] = payload['user_id']
    
    bookings = await db.bookings.find(query, {"_id": 0}).to_list(1000)
    
    # Enrich bookings with property details
    for booking in bookings:
        property_data = await db.properties.find_one(
            {"id": booking['property_id']}, 
            {"_id": 0, "title": 1, "location": 1, "rental_type": 1}
        )
        if property_data:
            booking['property_title'] = property_data.get('title', 'Unknown Property')
            booking['property_location'] = property_data.get('location', '')
            booking['property_rental_type'] = property_data.get('rental_type', '')
    
    return bookings

# Booking Cancellation Endpoints

@api_router.post("/bookings/{booking_id}/accept")
async def accept_booking(booking_id: str, payload=Depends(verify_token)):
    """Owner/Manager accepts a pending booking"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify user is owner or manager
    if payload['role'] not in ['owner', 'manager'] or booking['owner_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if booking is pending
    if booking['status'] != 'pending':
        raise HTTPException(status_code=400, detail="Only pending bookings can be accepted")
    
    # Update booking to confirmed
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "confirmed",
            "confirmed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Notify renter
    property_data = await db.properties.find_one({"id": booking['property_id']}, {"_id": 0, "title": 1})
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": booking['renter_id'],
        "type": "booking_confirmed",
        "booking_id": booking_id,
        "property_id": booking['property_id'],
        "message": f"Your booking request for {property_data.get('title', 'the property')} has been accepted!",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Booking accepted successfully"}

@api_router.post("/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: str, reason: str = Body(..., embed=True), payload=Depends(verify_token)):
    """Owner/Manager direct cancellation"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify user is owner or manager
    if payload['role'] not in ['owner', 'manager'] or booking['owner_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update booking
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_by": payload['user_id'],
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "cancellation_reason": reason
        }}
    )
    
    # Notify renter
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": booking['renter_id'],
        "type": "booking_cancelled",
        "booking_id": booking_id,
        "message": f"Your booking has been cancelled by the owner. Reason: {reason}",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Booking cancelled successfully"}

@api_router.post("/bookings/{booking_id}/request-cancel")
async def request_cancel_booking(booking_id: str, reason: str = Body(..., embed=True), payload=Depends(verify_token)):
    """Renter requests cancellation"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify user is the renter
    if booking['renter_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Save previous status before changing
    previous_status = booking.get('status', 'confirmed')
    
    # Update booking
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "cancellation_requested",
            "previous_status": previous_status,
            "cancellation_reason": reason,
            "cancellation_requested_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Notify owner
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": booking['owner_id'],
        "type": "cancellation_request",
        "booking_id": booking_id,
        "message": f"Renter has requested to cancel their booking. Reason: {reason}",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Cancellation request submitted"}

@api_router.post("/bookings/{booking_id}/approve-cancel")
async def approve_cancel_request(booking_id: str, payload=Depends(verify_token)):
    """Owner approves cancellation request"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify user is owner or manager
    if payload['role'] not in ['owner', 'manager'] or booking['owner_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if booking.get('status') != 'cancellation_requested':
        raise HTTPException(status_code=400, detail="No cancellation request pending")
    
    # Update booking
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_by": payload['user_id'],
            "cancelled_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Notify renter
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": booking['renter_id'],
        "type": "cancellation_approved",
        "booking_id": booking_id,
        "message": "Your cancellation request has been approved",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Cancellation approved"}

@api_router.post("/bookings/{booking_id}/deny-cancel")
async def deny_cancel_request(booking_id: str, denial_reason: str = Body(..., embed=True), payload=Depends(verify_token)):
    """Owner denies cancellation request"""
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Verify user is owner or manager
    if payload['role'] not in ['owner', 'manager'] or booking['owner_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if booking.get('status') != 'cancellation_requested':
        raise HTTPException(status_code=400, detail="No cancellation request pending")
    
    # Revert to previous status (confirmed or pending)
    previous_status = booking.get('previous_status', 'confirmed')
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {
            "status": previous_status,
            "cancellation_denied": True,
            "cancellation_denial_reason": denial_reason,
            "cancellation_denied_at": datetime.now(timezone.utc).isoformat()
        },
         "$unset": {"cancellation_requested_at": ""}
        }
    )
    
    # Notify renter
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": booking['renter_id'],
        "type": "cancellation_denied",
        "booking_id": booking_id,
        "message": f"Your cancellation request has been denied. Reason: {denial_reason}",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"message": "Cancellation request denied"}


# --- Subleases ---

@api_router.post("/subleases")
async def create_sublease(sublease_data: SubleaseCreate, payload=Depends(verify_token)):
    # Verify the renter has a booking for this property
    booking = await db.bookings.find_one({
        "property_id": sublease_data.property_id,
        "renter_id": payload['user_id'],
        "status": {"$in": ["pending", "confirmed"]}
    }, {"_id": 0})

    if not booking:
        raise HTTPException(status_code=403, detail="You can only sublease properties you have an active booking for")

    # Get the original property details
    property_data = await db.properties.find_one({"id": sublease_data.property_id}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")

    sublease_id = str(uuid.uuid4())
    sublease_doc = {
        "id": sublease_id,
        "original_property_id": sublease_data.property_id,
        "subleasor_id": payload['user_id'],
        "available_from": sublease_data.available_from,
        "available_to": sublease_data.available_to,
        "price": sublease_data.price,
        "price_type": sublease_data.price_type,
        "bedrooms_available": sublease_data.bedrooms_available if sublease_data.bedrooms_available is not None else property_data.get('bedrooms', 0),
        "notes": sublease_data.notes or "",
        # Copy key property details for the listing
        "title": f"Sublease: {property_data.get('title', '')}",
        "description": property_data.get('description', ''),
        "area": property_data.get('area', ''),
        "address": property_data.get('address', ''),
        "bathrooms": property_data.get('bathrooms', 0),
        "images": property_data.get('images', []),
        "amenities": property_data.get('amenities', []),
        "property_type": property_data.get('property_type', ''),
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    await db.subleases.insert_one(sublease_doc)
    return {"id": sublease_id, "message": "Sublease listed successfully"}


@api_router.get("/subleases")
async def list_subleases(area: Optional[str] = None):
    query = {"active": True}
    if area:
        query["area"] = {"$regex": area, "$options": "i"}
    subleases = await db.subleases.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return subleases


@api_router.get("/my-subleases")
async def get_my_subleases(payload=Depends(verify_token)):
    subleases = await db.subleases.find(
        {"subleasor_id": payload['user_id']}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)

    # Enrich with contract signing status
    for sub in subleases:
        if sub.get("contract_id"):
            contract = await db.contracts.find_one({"id": sub["contract_id"]}, {"_id": 0, "signed": 1})
            sub["contract_signed"] = contract.get("signed", False) if contract else False
        else:
            sub["contract_signed"] = False
    return subleases


@api_router.put("/subleases/{sublease_id}")
async def update_sublease(sublease_id: str, updates: dict = Body(...), payload=Depends(verify_token)):
    sublease = await db.subleases.find_one({"id": sublease_id}, {"_id": 0})
    if not sublease:
        raise HTTPException(status_code=404, detail="Sublease not found")
    if sublease['subleasor_id'] != payload['user_id'] and payload.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")

    allowed = {"available_from", "available_to", "price", "price_type", "bedrooms_available", "notes", "active"}
    update_fields = {k: v for k, v in updates.items() if k in allowed}
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.subleases.update_one({"id": sublease_id}, {"$set": update_fields})
    return {"message": "Sublease updated successfully"}


@api_router.post("/subleases/{sublease_id}/contract")
async def upload_sublease_contract(
    sublease_id: str,
    file: UploadFile = File(...),
    payload=Depends(verify_token)
):
    sublease = await db.subleases.find_one({"id": sublease_id}, {"_id": 0})
    if not sublease:
        raise HTTPException(status_code=404, detail="Sublease not found")
    if sublease['subleasor_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Only the subleasor can upload contracts")

    content_type = file.content_type or ""
    if content_type not in ALLOWED_CONTRACT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type. Allowed: PDF, DOCX, JPG, PNG, WebP")

    file_ext = ALLOWED_CONTRACT_TYPES[content_type]
    contract_id = str(uuid.uuid4())
    filename = f"{contract_id}.{file_ext}"
    file_path = CONTRACT_DIR / filename

    size = 0
    with open(file_path, "wb") as f:
        while chunk := await file.read(1024 * 256):
            size += len(chunk)
            if size > MAX_FILE_SIZE:
                f.close()
                file_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="File too large. Max 50MB")
            f.write(chunk)

    extracted_text = ""
    if file_ext == "pdf":
        extracted_text = extract_text_from_pdf(str(file_path))
    elif file_ext == "docx":
        extracted_text = extract_text_from_docx(str(file_path))
    elif file_ext in ("jpg", "png", "webp"):
        extracted_text = extract_text_from_image(str(file_path))

    sign_token = str(uuid.uuid4())

    contract_doc = {
        "id": contract_id,
        "sublease_id": sublease_id,
        "property_id": sublease.get("original_property_id", ""),
        "owner_id": payload['user_id'],
        "original_filename": file.filename,
        "stored_filename": filename,
        "file_type": file_ext,
        "file_size": size,
        "extracted_text": extracted_text,
        "translated_text": None,
        "translation_direction": None,
        "translation_status": "none",
        "signatures": [],
        "signed": False,
        "sign_token": sign_token,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.contracts.insert_one(contract_doc)
    await db.subleases.update_one(
        {"id": sublease_id},
        {"$set": {"contract_id": contract_id, "sign_token": sign_token, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    return {
        "id": contract_id,
        "sign_token": sign_token,
        "original_filename": file.filename,
        "message": "Contract uploaded. Share the signing link with your sublessee."
    }


@api_router.get("/contracts/sign/{sign_token}")
async def get_contract_for_signing(sign_token: str):
    """Public endpoint - sublessee accesses contract via sign_token (no auth needed)"""
    contract = await db.contracts.find_one({"sign_token": sign_token}, {"_id": 0})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found or link is invalid")

    sublease = None
    if contract.get("sublease_id"):
        sublease = await db.subleases.find_one({"id": contract["sublease_id"]}, {"_id": 0})

    return {
        "id": contract["id"],
        "original_filename": contract.get("original_filename"),
        "file_type": contract.get("file_type"),
        "extracted_text": contract.get("extracted_text"),
        "translated_text": contract.get("translated_text"),
        "translation_status": contract.get("translation_status"),
        "signatures": contract.get("signatures", []),
        "signed": contract.get("signed", False),
        "sublease": {
            "title": sublease.get("title", "") if sublease else "",
            "area": sublease.get("area", "") if sublease else "",
            "available_from": sublease.get("available_from", "") if sublease else "",
            "available_to": sublease.get("available_to", "") if sublease else "",
            "price": sublease.get("price", 0) if sublease else 0,
            "price_type": sublease.get("price_type", "") if sublease else "",
        } if sublease else None
    }


@api_router.post("/contracts/sign/{sign_token}")
async def sign_contract_public(sign_token: str, body: dict = Body(...)):
    """Public endpoint - sublessee signs the contract via sign_token"""
    contract = await db.contracts.find_one({"sign_token": sign_token}, {"_id": 0})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found or link is invalid")

    signer_name = body.get("signer_name", "").strip()
    signature_data = body.get("signature_data", "")

    if not signer_name or not signature_data:
        raise HTTPException(status_code=400, detail="Name and signature are required")

    new_signature = {
        "signer_id": "sublessee",
        "signer_name": signer_name,
        "signature_data": signature_data,
        "signed_at": datetime.now(timezone.utc).isoformat()
    }

    await db.contracts.update_one(
        {"sign_token": sign_token},
        {
            "$push": {"signatures": new_signature},
            "$set": {"signed": True, "updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Update sublease to mark contract as signed
    if contract.get("sublease_id"):
        await db.subleases.update_one(
            {"id": contract["sublease_id"]},
            {"$set": {"contract_signed": True}}
        )
        
        # Notify the subleasor (renter who posted the sublease)
        sublease = await db.subleases.find_one({"id": contract["sublease_id"]}, {"_id": 0})
        if sublease:
            notification = {
                "id": str(uuid.uuid4()),
                "user_id": sublease["subleasor_id"],
                "type": "sublease_contract_signed",
                "sublease_id": contract["sublease_id"],
                "message": f"{signer_name} has signed the sublease contract for {sublease.get('title', 'your property')}",
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.notifications.insert_one(notification)

    return {"message": "Contract signed successfully", "signed_at": new_signature['signed_at']}


@api_router.delete("/subleases/{sublease_id}")
async def delete_sublease(sublease_id: str, payload=Depends(verify_token)):
    sublease = await db.subleases.find_one({"id": sublease_id}, {"_id": 0})
    if not sublease:
        raise HTTPException(status_code=404, detail="Sublease not found")
    if sublease['subleasor_id'] != payload['user_id'] and payload.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.subleases.delete_one({"id": sublease_id})
    return {"message": "Sublease removed successfully"}

@api_router.post("/chat/messages")
async def send_message(chat_data: ChatMessage, payload = Depends(verify_token)):
    message_id = str(uuid.uuid4())
    message_doc = {
        "id": message_id,
        "property_id": chat_data.property_id,
        "sender_id": payload['user_id'],
        "receiver_id": chat_data.receiver_id,
        "message": chat_data.message,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False
    }
    
    await db.messages.insert_one(message_doc)
    
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": chat_data.receiver_id,
        "type": "new_message",
        "property_id": chat_data.property_id,
        "message": "You have a new message",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"id": message_id, "message": "Message sent successfully"}

@api_router.get("/chat/messages/{property_id}")
async def get_messages(property_id: str, payload = Depends(verify_token)):
    messages = await db.messages.find(
        {
            "property_id": property_id,
            "$or": [
                {"sender_id": payload['user_id']},
                {"receiver_id": payload['user_id']}
            ]
        },
        {"_id": 0}
    ).sort("created_at", 1).to_list(1000)
    
    await db.messages.update_many(
        {"property_id": property_id, "receiver_id": payload['user_id']},
        {"$set": {"read": True}}
    )
    
    return messages

@api_router.get("/chat/conversations")
async def get_conversations(payload = Depends(verify_token)):
    messages = await db.messages.find(
        {"$or": [{"sender_id": payload['user_id']}, {"receiver_id": payload['user_id']}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    conversations = {}
    for msg in messages:
        other_user_id = msg['receiver_id'] if msg['sender_id'] == payload['user_id'] else msg['sender_id']
        conv_key = f"{msg['property_id']}_{other_user_id}"
        
        if conv_key not in conversations:
            property_data = await db.properties.find_one({"id": msg['property_id']}, {"_id": 0, "title": 1})
            other_user = await db.users.find_one({"id": other_user_id}, {"_id": 0, "name": 1, "email": 1})
            
            conversations[conv_key] = {
                "property_id": msg['property_id'],
                "property_title": property_data.get('title', 'Unknown') if property_data else 'Unknown',
                "other_user": other_user if other_user else {},
                "last_message": msg['message'],
                "last_message_time": msg['created_at'],
                "unread": not msg['read'] and msg['receiver_id'] == payload['user_id']
            }
    
    return list(conversations.values())

@api_router.post("/notifications/preferences")
async def set_notification_preferences(prefs: NotificationPreferences, payload = Depends(verify_token)):
    pref_doc = prefs.model_dump()
    pref_doc['user_id'] = payload['user_id']
    pref_doc['created_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.notification_preferences.update_one(
        {"user_id": payload['user_id']},
        {"$set": pref_doc},
        upsert=True
    )
    
    return {"message": "Preferences saved successfully"}

@api_router.get("/notifications")
async def get_notifications(payload = Depends(verify_token)):
    notifications = await db.notifications.find(
        {"user_id": payload['user_id']},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return notifications

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, payload = Depends(verify_token)):
    await db.notifications.update_one(
        {"id": notification_id, "user_id": payload['user_id']},
        {"$set": {"read": True}}
    )
    return {"message": "Notification marked as read"}

@api_router.post("/translate")
async def translate_text(request: TranslationRequest):
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message=f"You are a professional translator. Translate the following text from {request.from_lang} to {request.to_lang}. Only provide the translation, no explanations."
        )
        chat.with_model("anthropic", "claude-sonnet-4-20250514")
        
        message = UserMessage(text=request.text)
        response = await chat.send_message(message)
        
        return {"translation": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")

# --- Contract Management ---

CONTRACT_DIR = ROOT_DIR / "uploads" / "contracts"
CONTRACT_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_CONTRACT_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}

def extract_text_from_pdf(file_path: str) -> str:
    text_parts = []
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
    return "\n\n".join(text_parts)

def extract_text_from_docx(file_path: str) -> str:
    text_parts = []
    try:
        doc = DocxDocument(file_path)
        for para in doc.paragraphs:
            if para.text.strip():
                text_parts.append(para.text)
    except Exception as e:
        logger.error(f"DOCX extraction error: {e}")
    return "\n\n".join(text_parts)

def extract_text_from_image(file_path: str) -> str:
    try:
        import pytesseract
        from PIL import Image
        img = Image.open(file_path)
        text = pytesseract.image_to_string(img, lang='heb+eng')
        return text.strip()
    except Exception as e:
        logger.warning(f"OCR extraction failed (pytesseract may not be installed): {e}")
        return ""


@api_router.post("/contracts/upload")
async def upload_contract(
    file: UploadFile = File(...),
    property_id: str = Form(...),
    payload=Depends(verify_token)
):
    # Verify property exists and user is owner
    property_data = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    if property_data.get('owner_id') != payload['user_id'] and payload.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Only property owners can upload contracts")

    # Validate file type
    content_type = file.content_type or ""
    if content_type not in ALLOWED_CONTRACT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {content_type}. Allowed: PDF, DOCX, JPG, PNG, WebP"
        )

    file_ext = ALLOWED_CONTRACT_TYPES[content_type]
    contract_id = str(uuid.uuid4())
    filename = f"{contract_id}.{file_ext}"
    file_path = CONTRACT_DIR / filename

    # Save file to disk
    size = 0
    with open(file_path, "wb") as f:
        while chunk := await file.read(1024 * 256):
            size += len(chunk)
            if size > MAX_FILE_SIZE:
                f.close()
                file_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="File too large. Max 50MB")
            f.write(chunk)

    # Extract text based on file type
    extracted_text = ""
    if file_ext == "pdf":
        extracted_text = extract_text_from_pdf(str(file_path))
    elif file_ext == "docx":
        extracted_text = extract_text_from_docx(str(file_path))
    elif file_ext in ("jpg", "png", "webp"):
        extracted_text = extract_text_from_image(str(file_path))

    contract_doc = {
        "id": contract_id,
        "property_id": property_id,
        "owner_id": payload['user_id'],
        "original_filename": file.filename,
        "stored_filename": filename,
        "file_type": file_ext,
        "file_size": size,
        "extracted_text": extracted_text,
        "translated_text": None,
        "translation_direction": None,
        "translation_status": "none",
        "signatures": [],
        "signed": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.contracts.insert_one(contract_doc)
    return {
        "id": contract_id,
        "original_filename": file.filename,
        "file_type": file_ext,
        "extracted_text_length": len(extracted_text),
        "message": "Contract uploaded successfully"
    }


@api_router.get("/contracts")
async def list_contracts(property_id: Optional[str] = None, payload=Depends(verify_token)):
    query = {}
    if payload.get('role') != 'admin':
        query["owner_id"] = payload['user_id']
    if property_id:
        query["property_id"] = property_id
    contracts = await db.contracts.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return contracts


@api_router.get("/contracts/download/{contract_id}")
async def download_contract(contract_id: str):
    from starlette.responses import FileResponse
    contract = await db.contracts.find_one({"id": contract_id}, {"_id": 0})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    file_path = CONTRACT_DIR / contract.get('stored_filename', '')
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Contract file not found on disk")

    media_types = {
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "jpg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
    }
    media_type = media_types.get(contract.get('file_type', ''), "application/octet-stream")

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        filename=contract.get('original_filename', f"contract.{contract.get('file_type', 'pdf')}")
    )


@api_router.get("/contracts/{contract_id}")
async def get_contract(contract_id: str, payload=Depends(verify_token)):
    contract = await db.contracts.find_one({"id": contract_id}, {"_id": 0})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if contract['owner_id'] != payload['user_id'] and payload.get('role') != 'admin':
        # Also allow signers to view
        signer_ids = [s.get('signer_id') for s in contract.get('signatures', [])]
        if payload['user_id'] not in signer_ids:
            raise HTTPException(status_code=403, detail="Not authorized")
    return contract


@api_router.post("/contracts/{contract_id}/translate")
async def translate_contract(contract_id: str, direction: str = Form("he-en"), payload=Depends(verify_token)):
    contract = await db.contracts.find_one({"id": contract_id}, {"_id": 0})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if contract['owner_id'] != payload['user_id'] and payload.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")

    text = contract.get('extracted_text', '')
    if not text or len(text.strip()) < 10:
        raise HTTPException(status_code=400, detail="No sufficient text extracted from the contract to translate. Please ensure the document contains readable text.")

    # Determine translation direction
    if direction == "he-en":
        from_lang, to_lang = "Hebrew", "English"
    elif direction == "en-he":
        from_lang, to_lang = "English", "Hebrew"
    else:
        raise HTTPException(status_code=400, detail="Invalid direction. Use 'he-en' or 'en-he'")

    # Mark as pending
    await db.contracts.update_one(
        {"id": contract_id},
        {"$set": {"translation_status": "pending", "translation_direction": direction, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message=f"You are a professional legal document translator specializing in Israeli rental contracts. Translate the following contract text from {from_lang} to {to_lang}. Maintain the original formatting, paragraph structure, and legal terminology. Only provide the translation, no explanations or notes."
        )
        chat.with_model("anthropic", "claude-4-sonnet-20250514")

        message = UserMessage(text=text)
        translated = await chat.send_message(message)

        await db.contracts.update_one(
            {"id": contract_id},
            {"$set": {
                "translated_text": translated,
                "translation_status": "completed",
                "translation_direction": direction,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )

        return {"translated_text": translated, "direction": direction, "status": "completed"}

    except Exception as e:
        await db.contracts.update_one(
            {"id": contract_id},
            {"$set": {"translation_status": "failed", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        logger.error(f"Translation failed for contract {contract_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")


@api_router.post("/contracts/{contract_id}/sign")
async def sign_contract(contract_id: str, signature: ContractSignature, payload=Depends(verify_token)):
    contract = await db.contracts.find_one({"id": contract_id}, {"_id": 0})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    new_signature = {
        "signer_id": payload['user_id'],
        "signer_name": signature.signer_name,
        "signature_data": signature.signature_data,
        "signed_at": datetime.now(timezone.utc).isoformat()
    }

    await db.contracts.update_one(
        {"id": contract_id},
        {
            "$push": {"signatures": new_signature},
            "$set": {"signed": True, "updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )

    return {"message": "Contract signed successfully", "signed_at": new_signature['signed_at']}


@api_router.delete("/contracts/{contract_id}")
async def delete_contract(contract_id: str, payload=Depends(verify_token)):
    contract = await db.contracts.find_one({"id": contract_id}, {"_id": 0})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    if contract['owner_id'] != payload['user_id'] and payload.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")

    # Delete file from disk
    file_path = CONTRACT_DIR / contract.get('stored_filename', '')
    if file_path.exists():
        file_path.unlink()

    await db.contracts.delete_one({"id": contract_id})
    return {"message": "Contract deleted successfully"}


@api_router.post("/document-service")
async def request_document_service(request: DocumentServiceRequest, payload = Depends(verify_token)):
    service_id = str(uuid.uuid4())
    service_doc = request.model_dump()
    service_doc['id'] = service_id
    service_doc['user_id'] = payload['user_id']
    service_doc['status'] = 'pending'
    service_doc['created_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.document_services.insert_one(service_doc)
    return {"id": service_id, "message": "Document service request submitted successfully"}

@api_router.get("/document-service")
async def get_document_services(payload = Depends(verify_token)):
    if payload['role'] == 'admin':
        services = await db.document_services.find({}, {"_id": 0}).to_list(1000)
    else:
        services = await db.document_services.find({"user_id": payload['user_id']}, {"_id": 0}).to_list(1000)
    return services

@api_router.post("/service-requests")
async def create_service_request(request_data: dict = Body(...), payload=Depends(verify_token)):
    request_id = str(uuid.uuid4())
    service_doc = {
        "id": request_id,
        "user_id": payload['user_id'],
        "service_type": request_data.get('service_type', 'unknown'),
        "details": request_data,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.service_requests.insert_one(service_doc)
    return {"id": request_id, "message": "Service request submitted successfully"}


@api_router.get("/service-requests")
async def list_service_requests(payload=Depends(verify_token)):
    query = {"user_id": payload['user_id']} if payload.get('role') != 'admin' else {}
    requests = await db.service_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return requests


@api_router.post("/contact")
async def submit_contact_form(request: ContactRequest):
    contact_id = str(uuid.uuid4())
    contact_doc = request.model_dump()
    contact_doc['id'] = contact_id
    contact_doc['created_at'] = datetime.now(timezone.utc).isoformat()
    contact_doc['status'] = 'new'
    
    await db.contacts.insert_one(contact_doc)
    return {"message": "Contact request submitted successfully"}


# --- Property Contracts ---

@api_router.post("/properties/{property_id}/contract")
async def upload_property_contract(
    property_id: str,
    file: UploadFile = File(...),
    payload=Depends(verify_token)
):
    """Upload contract for a property (owner/manager only)"""
    # Verify property exists and user is owner
    property_data = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if property_data['owner_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if property is long-term or short-term
    rental_type = property_data.get('rental_type', '')
    if rental_type not in ['long-term', 'short-term']:
        raise HTTPException(status_code=400, detail="Contracts only available for long-term and short-term rentals")
    
    # Validate file type (PDF and image formats)
    ALLOWED_TYPES = [
        'application/pdf',
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif'
    ]
    if not file.content_type or file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only PDF and image files (JPG, PNG, WEBP, HEIC) are allowed for contracts")
    
    # Save file
    UPLOAD_DIR = ROOT_DIR / "uploads"
    UPLOAD_DIR.mkdir(exist_ok=True)
    file_id = str(uuid.uuid4())
    
    # Get file extension from content type
    extension_map = {
        'application/pdf': 'pdf',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/heic': 'heic',
        'image/heif': 'heif'
    }
    ext = extension_map.get(file.content_type, 'pdf')
    filename = f"contract_{file_id}.{ext}"
    file_path = UPLOAD_DIR / filename
    
    size = 0
    MAX_CONTRACT_SIZE = 10 * 1024 * 1024  # 10MB
    with open(file_path, "wb") as f:
        while chunk := await file.read(1024 * 256):
            size += len(chunk)
            if size > MAX_CONTRACT_SIZE:
                f.close()
                file_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="Contract file too large. Max 10MB")
            f.write(chunk)
    
    contract_url = f"/api/uploads/{filename}"
    
    # Update property with contract URL
    await db.properties.update_one(
        {"id": property_id},
        {"$set": {
            "contract_url": contract_url,
            "contract_uploaded_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"contract_url": contract_url, "message": "Contract uploaded successfully"}


@api_router.get("/properties/{property_id}/contract")
async def get_property_contract(property_id: str):
    """Get contract details for a property"""
    property_data = await db.properties.find_one(
        {"id": property_id}, 
        {"_id": 0, "contract_url": 1, "contract_uploaded_at": 1, "rental_type": 1}
    )
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    return {
        "has_contract": bool(property_data.get('contract_url')),
        "contract_url": property_data.get('contract_url'),
        "uploaded_at": property_data.get('contract_uploaded_at'),
        "rental_type": property_data.get('rental_type')
    }


@api_router.delete("/properties/{property_id}/contract")
async def delete_property_contract(property_id: str, payload=Depends(verify_token)):
    """Delete contract for a property"""
    property_data = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if property_data['owner_id'] != payload['user_id']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Delete file from disk
    if property_data.get('contract_url'):
        filename = property_data['contract_url'].split('/')[-1]
        file_path = ROOT_DIR / "uploads" / filename
        file_path.unlink(missing_ok=True)
    
    # Remove from database
    await db.properties.update_one(
        {"id": property_id},
        {"$unset": {"contract_url": "", "contract_uploaded_at": ""}}
    )
    
    return {"message": "Contract deleted successfully"}


UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/webm", "video/mpeg"}

@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), payload=Depends(verify_token)):
    if not file.content_type:
        raise HTTPException(status_code=400, detail="Could not determine file type")

    is_image = file.content_type in ALLOWED_IMAGE_TYPES
    is_video = file.content_type in ALLOWED_VIDEO_TYPES
    if not is_image and not is_video:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {file.content_type}. Allowed: JPEG, PNG, WebP, GIF, MP4, MOV, WebM")

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    file_id = str(uuid.uuid4())
    filename = f"{file_id}.{ext}"
    file_path = UPLOAD_DIR / filename

    size = 0
    with open(file_path, "wb") as f:
        while chunk := await file.read(1024 * 256):
            size += len(chunk)
            if size > MAX_FILE_SIZE:
                f.close()
                file_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="File too large. Max 50MB")
            f.write(chunk)

    file_type = "image" if is_image else "video"
    url = f"/api/uploads/{filename}"

    return {"url": url, "file_type": file_type, "filename": filename, "size": size}

@api_router.post("/upload/multiple")
async def upload_multiple_files(files: List[UploadFile] = File(...), payload=Depends(verify_token)):
    results = []
    for file in files:
        is_image = file.content_type in ALLOWED_IMAGE_TYPES
        is_video = file.content_type in ALLOWED_VIDEO_TYPES
        if not is_image and not is_video:
            results.append({"filename": file.filename, "error": f"Unsupported type: {file.content_type}"})
            continue

        ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
        file_id = str(uuid.uuid4())
        filename = f"{file_id}.{ext}"
        file_path = UPLOAD_DIR / filename

        size = 0
        try:
            with open(file_path, "wb") as f:
                while chunk := await file.read(1024 * 256):
                    size += len(chunk)
                    if size > MAX_FILE_SIZE:
                        raise HTTPException(status_code=413, detail="File too large")
                    f.write(chunk)
            file_type = "image" if is_image else "video"
            url = f"/api/uploads/{filename}"
            results.append({"url": url, "file_type": file_type, "filename": filename, "size": size, "original_name": file.filename})
        except Exception as e:
            file_path.unlink(missing_ok=True)
            results.append({"filename": file.filename, "error": str(e)})

    return results

@api_router.delete("/upload/{filename}")
async def delete_upload(filename: str, payload=Depends(verify_token)):
    file_path = UPLOAD_DIR / filename
    if file_path.exists():
        file_path.unlink()
    return {"message": "File deleted"}


@api_router.get("/admin/dashboard")
async def get_admin_dashboard(payload = Depends(verify_token)):
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_properties = await db.properties.count_documents({"status": "active"})
    total_views = await db.properties.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$views"}}}
    ]).to_list(1)
    
    total_bookings = await db.bookings.count_documents({})
    total_users = await db.users.count_documents({})
    pending_services = await db.document_services.count_documents({"status": "pending"})
    
    recent_properties = await db.properties.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    
    return {
        "active_listings": total_properties,
        "total_views": total_views[0]['total'] if total_views else 0,
        "total_inquiries": total_bookings,
        "total_users": total_users,
        "pending_services": pending_services,
        "recent_properties": recent_properties
    }

@api_router.get("/admin/users")
async def get_all_users(payload = Depends(verify_token)):
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    users = await db.users.find({}, {"_id": 0, "password": 0}).sort("created_at", -1).to_list(1000)
    return users

@api_router.put("/admin/users/{user_id}/status")
async def update_user_status(user_id: str, payload = Depends(verify_token)):
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    new_status = "blocked" if user.get("status", "active") == "active" else "active"
    await db.users.update_one({"id": user_id}, {"$set": {"status": new_status}})
    return {"message": f"User {new_status}", "status": new_status}

@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, payload = Depends(verify_token)):
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    if user_id == payload['user_id']:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    await db.users.delete_one({"id": user_id})
    await db.properties.delete_many({"owner_id": user_id})
    return {"message": "User and their properties deleted"}

@api_router.get("/admin/properties")
async def get_all_properties_admin(payload = Depends(verify_token)):
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    properties = await db.properties.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for prop in properties:
        owner = await db.users.find_one({"id": prop.get("owner_id")}, {"_id": 0, "name": 1, "email": 1})
        prop["owner_name"] = owner.get("name", "Unknown") if owner else "Unknown"
        prop["owner_email"] = owner.get("email", "") if owner else ""
    return properties

@api_router.put("/admin/properties/{property_id}/status")
async def toggle_property_status(property_id: str, payload = Depends(verify_token)):
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    new_status = "inactive" if prop.get("status") == "active" else "active"
    await db.properties.update_one({"id": property_id}, {"$set": {"status": new_status}})
    return {"message": f"Property {new_status}", "status": new_status}

@api_router.get("/admin/chats")
async def get_all_chats(payload = Depends(verify_token)):
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    messages = await db.messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    conversations = {}
    for msg in messages:
        conv_key = f"{msg['property_id']}_{min(msg['sender_id'], msg['receiver_id'])}_{max(msg['sender_id'], msg['receiver_id'])}"
        if conv_key not in conversations:
            prop = await db.properties.find_one({"id": msg["property_id"]}, {"_id": 0, "title": 1})
            sender = await db.users.find_one({"id": msg["sender_id"]}, {"_id": 0, "name": 1, "role": 1})
            receiver = await db.users.find_one({"id": msg["receiver_id"]}, {"_id": 0, "name": 1, "role": 1})
            conversations[conv_key] = {
                "property_id": msg["property_id"],
                "property_title": prop.get("title", "Unknown") if prop else "Unknown",
                "participants": [
                    {"id": msg["sender_id"], "name": sender.get("name", "Unknown") if sender else "Unknown", "role": sender.get("role", "") if sender else ""},
                    {"id": msg["receiver_id"], "name": receiver.get("name", "Unknown") if receiver else "Unknown", "role": receiver.get("role", "") if receiver else ""}
                ],
                "messages": [],
                "last_message_time": msg["created_at"]
            }
        conversations[conv_key]["messages"].append({
            "sender_id": msg["sender_id"],
            "message": msg["message"],
            "created_at": msg["created_at"]
        })
    
    return list(conversations.values())

@api_router.get("/admin/document-services")
async def get_all_document_services(payload = Depends(verify_token)):
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    services = await db.document_services.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    for svc in services:
        user = await db.users.find_one({"id": svc.get("user_id")}, {"_id": 0, "name": 1, "email": 1})
        svc["user_name"] = user.get("name", "Unknown") if user else "Unknown"
        svc["user_email"] = user.get("email", "") if user else ""
    return services

@api_router.put("/admin/document-services/{service_id}/status")
async def update_service_status(service_id: str, status: str, payload = Depends(verify_token)):
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    if status not in ["pending", "in_progress", "completed", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    await db.document_services.update_one({"id": service_id}, {"$set": {"status": status}})
    return {"message": f"Service status updated to {status}"}

@api_router.get("/admin/settings")
async def get_site_settings(payload = Depends(verify_token)):
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    settings = await db.site_settings.find_one({"key": "global"}, {"_id": 0})
    if not settings:
        return {"whatsapp_number": "", "contact_email": "", "contact_phone": "", "featured_property_ids": []}
    return settings

@api_router.put("/admin/settings")
async def update_site_settings(settings: SiteSettings, payload = Depends(verify_token)):
    if payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    settings_doc = settings.model_dump()
    settings_doc["key"] = "global"
    settings_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.site_settings.update_one({"key": "global"}, {"$set": settings_doc}, upsert=True)
    return {"message": "Settings updated successfully"}

@api_router.get("/manager/{manager_id}/properties")
async def get_manager_properties(manager_id: str):
    properties = await db.properties.find({"owner_id": manager_id}, {"_id": 0}).to_list(1000)
    manager = await db.users.find_one({"id": manager_id, "role": {"$in": ["manager", "owner"]}}, {"_id": 0, "password": 0})
    
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")
    
    return {
        "manager": manager,
        "properties": properties
    }

@api_router.post("/user/logo")
async def upload_user_logo(file: UploadFile = File(...), payload=Depends(verify_token)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    ext = file.filename.split(".")[-1] if "." in file.filename else "png"
    filename = f"logo_{payload['user_id']}_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = UPLOAD_DIR / filename
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    logo_url = f"/api/uploads/{filename}"
    await db.users.update_one({"id": payload["user_id"]}, {"$set": {"business_logo": logo_url}})
    return {"logo_url": logo_url}

@api_router.delete("/user/logo")
async def delete_user_logo(payload=Depends(verify_token)):
    user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
    if user and user.get("business_logo"):
        old_file = UPLOAD_DIR / user["business_logo"].split("/")[-1]
        if old_file.exists():
            old_file.unlink()
    await db.users.update_one({"id": payload["user_id"]}, {"$unset": {"business_logo": ""}})
    return {"message": "Logo removed"}



# --- iCal Endpoints ---
class ICalUrlInput(BaseModel):
    url: str

@api_router.post("/properties/{property_id}/ical")
async def add_ical_url(property_id: str, data: ICalUrlInput, payload=Depends(verify_token)):
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    if prop.get("owner_id") != payload["user_id"] and payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    if prop.get("rental_type") != "vacation":
        raise HTTPException(status_code=400, detail="iCal sync is only available for vacation rentals")
    # Validate URL by trying to fetch it
    dates = await parse_ical_feed(data.url)
    ical_urls = prop.get("ical_urls", [])
    if data.url not in ical_urls:
        ical_urls.append(data.url)
    await db.properties.update_one({"id": property_id}, {"$set": {"ical_urls": ical_urls}})
    # Sync immediately
    await sync_property_ical(property_id)
    return {"message": "iCal feed added and synced", "blocked_dates": len(dates), "ical_urls": ical_urls}

@api_router.delete("/properties/{property_id}/ical")
async def remove_ical_url(property_id: str, data: ICalUrlInput, payload=Depends(verify_token)):
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    if prop.get("owner_id") != payload["user_id"] and payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    ical_urls = prop.get("ical_urls", [])
    if data.url in ical_urls:
        ical_urls.remove(data.url)
    await db.properties.update_one({"id": property_id}, {"$set": {"ical_urls": ical_urls}})
    await db.external_bookings.delete_many({"property_id": property_id, "source_url": data.url})
    return {"message": "iCal feed removed", "ical_urls": ical_urls}

@api_router.get("/properties/{property_id}/ical-export")
async def export_ical(property_id: str):
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0, "title": 1})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    bookings = await db.bookings.find(
        {"property_id": property_id, "status": {"$in": ["pending", "confirmed"]}},
        {"_id": 0}
    ).to_list(1000)
    cal = iCalCalendar()
    cal.add('prodid', '-//MyIsraelRental//EN')
    cal.add('version', '2.0')
    cal.add('calscale', 'GREGORIAN')
    cal.add('method', 'PUBLISH')
    cal.add('x-wr-calname', prop.get('title', 'Property Calendar'))
    for b in bookings:
        event = iCalEvent()
        event.add('summary', f'Booked - {prop.get("title", "")}')
        event.add('dtstart', datetime.strptime(b['start_date'], '%Y-%m-%d').date())
        event.add('dtend', datetime.strptime(b['end_date'], '%Y-%m-%d').date())
        event.add('uid', b.get('id', str(uuid.uuid4())))
        event.add('dtstamp', datetime.now(timezone.utc))
        cal.add_component(event)
    from starlette.responses import Response
    return Response(content=cal.to_ical(), media_type="text/calendar", headers={"Content-Disposition": f"attachment; filename={property_id}.ics"})

@api_router.get("/properties/{property_id}/blocked-dates")
async def get_blocked_dates(property_id: str):
    # Internal bookings
    bookings = await db.bookings.find(
        {"property_id": property_id, "status": {"$in": ["pending", "confirmed"]}},
        {"_id": 0, "start_date": 1, "end_date": 1}
    ).to_list(1000)
    # External iCal bookings
    external = await db.external_bookings.find(
        {"property_id": property_id},
        {"_id": 0, "start_date": 1, "end_date": 1, "summary": 1}
    ).to_list(1000)
    # Get last sync time
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0, "ical_last_synced": 1, "ical_urls": 1})
    return {
        "internal": bookings,
        "external": external,
        "ical_urls_count": len(prop.get("ical_urls", [])) if prop else 0,
        "last_synced": prop.get("ical_last_synced") if prop else None
    }

@api_router.post("/properties/{property_id}/ical-sync")
async def manual_ical_sync(property_id: str, payload=Depends(verify_token)):
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    if prop.get("owner_id") != payload["user_id"] and payload["role"] != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    await sync_property_ical(property_id)
    return {"message": "Sync complete", "last_synced": datetime.now(timezone.utc).isoformat()}


# --- Notifications ---

@api_router.get("/notifications")
async def get_notifications(payload=Depends(verify_token)):
    """Get all notifications for the current user"""
    notifications = await db.notifications.find(
        {"user_id": payload['user_id']},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return notifications

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, payload=Depends(verify_token)):
    """Mark a notification as read"""
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": payload['user_id']},
        {"$set": {"read": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Notification marked as read"}

@api_router.put("/notifications/read-all")
async def mark_all_notifications_read(payload=Depends(verify_token)):
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {"user_id": payload['user_id'], "read": False},
        {"$set": {"read": True}}
    )
    return {"message": "All notifications marked as read"}


app.include_router(api_router)
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def start_ical_sync():
    asyncio.create_task(sync_all_ical_feeds())

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()