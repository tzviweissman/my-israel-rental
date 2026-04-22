"""Pydantic models for API requests/responses"""
from pydantic import BaseModel, EmailStr
from typing import List, Optional


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
    available_from: Optional[str] = None
    starting_date: Optional[str] = None
    minimum_booking_days: Optional[int] = None


class BookingCreate(BaseModel):
    property_id: str
    start_date: str
    end_date: str
    message: Optional[str] = None
    contract_signed: Optional[bool] = False
    signature_data: Optional[str] = None


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
    price_type: str
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


class ICalUrlInput(BaseModel):
    url: str



class SavedSearchFilters(BaseModel):
    rental_type: Optional[str] = None
    area: Optional[str] = None
    bedrooms_min: Optional[float] = None
    max_price: Optional[float] = None
    start_date: Optional[str] = None  # YYYY-MM-DD
    end_date: Optional[str] = None    # YYYY-MM-DD


class SavedSearchCreate(BaseModel):
    name: Optional[str] = None  # user-facing label; we'll derive one if absent
    filters: SavedSearchFilters
    date_fuzziness_days: Optional[int] = 30
