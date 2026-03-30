from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, Depends, Header
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

class PropertyCreate(BaseModel):
    title: str
    description: str
    rental_type: str
    property_type: str
    bedrooms: Optional[float] = None
    bathrooms: Optional[float] = None
    area: str
    address: str
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

class BookingCreate(BaseModel):
    property_id: str
    start_date: str
    end_date: str
    guest_count: int
    message: Optional[str] = None

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
    signature_data: str

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
    min_bedrooms: Optional[int] = None,
    max_price: Optional[float] = None,
    area: Optional[str] = None,
    owner_id: Optional[str] = None,
    min_price: Optional[float] = None,
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
    if max_price:
        if rental_type == 'vacation':
            query['nightly_price'] = {"$lte": max_price}
        else:
            query['monthly_price'] = {"$lte": max_price}
    if min_price:
        price_field = 'nightly_price' if rental_type == 'vacation' else 'monthly_price'
        if price_field in query:
            query[price_field] = {**query[price_field], "$gte": min_price}
        else:
            query[price_field] = {"$gte": min_price}
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

@api_router.post("/bookings")
async def create_booking(booking_data: BookingCreate, payload = Depends(verify_token)):
    property_data = await db.properties.find_one({"id": booking_data.property_id}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    booking_id = str(uuid.uuid4())
    booking_doc = booking_data.model_dump()
    booking_doc['id'] = booking_id
    booking_doc['renter_id'] = payload['user_id']
    booking_doc['owner_id'] = property_data['owner_id']
    booking_doc['status'] = 'pending'
    booking_doc['created_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.bookings.insert_one(booking_doc)
    
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": property_data['owner_id'],
        "type": "booking_request",
        "property_id": booking_data.property_id,
        "booking_id": booking_id,
        "message": f"New booking request for {property_data['title']}",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    return {"id": booking_id, "message": "Booking created successfully"}

@api_router.get("/bookings")
async def get_bookings(payload = Depends(verify_token)):
    query = {}
    if payload['role'] == 'renter':
        query['renter_id'] = payload['user_id']
    elif payload['role'] == 'owner' or payload['role'] == 'manager':
        query['owner_id'] = payload['user_id']
    
    bookings = await db.bookings.find(query, {"_id": 0}).to_list(1000)
    return bookings

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

@api_router.post("/contracts/upload")
async def upload_contract(property_id: str = Form(...), contract_file: str = Form(...), payload = Depends(verify_token)):
    property_data = await db.properties.find_one({"id": property_id}, {"_id": 0})
    if not property_data:
        raise HTTPException(status_code=404, detail="Property not found")
    
    if property_data['owner_id'] != payload['user_id'] and payload['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized")
    
    contract_id = str(uuid.uuid4())
    contract_doc = {
        "id": contract_id,
        "property_id": property_id,
        "owner_id": payload['user_id'],
        "file_data": contract_file,
        "signed": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.contracts.insert_one(contract_doc)
    return {"id": contract_id, "message": "Contract uploaded successfully"}

@api_router.post("/contracts/sign")
async def sign_contract(signature: ContractSignature, payload = Depends(verify_token)):
    contract = await db.contracts.find_one({"id": signature.contract_id}, {"_id": 0})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    await db.contracts.update_one(
        {"id": signature.contract_id},
        {"$set": {
            "signed": True,
            "signature_data": signature.signature_data,
            "signer_id": payload['user_id'],
            "signed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Contract signed successfully"}

@api_router.get("/contracts/{property_id}")
async def get_contract(property_id: str, payload = Depends(verify_token)):
    contract = await db.contracts.find_one({"property_id": property_id}, {"_id": 0})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract

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

@api_router.post("/contact")
async def submit_contact(request: ContactRequest):
    contact_id = str(uuid.uuid4())
    contact_doc = request.model_dump()
    contact_doc['id'] = contact_id
    contact_doc['created_at'] = datetime.now(timezone.utc).isoformat()
    contact_doc['status'] = 'new'
    
    await db.contacts.insert_one(contact_doc)
    return {"message": "Contact request submitted successfully"}

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

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()