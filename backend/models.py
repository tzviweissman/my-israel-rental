"""Pydantic models for API requests/responses"""
from typing import List

from pydantic import BaseModel, EmailStr, field_validator

from utils.area_normalize import normalize_area


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


class LanguagePreference(BaseModel):
    language: str  # 'en' or 'he'


class WhatsAppNumberUpdate(BaseModel):
    """Payload for PUT /auth/whatsapp — empty string clears the number."""
    whatsapp_number: str


class RoleUpdate(BaseModel):
    """Payload for PUT /auth/role — self-service role switch for users
    who picked the wrong role at signup (e.g. accidentally chose Renter
    when they meant Lister/Owner). Only the renter→owner upgrade path
    is allowed via this endpoint; downgrades or admin promotion would
    orphan listings / leak permissions.
    """
    role: str  # 'owner' (only valid value for now)


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
    has_cleaning_fee: bool | None = False
    cleaning_fee_price: float | None = None
    cleaning_fee_currency: str | None = 'ILS'
    # Vacation-rentals only — optional cap on how many guests can stay.
    # Hidden from the form for non-vacation rental types.
    max_guests: int | None = None
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
    # Optional cap on availability — for owners renting out their place for
    # just a window of time (e.g. one week while they're abroad). When set,
    # the booking flow rejects any night past this date. Leave None for
    # open-ended availability.
    available_to: str | None = None
    starting_date: str | None = None
    minimum_booking_days: int | None = None
    checkin_time: str | None = None
    checkout_time: str | None = None
    # Holiday categories — only meaningful when rental_type='vacation'.
    # Empty list means "regular vacation". Allowed values: 'sukkot', 'pesach'.
    holiday_tags: List[str] | None = []
    # Optional lump-sum price for the entire holiday window (e.g. all of
    # Sukkot or Pesach). When set, the listing page surfaces it as an
    # alternative to the nightly rate so renters can book the whole holiday
    # in one click. Only meaningful when at least one `holiday_tags` value
    # is set.
    holiday_lump_price: float | None = None
    holiday_lump_currency: str | None = 'ILS'
    # When True, `holiday_lump_price` is interpreted as a PER-NIGHT rate
    # during the holiday window (instead of the default "whole-holiday
    # total"). Lets owners set a holiday-night premium without committing
    # to a fixed lump (useful when stay length varies). UI uses this to
    # render the right suffix ("/night" vs "/Sukkot").
    holiday_lump_is_per_night: bool | None = False
    # Multi-list — when set, the same physical apartment appears in more
    # than one Stays category. Primary `rental_type` is always included
    # implicitly; e.g. `rental_type='short-term'` + `rental_types=['short-term','vacation']`
    # makes the listing surface in BOTH the short-term feed AND vacation
    # (typically to capture Sukkot/Pesach travelers). If missing/empty on
    # read, callers should treat it as `[rental_type]`.
    rental_types: List[str] | None = None
    # Optional holiday window — when set, any booking whose date range
    # overlaps this window under the primary (monthly/nightly) rate is
    # rejected, and renters are steered to the `holiday_lump_price`. ISO
    # YYYY-MM-DD. Both inclusive.
    holiday_start_date: str | None = None
    holiday_end_date: str | None = None

    # Canonicalise `area` at the model boundary — the one choke point every
    # write path funnels through: POST /properties (create), PUT
    # /properties/{id} (update), and the bulk-upload commit in
    # routes/bulk_upload.py, which builds each row as PropertyCreate(**row)
    # before inserting. Putting it here rather than in each route means a
    # future write path cannot forget it.
    #
    # Unrecognised areas pass through untouched — see utils/area_normalize.
    # Existing documents are NOT rewritten; this only affects new writes.
    @field_validator("area")
    @classmethod
    def _canonicalize_area(cls, v: str) -> str:
        return normalize_area(v)


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
    # Optional Cloudinary URL(s) attached to this message. When set, the
    # `message` text may be empty (image-only messages are allowed).
    image_url: str | None = None
    # Optional Cloudinary video URL. Same rules as image_url — when set,
    # the message text may be empty. Listers attach short property walk-
    # throughs / inspection clips this way.
    video_url: str | None = None


class EditMessage(BaseModel):
    message: str


class TypingPing(BaseModel):
    property_id: str
    with_user: str


class TranslateMessageRequest(BaseModel):
    target_lang: str  # 'en' or 'he'


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
    # When the renter booked through MyIsraelRental, property_id references
    # the in-DB property and we copy its title/area/images automatically.
    # When the renter booked elsewhere, property_id is omitted and the user
    # supplies title/area/images themselves (manual sublease).
    property_id: str | None = None
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
    # Manual-sublease fields (only used when property_id is None)
    title: str | None = None
    description: str | None = None
    area: str | None = None
    address: str | None = None
    bedrooms: int | None = None
    bathrooms: int | None = None
    property_type: str | None = None
    amenities: List[str] | None = []
    images: List[str] | None = []


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
    max_price_currency: str | None = None  # 'ILS' or 'USD'
    start_date: str | None = None  # YYYY-MM-DD
    end_date: str | None = None    # YYYY-MM-DD


class SavedSearchCreate(BaseModel):
    name: str | None = None  # user-facing label; we'll derive one if absent
    filters: SavedSearchFilters
    date_fuzziness_days: int | None = 30
