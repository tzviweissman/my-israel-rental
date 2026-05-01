"""Pydantic models for API requests/responses"""
from typing import List

from pydantic import BaseModel, EmailStr


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str
    phone: str | None = None


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
    description: str | None = None
    rental_type: str
    property_type: str
    bedrooms: float | None = None
    bathrooms: float | None = None
    area: str
    address: str | None = None
    square_meters: float | None = None
    porch_square_meters: float | None = None
    floor: float | None = None
    has_elevator: bool | None = False
    is_shabbat_elevator: bool | None = False
    is_tama: bool | None = False
    has_agent_fee: bool | None = False
    agent_fee_price: float | None = None
    agent_fee_currency: str | None = 'ILS'
    porches: int | None = 0
    sukkah_compatible: bool | None = False
    condition: str | None = 'good'
    furniture_option: str | None = 'no_furniture'
    amenities: List[str] | None = []
    monthly_price: float | None = None
    nightly_price: float | None = None
    currency: str | None = 'ILS'
    images: List[str] | None = []
    videos: List[str] | None = []
    ical_url: str | None = None
    cancellation_policy: str | None = 'flexible'
    custom_cancellation_policy: str | None = None
    available_from: str | None = None
    starting_date: str | None = None
    minimum_booking_days: int | None = None
    checkin_time: str | None = None
    checkout_time: str | None = None
    # Holiday categories — only meaningful when rental_type='vacation'.
    # Empty list means "regular vacation". Allowed values: 'sukkot', 'pesach'.
    holiday_tags: List[str] | None = []


class BookingCreate(BaseModel):
    property_id: str
    start_date: str
    end_date: str
    message: str | None = None
    contract_signed: bool | None = False
    signature_data: str | None = None
    # When set, the booking is for a sublease — the sublessor (not the
    # property owner) receives all notifications, and the sublease price is
    # used for total-cost calculation.
    sublease_id: str | None = None


class ChatMessage(BaseModel):
    property_id: str
    message: str
    receiver_id: str


class TypingPing(BaseModel):
    property_id: str
    with_user: str


class NotificationPreferences(BaseModel):
    rental_type: str | None = None
    min_bedrooms: int | None = None
    max_price: float | None = None
    area: str | None = None


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
    currency: str | None = 'ILS'
    bedrooms_available: int | None = None
    notes: str | None = None
    # Sublease categorisation. Empty list = treat as regular short-term sublease.
    # Allowed values: 'sukkot', 'pesach'. (Short-term is the implicit default.)
    holiday_tags: List[str] | None = []


class DocumentServiceRequest(BaseModel):
    service_type: str
    property_address: str
    tenant_name: str
    tenant_id: str
    additional_info: str | None = None


class SiteSettings(BaseModel):
    whatsapp_number: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    featured_property_ids: List[str] | None = []


class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    phone: str | None = None
    message: str


class ICalUrlInput(BaseModel):
    url: str



class SavedSearchFilters(BaseModel):
    rental_type: str | None = None
    area: str | None = None
    bedrooms_min: float | None = None
    max_price: float | None = None
    start_date: str | None = None  # YYYY-MM-DD
    end_date: str | None = None    # YYYY-MM-DD


class SavedSearchCreate(BaseModel):
    name: str | None = None  # user-facing label; we'll derive one if absent
    filters: SavedSearchFilters
    date_fuzziness_days: int | None = 30
